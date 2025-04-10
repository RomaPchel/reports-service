import { DateTime, type WeekdayNumbers } from "luxon";
import { Database, Log, OrganizationClient } from "markly-ts-core";
import type {ReportJobData, ReportScheduleRequest} from "markly-ts-core/dist/lib/interfaces/ReportsInterfaces.js";
import {CommunicationChannel} from "markly-ts-core/dist/lib/entities/ClientCommunicationChannel.js";

const logger: Log = Log.getInstance().extend("reports-util");
const database = await Database.getInstance();

export class ReportsUtil {
  public static async processScheduledReportJob(data: ReportJobData) {
    try {
        logger.info(`Generation report for Client with UUID ${data.clientUuid}.`);

        const client = await database.em.findOne(
        OrganizationClient,
        { uuid: data.clientUuid },
        {
          populate: ["organization"],
        },
      );

      if (!client) {
        logger.error(`Client with UUID ${data.clientUuid} not found.`);
        return { success: false };
      }

      const communicationChannels = await database.em.find(
        CommunicationChannel,
        {
          client,
          active: true,
        },
      );

      // const report = await FacebookDataUtil.getAllReportData(
      //   data.organizationUuid,
      //   data.accountId,
      //   data.dataPreset,
      // );

      if (!data.reviewNeeded) {
        for (const channel of communicationChannels) {
          try {
            await channel.send({});
          } catch (err) {
            logger.error(
              `Failed to send report via channel ${channel.uuid}:`,
              err,
            );
          }
        }
      } else {
        // await NotificationsUtil.sendReportIsReadyEmails(
        //   client.organization.uuid,
        //   "Your scheduled report is ready to review.",
        // );
      }

      return { success: true };
    } catch (e) {
      logger.error("Failed to process scheduled report job:", e);
      return { success: false };
    }
  }
  private static getWeekday(day: string): WeekdayNumbers {
    switch (day) {
      case "Monday":
        return 1;
      case "Tuesday":
        return 2;
      case "Wednesday":
        return 3;
      case "Thursday":
        return 4;
      case "Friday":
        return 5;
      case "Saturday":
        return 6;
      case "Sunday":
        return 7;
      default:
        return 1;
    }
  }

  public static getNextRunDate(scheduleOption: ReportScheduleRequest) {
    const now = DateTime.now().setZone("UTC");
    let nextRun: DateTime;
    switch (scheduleOption.frequency) {
      case "weekly": {
        const targetWeekday: WeekdayNumbers = this.getWeekday(
          scheduleOption.dayOfWeek,
        );
        nextRun = now.set({
          weekday: targetWeekday,
          hour: Number(scheduleOption.time.split(":")[0]),
          minute: Number(scheduleOption.time.split(":")[1]),
          second: 0,
          millisecond: 0,
        });
        if (nextRun < now) {
          nextRun = nextRun.plus({ weeks: 1 });
        }
        break;
      }
      case "biweekly": {
        const targetWeekday: WeekdayNumbers = this.getWeekday(
          scheduleOption.dayOfWeek,
        );
        nextRun = now.set({
          weekday: targetWeekday,
          hour: Number(scheduleOption.time.split(":")[0]),
          minute: Number(scheduleOption.time.split(":")[1]),
          second: 0,
          millisecond: 0,
        });
        if (nextRun < now) {
          nextRun = nextRun.plus({ weeks: 2 });
        }
        break;
      }
      case "monthly": {
        nextRun = now.set({
          day: scheduleOption.dayOfMonth,
          hour: Number(scheduleOption.time.split(":")[0]),
          minute: Number(scheduleOption.time.split(":")[1]),
          second: 0,
          millisecond: 0,
        });
        if (nextRun < now) {
          nextRun = nextRun.plus({ months: 1 });
        }
        break;
      }
      case "custom": {
        nextRun = now.set({
          hour: Number(scheduleOption.time.split(":")[0]),
          minute: Number(scheduleOption.time.split(":")[1]),
          second: 0,
          millisecond: 0,
        });
        if (nextRun < now) {
          nextRun = now.plus({ days: scheduleOption.intervalDays });
        } else {
          nextRun = nextRun.plus({
            days: scheduleOption.intervalDays,
          });
        }
        break;
      }
      default: {
        nextRun = now;
      }
    }
    return nextRun;
  }
}
