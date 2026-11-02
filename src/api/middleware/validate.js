'use strict';

/**
 * Validates req[source] against a zod schema. On success the parsed value
 * (with defaults/coercion applied) is stored on req.validated[source].
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Request validation failed',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || source,
          message: issue.message,
        })),
      });
    }
    req.validated = { ...(req.validated || {}), [source]: result.data };
    return next();
  };
}

module.exports = { validate };
