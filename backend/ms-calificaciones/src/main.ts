import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configure } from './setup';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configure(app);
  await app.listen(
    Number(process.env.PORT ?? 3000),
    process.env.HOST ?? '0.0.0.0',
  );
}
void bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Fallo de inicio');
  process.exitCode = 1;
});
