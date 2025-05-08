import type { Job } from "bullmq";
import { ReportsUtil } from "../utils/ReportsUtil.js";
import {
  Database,
  OrganizationClient,
  SchedulingOption, Report} from "marklie-ts-core";
import type {ReportScheduleRequest} from "marklie-ts-core/dist/lib/interfaces/ReportsInterfaces.js";
import {CronUtil} from "../utils/CronUtil.js";
import {ReportQueueService} from "./ReportsQueueService.js";

const database = await Database.getInstance();

export class ReportsService {
  async scheduleReport(
    scheduleOption: ReportScheduleRequest,
  ): Promise<string> {
      const schedule = new SchedulingOption();

      const cronExpression =
          CronUtil.convertScheduleRequestToCron(scheduleOption);

      schedule.cronExpression =
          CronUtil.convertScheduleRequestToCron(scheduleOption);
      schedule.client = database.em.getReference(
          OrganizationClient,
          scheduleOption.clientUuid,
      );

      const client = await database.em.findOne(OrganizationClient, {
          uuid: scheduleOption.clientUuid,
      });

      const queue = ReportQueueService.getInstance();

      const job: Job = await queue.scheduleReport(
          {
              ...scheduleOption,
              organizationUuid: client.organization.uuid,
              accountId: client?.accountId,
              reviewNeeded: scheduleOption.reviewNeeded,
              dataPreset: scheduleOption.datePreset
          },
          cronExpression,
      );

      //todo: add timezones
      schedule.reportType = scheduleOption.frequency;
      schedule.jobData = scheduleOption as any;
      schedule.timezone = "UTC";
      schedule.datePreset = scheduleOption.datePreset;
      schedule.bullJobId = job.id as string;
      schedule.nextRun = ReportsUtil.getNextRunDate(scheduleOption).toJSDate();

      await database.em.persistAndFlush(schedule);

      return cronExpression;
  }

  async getReport(
    uuid: string,
  ) {
    return database.em.findOne(Report, {uuid: uuid});
  }
}
