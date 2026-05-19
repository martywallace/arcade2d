import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // All controllers are mounted under /api so the static SPA can own the
  // remaining routes (see ServeStaticModule in AppModule).
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  console.log(`arcade2d dev server listening on http://0.0.0.0:${port}`);
}

void bootstrap();
