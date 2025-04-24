import Router from "koa-router";
import type { Context } from "koa";
import { ReportsService } from "../services/ReportsService.js";

export class ReportsController extends Router {
    private readonly reportsService: ReportsService;
    constructor() {
        super({ prefix: "/api/reports" });
        this.reportsService = new ReportsService();
        this.setUpRoutes();
    }

    private setUpRoutes() {
        this.get("/:uuid", this.getReport.bind(this));
    }

    private async getReport(ctx: Context) {
        const uuid = ctx.params.uuid as string;

        ctx.body = await this.reportsService.getReport(
            uuid,
        );
        ctx.status = 200;
    }
}
