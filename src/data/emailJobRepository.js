'use strict';

const db = require('./db');
const { EmailJobStatus, emailJobFromRow } = require('../models');

/**
 * All SQL for the email_jobs table lives here. Callers get domain objects back.
 */

async function create({ toAddress, subject, html, text, maxAttempts }) {
  const { rows } = await db.query(
    `INSERT INTO email_jobs (to_address, subject, html, text, max_attempts)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [toAddress, subject, html ?? null, text ?? null, maxAttempts],
  );
  return emailJobFromRow(rows[0]);
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM email_jobs WHERE id = $1', [id]);
  return emailJobFromRow(rows[0]);
}

async function list({ status, limit, offset }) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT * FROM email_jobs ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(emailJobFromRow);
}

/**
 * Atomically claims up to `limit` due pending jobs for this worker.
 * FOR UPDATE SKIP LOCKED lets several workers run safely in parallel;
 * `locked_until` acts as a lease so a crashed worker's jobs are picked up again.
 */
async function claimDueJobs(limit, lockTimeoutMs) {
  const { rows } = await db.query(
    `UPDATE email_jobs
        SET locked_until = now() + ($2::int * interval '1 millisecond'),
            updated_at   = now()
      WHERE id IN (
            SELECT id FROM email_jobs
             WHERE status = $3
               AND next_attempt_at <= now()
               AND (locked_until IS NULL OR locked_until < now())
             ORDER BY next_attempt_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED)
      RETURNING *`,
    [limit, lockTimeoutMs, EmailJobStatus.PENDING],
  );
  return rows.map(emailJobFromRow);
}

async function markSent(id, providerMessageId) {
  const { rows } = await db.query(
    `UPDATE email_jobs
        SET status = $2, attempts = attempts + 1, provider_message_id = $3,
            last_error = NULL, sent_at = now(), locked_until = NULL, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, EmailJobStatus.SENT, providerMessageId],
  );
  return emailJobFromRow(rows[0]);
}

/** Records a failed attempt and schedules the next retry (job stays pending). */
async function scheduleRetry(id, errorMessage, nextAttemptAt) {
  const { rows } = await db.query(
    `UPDATE email_jobs
        SET attempts = attempts + 1, last_error = $2, next_attempt_at = $3,
            locked_until = NULL, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, errorMessage, nextAttemptAt],
  );
  return emailJobFromRow(rows[0]);
}

/** Records the final failed attempt and marks the job permanently failed. */
async function markFailed(id, errorMessage) {
  const { rows } = await db.query(
    `UPDATE email_jobs
        SET status = $2, attempts = attempts + 1, last_error = $3,
            locked_until = NULL, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, EmailJobStatus.FAILED, errorMessage],
  );
  return emailJobFromRow(rows[0]);
}

async function countByStatus() {
  const { rows } = await db.query('SELECT status, COUNT(*)::int AS count FROM email_jobs GROUP BY status');
  const counts = { pending: 0, sent: 0, failed: 0 };
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

module.exports = { create, findById, list, claimDueJobs, markSent, scheduleRetry, markFailed, countByStatus };
