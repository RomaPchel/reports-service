import Koa from "koa";
import koabodyparser from "koa-bodyparser";
import {
  AuthMiddleware,
  CookiesMiddleware,
  Database,
  ErrorMiddleware, Log,
  ValidationMiddleware
} from "markly-ts-core";
import {PubSubWrapper} from "./lib/classes/PubSub.js";
import {ReportsService} from "./lib/services/ReportsService.js";
import type {ReportScheduleRequest} from "markly-ts-core/dist/lib/interfaces/ReportsInterfaces.js";
import {ReportQueueService} from "./lib/services/ReportsQueueService.js";

const app = new Koa();
const logger = Log.getInstance().extend('service');

const database =  await Database.getInstance();

await database.orm.connect().then(() => {
  logger.info("Database has connected!");
});

const reportsService = new ReportsService();
const reportQueue = ReportQueueService.getInstance();

PubSubWrapper.subscribe<ReportScheduleRequest>("report-sub", async (data)=> {
  logger.info(`Received message to topic report-sub`);

  await reportsService.scheduleReport(data)
})

app.use(koabodyparser());
app.use(CookiesMiddleware);
app.use(AuthMiddleware());
app.use(ErrorMiddleware());
app.use(ValidationMiddleware());

app.listen(3000, () => {
  logger.info(`Auth server is running at ${3000}`);
});

process.on('SIGINT', async () => {
  logger.error('🛑 Gracefully shutting down...');
  await reportQueue.close();
  await database.orm.close();
  process.exit(0);
});
