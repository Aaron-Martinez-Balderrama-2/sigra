import { Injectable, signal } from '@angular/core';
import { RegistrarAsistenciaLoteRequest, RegistroOfflineItem } from '../models/sigra.model';
import { AsistenciaService } from './asistencia.service';
import { firstValueFrom } from 'rxjs';

const DB_NAME = 'sigra_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'cola_asistencia';

@Injectable({
  providedIn: 'root',
})
export class OfflineStorageService {
  private db: IDBDatabase | null = null;
  public readonly cantidadPendientes = signal<number>(0);
  public readonly itemsPendientes = signal<RegistroOfflineItem[]>([]);

  constructor() {
    this.iniciarDb().then(() => this.refrescarEstado());
  }

  private iniciarDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB no está disponible en este entorno'));
      }

      if (this.db) {
        return resolve(this.db);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('operationId', 'operationId', { unique: true });
          store.createIndex('estadoSync', 'estadoSync', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event: Event) => {
        console.error('Error al inicializar IndexedDB sigra_offline_db:', event);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  public async encolar(
    payload: RegistrarAsistenciaLoteRequest
  ): Promise<RegistroOfflineItem> {
    const db = await this.iniciarDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const nuevoRegistro: Omit<RegistroOfflineItem, 'id'> = {
        operationId: payload.operationId,
        cursoId: payload.cursoId,
        fecha: payload.fecha,
        timestamp: Date.now(),
        payload,
        estadoSync: 'PENDIENTE',
      };

      const request = store.add(nuevoRegistro);

      request.onsuccess = () => {
        const idGenerado = request.result as number;
        const creado: RegistroOfflineItem = { ...nuevoRegistro, id: idGenerado };
        this.refrescarEstado();
        resolve(creado);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async listarPendientes(): Promise<RegistroOfflineItem[]> {
    const db = await this.iniciarDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result as RegistroOfflineItem[]) || [];
        resolve(items);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async eliminar(id: number): Promise<void> {
    const db = await this.iniciarDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.refrescarEstado();
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async refrescarEstado(): Promise<void> {
    try {
      const items = await this.listarPendientes();
      this.itemsPendientes.set(items);
      this.cantidadPendientes.set(items.length);
    } catch {
      this.itemsPendientes.set([]);
      this.cantidadPendientes.set(0);
    }
  }

  /**
   * Sincroniza todos los lotes de la cola con ms-asistencia en PostgreSQL
   */
  public async sincronizarCola(asistenciaService: AsistenciaService): Promise<{
    sincronizados: number;
    errores: number;
  }> {
    const items = await this.listarPendientes();
    let sincronizados = 0;
    let errores = 0;

    for (const item of items) {
      try {
        await firstValueFrom(asistenciaService.registrarLote(item.payload));
        if (item.id !== undefined) {
          await this.eliminar(item.id);
        }
        sincronizados++;
      } catch (err) {
        console.error('Error al sincronizar item offline:', item, err);
        errores++;
      }
    }

    await this.refrescarEstado();
    return { sincronizados, errores };
  }
}

