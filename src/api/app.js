'use strict';

const path = require('node:path');
const express = require('express');
const { createRoutes } = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { emailService: defaultEmailService } = require('../services/emailService');
const defaultHealthService = require('../services/healthService');

function createApp({
  emailService = defaultEmailService,
  healthService = defaultHealthService,
  getWorkerState,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  // Frontend: one static page (public/) that calls the API below.
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use(createRoutes({ emailService, healthService, getWorkerState }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
