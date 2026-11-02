'use strict';

const config = require('../config');
const { emailService: defaultEmailService } = require('../services/emailService');

/**
 * Background loop that drains the email queue. It only talks to the service
 * layer — it never touches SQL or Resend directly.
 */
function createEmailWorker({
  emailService = defaultEmailService,
  pollIntervalMs = config.worker.pollIntervalMs,
  heartbeatUrl = config.worker.heartbeatUrl,
} = {}) {
  const state = { running: false, lastRunAt: null, lastProcessed: 0, lastError: null };
  let lastHeartbeatAt = 0;

  /** Tells the uptime monitor the worker loop is alive. Failures are logged, never fatal. */
  function sendHeartbeat() {
    if (!heartbeatUrl || Date.now() - lastHeartbeatAt < 60_000) return;
    lastHeartbeatAt = Date.now();
    fetch(heartbeatUrl, { signal: AbortSignal.timeout(5000) }).catch((err) => {
      console.warn('[worker] heartbeat failed:', err.message);
    });
  }
  let timer = null;
  let stopping = false;
  let currentTick = Promise.resolve();

  async function tick() {
    try {
      let processed;
      // Keep draining while there is work; then wait for the next poll.
      do {
        processed = await emailService.processDueJobs();
        state.lastProcessed = processed;
      } while (processed > 0 && !stopping);
      state.lastError = null;
      sendHeartbeat();
    } catch (err) {
      state.lastError = err.message;
      console.error('[worker] poll failed:', err.message);
    } finally {
      state.lastRunAt = new Date().toISOString();
      if (!stopping) timer = setTimeout(run, pollIntervalMs);
    }
  }

  function run() {
    currentTick = tick();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    stopping = false;
    console.log(`[worker] started, polling every ${pollIntervalMs}ms`);
    run();
  }

  async function stop() {
    stopping = true;
    if (timer) clearTimeout(timer);
    await currentTick;
    state.running = false;
    console.log('[worker] stopped');
  }

  return { start, stop, getState: () => ({ ...state }) };
}

module.exports = { createEmailWorker };
