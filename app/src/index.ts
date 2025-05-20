import Koa from "koa";
import koabodyparser from "koa-bodyparser";
import cors from "@koa/cors";
import 'dotenv/config';
import {
  AuthMiddleware,
  CookiesMiddleware,
  Database,
  ErrorMiddleware,
  Log,
  ValidationMiddleware,
} from "marklie-ts-core";
import { ReportQueueService } from "./lib/services/ReportsQueueService.js";
import {ReportsController} from "./lib/controllers/ReportsController.js";

const app = new Koa();
const logger = Log.getInstance().extend("service");

const database = await Database.getInstance();

logger.info("Database has connected!");

const reportQueue = ReportQueueService.getInstance();

app.use(
    cors({
      origin: "http://localhost:4200",
      credentials: true,
    }),
);
app.use(koabodyparser());
app.use(CookiesMiddleware);
app.use(AuthMiddleware([/^\/api\/reports\/[^/]+$/]));
app.use(ValidationMiddleware());
app.use(ErrorMiddleware());

app
    .use(new ReportsController().routes())
    .use(new ReportsController().allowedMethods());

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  logger.info(`Auth server is running at ${PORT}`);
});

process.on("SIGINT", async () => {
  logger.error("🛑 Gracefully shutting down...");
  await reportQueue.close();
  await database.orm.close();
  process.exit(0);
});
