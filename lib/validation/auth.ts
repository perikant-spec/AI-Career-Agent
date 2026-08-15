import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().min(1).max(120).optional(),
  acceptedLegal: z
    .boolean()
    .refine((v) => v === true, "You must accept the Terms of Service and Privacy Policy to continue."),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().min(1, "Missing reset token."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm."),
});
