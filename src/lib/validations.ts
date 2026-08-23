import { z } from 'zod';

export const authSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

export const signUpSchema = authSchema.extend({
  username: z.string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-z0-9_]+$/, { message: "Username can only contain lowercase letters, numbers, and underscores" }),
  displayName: z.string()
    .trim()
    .max(50, { message: "Display name must be less than 50 characters" })
    .optional(),
});

export const profileSchema = z.object({
  username: z.string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-z0-9_]+$/, { message: "Username can only contain lowercase letters, numbers, and underscores" }),
  displayName: z.string()
    .trim()
    .max(50, { message: "Display name must be less than 50 characters" }),
  bio: z.string()
    .trim()
    .max(500, { message: "Bio must be less than 500 characters" })
    .optional(),
});

export const reelSchema = z.object({
  title: z.string()
    .trim()
    .min(1, { message: "Title is required" })
    .max(100, { message: "Title must be less than 100 characters" }),
  description: z.string()
    .trim()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
});

export type AuthFormData = z.infer<typeof authSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ReelFormData = z.infer<typeof reelSchema>;
