import Router from "koa-router";
import type { Context } from "koa";
import { ReportsService } from "../services/ReportsService.js";
import {User} from "marklie-ts-core";
import type {ReportScheduleRequest} from "marklie-ts-core/dist/lib/interfaces/ReportsInterfaces.js";

export class ReportsController extends Router {
    private readonly reportsService: ReportsService;
    constructor() {
        super({ prefix: "/api/reports" });
        this.reportsService = new ReportsService();
        this.setUpRoutes();
    }

    private setUpRoutes() {
        this.get("/:uuid", this.getReport.bind(this));
        this.post("/schedule", this.scheduleReport.bind(this));
    }

    private async getReport(ctx: Context) {
        const uuid = ctx.params.uuid as string;

        ctx.body = await this.reportsService.getReport(
            uuid,
        );
        ctx.status = 200;
    }

    private async scheduleReport(ctx: Context) {
        const user: User = ctx.state.user as User;
        const scheduleOption: ReportScheduleRequest = ctx.request
            .body as ReportScheduleRequest;

        await this.reportsService.scheduleReport({
            ...scheduleOption,
            organizationUuid: user.activeOrganization.uuid,
        })

        ctx.body = {
            message: "Report schedule created successfully",
        };
        ctx.status = 201;
    }
}
