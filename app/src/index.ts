import Koa from "koa";
import koabodyparser from "koa-bodyparser";
import cors from "@koa/cors";
import {
  AuthMiddleware,
  CookiesMiddleware,
  Database,
  ErrorMiddleware,
  Log,
  PubSubWrapper,
  ValidationMiddleware,
} from "marklie-ts-core";
import { ReportsService } from "./lib/services/ReportsService.js";
import type { ReportScheduleRequest } from "marklie-ts-core/dist/lib/interfaces/ReportsInterfaces.js";
import { ReportQueueService } from "./lib/services/ReportsQueueService.js";
import {ReportsController} from "./lib/controllers/ReportsController.js";
import { OpenAiWrapper } from "lib/classes/OpenAiWrapper.js";

const app = new Koa();
const logger = Log.getInstance().extend("service");

const database = await Database.getInstance();

await database.orm.connect().then(() => {
  logger.info("Database has connected!");
});

const reportsService = new ReportsService();
const reportQueue = ReportQueueService.getInstance();

PubSubWrapper.subscribe<ReportScheduleRequest>(
  "report-sub",
  async (data: ReportScheduleRequest) => {
    logger.info(`Received message to topic report-sub`);

    await reportsService.scheduleReport(data);
  },
);
app.use(
    cors({
      origin: "http://localhost:4200",
      credentials: true,
    }),
);
app.use(koabodyparser());
app.use(CookiesMiddleware);
app.use(AuthMiddleware());
app.use(ErrorMiddleware());
app.use(ValidationMiddleware());

app
    .use(new ReportsController().routes())
    .use(new ReportsController().allowedMethods());

app.listen(3030, () => {
  logger.info(`Auth server is running at ${3030}`);
});

process.on("SIGINT", async () => {
  logger.error("🛑 Gracefully shutting down...");
  await reportQueue.close();
  await database.orm.close();
  process.exit(0);
});
