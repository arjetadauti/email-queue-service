'use strict';

/**
 * Exponential backoff: base, 2x base, 4x base ... capped at 1 hour.
 * @param {number} failedAttempts number of attempts that have failed so far (>= 1)
 * @param {number} baseDelayMs
 */
function backoffDelayMs(failedAttempts, baseDelayMs) {
  const delay = baseDelayMs * 2 ** Math.max(0, failedAttempts - 1);
  return Math.min(delay, 60 * 60 * 1000);
}

/** True when the job may try again after `attemptsMade` attempts. */
function canRetry(attemptsMade, maxAttempts) {
  return attemptsMade < maxAttempts;
}

module.exports = { backoffDelayMs, canRetry };
