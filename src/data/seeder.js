'use strict';

/**
 * Demo data. Recipients are Resend's test inboxes, so running the worker
 * afterwards is safe: nothing reaches a real person.
 *   delivered@resend.dev -> simulates a successful delivery
 *   bounced@resend.dev   -> simulates a bounce
 */
const db = require('./db');


const SEED_TAG = '[seed]';

const jobs = [
  // Waiting for the worker
  { to: 'delivered@resend.dev', subject: `${SEED_TAG} Welcome aboard`, text: 'Thanks for signing up!', status: 'pending', attempts: 0 },
  { to: 'delivered@resend.dev', subject: `${SEED_TAG} Your weekly digest`, html: '<h1>Weekly digest</h1><p>Here is what happened this week.</p>', status: 'pending', attempts: 0 },
  { to: 'bounced@resend.dev', subject: `${SEED_TAG} Password reset`, text: 'Click the link to reset your password.', status: 'pending', attempts: 0 },
  // Historical examples so GET /emails?status=... has something to show
  { to: 'delivered@resend.dev', subject: `${SEED_TAG} Order confirmation #1001`, text: 'Your order is confirmed.', status: 'sent', attempts: 1, providerMessageId: 'seed-demo-message-id' },
  { to: 'nobody@example.invalid', subject: `${SEED_TAG} Invoice reminder`, text: 'Your invoice is due.', status: 'failed', attempts: 4, lastError: 'Resend validation_error: Invalid `to` field (seeded example)' },
];

async function seed({ reset = false } = {}) {
  await db.withTransaction(async (client) => {
    if (reset) {
      await client.query('DELETE FROM email_jobs');
    } else {
      // Idempotent: replace previous seed rows only.
      await client.query("DELETE FROM email_jobs WHERE subject LIKE '[seed]%'");
    }

    for (const job of jobs) {
      await client.query(
        `INSERT INTO email_jobs
           (to_address, subject, html, text, status, attempts, max_attempts, last_error, provider_message_id, sent_at)
         VALUES ($1, $2, $3, $4, $5::varchar, $6, 4, $7, $8, CASE WHEN $5::varchar = 'sent' THEN now() END)`,
        [job.to, job.subject, job.html ?? null, job.text ?? null, job.status, job.attempts, job.lastError ?? null, job.providerMessageId ?? null],
      );
    }
  });
  return jobs.length;
}

module.exports = { seed };
