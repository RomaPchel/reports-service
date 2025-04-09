import type Application from "koa";
import type { Context, Middleware, Next } from "koa";
import jwt from "jsonwebtoken";
import type { User } from "../entities/User.js";
import { AuthenticationUtil } from "../utils/AuthenticationUtil.js";

export const AuthMiddleware: () => Application.Middleware<
  Application.DefaultState,
  Application.DefaultContext
> = (): Middleware => {
  return async (ctx: Context, next: Next) => {
    const excludedEndpoints: string[] = ["/login", "/register", "/refresh"];
    if (excludedEndpoints.some((endpoint) => ctx.path.includes(endpoint))) {
      await next();
      return;
    }
    const token: string = ctx.get("Authorization").split(" ")[1];

    if (!token) {
      ctx.throw(401, "No token provided");
    }

    try {
      const user: User | null =
        await AuthenticationUtil.fetchUserWithTokenInfo(token);
      if (!token || !user) {
        ctx.throw(401, "Unauthorized");
      } else {
        ctx.state.user = user;
        await next();
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        ctx.throw(401, "Token expired.");
      }
    }
  };
};
