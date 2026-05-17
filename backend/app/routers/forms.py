import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models import GenerationJob, User
from app.schemas.forms import (
    GenerateResponse,
    JobResponse,
    ValidationIssueSchema,
    ValidationResponse,
)
from app.services.form_engine import create_zip_archive, generate_forms, validate_excel

router = APIRouter(prefix="/api/forms", tags=["forms"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}


async def _read_upload(file: UploadFile) -> bytes:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are allowed")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    return content


@router.get("/template")
def download_template():
    candidates = [
        Path(__file__).resolve().parents[3] / "Form_Input_Template.xlsx",
        Path(__file__).resolve().parents[2] / "Form_Input_Template.xlsx",
    ]
    template_path = next((p for p in candidates if p.exists()), None)
    if not template_path:
        raise HTTPException(status_code=404, detail="Template file not found")
    return FileResponse(
        path=template_path,
        filename="Form_Input_Template.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/validate", response_model=ValidationResponse)
async def validate_form_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    content = await _read_upload(file)
    try:
        result = validate_excel(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {exc}") from exc

    return ValidationResponse(
        valid=result.valid,
        total_employees=result.total_employees,
        ready_count=result.ready_count,
        issues=[ValidationIssueSchema(employee_id=i.employee_id, message=i.message) for i in result.issues],
        missing_sheets=result.missing_sheets,
        missing_columns=result.missing_columns,
    )


@router.post("/generate", response_model=GenerateResponse)
async def generate_form_files(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await _read_upload(file)
    job = GenerationJob(
        user_id=current_user.id,
        original_filename=file.filename or "upload.xlsx",
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        validation = validate_excel(content)
        result = generate_forms(content, company_name=settings.COMPANY_NAME)

        output_dir = Path(settings.OUTPUT_DIR) / str(current_user.id) / str(job.id)
        output_dir.mkdir(parents=True, exist_ok=True)

        if not result.generated:
            job.status = "failed"
            job.total_employees = result.total_employees
            job.skipped_count = len(result.skipped)
            job.validation_errors = json.dumps(
                [{"employee_id": s.employee_id, "message": s.message} for s in result.skipped]
            )
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="No forms could be generated. Fix Excel data and try again.",
            )

        zip_bytes = create_zip_archive(result.generated)
        zip_path = output_dir / "forms.zip"
        zip_path.write_bytes(zip_bytes)

        for filename, data in result.generated:
            (output_dir / filename).write_bytes(data)

        job.status = "completed"
        job.total_employees = result.total_employees
        job.generated_count = len(result.generated)
        job.skipped_count = len(result.skipped)
        job.zip_path = str(zip_path)
        if result.skipped:
            job.validation_errors = json.dumps(
                [{"employee_id": s.employee_id, "message": s.message} for s in result.skipped]
            )
        db.commit()
        db.refresh(job)

        return GenerateResponse(
            job=JobResponse(
                id=job.id,
                original_filename=job.original_filename,
                status=job.status,
                total_employees=job.total_employees,
                generated_count=job.generated_count,
                skipped_count=job.skipped_count,
                created_at=job.created_at.isoformat() if job.created_at else "",
            ),
            skipped=[
                ValidationIssueSchema(employee_id=s.employee_id, message=s.message)
                for s in result.skipped
            ],
        )
    except HTTPException:
        raise
    except Exception as exc:
        job.status = "failed"
        job.validation_errors = str(exc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = (
        db.query(GenerationJob)
        .filter(GenerationJob.user_id == current_user.id)
        .order_by(GenerationJob.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        JobResponse(
            id=j.id,
            original_filename=j.original_filename,
            status=j.status,
            total_employees=j.total_employees,
            generated_count=j.generated_count,
            skipped_count=j.skipped_count,
            created_at=j.created_at.isoformat() if j.created_at else "",
        )
        for j in jobs
    ]


@router.get("/jobs/{job_id}/download")
def download_job_zip(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = (
        db.query(GenerationJob)
        .filter(GenerationJob.id == job_id, GenerationJob.user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed" or not job.zip_path:
        raise HTTPException(status_code=400, detail="Job has no downloadable output")
    zip_path = Path(job.zip_path)
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP file missing on server")
    return FileResponse(
        path=zip_path,
        filename=f"forms_job_{job_id}.zip",
        media_type="application/zip",
    )
