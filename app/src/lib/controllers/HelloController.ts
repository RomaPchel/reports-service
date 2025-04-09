import Router from "koa-router";

export class HelloController extends Router {
    constructor() {
        super({ prefix: "/api/" });
        this.setUpRoutes();
    }

    private setUpRoutes() {

    }

}
