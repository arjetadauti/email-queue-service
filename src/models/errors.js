'use strict';

/**
 * Domain errors. Services throw these; only the api layer translates them
 * into HTTP status codes.
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class DomainValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

module.exports = { NotFoundError, DomainValidationError };
