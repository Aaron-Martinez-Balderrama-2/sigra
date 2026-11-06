import { Controller, Get } from '@nestjs/common';
import { Public } from './adapters/auth/auth';
import { MongoStore } from './adapters/persistence/mongo/mongo-store';
@Controller()
export class AppController {
  constructor(private readonly store: MongoStore) {}
  @Public()
  @Get('health')
  async health() {
    await this.store.ping();
    return { status: 'UP', service: 'ms-calificaciones' };
  }
}
