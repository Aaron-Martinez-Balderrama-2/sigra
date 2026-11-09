import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  EstudianteEscolar,
  EstadoAsistencia,
  RegistrarAsistenciaLoteRequest,
  RegistroOfflineItem,
} from '../../core/models/sigra.model';
import { AsistenciaService, IdempotenciaResultado } from '../../core/services/asistencia.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { AuthSsoService } from '../../core/services/auth-sso.service';

@Component({
  selector: 'app-planilla-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="espacio-asistencia">
      <!-- Encabezado de la Planilla -->
      <div class="tarjeta encabezado-clase">
        <div class="info-curso">
          <span class="etiqueta-gestion">Gestión 2026 • 1.er Trimestre</span>
          <h2>{{ auth.contextoEscolar().cursoNombre }} — {{ auth.contextoEscolar().materiaNombre }}</h2>
          <p class="subtexto-docente">
            Docente Asignado: <strong>{{ auth.actor().nombre }}</strong> • Código Curso: <code>{{ auth.contextoEscolar().cursoId }}</code>
          </p>
        </div>

        <div class="controles-fecha">
          <label for="fecha-clase"><strong>Fecha de Lista:</strong></label>
          <input
            id="fecha-clase"
            type="date"
            class="input-fecha"
            [ngModel]="fechaSeleccionada()"
            (ngModelChange)="fechaSeleccionada.set($event); cargarPlanillaFecha()"
          />
        </div>
      </div>

      <!-- Alertas y Mensajes de Estado -->
      <div *ngIf="mensajeExito()" class="alerta alerta-exito">
        {{ mensajeExito() }}
      </div>
      <div *ngIf="mensajeError()" class="alerta alerta-error">
        {{ mensajeError() }}
      </div>

      <!-- Barra de Acciones Rápidas -->
      <div class="barra-acciones-planilla">
        <div class="acciones-rapidas">
          <button class="btn btn-outline" (click)="marcarTodos('PRESENTE')">
            ✓ Todos Presentes
          </button>
          <button class="btn btn-outline" (click)="marcarTodos('FALTA')">
            ✕ Todos Falta
          </button>
        </div>

        <button
          class="btn btn-dorado btn-guardar-principal"
          [disabled]="guardando()"
          (click)="guardarPlanilla()"
        >
          <span *ngIf="!guardando()">💾 Guardar Asistencia del Curso</span>
          <span *ngIf="guardando()">⏳ Procesando registro...</span>
        </button>
      </div>

      <!-- Tabla Principal de Alumnos -->
      <div class="contenedor-tabla">
        <table class="tabla-sigra">
          <thead>
            <tr>
              <th style="width: 80px;">N.°</th>
              <th>Estudiante de Colegio</th>
              <th>Estado de Asistencia</th>
              <th style="text-align: center;">% Asistencia Histórica</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let alumno of listaAlumnos; let i = index">
              <td>
                <span class="numero-orden">{{ i + 1 }}</span>
              </td>
              <td>
                <div class="alumno-fila">
                  <div class="alumno-avatar">{{ alumno.nombre.charAt(0) }}</div>
                  <div>
                    <div class="alumno-nombre">{{ alumno.nombre }}</div>
                    <div class="alumno-id">ID: <code>{{ alumno.id }}</code> • {{ alumno.perfil }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="selector-estados">
                  <button
                    type="button"
                    class="btn-estado"
                    [class.activo-presente]="estadosAsistencia[alumno.id] === 'PRESENTE'"
                    (click)="seleccionarEstado(alumno.id, 'PRESENTE')"
                  >
                    Presente
                  </button>
                  <button
                    type="button"
                    class="btn-estado"
                    [class.activo-falta]="estadosAsistencia[alumno.id] === 'FALTA'"
                    (click)="seleccionarEstado(alumno.id, 'FALTA')"
                  >
                    Falta
                  </button>
                  <button
                    type="button"
                    class="btn-estado"
                    [class.activo-atraso]="estadosAsistencia[alumno.id] === 'ATRASO'"
                    (click)="seleccionarEstado(alumno.id, 'ATRASO')"
                  >
                    Atraso
                  </button>
                  <button
                    type="button"
                    class="btn-estado"
                    [class.activo-justificada]="estadosAsistencia[alumno.id] === 'FALTA_JUSTIFICADA'"
                    (click)="seleccionarEstado(alumno.id, 'FALTA_JUSTIFICADA')"
                  >
                    Justificada
                  </button>
                </div>
              </td>
              <td style="text-align: center;">
                <div class="resumen-porcentaje">
                  <span
                    class="badge"
                    [class.badge-presente]="(porcentajes[alumno.id] ?? 100) >= 85"
                    [class.badge-riesgo]="(porcentajes[alumno.id] ?? 100) < 85"
                  >
                    {{ (porcentajes[alumno.id] ?? 100).toFixed(1) }}%
                  </span>
                  <div *ngIf="(porcentajes[alumno.id] ?? 100) < 85" class="alerta-inasistencia">
                    ⚠️ Riesgo por inasistencias
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- SECCIÓN: Cola de Sincronización Offline IndexedDB (Req. 1.5) -->
      <div class="tarjeta seccion-offline">
        <div class="cabecera-offline">
          <div class="titulo-offline">
            <h3>📦 Cola de Sincronización Offline (IndexedDB)</h3>
            <p>
              Base de datos local en navegador: <code>sigra_offline_db</code> • Registros en espera:
              <strong>{{ offline.cantidadPendientes() }}</strong>
            </p>
          </div>

          <button
            class="btn btn-azul"
            [disabled]="offline.cantidadPendientes() === 0 || !network.estaOnline() || sincronizando()"
            (click)="sincronizarCola()"
          >
            {{ sincronizando() ? '⏳ Sincronizando con PostgreSQL...' : '🔄 Sincronizar Cola Ahora' }}
          </button>
        </div>

        <div *ngIf="offline.cantidadPendientes() === 0" class="cola-vacia">
          ✓ No hay registros pendientes en la cola local. Todas las asistencias están sincronizadas con el servidor.
        </div>

        <div *ngIf="offline.cantidadPendientes() > 0" class="lista-cola">
          <div *ngFor="let item of offline.itemsPendientes()" class="item-cola">
            <div>
              <strong>UUID (operationId):</strong> <code>{{ item.operationId }}</code><br />
              <small>Fecha: {{ item.fecha }} • Alumnos registrados: {{ item.payload.estudiantes.length }}</small>
            </div>
            <span class="badge badge-atraso">PENDIENTE EN INDEXEDDB</span>
          </div>
        </div>
      </div>

      <!-- SECCIÓN: DEFENSA DE IDEMPOTENCIA EN VIVO (Req. 1.6) -->
      <div class="tarjeta seccion-idempotencia">
        <div class="cabecera-idempotencia">
          <div>
            <h3>⚡ Demostración de Idempotencia en Redes Hostiles (Requisito 1.6)</h3>
            <p>
              Envía concurrentemente <strong>5 peticiones simultáneas</strong> a <code>POST /api/v1/asistencia/lote</code> usando exactamente el mismo identificador único <code>operationId</code> (UUID v4).
            </p>
          </div>

          <button
            class="btn btn-dorado"
            [disabled]="probandoIdempotencia() || !network.estaOnline()"
            (click)="ejecutarPruebaIdempotencia()"
          >
            {{ probandoIdempotencia() ? '⚡ Enviando 5 peticiones...' : '⚡ Disparar 5 Peticiones Concurrentes' }}
          </button>
        </div>

        <div *ngIf="resultadosIdempotencia().length > 0" class="panel-resultados-idempotencia">
          <div class="uuid-utilizado">
            UUID Compartido: <code>{{ uuidIdempotencia() }}</code>
          </div>

          <div class="grid-respuestas-idempotencia">
            <div
              *ngFor="let res of resultadosIdempotencia()"
              class="tarjeta-intento"
              [class.intento-primero]="!res.esReplay"
              [class.intento-replay]="res.esReplay"
            >
              <div class="intento-cabecera">
                <span class="badge-intento">Petición #{{ res.intento }}</span>
                <span class="codigo-http">HTTP {{ res.statusHttp }}</span>
              </div>
              <div class="intento-cuerpo">
                <div><strong>X-Idempotent-Replay:</strong> <code>{{ res.headerIdempotentReplay ?? 'false' }}</code></div>
                <div><strong>Mensaje:</strong> {{ res.mensaje }}</div>
                <div><small>Tiempo de respuesta: {{ res.tiempoRespuestaMs }} ms</small></div>
              </div>
              <div class="intento-pie">
                <span *ngIf="!res.esReplay" class="tag-original">✓ Registro Nuevo Creado</span>
                <span *ngIf="res.esReplay" class="tag-replay">🔁 Idempotente (Sin Duplicar)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .espacio-asistencia {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .encabezado-clase {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        background: linear-gradient(135deg, #ffffff 0%, var(--colegio-azul-claro) 100%);
        border-left: 6px solid var(--colegio-azul-oscuro);
      }

      .etiqueta-gestion {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--colegio-azul-medio);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .subtexto-docente {
        color: var(--texto-secundario);
        font-size: 0.85rem;
        margin-top: 0.25rem;
      }

      .controles-fecha {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        background: #ffffff;
        padding: 0.5rem 0.85rem;
        border-radius: var(--radio-md);
        border: 1px solid var(--borde-suave);
      }

      .input-fecha {
        font-family: inherit;
        padding: 0.4rem 0.65rem;
        border: 1px solid var(--borde-suave);
        border-radius: 4px;
        font-weight: 600;
      }

      .barra-acciones-planilla {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .acciones-rapidas {
        display: flex;
        gap: 0.5rem;
      }

      .btn-guardar-principal {
        font-size: 0.95rem;
        padding: 0.75rem 1.75rem;
      }

      .contenedor-tabla {
        overflow-x: auto;
      }

      .numero-orden {
        font-weight: 700;
        color: var(--texto-secundario);
      }

      .alumno-fila {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }

      .alumno-avatar {
        width: 36px;
        height: 36px;
        background-color: var(--colegio-azul-medio);
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }

      .alumno-nombre {
        font-weight: 700;
        color: var(--colegio-azul-oscuro);
      }

      .alumno-id {
        font-size: 0.75rem;
        color: var(--texto-secundario);
      }

      .selector-estados {
        display: inline-flex;
        background: #f1f5f9;
        border-radius: var(--radio-md);
        padding: 3px;
        gap: 3px;
      }

      .btn-estado {
        padding: 0.35rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        background: transparent;
        color: var(--texto-secundario);
        border-radius: 4px;
      }

      .btn-estado:hover {
        background: #e2e8f0;
      }

      .activo-presente {
        background: var(--verde-exito) !important;
        color: #ffffff !important;
      }

      .activo-falta {
        background: var(--colegio-rojo-principal) !important;
        color: #ffffff !important;
      }

      .activo-atraso {
        background: var(--colegio-dorado-claro) !important;
        color: #78350f !important;
      }

      .activo-justificada {
        background: #4f46e5 !important;
        color: #ffffff !important;
      }

      .resumen-porcentaje {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }

      .alerta-inasistencia {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--colegio-rojo-principal);
      }

      .alerta {
        padding: 0.85rem 1.25rem;
        border-radius: var(--radio-md);
        font-weight: 600;
        font-size: 0.875rem;
      }
      .alerta-exito {
        background-color: #dcfce7;
        color: #14532d;
        border: 1px solid #86efac;
      }
      .alerta-error {
        background-color: #fee2e2;
        color: #7f1d1d;
        border: 1px solid #fca5a5;
      }

      /* Offline */
      .seccion-offline {
        border-top: 4px solid var(--colegio-dorado-claro);
      }

      .cabecera-offline, .cabecera-idempotencia {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .cola-vacia {
        margin-top: 1rem;
        padding: 0.85rem;
        background: #f8fafc;
        border: 1px dashed var(--borde-suave);
        border-radius: var(--radio-md);
        color: var(--texto-secundario);
        font-size: 0.875rem;
      }

      .lista-cola {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .item-cola {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: var(--radio-md);
        font-size: 0.85rem;
      }

      /* Idempotencia */
      .seccion-idempotencia {
        border-top: 4px solid var(--colegio-dorado-principal);
      }

      .panel-resultados-idempotencia {
        margin-top: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .uuid-utilizado {
        background: #f1f5f9;
        padding: 0.5rem 0.85rem;
        border-radius: var(--radio-md);
        font-size: 0.85rem;
      }

      .grid-respuestas-idempotencia {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
      }

      .tarjeta-intento {
        padding: 0.85rem;
        border-radius: var(--radio-md);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.8rem;
      }

      .intento-primero {
        background: #ecfdf5;
        border: 2px solid #10b981;
      }

      .intento-replay {
        background: #eff6ff;
        border: 1px solid #93c5fd;
      }

      .intento-cabecera {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .badge-intento {
        font-weight: 700;
      }

      .codigo-http {
        font-weight: 800;
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: #ffffff;
      }

      .tag-original {
        color: #065f46;
        font-weight: 700;
      }

      .tag-replay {
        color: #1e40af;
        font-weight: 700;
      }
    `,
  ],
})
export class PlanillaAsistenciaComponent implements OnInit {
  public readonly auth = inject(AuthSsoService);
  public readonly network = inject(NetworkStatusService);
  private readonly asistenciaService = inject(AsistenciaService);
  public readonly offline = inject(OfflineStorageService);

  public readonly listaAlumnos: EstudianteEscolar[] = CATALOGO_ESTUDIANTES_COLEGIO;
  public readonly fechaSeleccionada = signal<string>('2026-11-07');
  public readonly estadosAsistencia: Record<string, EstadoAsistencia> = {};
  public readonly porcentajes: Record<string, number | undefined> = {};

  public readonly guardando = signal<boolean>(false);
  public readonly sincronizando = signal<boolean>(false);
  public readonly probandoIdempotencia = signal<boolean>(false);
  public readonly mensajeExito = signal<string | null>(null);
  public readonly mensajeError = signal<string | null>(null);

  public readonly uuidIdempotencia = signal<string>('');
  public readonly resultadosIdempotencia = signal<IdempotenciaResultado[]>([]);

  ngOnInit(): void {
    this.marcarTodos('PRESENTE');
    this.cargarPorcentajes();
    this.cargarPlanillaFecha();

    this.network.reconexion$.subscribe(() => {
      if (this.offline.cantidadPendientes() > 0) {
        this.sincronizarCola();
      }
    });
  }

  public marcarTodos(estado: EstadoAsistencia): void {
    for (const alumno of this.listaAlumnos) {
      this.estadosAsistencia[alumno.id] = estado;
    }
  }

  public seleccionarEstado(estudianteId: string, estado: EstadoAsistencia): void {
    this.estadosAsistencia[estudianteId] = estado;
  }

  public cargarPlanillaFecha(): void {
    const cursoId = this.auth.contextoEscolar().cursoId;
    const fecha = this.fechaSeleccionada();

    this.asistenciaService.obtenerPlanillaCursoFecha(cursoId, fecha).subscribe({
      next: (res) => {
        if (res.datos && res.datos.length > 0) {
          for (const reg of res.datos) {
            if (this.estadosAsistencia[reg.estudianteId] !== undefined) {
              this.estadosAsistencia[reg.estudianteId] = reg.estado;
            }
          }
        }
      },
      error: () => {},
    });
  }

  public cargarPorcentajes(): void {
    const cursoId = this.auth.contextoEscolar().cursoId;
    for (const alumno of this.listaAlumnos) {
      this.asistenciaService.obtenerResumenEstudiante(alumno.id, cursoId).subscribe({
        next: (res) => {
          if (res.datos) {
            this.porcentajes[alumno.id] = res.datos.porcentajeAsistencia;
          }
        },
        error: () => {
          this.porcentajes[alumno.id] = 100.0;
        },
      });
    }
  }

  public async guardarPlanilla(): Promise<void> {
    this.guardando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const payload: RegistrarAsistenciaLoteRequest = {
      operationId: crypto.randomUUID(),
      cursoId: this.auth.contextoEscolar().cursoId,
      fecha: this.fechaSeleccionada(),
      estudiantes: this.listaAlumnos.map((a) => ({
        estudianteId: a.id,
        estado: this.estadosAsistencia[a.id] || 'PRESENTE',
      })),
    };

    if (!this.network.estaOnline()) {
      try {
        await this.offline.encolar(payload);
        this.guardando.set(false);
        this.mensajeExito.set(
          `📦 Modo Offline: Asistencia guardada localmente en IndexedDB (UUID: ${payload.operationId}). Se sincronizará al recuperar internet.`
        );
      } catch (err) {
        this.guardando.set(false);
        this.mensajeError.set('Error al guardar en almacenamiento offline IndexedDB');
      }
      return;
    }

    this.asistenciaService.registrarLote(payload).subscribe({
      next: (res) => {
        this.guardando.set(false);
        const replay = res.headers.get('X-Idempotent-Replay');
        this.mensajeExito.set(
          `✓ Asistencia guardada exitosamente en PostgreSQL (UUID: ${payload.operationId} | Replay: ${replay || 'false'})`
        );
        this.cargarPorcentajes();
      },
      error: async () => {
        await this.offline.encolar(payload);
        this.guardando.set(false);
        this.mensajeExito.set(
          `⚠️ Servidor no disponible. Asistencia respaldada en la cola offline de IndexedDB (UUID: ${payload.operationId}).`
        );
      },
    });
  }

  public async sincronizarCola(): Promise<void> {
    this.sincronizando.set(true);
    const resultado = await this.offline.sincronizarCola(this.asistenciaService);
    this.sincronizando.set(false);
    this.mensajeExito.set(
      `✓ Sincronización completada: ${resultado.sincronizados} lotes enviados a PostgreSQL (${resultado.errores} errores).`
    );
    this.cargarPorcentajes();
  }

  public ejecutarPruebaIdempotencia(): void {
    this.probandoIdempotencia.set(true);
    const uuid = crypto.randomUUID();
    this.uuidIdempotencia.set(uuid);

    const payload: RegistrarAsistenciaLoteRequest = {
      operationId: uuid,
      cursoId: this.auth.contextoEscolar().cursoId,
      fecha: this.fechaSeleccionada(),
      estudiantes: this.listaAlumnos.map((a) => ({
        estudianteId: a.id,
        estado: this.estadosAsistencia[a.id] || 'PRESENTE',
      })),
    };

    this.asistenciaService.probarIdempotenciaConcurrente(payload).subscribe({
      next: (resultados) => {
        this.resultadosIdempotencia.set(resultados);
        this.probandoIdempotencia.set(false);
      },
      error: (err) => {
        console.error('Error en prueba concurrente de idempotencia:', err);
        this.probandoIdempotencia.set(false);
      },
    });
  }
}
