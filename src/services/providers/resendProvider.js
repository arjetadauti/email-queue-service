'use strict';

const { Resend } = require('resend');
const config = require('../../config');

let client = null;
function getClient() {
  if (!config.resend.apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!client) client = new Resend(config.resend.apiKey);
  return client;
}

/**
 * Sends one email through Resend. Resolves with { id } or throws an Error.
 * The job id is used as the idempotency key, so a retry after a timeout
 * can never deliver the same email twice.
 */
async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const payload = { from: config.resend.from, to: [to], subject };
  if (html) payload.html = html;
  if (text) payload.text = text;

  const { data, error } = await getClient().emails.send(payload, { idempotencyKey });
  if (error) {
    const err = new Error(`Resend ${error.name || 'error'}: ${error.message}`);
    err.providerError = error;
    throw err;
  }
  return { id: data.id };
}

module.exports = { sendEmail };
