import type { Analysis, CandidateProfile, JobDescription } from "../../../shared/schemas";

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function parseResume(file: File): Promise<CandidateProfile> {
  const form = new FormData();
  form.append("file", file);
  return json(await fetch("/api/resume/parse", { method: "POST", body: form }));
}

export async function parseJob(input: { text?: string; file?: File }): Promise<JobDescription> {
  if (input.file) {
    const form = new FormData();
    form.append("file", input.file);
    if (input.text) form.append("text", input.text);
    return json(await fetch("/api/job/parse", { method: "POST", body: form }));
  }
  return json(await fetch("/api/job/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.text })
  }));
}

export async function runAnalysis(candidate: CandidateProfile, job: JobDescription): Promise<Analysis> {
  return json(await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate, job })
  }));
}
