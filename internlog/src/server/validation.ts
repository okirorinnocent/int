import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '../features/auth/auth-schema';
import { profileSchema, studentProfileSchema, type ProfileInput, type StudentProfileInput } from '../features/profiles/profile-schema';

/** Re-validate untrusted request payloads at the server boundary before any database mutation. */
export function validateSignupPayload(input: unknown): SignupInput {
  return signupSchema.parse(input);
}

export function validateLoginPayload(input: unknown): LoginInput {
  return loginSchema.parse(input);
}

export function validateProfilePayload(input: unknown): ProfileInput {
  return profileSchema.parse(input);
}

export function validateStudentProfilePayload(input: unknown): StudentProfileInput {
  return studentProfileSchema.parse(input);
}
