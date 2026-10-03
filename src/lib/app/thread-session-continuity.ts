type ThreadSubmitSessionResponse = {
  session_id?: string;
  job?: {
    job_id?: string;
    session_id?: string;
  };
};

export function resolveThreadSubmitSessionRedirect(
  requestedSessionId: string,
  response: ThreadSubmitSessionResponse,
  refreshAt = Date.now()
): string | null {
  const requested = requestedSessionId.trim();
  const responseSessionId = response.job?.session_id?.trim()
    || response.session_id?.trim()
    || requested;
  if (!responseSessionId || responseSessionId === requested) return null;

  const params = new URLSearchParams();
  const jobId = response.job?.job_id?.trim();
  if (jobId) params.set("job_id", jobId);
  params.set("refresh", String(refreshAt));

  return `/app/chat/${encodeURIComponent(responseSessionId)}?${params.toString()}`;
}
