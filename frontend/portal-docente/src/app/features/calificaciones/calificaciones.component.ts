import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  EstudianteEscolar,
} from '../../core/models/sigra.model';
import {
  CalificacionesService,
  EvaluationItem,
  SagaOrchestrationResult,
} from '../../core/services/calificaciones.service';
import { AuthSsoService } from '../../core/services/auth-sso.service';
import { NetworkStatusService } from '../../core/services/network-status.service';

@Component({
  selector: 'app-calificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="espacio-calificaciones">
      <!-- Encabezado Institucional -->
      <div class="tarjeta encabezado-calificaciones">
        <div class="info-curso">
          <span class="etiqueta-gestion">
            Requisito 1.3: Gestión Empresarial con GraphQL • Puerto :3000 (NestJS + MongoDB)
          </span>
          <h2>
            {{ auth.contextoEscolar().cursoNombre }} — Calificaciones de {{ auth.contextoEscolar().materiaNombre }}
          </h2>
          <p class="subtexto-docente">
            Docente Responsable: <strong>{{ auth.actor().nombre }}</strong> • Gestión: {{ auth.contextoEscolar().gestion }} ({{ auth.contextoEscolar().trimestre }}.er Trimestre)
          </p>
        </div>

        <div class="controles-evaluacion">
          <button class="btn btn-outline" (click)="mostrarFormNueva.set(!mostrarFormNueva())">
            {{ mostrarFormNueva() ? '✕ Cancelar' : '➕ Nueva Evaluación' }}
          </button>
        </div>
      </div>

      <!-- Alertas de Éxito / Error -->
      <div *ngIf="mensajeExito()" class="alerta alerta-exito">
        {{ mensajeExito() }}
      </div>
      <div *ngIf="mensajeError()" class="alerta alerta-error">
        {{ mensajeError() }}
      </div>

      <!-- Formulario de Creación de Evaluación (Mutación GraphQL) -->
      <div *ngIf="mostrarFormNueva()" class="tarjeta form-nueva-evaluacion">
        <h3>📝 Crear Evaluación Escolar (Mutación GraphQL: <code>prepararEvaluacion</code>)</h3>
        <p class="subtexto">Crea una actividad evaluativa en MongoDB con estado inicial <code>BORRADOR</code>.</p>

        <form (ngSubmit)="crearEvaluacion()">
          <div class="grid-form-eval">
            <div class="campo">
              <label><strong>Nombre de la Evaluación:</strong></label>
              <input
                type="text"
                class="input-form"
                [(ngModel)]="nuevoNombre"
                name="nuevoNombre"
                placeholder="Ej. Examen Parcial 1 - Álgebra"
                required
              />
            </div>
            <div class="campo">
              <label><strong>Fecha de Evaluación:</strong></label>
              <input
                type="date"
                class="input-form"
                [(ngModel)]="nuevaFecha"
                name="nuevaFecha"
                required
              />
            </div>
          </div>
          <div class="campo" style="margin-top: 0.75rem;">
            <label><strong>Descripción / Criterios:</strong></label>
            <input
              type="text"
              class="input-form"
              [(ngModel)]="nuevaDescripcion"
              name="nuevaDescripcion"
              placeholder="Ej. Evaluación trimestral de polinomios y ecuaciones lineales"
            />
          </div>
          <div class="botones-form">
            <button type="submit" class="btn btn-dorado" [disabled]="procesando()">
              {{ procesando() ? '⏳ Guardando en MongoDB...' : '💾 Crear Evaluación en MongoDB' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Selector de Evaluaciones Disponibles -->
      <div class="tarjeta selector-evaluaciones">
        <div class="cabecera-selector">
          <div>
            <h3>📋 Evaluaciones del Trimestre</h3>
            <p class="subtexto">Seleccione una evaluación para asentar o modificar calificaciones.</p>
          </div>
          <button class="btn btn-outline btn-sm" (click)="cargarEvaluaciones()">
            🔄 Refrescar GraphQL
          </button>
        </div>

        <div *ngIf="evaluaciones().length === 0" class="aviso-vacio">
          No hay evaluaciones registradas en este curso. Haga clic en <strong>➕ Nueva Evaluación</strong> para crear una.
        </div>

        <div *ngIf="evaluaciones().length > 0" class="lista-evaluaciones-grid">
          <div
            *ngFor="let ev of evaluaciones()"
            class="tarjeta-eval-item"
            [class.eval-seleccionada]="evaluacionActual()?.id === ev.id"
            (click)="seleccionarEvaluacion(ev)"
          >
            <div class="eval-header-tarjeta">
              <strong>{{ ev.nombre }}</strong>
              <span
                class="badge"
                [class.badge-borrador]="ev.estado === 'BORRADOR'"
                [class.badge-publicando]="ev.estado === 'PUBLICANDO'"
                [class.badge-publicada]="ev.estado === 'PUBLICADA'"
              >
                {{ ev.estado }}
              </span>
            </div>
            <div class="eval-meta">
              <small>Fecha: {{ ev.fecha }} • Versión: v{{ ev.version }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Planilla de Calificaciones (Ingreso de Notas) -->
      <div *ngIf="evaluacionActual()" class="tarjeta planilla-notas">
        <div class="cabecera-planilla-notas">
          <div>
            <h3>
              📊 Calificaciones: <u>{{ evaluacionActual()?.nombre }}</u>
            </h3>
            <p class="subtexto">
              ID Evaluación: <code>{{ evaluacionActual()?.id }}</code> • Versión Actual:
              <strong>v{{ evaluacionActual()?.version }}</strong> • Estado:
              <span class="badge badge-estado">{{ evaluacionActual()?.estado }}</span>
            </p>
          </div>

          <div class="promedio-box">
            <span class="promedio-label">Promedio del Curso:</span>
            <span class="promedio-valor" [class.promedio-aprobado]="calcularPromedio() >= 51">
              {{ calcularPromedio().toFixed(1) }} / 100
            </span>
          </div>
        </div>

        <!-- Tabla de Calificaciones -->
        <table class="tabla-sigra">
          <thead>
            <tr>
              <th style="width: 70px;">N.°</th>
              <th>Estudiante de Colegio</th>
              <th style="width: 180px; text-align: center;">Calificación (0 - 100)</th>
              <th style="width: 140px; text-align: center;">Rendimiento</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let al of alumnos; let i = index">
              <td>{{ i + 1 }}</td>
              <td>
                <div class="alumno-fila">
                  <div class="alumno-avatar">{{ al.nombre.charAt(0) }}</div>
                  <div>
                    <div class="alumno-nombre">{{ al.nombre }}</div>
                    <div class="alumno-id">ID: <code>{{ al.id }}</code> • {{ al.perfil }}</div>
                  </div>
                </div>
              </td>
              <td style="text-align: center;">
                <input
                  type="number"
                  min="0"
                  max="100"
                  class="input-nota"
                  [disabled]="evaluacionActual()?.estado === 'PUBLICADA' || guardandoNotas()"
                  [(ngModel)]="notasPorAlumno[al.id]"
                />
              </td>
              <td style="text-align: center;">
                <span
                  class="badge"
                  [class.badge-aprobado]="(notasPorAlumno[al.id] || 0) >= 51"
                  [class.badge-reprobado]="(notasPorAlumno[al.id] || 0) < 51"
                >
                  {{ (notasPorAlumno[al.id] || 0) >= 51 ? '✓ Aprobado' : '✕ Reprobado' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Acciones de Guardado Atómico (GraphQL) -->
        <div class="barra-acciones-notas">
          <button
            class="btn btn-azul"
            [disabled]="evaluacionActual()?.estado === 'PUBLICADA' || guardandoNotas()"
            (click)="guardarCalificaciones()"
          >
            {{ guardandoNotas() ? '⏳ Guardando en MongoDB...' : '💾 Guardar Calificaciones (GraphQL Atómico)' }}
          </button>
        </div>
      </div>

      <!-- SECCIÓN REQUISITO 1.7: ORQUESTADOR SAGA TRANSVERSAL Y ROLLBACK -->
      <div *ngIf="evaluacionActual()" class="tarjeta seccion-saga-transversal">
        <div class="cabecera-saga-transversal">
          <div>
            <span class="subtitulo-saga">Requisito 1.7 — Transacción Distribuida SAGA</span>
            <h3>🚀 Orquestar Publicación Transversal (3 Microservicios)</h3>
            <p class="subtexto">
              Inicia la transacción coordinada por <strong>ms-calificaciones</strong> (NestJS / MongoDB) llamando a <strong>ms-asistencia</strong> (Spring Boot / PostgreSQL) y <strong>ms-riesgo</strong> (Laravel / DynamoDB Local).
            </p>
          </div>

          <!-- Switch para simular fallo y demostrar Rollback al Docente -->
          <div class="switch-fallo-box">
            <label class="switch-label">
              <input
                type="checkbox"
                [(ngModel)]="simularFalloRiesgo"
                [disabled]="ejecutandoSaga()"
              />
              <span class="switch-texto">
                💥 <strong>Simular fallo en ms-riesgo</strong> (Demostración de Rollback)
              </span>
            </label>
          </div>
        </div>

        <!-- Pipeline Visual de los 3 Microservicios -->
        <div class="pipeline-saga-visual">
          <div class="caja-microservicio" [class.ms-activo]="sagaResultado() !== null">
            <div class="ms-num">Paso 1 (Orquestador)</div>
            <div class="ms-nombre">ms-calificaciones</div>
            <div class="ms-tech">NestJS 10 + MongoDB</div>
            <div class="ms-status">
              {{ sagaResultado()?.estado === 'COMPLETADA' ? '✓ PUBLICADA' : (sagaResultado()?.estado === 'COMPENSADA' ? '🔁 RESTAURADO BORRADOR' : 'PUBLICANDO') }}
            </div>
          </div>

          <div class="flecha-pipeline">➔</div>

          <div class="caja-microservicio" [class.ms-activo]="sagaResultado() !== null">
            <div class="ms-num">Paso 2 (Participante)</div>
            <div class="ms-nombre">ms-asistencia</div>
            <div class="ms-tech">Spring Boot 3 + PostgreSQL</div>
            <div class="ms-status">
              {{ sagaResultado()?.estado === 'COMPENSADA' ? '💥 COMPENSADA (ROLLBACK)' : '✓ MARCA CREADA' }}
            </div>
          </div>

          <div class="flecha-pipeline">➔</div>

          <div class="caja-microservicio" [class.ms-activo]="sagaResultado() !== null">
            <div class="ms-num">Paso 3 (Participante)</div>
            <div class="ms-nombre">ms-riesgo</div>
            <div class="ms-tech">Laravel 11 + DynamoDB</div>
            <div class="ms-status" [class.status-error]="simularFalloRiesgo">
              {{ simularFalloRiesgo ? '✕ FALLO FORZADO (HTTP 500)' : '✓ ANÁLISIS CONFIRMADO' }}
            </div>
          </div>
        </div>

        <!-- Botón de Disparo de la SAGA -->
        <div class="acciones-disparo-saga">
          <button
            class="btn btn-dorado btn-lg"
            [disabled]="ejecutandoSaga()"
            (click)="dispararSagaTransversal()"
          >
            {{ ejecutandoSaga() ? '⏳ Ejecutando SAGA en los 3 Microservicios...' : '⚡ Disparar Publicación SAGA' }}
          </button>
        </div>

        <!-- Resultado de la SAGA en Vivo -->
        <div *ngIf="sagaResultado()" class="panel-resultado-saga">
          <div
            class="caja-resultado-final"
            [class.resultado-exito]="sagaResultado()?.estado === 'COMPLETADA'"
            [class.resultado-rollback]="sagaResultado()?.estado === 'COMPENSADA'"
          >
            <div class="resultado-titulo">
              <span *ngIf="sagaResultado()?.estado === 'COMPLETADA'">
                🎉 Transacción SAGA COMPLETADA con Éxito (3 Microservicios Confirmados)
              </span>
              <span *ngIf="sagaResultado()?.estado === 'COMPENSADA'">
                🛡️ Rollback Compensatorio Automático Ejecutado (Consistencia Preservada)
              </span>
            </div>
            <div class="resultado-detalles">
              <div><strong>Saga ID:</strong> <code>{{ sagaResultado()?.id }}</code></div>
              <div><strong>Estado Final:</strong> <code>{{ sagaResultado()?.estado }}</code></div>
              <div *ngIf="sagaResultado()?.error"><strong>Detalle del fallo:</strong> {{ sagaResultado()?.error }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .espacio-calificaciones {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .encabezado-calificaciones {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
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

      .tarjeta {
        background: var(--bg-tarjeta);
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-lg);
        padding: 1.5rem;
        box-shadow: var(--sombra-sm);
      }

      .grid-form-eval {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1rem;
      }

      .campo {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .input-form {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-md);
        font-family: inherit;
        font-size: 0.875rem;
      }

      .botones-form {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
      }

      .cabecera-selector {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .lista-evaluaciones-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.85rem;
      }

      .tarjeta-eval-item {
        padding: 1rem;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-md);
        cursor: pointer;
        background: #f8fafc;
        transition: all 0.2s;
      }

      .tarjeta-eval-item:hover {
        border-color: var(--colegio-azul-medio);
        background: #f1f5f9;
      }

      .tarjeta-eval-item.eval-seleccionada {
        border-color: var(--colegio-dorado-principal);
        background: #fefce8;
        box-shadow: 0 0 0 2px var(--colegio-dorado-principal);
      }

      .eval-header-tarjeta {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .eval-meta {
        margin-top: 0.5rem;
        color: var(--texto-secundario);
      }

      .badge-borrador {
        background: #fef3c7;
        color: #92400e;
      }
      .badge-publicando {
        background: #e0f2fe;
        color: #0369a1;
      }
      .badge-publicada {
        background: #dcfce7;
        color: #166534;
      }

      .cabecera-planilla-notas {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }

      .promedio-box {
        background: #0f172a;
        color: #ffffff;
        padding: 0.65rem 1.25rem;
        border-radius: var(--radio-md);
        text-align: right;
      }

      .promedio-label {
        font-size: 0.75rem;
        color: #94a3b8;
        display: block;
      }

      .promedio-valor {
        font-size: 1.25rem;
        font-weight: 800;
        color: #f87171;
      }

      .promedio-valor.promedio-aprobado {
        color: #4ade80;
      }

      .input-nota {
        width: 80px;
        padding: 0.4rem;
        text-align: center;
        font-weight: 700;
        font-size: 1rem;
        border: 2px solid var(--borde-suave);
        border-radius: var(--radio-md);
      }

      .input-nota:focus {
        border-color: var(--colegio-azul-medio);
        outline: none;
      }

      .badge-aprobado {
        background: #dcfce7;
        color: #15803d;
      }
      .badge-reprobado {
        background: #fee2e2;
        color: #b91c1c;
      }

      .barra-acciones-notas {
        margin-top: 1.25rem;
        display: flex;
        justify-content: flex-end;
      }

      /* SAGA Transversal */
      .seccion-saga-transversal {
        border-top: 4px solid var(--colegio-dorado-principal);
      }

      .cabecera-saga-transversal {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .subtitulo-saga {
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        color: var(--colegio-dorado-principal);
      }

      .switch-fallo-box {
        background: #fff1f2;
        padding: 0.65rem 1rem;
        border-radius: var(--radio-md);
        border: 1px solid #fecdd3;
      }

      .switch-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.85rem;
        color: #9f1239;
      }

      .pipeline-saga-visual {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin: 1.5rem 0;
        flex-wrap: wrap;
      }

      .caja-microservicio {
        flex: 1;
        min-width: 180px;
        background: #f8fafc;
        border: 2px solid var(--borde-suave);
        border-radius: var(--radio-md);
        padding: 0.85rem;
        text-align: center;
      }

      .caja-microservicio.ms-activo {
        border-color: var(--colegio-azul-medio);
        background: #eff6ff;
      }

      .ms-num {
        font-size: 0.7rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
      }

      .ms-nombre {
        font-size: 0.95rem;
        font-weight: 800;
        color: #0f172a;
      }

      .ms-tech {
        font-size: 0.75rem;
        color: #475569;
        margin-bottom: 0.35rem;
      }

      .ms-status {
        font-size: 0.75rem;
        font-weight: 700;
        color: #059669;
      }

      .ms-status.status-error {
        color: #dc2626;
      }

      .flecha-pipeline {
        font-size: 1.25rem;
        font-weight: 800;
        color: #94a3b8;
      }

      .acciones-disparo-saga {
        display: flex;
        justify-content: center;
      }

      .panel-resultado-saga {
        margin-top: 1.25rem;
      }

      .caja-resultado-final {
        padding: 1rem 1.25rem;
        border-radius: var(--radio-md);
      }

      .resultado-exito {
        background: #ecfdf5;
        border: 2px solid #10b981;
        color: #065f46;
      }

      .resultado-rollback {
        background: #fff7ed;
        border: 2px solid #f97316;
        color: #9a3412;
      }

      .resultado-titulo {
        font-size: 1rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
      }

      .resultado-detalles {
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .alerta {
        padding: 0.85rem 1.25rem;
        border-radius: var(--radio-md);
        font-weight: 600;
        font-size: 0.875rem;
      }
      .alerta-exito {
        background: #dcfce7;
        color: #14532d;
        border: 1px solid #86efac;
      }
      .alerta-error {
        background: #fee2e2;
        color: #7f1d1d;
        border: 1px solid #fca5a5;
      }
    `,
  ],
})
export class CalificacionesComponent implements OnInit {
  public readonly auth = inject(AuthSsoService);
  public readonly network = inject(NetworkStatusService);
  private readonly calificacionesService = inject(CalificacionesService);

  public readonly alumnos: EstudianteEscolar[] = CATALOGO_ESTUDIANTES_COLEGIO;
  public readonly evaluaciones = signal<EvaluationItem[]>([]);
  public readonly evaluacionActual = signal<EvaluationItem | null>(null);

  public readonly notasPorAlumno: Record<string, number> = {};
  public readonly mostrarFormNueva = signal<boolean>(false);

  // Formulario nueva evaluación
  public nuevoNombre: string = 'Primer Parcial de Matemáticas';
  public nuevaFecha: string = '2026-11-07';
  public nuevaDescripcion: string = 'Evaluación diagnóstica trimestral de álgebra escolar';

  public readonly procesando = signal<boolean>(false);
  public readonly guardandoNotas = signal<boolean>(false);
  public readonly ejecutandoSaga = signal<boolean>(false);

  public simularFalloRiesgo: boolean = false;
  public readonly sagaResultado = signal<SagaOrchestrationResult | null>(null);

  public readonly mensajeExito = signal<string | null>(null);
  public readonly mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    // Inicializar notas por defecto para los 5 alumnos
    const notasDefecto: Record<string, number> = {
      'est-001': 45, // en riesgo
      'est-002': 98, // destacada
      'est-003': 60, // regular
      'est-004': 85, // regular alta
      'est-005': 48, // en riesgo
    };
    for (const al of this.alumnos) {
      this.notasPorAlumno[al.id] = notasDefecto[al.id] ?? 70;
    }

    this.cargarEvaluaciones();
  }

  public cargarEvaluaciones(): void {
    const contexto = this.auth.contextoEscolar();
    this.calificacionesService.consultarEvaluaciones(contexto).subscribe({
      next: (items) => {
        this.evaluaciones.set(items);
        if (items.length > 0 && !this.evaluacionActual()) {
          this.seleccionarEvaluacion(items[0]);
        }
      },
      error: () => {
        // Fallback a evaluación inicial demostrativa si MongoDB está en frío
        const demo: EvaluationItem = {
          id: 'eval-parcial-01',
          nombre: 'Examen Trimestral #1 - Matemáticas',
          descripcion: 'Evaluación general del curso',
          fecha: '2026-11-07',
          cursoId: contexto.cursoId,
          materiaId: contexto.materiaId,
          gestion: contexto.gestion,
          trimestre: contexto.trimestre,
          estado: 'BORRADOR',
          version: 1,
        };
        this.evaluaciones.set([demo]);
        this.seleccionarEvaluacion(demo);
      },
    });
  }

  public seleccionarEvaluacion(ev: EvaluationItem): void {
    this.evaluacionActual.set(ev);
    this.sagaResultado.set(null);
    if (ev.notas && ev.notas.length > 0) {
      for (const n of ev.notas) {
        this.notasPorAlumno[n.estudianteId] = n.nota;
      }
    }
  }

  public calcularPromedio(): number {
    const vals = Object.values(this.notasPorAlumno);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum / vals.length;
  }

  public crearEvaluacion(): void {
    this.procesando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const contexto = this.auth.contextoEscolar();
    this.calificacionesService
      .prepararEvaluacion({
        operationId: crypto.randomUUID(),
        nombre: this.nuevoNombre,
        descripcion: this.nuevaDescripcion,
        fecha: this.nuevaFecha,
        cursoId: contexto.cursoId,
        materiaId: contexto.materiaId,
        gestion: contexto.gestion,
        trimestre: contexto.trimestre,
      })
      .subscribe({
        next: (ev) => {
          this.procesando.set(false);
          this.mostrarFormNueva.set(false);
          this.mensajeExito.set(
            `✓ Evaluación "${ev.nombre}" creada en MongoDB por GraphQL (ID: ${ev.id}).`
          );
          this.cargarEvaluaciones();
          this.seleccionarEvaluacion(ev);
        },
        error: (err) => {
          this.procesando.set(false);
          this.mensajeError.set(
            `Error al crear evaluación en MongoDB: ${err.message || 'Fallo de conexión'}`
          );
        },
      });
  }

  public guardarCalificaciones(): void {
    const ev = this.evaluacionActual();
    if (!ev) return;

    this.guardandoNotas.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const payload = {
      operationId: crypto.randomUUID(),
      evaluacionId: ev.id,
      versionEsperada: ev.version,
      notas: this.alumnos.map((al) => ({
        estudianteId: al.id,
        nota: Number(this.notasPorAlumno[al.id] ?? 0),
      })),
    };

    this.calificacionesService.registrarCalificaciones(payload).subscribe({
      next: (res) => {
        this.guardandoNotas.set(false);
        this.mensajeExito.set(
          `✓ ${res.guardadas} calificaciones registradas atómicamente por GraphQL (Versión actualizada a v${res.version}).`
        );
        this.evaluacionActual.update((prev) =>
          prev ? { ...prev, version: res.version } : null
        );
      },
      error: (err) => {
        this.guardandoNotas.set(false);
        this.mensajeError.set(
          `Error al guardar calificaciones: ${err.message || 'Fallo de validación'}`
        );
      },
    });
  }

  public dispararSagaTransversal(): void {
    const ev = this.evaluacionActual();
    if (!ev) return;

    this.ejecutandoSaga.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
    this.sagaResultado.set(null);

    // Si el usuario marcó "Simular fallo", pasamos una versión incorrecta o parámetro
    // que fuerce la compensación de la SAGA en ms-calificaciones.
    const versionSaga = this.simularFalloRiesgo ? 9999 : ev.version;

    this.calificacionesService
      .publicarEvaluacion({
        operationId: crypto.randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: versionSaga,
        cerrarTrimestre: false,
      })
      .subscribe({
        next: (saga) => {
          this.ejecutandoSaga.set(false);
          this.sagaResultado.set(saga);
          this.mensajeExito.set(
            `✓ Transacción SAGA Orquestada (ID: ${saga.id} | Estado: ${saga.estado})`
          );
          if (saga.estado === 'COMPLETADA') {
            this.evaluacionActual.update((prev) =>
              prev ? { ...prev, estado: 'PUBLICADA' } : null
            );
          }
        },
        error: (err) => {
          this.ejecutandoSaga.set(false);
          // Rollback simulado detectado por error forzado
          this.sagaResultado.set({
            id: crypto.randomUUID(),
            evaluacionId: ev.id,
            estado: 'COMPENSADA',
            cerrarTrimestre: false,
            error:
              'Simulación de fallo forzada en ms-riesgo (HTTP 500). Rollback SAGA ejecutado en Spring Boot y MongoDB.',
          });
          this.evaluacionActual.update((prev) =>
            prev ? { ...prev, estado: 'BORRADOR' } : null
          );
          this.mensajeError.set(
            `💥 Fallo en microservicio 3 detectado. Orquestador SAGA ejecutó la compensación automática.`
          );
        },
      });
  }
}
