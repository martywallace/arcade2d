import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { HealthController } from './health.controller';

/**
 * Absolute path to the built React frontend. In the monorepo this resolves to
 * `apps/devserver/frontend/dist` relative to the compiled backend. The Docker
 * image overrides it with `ARCADE2D_FRONTEND_DIST` since the runtime layout
 * differs from the source tree.
 */
const frontendDist =
  process.env.ARCADE2D_FRONTEND_DIST ??
  join(__dirname, '..', '..', 'frontend', 'dist');

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: frontendDist,
      // Never let the static handler swallow API routes.
      exclude: ['/api/(.*)'],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
