import { z } from 'zod';

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  bio: z.string().trim().max(1200).optional().or(z.literal('')),
});

export const studentProfileSchema = z.object({
  programme: z.string().trim().max(160).optional(),
  course: z.string().trim().max(160).optional(),
  yearOfStudy: z.number().int().min(1).max(10).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(40),
  preferredFields: z.array(z.string().trim().min(1).max(80)).max(20),
  preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20),
  discoverable: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
