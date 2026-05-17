# Start FastAPI backend (run from project root or scripts folder)
$BackendDir = Join-Path $PSScriptRoot "..\backend"
Set-Location $BackendDir

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created backend/.env from .env.example"
}

$env:PYTHONPATH = $BackendDir
Write-Host "Starting API at http://localhost:8000 (docs: http://localhost:8000/docs)"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
