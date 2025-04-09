import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" }),
});

export const UrlParamsSchema = z.object({
  uuid: z.string().min(1, { message: "UUID is required" }),
});
