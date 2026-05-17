# Form Automation System

Enterprise web application for HR/IT teams to bulk-generate **Device Issue & Return** Word forms from a structured Excel workbook. Non-technical users upload data, validate it in the browser, and download a ZIP of per-employee `.docx` files.

Built for **UTCL Internship** — automates what was previously a manual or CLI-only process (`script.py`).

---

## Features

- **User authentication** — register, login, JWT-protected API
- **Excel template download** — standard three-sheet format
- **Validation** — checks sheets, columns, and per-employee data completeness before generation
- **Bulk DOCX generation** — one Word document per employee with employee info, devices, issue details, terms, and signature blocks
- **ZIP download** — all forms packaged for a generation job
- **Job history** — recent runs with status, counts, and re-download

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 8 |
| **Routing** | React Router 7 |
| **Styling** | Tailwind CSS 4 |
| **UI** | Radix UI primitives, custom shadcn-style components |
| **Icons** | Lucide React |
| **HTTP client** | Axios |
| **Backend** | FastAPI, Uvicorn |
| **ORM** | SQLAlchemy 2 |
| **Database** | SQLite (`form_automation.db`) |
| **Auth** | JWT (python-jose), bcrypt password hashing |
| **Excel parsing** | Pandas, openpyxl |
| **Document generation** | python-docx |
| **Config** | pydantic-settings |

---

## How it works

```mermaid
flowchart LR
  A[Register / Login] --> B[Download Excel template]
  B --> C[Fill 3 sheets offline]
  C --> D[Upload Excel]
  D --> E[Validate optional]
  E --> F[Generate forms]
  F --> G[Download ZIP]
```

1. User signs up or logs in → account stored in `users` table.
2. User downloads `Form_Input_Template.xlsx` and fills data in Excel.
3. User uploads the file → **Validate** (optional) shows readiness per employee.
4. User clicks **Generate** → backend creates one `.docx` per valid employee, zips them, and records a job.
5. User downloads the ZIP from **Recent generations**.

---

## Project structure

```
Form-Automation-System/
├── backend/
│   ├── app/
│   │   ├── auth/           # JWT, password hashing, current user dependency
│   │   ├── models/         # SQLAlchemy: User, GenerationJob
│   │   ├── routers/        # /api/auth, /api/forms
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── services/       # form_engine.py — Excel validation & DOCX generation
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── generated/          # Output ZIPs and DOCX (per user/job, gitignored)
│   ├── uploads/            # Upload directory (created on startup)
│   ├── form_automation.db  # SQLite database (gitignored)
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/          # Login, Register, Dashboard
│       ├── context/        # AuthContext (JWT in localStorage)
│       ├── lib/api.ts      # API client
│       └── components/
├── scripts/
│   └── start-backend.ps1   # Quick start API on Windows
├── Form_Input_Template.xlsx
├── script.py               # Legacy CLI (optional)
└── README.md
```

---

## Database (what is stored)

**SQLite file:** `backend/form_automation.db`

Same database for login and form generation — only the table differs.

| Table | Purpose |
|-------|---------|
| `users` | Email, full name, **hashed** password, `created_at` |
| `generation_jobs` | Filename, status, employee counts, skip errors, path to ZIP |

**Not in the database:** Excel file contents, generated Word bytes (stored on disk under `backend/generated/{user_id}/{job_id}/`).

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (22 recommended)
- **npm**

---

## Quick start

### 1. Backend

```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env` uses SQLite:

```env
DATABASE_URL=sqlite:///./form_automation.db
```

From the **project root**:

```powershell
.\scripts\start-backend.ps1
```

Or manually from `backend/`:

```powershell
$env:PYTHONPATH = (Get-Location)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **API:** http://localhost:8000  
- **Swagger docs:** http://localhost:8000/docs  

Tables are created automatically on first startup.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

- **App:** http://localhost:5173  
- Vite proxies `/api` → `http://localhost:8000` (no `VITE_API_URL` needed in dev)

### 3. Use the app

1. Register an account  
2. Download the Excel template  
3. Fill all three sheets (matching **Employee ID** across sheets)  
4. Upload → **Validate** → **Generate forms**  
5. Download ZIP from job history  

---

## Excel format

Three required sheets (see `Form_Input_Template.xlsx`):

### Employee_Master

| Employee ID | Employee Name | Department | Designation | Contact No. | Email |
|-------------|---------------|------------|-------------|-------------|-------|

### Device_Details

| Employee ID | Device Type | Brand / Model | Serial No. | Condition | Remarks |
|-------------|-------------|---------------|------------|-----------|---------|

(Multiple device rows per employee are supported.)

### Issue_Details

| Employee ID | Issue Date | Expected Return Date | Purpose of Issue | Approved By |
|-------------|------------|----------------------|------------------|-------------|

**Rule:** One Word form is generated per employee in `Employee_Master` only if that **Employee ID** has at least one row in both `Device_Details` and `Issue_Details`.

---

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Login (returns JWT) |
| `GET` | `/api/auth/me` | Yes | Current user profile |
| `GET` | `/api/forms/template` | Yes | Download Excel template |
| `POST` | `/api/forms/validate` | Yes | Validate uploaded Excel |
| `POST` | `/api/forms/generate` | Yes | Generate DOCX + ZIP, create job |
| `GET` | `/api/forms/jobs` | Yes | List recent jobs (max 50) |
| `GET` | `/api/forms/jobs/{id}/download` | Yes | Download job ZIP |
| `GET` | `/api/health` | No | Health check |

Authenticated requests: `Authorization: Bearer <access_token>`

---

## Viewing the SQLite database

The DB is binary — do not open it as plain text in VS Code.

**Python one-liner** (from `backend/`):

```powershell
python -c "import sqlite3; c=sqlite3.connect('form_automation.db'); print(c.execute('SELECT id, email, full_name FROM users').fetchall())"
```

**sqlite-utils** (optional):

```powershell
pip install sqlite-utils
sqlite-utils tables form_automation.db
sqlite-utils query form_automation.db "SELECT * FROM generation_jobs"
```

**GUI:** [DB Browser for SQLite](https://sqlitebrowser.org/) or VS Code extension **SQLite Viewer**.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./form_automation.db` |
| `SECRET_KEY` | JWT signing secret | Change in production |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `1440` (24h) |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:5173` |
| `COMPANY_NAME` | Header on generated forms | `ABC` |
| `UPLOAD_DIR` | Upload folder | `uploads` |
| `OUTPUT_DIR` | Generated files folder | `generated` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL; leave empty in dev to use Vite proxy |

---

## Production notes

- Set a strong random `SECRET_KEY` (e.g. `openssl rand -hex 32`)
- Use HTTPS and restrict `CORS_ORIGINS` to your frontend domain
- Back up `form_automation.db` and `backend/generated/`
- Do not commit `.env`, `form_automation.db`, or generated output

---

## License

See [LICENSE](LICENSE) in this repository.
