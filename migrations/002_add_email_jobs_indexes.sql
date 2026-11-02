-- 002: indexes for the worker's polling query and for listing jobs

-- Worker: "pending jobs that are due, oldest first". Partial index stays small
-- because sent/failed jobs are excluded.
CREATE INDEX IF NOT EXISTS idx_email_jobs_due
    ON email_jobs (next_attempt_at)
    WHERE status = 'pending';

-- API: GET /emails?status=... ordered by newest
CREATE INDEX IF NOT EXISTS idx_email_jobs_status_created
    ON email_jobs (status, created_at DESC);
