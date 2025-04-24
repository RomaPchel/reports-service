import { DateTime, type WeekdayNumbers } from "luxon";
import {
  Database, GCSWrapper,
  Log,
  OrganizationClient, PubSubWrapper,
  SchedulingOption, Report
} from "markly-ts-core";
import type {ReportJobData, ReportScheduleRequest} from "markly-ts-core/dist/lib/interfaces/ReportsInterfaces.js";
import puppeteer from "puppeteer";
import {FacebookDataUtil} from "./FacebookDataUtil.js";

const logger: Log = Log.getInstance().extend("reports-util");
const database = await Database.getInstance();

export class ReportsUtil {
  public static async processScheduledReportJob(data: ReportJobData) {
    try {
      logger.info(`Generating report for Client UUID: ${data.clientUuid}`);

      const client = await database.em.findOne(
          OrganizationClient,
          {uuid: data.clientUuid},
          {
            populate: ["organization"],
          },
      );

      if (!client) {
        logger.error(`Client with UUID ${data.clientUuid} not found.`);
        return {success: false};
      }

      const reportData = await FacebookDataUtil.getAllReportData(
          data.organizationUuid,
          client.accountId,
          data.dataPreset
      );

      const report = database.em.create(Report, {
        organization: client.organization,
        client: client,
        reportType: 'facebook',
        gcsUrl: "",
        data: reportData,
        metadata: {
          datePreset: data.dataPreset,
          reviewNeeded: data.reviewNeeded,
        },
      });

      database.em.persist(report);
      await database.em.flush();

      await this.updateLastRun(client.uuid);

      const pdfBuffer = await this.generateReportPdf(report.uuid);

      const filePath = this.generateFilePath(client.uuid, data.dataPreset);
      const gcs = GCSWrapper.getInstance('marklie-client-reports');

      const publicUrl = await gcs.uploadBuffer(
          pdfBuffer,
          filePath,
          'application/pdf',
          false,
          true
      );

      report.gcsUrl = publicUrl;
      await database.em.flush();

      const payload = {
        reportUrl: publicUrl,
        clientUuid: client.uuid,
        organizationUuid: client.organization.uuid,
        reportId: report.uuid,
      };

      const topic = data.reviewNeeded
          ? "notification-report-ready"
          : "notification-send-report";

      await PubSubWrapper.publishMessage(topic, payload);

      return { success: true };
    } catch (e) {
      logger.error("Failed to process scheduled report job:", e);
      return { success: false };
    }
  }

  private static async updateLastRun(clientUuid: string) {
    const option = await database.em.findOne(SchedulingOption, {
      client: clientUuid,
    });

    if (option) {
      option.lastRun = new Date();
      await database.em.flush();
    }
  }

  private static generateFilePath(clientUuid: string, preset: string) {
    const today = new Date().toISOString().split("T")[0];
    return `report/${clientUuid}-facebook-report-${preset}-${today}.pdf`;
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
          nextRun = nextRun.plus({weeks: 1});
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
          nextRun = nextRun.plus({weeks: 2});
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
          nextRun = nextRun.plus({months: 1});
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
          nextRun = now.plus({days: scheduleOption.intervalDays});
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

  private static async generateReportPdf(reportUuid: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(`http://localhost:4200/report/${reportUuid}`);
    await page.emulateMediaType('print');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });

    await browser.close();
    return Buffer.from(pdf);
  }


}