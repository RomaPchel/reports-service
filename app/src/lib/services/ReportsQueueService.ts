import { BullMQWrapper } from 'markly-ts-core';
import { RedisClient } from 'markly-ts-core';
import type { ReportJobData } from 'markly-ts-core/dist/lib/interfaces/ReportsInterfaces.js';
import { ReportsUtil } from '../utils/ReportsUtil.js';
import type { Job } from 'bullmq';

export class ReportQueueService {
    private static instance: ReportQueueService;
    private queue: BullMQWrapper;

    private constructor() {
        this.queue = new BullMQWrapper(
            'report-queue',
            RedisClient.getInstance().duplicate(),
            {
                'generate-report': this.generateReportJob.bind(this)
            }
        );
    }

    public static getInstance(): ReportQueueService {
        if (!ReportQueueService.instance) {
            ReportQueueService.instance = new ReportQueueService();
        }
        return ReportQueueService.instance;
    }

    private async generateReportJob(data: ReportJobData): Promise<void> {
        await ReportsUtil.processScheduledReportJob(data);
    }

    public async getAllJobs(): Promise<void> {
        return this.queue.listScheduledJobs()
    }

    public async scheduleReport(data: ReportJobData, cron: string): Promise<Job> {
        return await this.queue.addScheduledJob('generate-report', data, cron);
    }

    public async enqueueReport(data: ReportJobData): Promise<Job> {
        return await this.queue.addJob('generate-report', data);
    }

    public async deleteAllJobs(): Promise<void> {
        const repeatableJobs = await this.queue.listScheduledJobs();

        for (const job of repeatableJobs) {
            await this.queue.removeScheduledJob(job.key);
        }
        await this.queue.drainAndClean();
    }

    // Expose a method to get a job by ID.
    public async getJob(jobId: string): Promise<Job | null> {
        return await this.queue.getJob(jobId);
    }

    // Remove a specific job by its ID.
    public async removeJob(jobId: string): Promise<void> {
        await this.queue.removeJob(jobId);
    }

    // Close all BullMQ resources.
    public async close(): Promise<void> {
        await this.queue.close();
    }
}
