import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from '../src/features/auth/auth-schema';

describe('authentication input schemas', () => {
  it('accepts a MUST university email for student registration', () => {
    const result = signupSchema.safeParse({ fullName: 'Amina N.', email: 'amina@must.ac.ug', password: 'secure-password-123', role: 'student' });
    expect(result.success).toBe(true);
  });

  it('rejects non-university email addresses', () => {
    const result = signupSchema.safeParse({ fullName: 'Amina N.', email: 'amina@gmail.com', password: 'secure-password-123', role: 'student' });
    expect(result.success).toBe(false);
  });

  it('rejects admin self-registration', () => {
    const result = signupSchema.safeParse({ fullName: 'Admin User', email: 'admin@must.ac.ug', password: 'secure-password-123', role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('validates login credentials', () => {
    expect(loginSchema.safeParse({ email: 'student@must.ac.ug', password: 'pass' }).success).toBe(true);
  });
});
