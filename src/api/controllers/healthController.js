'use strict';

function createHealthController({ healthService, getWorkerState }) {
  /** GET /health — 200 when the database answers, 503 otherwise. */
  async function check(req, res) {
    const { healthy, report } = await healthService.getHealth({
      workerState: getWorkerState ? getWorkerState() : undefined,
    });
    res.set('Cache-Control', 'no-store');
    res.status(healthy ? 200 : 503).json(report);
  }

  return { check };
}

module.exports = { createHealthController };
