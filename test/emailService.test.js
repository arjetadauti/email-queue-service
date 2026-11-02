'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmailService } = require('../src/services/emailService');
const { backoffDelayMs, canRetry } = require('../src/services/retryPolicy');
const { DomainValidationError, NotFoundError } = require('../src/models');

const silentLogger = { info() {}, warn() {}, error() {} };
const config = { worker: { maxRetries: 3, retryBaseDelayMs: 1000, batchSize: 10, lockTimeoutMs: 60000 } };

function fakeRepository() {
  const calls = [];
  const record = (name) => async (...args) => {
    calls.push({ name, args });
    return { id: args[0] };
  };
  return {
    calls,
    create: async (input) => ({ id: 'job-1', ...input, attempts: 0, status: 'pending' }),
    findById: async () => null,
    list: async () => [],
    claimDueJobs: async () => [],
    markSent: record('markSent'),
    scheduleRetry: record('scheduleRetry'),
    markFailed: record('markFailed'),
  };
}

const job = (attempts) => ({ id: 'job-1', toAddress: 'a@b.co', subject: 's', text: 't', attempts, maxAttempts: 4 });

test('retry policy: exponential backoff and 1 + 3 retries', () => {
  assert.equal(backoffDelayMs(1, 1000), 1000);
  assert.equal(backoffDelayMs(2, 1000), 2000);
  assert.equal(backoffDelayMs(3, 1000), 4000);
  assert.equal(canRetry(3, 4), true);
  assert.equal(canRetry(4, 4), false);
});

test('enqueueEmail stores a job with maxAttempts = 1 + maxRetries and does not send', async () => {
  let sent = false;
  const service = createEmailService({
    repository: fakeRepository(),
    provider: { sendEmail: async () => { sent = true; } },
    config,
    logger: silentLogger,
  });
  const created = await service.enqueueEmail({ to: 'a@b.co', subject: 'Hi', text: 'Hello' });
  assert.equal(created.maxAttempts, 4);
  assert.equal(sent, false);
});

test('enqueueEmail rejects an email with no body', async () => {
  const service = createEmailService({ repository: fakeRepository(), config, logger: silentLogger });
  await assert.rejects(service.enqueueEmail({ to: 'a@b.co', subject: 'Hi' }), DomainValidationError);
});

test('getJob throws NotFoundError for an unknown id', async () => {
  const service = createEmailService({ repository: fakeRepository(), config, logger: silentLogger });
  await assert.rejects(service.getJob('missing'), NotFoundError);
});

test('successful send marks the job sent with the provider message id', async () => {
  const repository = fakeRepository();
  const service = createEmailService({
    repository,
    provider: { sendEmail: async ({ idempotencyKey }) => ({ id: `msg-for-${idempotencyKey}` }) },
    config,
    logger: silentLogger,
  });
  await service.processJob(job(0));
  assert.deepEqual(repository.calls, [{ name: 'markSent', args: ['job-1', 'msg-for-email-job-job-1'] }]);
});

test('failed send schedules a retry with backoff while attempts remain', async () => {
  const repository = fakeRepository();
  const now = new Date('2026-01-01T00:00:00Z');
  const service = createEmailService({
    repository,
    provider: { sendEmail: async () => { throw new Error('boom'); } },
    config,
    logger: silentLogger,
    now: () => now,
  });
  await service.processJob(job(1)); // this is attempt 2 of 4
  const [call] = repository.calls;
  assert.equal(call.name, 'scheduleRetry');
  assert.equal(call.args[1], 'boom');
  assert.equal(call.args[2].getTime(), now.getTime() + 2000);
});

test('the 4th failed attempt (3rd retry) marks the job failed', async () => {
  const repository = fakeRepository();
  const service = createEmailService({
    repository,
    provider: { sendEmail: async () => { throw new Error('still down'); } },
    config,
    logger: silentLogger,
  });
  await service.processJob(job(3));
  assert.deepEqual(repository.calls, [{ name: 'markFailed', args: ['job-1', 'still down'] }]);
});
