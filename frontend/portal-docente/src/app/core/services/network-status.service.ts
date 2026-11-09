import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NetworkStatusService {
  private readonly _navegadorOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  /**
   * Interruptor docente para simular corte de internet en el aula escolar
   */
  public readonly simularCorteRed = signal<boolean>(false);

  /**
   * Estado de conectividad efectivo:
   * Verdadero únicamente si el navegador tiene internet Y no se está simulando corte
   */
  public readonly estaOnline = computed(() => {
    if (this.simularCorteRed()) return false;
    return this._navegadorOnline();
  });

  public readonly reconexion$ = new Subject<void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this._navegadorOnline.set(true);
        if (!this.simularCorteRed()) {
          this.reconexion$.next();
        }
      });

      window.addEventListener('offline', () => {
        this._navegadorOnline.set(false);
      });
    }
  }

  public alternarSimulacionCorte(): void {
    this.simularCorteRed.update((val) => {
      const nuevo = !val;
      // Si se desactiva la simulación y hay red real, avisar reconexión
      if (!nuevo && this._navegadorOnline()) {
        this.reconexion$.next();
      }
      return nuevo;
    });
  }
}

