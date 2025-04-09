import Koa from "koa";
import koabodyparser from "koa-bodyparser";
import {HelloController} from "./lib/controllers/HelloController";
import {orm} from "./lib/db/config/DB";
import {ErrorMiddleware} from "./lib/middlewares/ErrorMiddleware";
import {ValidationMiddleware} from "./lib/middlewares/ValidationMiddleware";
import {AuthMiddleware} from "./lib/middlewares/AuthMiddleware.js";
import {CookiesMiddleware} from "./lib/middlewares/CookiesMiddleware.js";

const app = new Koa();

await orm.connect().then(() => {
  console.log("Database has connected!");
});

app.use(koabodyparser());
app.use(CookiesMiddleware);
app.use(AuthMiddleware());
app.use(ErrorMiddleware());
app.use(ValidationMiddleware());
app.use(koabodyparser());
app
    .use(new HelloController().routes())
    .use(new HelloController().allowedMethods());

app.listen(3000, () => {
  console.log(`Auth server is running at ${3000}`);
});
