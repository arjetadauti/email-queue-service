'use strict';

/** Allowed job statuses — mirrors the CHECK constraint in the migration. */
const EmailJobStatus = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
});

/**
 * Entity: maps a raw `email_jobs` row (snake_case) to a domain object (camelCase).
 * @param {object} row
 */
function emailJobFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    toAddress: row.to_address,
    subject: row.subject,
    html: row.html,
    text: row.text,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    providerMessageId: row.provider_message_id,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** DTO returned by the API — never exposes internal locking fields. */
function toEmailJobDTO(job) {
  return {
    id: job.id,
    to: job.toAddress,
    subject: job.subject,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    lastError: job.lastError,
    providerMessageId: job.providerMessageId,
    nextAttemptAt: job.nextAttemptAt,
    sentAt: job.sentAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

module.exports = { EmailJobStatus, emailJobFromRow, toEmailJobDTO };
