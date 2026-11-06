import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpErrorFilter } from './adapters/http/error-filter';
export function configure(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins, credentials: false });
  app.enableShutdownHooks();
}
