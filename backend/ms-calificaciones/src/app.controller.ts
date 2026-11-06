import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from './adapters/auth/auth';
import { STORE, Store } from './core/ports/store';
@Controller()
export class AppController {
  constructor(@Inject(STORE) private readonly store: Store) {}
  @Public()
  @Get('health')
  async health() {
    await this.store.ping?.();
    return { status: 'UP', service: 'ms-calificaciones' };
  }
}
