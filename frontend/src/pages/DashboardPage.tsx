import { useCallback, useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Upload,
  AlertTriangle,
  History,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import {
  downloadJobZip,
  downloadTemplate,
  fetchJobs,
  generateForms,
  validateExcel,
  type Job,
  type ValidationResponse,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"

export function DashboardPage() {
  const { user, logout } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState<"validate" | "generate" | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs()
      setJobs(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  function onFileChange(selected: File | null) {
    setFile(selected)
    setValidation(null)
    setMessage("")
    setError("")
  }

  async function handleValidate() {
    if (!file) return
    setLoading("validate")
    setError("")
    try {
      const result = await validateExcel(file)
      setValidation(result)
      setMessage(
        result.valid
          ? `Ready: ${result.ready_count} of ${result.total_employees} employees can generate forms.`
          : `Found issues. ${result.ready_count} of ${result.total_employees} employees are ready.`
      )
    } catch {
      setError("Validation failed. Check your Excel file format.")
    } finally {
      setLoading(null)
    }
  }

  async function handleGenerate() {
    if (!file) return
    setLoading("generate")
    setError("")
    setMessage("")
    try {
      const result = await generateForms(file)
      setMessage(
        `Generated ${result.job.generated_count} form(s).` +
          (result.skipped.length ? ` Skipped ${result.skipped.length} employee(s).` : "")
      )
      setValidation(null)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
      await loadJobs()
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setError(typeof detail === "string" ? detail : "Generation failed.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Form Automation</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user?.full_name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Upload Excel
              </CardTitle>
              <CardDescription>
                Use the template with Employee_Master, Device_Details, and Issue_Details sheets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Excel template
              </Button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />

              {file && (
                <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={!file || loading !== null}
                  onClick={handleValidate}
                >
                  {loading === "validate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Validate
                </Button>
                <Button
                  className="flex-1"
                  disabled={!file || loading !== null}
                  onClick={handleGenerate}
                >
                  {loading === "generate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Generate forms
                </Button>
              </div>

              {message && <Alert variant="success">{message}</Alert>}
              {error && <Alert variant="destructive">{error}</Alert>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                Validation results
              </CardTitle>
              <CardDescription>Review before generating Word documents.</CardDescription>
            </CardHeader>
            <CardContent>
              {!validation ? (
                <p className="text-sm text-muted-foreground">
                  Upload a file and click Validate to see employee readiness.
                </p>
              ) : (
                <div className="space-y-3 text-sm">
                  <p>
                    <strong>{validation.ready_count}</strong> / {validation.total_employees} employees ready
                  </p>
                  {validation.missing_sheets.length > 0 && (
                    <p className="text-destructive">Missing sheets: {validation.missing_sheets.join(", ")}</p>
                  )}
                  {validation.issues.length > 0 && (
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
                      {validation.issues.map((issue) => (
                        <li key={issue.employee_id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{issue.employee_id}</span>: {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {validation.valid && validation.issues.length === 0 && (
                    <p className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> All employees are ready.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Recent generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-4">File</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Generated</th>
                      <th className="py-2 pr-4">Skipped</th>
                      <th className="py-2">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b">
                        <td className="py-3 pr-4">{job.original_filename}</td>
                        <td className="py-3 pr-4 capitalize">{job.status}</td>
                        <td className="py-3 pr-4">{job.generated_count}</td>
                        <td className="py-3 pr-4">{job.skipped_count}</td>
                        <td className="py-3">
                          {job.status === "completed" ? (
                            <Button size="sm" variant="outline" onClick={() => downloadJobZip(job.id)}>
                              <Download className="mr-1 h-3 w-3" />
                              ZIP
                            </Button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

