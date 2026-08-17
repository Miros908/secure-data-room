import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z
  .object({
    email: z.email(),
  })
  .strict();

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value', () => {
    expect(pipe.transform({ email: 'a@example.com' })).toEqual({
      email: 'a@example.com',
    });
  });

  it('rejects unknown fields on a strict schema', () => {
    try {
      pipe.transform({ email: 'a@example.com', extra: true });
      throw new Error('expected validation_error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string;
        issues: Array<{ path: string; message: string }>;
      };
      expect(body.message).toBe('validation_error');
      expect(body.issues.some((issue) => issue.message.length > 0)).toBe(true);
      expect(JSON.stringify(body)).toMatch(/extra/);
      expect(JSON.stringify(body)).not.toMatch(/stack/i);
    }
  });

  it('rejects an invalid email with a path', () => {
    try {
      pipe.transform({ email: 'not-an-email' });
      throw new Error('expected validation_error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        issues: Array<{ path: string }>;
      };
      expect(body.issues[0]?.path).toBe('email');
    }
  });
});
