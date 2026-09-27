import "reflect-metadata";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { Database } from "./database";
import { ApiController } from "./routes";
import { AdminController } from "./admin";
import { FriendlyErrors } from "./errors";
@Module({
  providers: [Database],
  controllers: [ApiController, AdminController],
})
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new FriendlyErrors());
  app.use(cookieParser());
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").split(
        ",",
      );
      if (!origin || !allowed.includes(origin))
        return res.status(403).json({
          message: "Yêu cầu không hợp lệ. Vui lòng thao tác từ website.",
        });
    }
    next();
  });
  app.use(
    "/api/v1/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 40,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/v1/contact",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(3001, "127.0.0.1");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
