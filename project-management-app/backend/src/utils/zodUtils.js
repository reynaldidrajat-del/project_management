const { ZodError } = require('zod');

const formatZodError = (error) => {
  if (!(error instanceof ZodError)) {
    return error?.message || 'Payload tidak valid.';
  }

  return error.issues
    .map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join(' ');
};

const parseSchema = (schema, value) => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
};

module.exports = {
  formatZodError,
  parseSchema,
};
