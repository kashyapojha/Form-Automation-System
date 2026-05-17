import axios from "axios"

const API_BASE = import.meta.env.VITE_API_URL || ""

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ""
    const isAuthRequest = url.includes("/api/auth/login") || url.includes("/api/auth/register")
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem("access_token")
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Cannot reach the server. Start the backend on port 8000 (see README)."
    }
    const detail = error.response.data?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ") || fallback
    }
  }
  return fallback
}

export interface User {
  id: number
  email: string
  full_name: string
}

export interface ValidationIssue {
  employee_id: string
  message: string
}

export interface ValidationResponse {
  valid: boolean
  total_employees: number
  ready_count: number
  issues: ValidationIssue[]
  missing_sheets: string[]
  missing_columns: Record<string, string[]>
}

export interface Job {
  id: number
  original_filename: string
  status: string
  total_employees: number
  generated_count: number
  skipped_count: number
  created_at: string
}

export interface GenerateResponse {
  job: Job
  skipped: ValidationIssue[]
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams()
  form.append("username", email)
  form.append("password", password)
  const { data } = await api.post<{ access_token: string }>("/api/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })
  return data
}

export async function register(email: string, fullName: string, password: string) {
  const { data } = await api.post<User>("/api/auth/register", {
    email,
    full_name: fullName,
    password,
  })
  return data
}

export async function fetchMe() {
  const { data } = await api.get<User>("/api/auth/me")
  return data
}

export async function validateExcel(file: File) {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post<ValidationResponse>("/api/forms/validate", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export async function generateForms(file: File) {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post<GenerateResponse>("/api/forms/generate", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export async function fetchJobs() {
  const { data } = await api.get<Job[]>("/api/forms/jobs")
  return data
}

export function downloadJobZip(jobId: number) {
  const token = localStorage.getItem("access_token")
  const url = `${API_BASE}/api/forms/jobs/${jobId}/download`
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", `forms_job_${jobId}.zip`)
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl
      link.click()
      URL.revokeObjectURL(objectUrl)
    })
}

export function downloadTemplate() {
  const token = localStorage.getItem("access_token")
  const url = `${API_BASE}/api/forms/template`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = "Form_Input_Template.xlsx"
      link.click()
    })
}
