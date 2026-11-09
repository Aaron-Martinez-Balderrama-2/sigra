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

  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
    'http://localhost:5173',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:4201',
    'http://127.0.0.1:4202',
    'http://127.0.0.1:5173',
  ];

  const origins = envOrigins.length > 0 ? envOrigins : defaultOrigins;
  app.enableCors({ origin: origins, credentials: false });

  app.enableShutdownHooks();
}
