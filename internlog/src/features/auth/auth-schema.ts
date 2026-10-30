import { z } from 'zod';

const allowedEmailDomains = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? 'must.ac.ug').split(',').map((domain: string) => domain.trim().toLowerCase()).filter(Boolean);

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.email('Enter a valid university email').refine((value) => allowedEmailDomains.includes(value.toLowerCase().split('@').at(-1) ?? ''), {
    message: `Use an approved university email domain: ${allowedEmailDomains.join(', ')}`,
  }),
  password: z.string().min(10, 'Use at least 10 characters').max(72),
  role: z.enum(['student', 'employer', 'workplace_supervisor', 'academic_supervisor']),
});

export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
