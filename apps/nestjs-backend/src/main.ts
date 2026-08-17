import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { parseCorsOrigin } from './cors-origin';
import { requestIdMiddleware } from './request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.enableCors({
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
