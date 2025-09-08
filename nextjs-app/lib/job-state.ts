export type JobStatus = "pending" | "processing" | "completed" | "failed";

export function isTerminal(s: JobStatus): boolean {
  return s === "completed" || s === "failed";
}

export function isLegalTransition(prev: JobStatus, next: JobStatus): boolean {
  const allowed: Record<JobStatus, JobStatus[]> = {
    pending: ["processing", "completed", "failed"],
    processing: ["completed", "failed"],
    completed: [],
    failed: [],
  };
  return allowed[prev]?.includes(next) ?? false;
}

