'use strict';

const defaultConfig = require('../config');
const defaultRepository = require('../data/emailJobRepository');
const defaultProvider = require('./providers/resendProvider');
const { backoffDelayMs, canRetry } = require('./retryPolicy');
const { NotFoundError, DomainValidationError, EmailJobStatus } = require('../models');

/**
 * Business logic for the email queue. Dependencies are injectable so the
 * service can be unit-tested without a database or network.
 */
function createEmailService({
  repository = defaultRepository,
  provider = defaultProvider,
  config = defaultConfig,
  logger = console,
  now = () => new Date(),
} = {}) {
  const maxAttempts = 1 + config.worker.maxRetries;

  /** Enqueue only — never sends. The worker picks the job up asynchronously. */
  async function enqueueEmail({ to, subject, html, text }) {
    if (!html && !text) {
      throw new DomainValidationError('An email needs an html or text body');
    }
    return repository.create({ toAddress: to, subject, html, text, maxAttempts });
  }

  async function getJob(id) {
    const job = await repository.findById(id);
    if (!job) throw new NotFoundError(`Email job ${id} not found`);
    return job;
  }

  function listJobs({ status, limit = 20, offset = 0 } = {}) {
    if (status && !Object.values(EmailJobStatus).includes(status)) {
      throw new DomainValidationError(`Unknown status "${status}"`);
    }
    return repository.list({ status, limit, offset });
  }

  /** Sends one claimed job and records the outcome. Never throws. */
  async function processJob(job) {
    const attemptNumber = job.attempts + 1;
    try {
      const { id: providerMessageId } = await provider.sendEmail({
        to: job.toAddress,
        subject: job.subject,
        html: job.html,
        text: job.text,
        idempotencyKey: `email-job-${job.id}`,
      });
      logger.info(`[worker] job ${job.id} sent (attempt ${attemptNumber}/${job.maxAttempts})`);
      return repository.markSent(job.id, providerMessageId);
    } catch (err) {
      const message = String(err && err.message ? err.message : err).slice(0, 1000);

      if (canRetry(attemptNumber, job.maxAttempts)) {
        const delay = backoffDelayMs(attemptNumber, config.worker.retryBaseDelayMs);
        const nextAttemptAt = new Date(now().getTime() + delay);
        logger.warn(
          `[worker] job ${job.id} failed (attempt ${attemptNumber}/${job.maxAttempts}): ${message} — retrying in ${delay}ms`,
        );
        return repository.scheduleRetry(job.id, message, nextAttemptAt);
      }

      logger.error(`[worker] job ${job.id} permanently failed after ${attemptNumber} attempts: ${message}`);
      return repository.markFailed(job.id, message);
    }
  }

  /** Claims a batch of due jobs and processes them. Returns how many were handled. */
  async function processDueJobs() {
    const jobs = await repository.claimDueJobs(config.worker.batchSize, config.worker.lockTimeoutMs);
    for (const job of jobs) {
      // Sequential on purpose: keeps us well under Resend's rate limit.
      await processJob(job);
    }
    return jobs.length;
  }

  return { enqueueEmail, getJob, listJobs, processJob, processDueJobs };
}

module.exports = { createEmailService, emailService: createEmailService() };
