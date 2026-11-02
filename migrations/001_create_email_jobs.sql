-- 001: email job queue table
-- gen_random_uuid() is built into PostgreSQL 13+.

CREATE TABLE IF NOT EXISTS email_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_address          VARCHAR(320)  NOT NULL,
    subject             VARCHAR(998)  NOT NULL,
    html                TEXT,
    text                TEXT,
    status              VARCHAR(16)   NOT NULL DEFAULT 'pending',
    attempts            INTEGER       NOT NULL DEFAULT 0,
    max_attempts        INTEGER       NOT NULL DEFAULT 4,
    last_error          TEXT,
    provider_message_id VARCHAR(255),
    next_attempt_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    locked_until        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT email_jobs_status_check   CHECK (status IN ('pending', 'sent', 'failed')),
    CONSTRAINT email_jobs_body_check     CHECK (html IS NOT NULL OR text IS NOT NULL),
    CONSTRAINT email_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts >= 1)
);
