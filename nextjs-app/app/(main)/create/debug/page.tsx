"use client";

import { useState, useEffect } from "react";
import { listPendingJobsAction } from "@/actions/ai";
import { simulateWebhookAction } from "@/actions/ai/simulate-webhook";

export default function DebugPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const result = await listPendingJobsAction();
      if (result.isSuccess) {
        setJobs(result.data || []);
      } else {
        setError(result.message || "Failed to load jobs");
      }
    } catch (err) {
      setError("Error fetching jobs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const sendWebhook = async (jobId: string) => {
    try {
      const res = await simulateWebhookAction(jobId);
      if (!res.ok) {
        alert(`Error: ${res.message}`);
        return;
      }
      alert("Webhook sent successfully");
      await fetchJobs();
    } catch (err) {
      console.error("Error sending webhook:", err);
      alert(`Error sending webhook: ${err}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Pending Jobs Debug</h1>
      
      <button 
        onClick={fetchJobs}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Refresh
      </button>
      
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : jobs.length === 0 ? (
        <p>No pending jobs found</p>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="border p-4 rounded">
              <p><strong>Job ID:</strong> {job.id}</p>
              <p><strong>Status:</strong> {job.status}</p>
              <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
              <button
                onClick={() => sendWebhook(job.id)}
                className="bg-green-500 text-white px-4 py-2 rounded mt-2"
              >
                Send Completion Webhook
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
