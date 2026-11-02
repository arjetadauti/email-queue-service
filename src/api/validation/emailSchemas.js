'use strict';

const { z } = require('zod');

const enqueueEmailSchema = z
  .object({
    to: z.email({ message: 'to must be a valid email address' }),
    subject: z.string().trim().min(1, 'subject is required').max(998),
    html: z.string().min(1).max(500_000).optional(),
    text: z.string().min(1).max(500_000).optional(),
  })
  .strict()
  .refine((body) => body.html || body.text, { message: 'Provide html or text', path: ['html'] });

const jobIdParamsSchema = z.object({
  id: z.uuid({ message: 'id must be a UUID' }),
});

const listJobsQuerySchema = z.object({
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = { enqueueEmailSchema, jobIdParamsSchema, listJobsQuerySchema };
