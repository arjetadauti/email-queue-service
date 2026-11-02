'use strict';

const { NotFoundError, DomainValidationError } = require('../../models');

function notFound(req, res) {
  res.status(404).json({ error: 'NotFound', message: `Route ${req.method} ${req.path} not found` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: 'NotFound', message: err.message });
  }
  if (err instanceof DomainValidationError) {
    return res.status(400).json({ error: 'ValidationError', message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BadRequest', message: 'Malformed JSON body' });
  }
  console.error('[api] unhandled error:', err);
  return res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
