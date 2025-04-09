import type { Context, Next } from "koa";
import { CookiesWrapper } from "../classes/CookiesWrapper.js";

export const CookiesMiddleware = async (ctx: Context, next: Next) => {
  ctx.state.cookiesWrapper = new CookiesWrapper(ctx);
  await next();
};
