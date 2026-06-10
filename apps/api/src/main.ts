import "reflect-metadata";
import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppModule } from "./app.module.js";
import { ConfigService } from "./config/config.service.js";
import { setupOpenApi } from "./docs/openapi.js";

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || config.config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS."), false);
    },
    credentials: true,
  });
  app.enableShutdownHooks();
  if (config.config.enableOpenApi) {
    setupOpenApi(app);
  }

  await app.listen(config.apiPort);
  Logger.log(
    `AgentPass API listening on http://localhost:${config.apiPort}`,
    "Bootstrap",
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await bootstrap();
}
