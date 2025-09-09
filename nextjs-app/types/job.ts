/**
 * @file types/job.ts
 * @description
 * Shared type definitions for job data structure used across components
 */

export interface JobData {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  resultPayload?: {
    cards?: Array<{
      front: string;
      back: string;
      type?: "qa" | "cloze";
    }>;
  };
  errorMessage?: string;
}