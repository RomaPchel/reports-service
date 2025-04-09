import type { RegistrationRequestBody } from "../interfaces/AuthInterfaces.js";
import { z } from "zod";
import type { Request } from "koa";
export class Validator {
  public static validateRegistrationRequest(body: RegistrationRequestBody) {
    const RegistrationRequestSchema = z.object({
      email: z.string().email({ message: "Invalid email address" }),
      password: z
        .string()
        .min(8, { message: "Password must be at least 8 characters long" }),
      // firstName: z.string().min(8, { message: "Password must be at least 8 characters long" }),
      // lastName: z.string().min(8, { message: "Password must be at least 8 characters long" }),
    });

    return RegistrationRequestSchema.parse(body);
  }

  public static validateBody(request: Request) {
    switch (request.url) {
      case "/register":
        this.validateRegistrationRequest(
          request.body as RegistrationRequestBody,
        );
    }
  }
}
