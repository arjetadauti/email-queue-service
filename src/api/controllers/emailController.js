'use strict';

const { toEmailJobDTO } = require('../../models');

function createEmailController({ emailService }) {
  /** POST /emails — enqueue and return 202 Accepted with the job. */
  async function enqueue(req, res) {
    const job = await emailService.enqueueEmail(req.validated.body);
    res
      .status(202)
      .location(`/emails/${job.id}`)
      .json({ message: 'Email queued', job: toEmailJobDTO(job) });
  }

  /** GET /emails/:id */
  async function getById(req, res) {
    const job = await emailService.getJob(req.validated.params.id);
    res.json({ job: toEmailJobDTO(job) });
  }

  /** GET /emails?status=&limit=&offset= */
  async function list(req, res) {
    const { status, limit, offset } = req.validated.query;
    const jobs = await emailService.listJobs({ status, limit, offset });
    res.json({ jobs: jobs.map(toEmailJobDTO), limit, offset });
  }

  return { enqueue, getById, list };
}

module.exports = { createEmailController };
