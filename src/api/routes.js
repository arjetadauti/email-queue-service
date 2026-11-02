'use strict';

const { Router } = require('express');
const { validate } = require('./middleware/validate');
const { enqueueEmailSchema, jobIdParamsSchema, listJobsQuerySchema } = require('./validation/emailSchemas');
const { createEmailController } = require('./controllers/emailController');
const { createHealthController } = require('./controllers/healthController');

function createRoutes({ emailService, healthService, getWorkerState }) {
  const router = Router();
  const emails = createEmailController({ emailService });
  const health = createHealthController({ healthService, getWorkerState });

  router.get('/health', health.check);

  router.post('/emails', validate(enqueueEmailSchema, 'body'), emails.enqueue);
  router.get('/emails', validate(listJobsQuerySchema, 'query'), emails.list);
  router.get('/emails/:id', validate(jobIdParamsSchema, 'params'), emails.getById);

  return router;
}

module.exports = { createRoutes };
