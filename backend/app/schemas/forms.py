from pydantic import BaseModel


class ValidationIssueSchema(BaseModel):
    employee_id: str
    message: str


class ValidationResponse(BaseModel):
    valid: bool
    total_employees: int
    ready_count: int
    issues: list[ValidationIssueSchema]
    missing_sheets: list[str]
    missing_columns: dict[str, list[str]]


class JobResponse(BaseModel):
    id: int
    original_filename: str
    status: str
    total_employees: int
    generated_count: int
    skipped_count: int
    created_at: str

    model_config = {"from_attributes": True}


class GenerateResponse(BaseModel):
    job: JobResponse
    skipped: list[ValidationIssueSchema]
