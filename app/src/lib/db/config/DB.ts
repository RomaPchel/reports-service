import { MikroORM } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { EntityManager } from "@mikro-orm/postgresql";

export const orm = await MikroORM.init({
    metadataProvider: TsMorphMetadataProvider,
    entities: ["./dist/entities/*.js"],
    entitiesTs: ["./src/entities/*.ts"],
    dbName: "",
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: process.env.DATABASE_PASSWORD as string,
});

export const em = orm.em.fork() as EntityManager;
