import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SagaMarcasService,
  MarcaSagaResponse,
  CrearMarcaSagaRequest,
} from '../../core/services/saga-marcas.service';
import { AuthSsoService } from '../../core/services/auth-sso.service';

@Component({
  selector: 'app-saga-marcas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="espacio-saga">
      <!-- Encabezado -->
      <div class="tarjeta encabezado-saga">
        <div>
          <span class="subtitulo-saga">{{ auth.modoTest() ? 'Caso de Uso CU-04 (Requisitos RF-06 y RF-07)' : 'Trazabilidad y Consistencia de Asistencia' }}</span>
          <h2>Monitor de Marcas SAGA de Asistencia (Transacción Distribuida)</h2>
          <p class="texto-saga">
            Evidencia del comportamiento de <code>ms-asistencia</code> (PostgreSQL) como participante en la SAGA Transversal con soporte de idempotencia y reversión por compensación (Rollback).
          </p>
        </div>
      </div>

      <!-- Diagrama de Pasos SAGA -->
      <div class="tarjeta diagrama-saga">
        <h3>Pipeline de la Transacción Distribuida SAGA</h3>
        <div class="pasos-pipeline">
          <div class="paso-caja paso-otro">
            <span class="paso-num">Paso 1</span>
            <strong>ms-calificaciones</strong>
            <small>NestJS + MongoDB</small>
            <span class="paso-estado">PUBLICANDO</span>
          </div>

          <div class="conector">➔</div>

          <div class="paso-caja paso-tu-servicio">
            <span class="paso-num">Paso 2 (Tu Microservicio)</span>
            <strong>ms-asistencia</strong>
            <small>Spring Boot 3 + PostgreSQL</small>
            <span class="paso-estado">CREAR MARCA / COMPENSAR</span>
          </div>

          <div class="conector">➔</div>

          <div class="paso-caja paso-otro">
            <span class="paso-num">Paso 3</span>
            <strong>ms-riesgo</strong>
            <small>Laravel 11 + DynamoDB</small>
            <span class="paso-estado">ANÁLISIS PENDIENTE</span>
          </div>
        </div>
      </div>

      <!-- Alertas -->
      <div *ngIf="mensajeExito()" class="alerta alerta-exito">
        {{ mensajeExito() }}
      </div>
      <div *ngIf="mensajeError()" class="alerta alerta-error">
        {{ mensajeError() }}
      </div>

      <div class="grid-saga">
        <!-- Panel 1: Crear Marca de Seguimiento -->
        <div class="tarjeta">
          <h3>📌 Crear Marca SAGA en ms-asistencia</h3>
          <p class="subtexto">Simula la invocación que realiza el orquestador durante el Paso 2.</p>

          <form (ngSubmit)="crearMarca()">
            <div class="campo">
              <label><strong>operationId (Idempotencia):</strong></label>
              <div class="flex-input">
                <input type="text" class="input-form" [(ngModel)]="opId" name="opId" required />
                <button type="button" class="btn btn-outline" (click)="generarNuevoUuid()">🎲 Nuevo</button>
              </div>
            </div>

            <div class="campo">
              <label><strong>sagaId (UUID de la SAGA):</strong></label>
              <input type="text" class="input-form" [(ngModel)]="sagaId" name="sagaId" required />
            </div>

            <div class="campo">
              <label><strong>evaluacionId:</strong></label>
              <input type="text" class="input-form" [(ngModel)]="evaluacionId" name="evaluacionId" required />
            </div>

            <div class="campo">
              <label><strong>cursoId:</strong></label>
              <input type="text" class="input-form" [(ngModel)]="cursoId" name="cursoId" required />
            </div>

            <button type="submit" class="btn btn-dorado btn-bloque" [disabled]="procesando()">
              {{ procesando() ? 'Procesando en PostgreSQL...' : '💾 Crear Marca de Asistencia (Paso 2)' }}
            </button>
          </form>
        </div>

        <!-- Panel 2: Consultar y Compensar (Rollback) -->
        <div class="tarjeta">
          <h3>💥 Demostración de Rollback (Compensación)</h3>
          <p class="subtexto">
            Si un paso posterior falla, el orquestador revierte la marca invocando <code>POST /api/v1/asistencia/marcas/&#123;id&#125;/compensar</code>.
          </p>

          <div class="campo">
            <label><strong>Consultar por ID de Marca u operationId:</strong></label>
            <div class="flex-input">
              <input
                type="text"
                class="input-form"
                [(ngModel)]="busquedaId"
                placeholder="UUID de la marca o de la operación..."
              />
              <button class="btn btn-azul" (click)="consultarMarca()">🔍 Buscar</button>
            </div>
          </div>

          <div *ngIf="marcaActual()" class="tarjeta-marca-resultado">
            <div class="marca-cabecera">
              <span class="marca-id">ID: <code>{{ marcaActual()?.id }}</code></span>
              <span
                class="badge"
                [class.badge-presente]="marcaActual()?.estado === 'REGISTRADA'"
                [class.badge-falta]="marcaActual()?.estado === 'COMPENSADA'"
              >
                {{ marcaActual()?.estado }}
              </span>
            </div>

            <div class="marca-detalles">
              <div><strong>SAGA ID:</strong> <code>{{ marcaActual()?.sagaId }}</code></div>
              <div><strong>Evaluación:</strong> <code>{{ marcaActual()?.evaluacionId }}</code></div>
              <div><strong>Curso:</strong> {{ marcaActual()?.cursoId }}</div>
              <div><strong>Última actualización:</strong> {{ marcaActual()?.updatedAt || marcaActual()?.createdAt }}</div>
            </div>

            <div *ngIf="marcaActual()?.estado === 'REGISTRADA'" class="seccion-accion-compensar">
              <button
                class="btn btn-rojo btn-bloque"
                [disabled]="procesando()"
                (click)="compensarMarcaActual()"
              >
                💥 Ejecutar Rollback / Compensar Marca en ms-asistencia
              </button>
            </div>

            <div *ngIf="marcaActual()?.estado === 'COMPENSADA'" class="aviso-compensado">
              ✓ Esta marca ya fue revertida y compensada exitosamente (Rollback completado sin efectos colaterales).
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .espacio-saga {
        display: flex;
        flex-direction: column;
        gap: var(--space-md, 1rem);
      }

      .encabezado-saga {
        background: linear-gradient(135deg, #ffffff 0%, var(--colegio-azul-claro) 100%);
        border-left: 4px solid var(--colegio-azul-oscuro);
        padding: clamp(0.75rem, 1vw, 1rem) 1.25rem;
      }

      .encabezado-saga h2 {
        font-size: clamp(0.95rem, 1.2vw, 1.2rem);
        margin: 0.15rem 0;
      }

      .subtitulo-saga {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--colegio-azul-medio);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .texto-saga {
        color: var(--texto-secundario);
        font-size: 0.8rem;
        margin-top: 0.15rem;
      }

      .diagrama-saga {
        background: #ffffff;
        padding: clamp(0.85rem, 1.2vw, 1.25rem);
      }

      .diagrama-saga h3 {
        font-size: clamp(0.9rem, 1.1vw, 1.05rem);
      }

      .pasos-pipeline {
        margin-top: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .paso-caja {
        flex: 1;
        min-width: 180px;
        padding: 0.65rem 0.75rem;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        border: 1px solid var(--borde-suave);
      }

      .paso-tu-servicio {
        background: #fefce8;
        border: 2px solid var(--colegio-dorado-principal);
        box-shadow: var(--sombra-sm);
      }

      .paso-otro {
        background: #f8fafc;
      }

      .paso-num {
        font-size: 0.68rem;
        font-weight: 800;
        color: var(--texto-secundario);
        text-transform: uppercase;
      }

      .paso-estado {
        margin-top: 0.25rem;
        font-size: 0.68rem;
        font-weight: 800;
        color: var(--colegio-azul-medio);
      }

      .conector {
        font-size: 1.1rem;
        color: var(--texto-secundario);
      }

      .grid-saga {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }

      .tarjeta {
        background: var(--bg-tarjeta);
        border: 1px solid var(--borde-suave);
        border-radius: var(--radius-lg);
        padding: clamp(0.85rem, 1.2vw, 1.25rem);
        box-shadow: var(--sombra-sm);
      }

      .tarjeta h3 {
        font-size: clamp(0.9rem, 1.1vw, 1.05rem);
      }

      .subtexto {
        font-size: 0.78rem;
        color: var(--texto-secundario);
        margin-bottom: 0.75rem;
      }

      .campo {
        margin-bottom: 0.65rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .flex-input {
        display: flex;
        gap: 0.45rem;
      }

      .input-form {
        flex: 1;
        font-family: inherit;
        padding: 0.42rem 0.65rem;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radius-md);
        font-size: 0.82rem;
      }

      .btn-bloque {
        width: 100%;
        margin-top: 0.65rem;
        padding: 0.55rem;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .tarjeta-marca-resultado {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: #f8fafc;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .marca-cabecera {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .marca-detalles {
        font-size: 0.78rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .seccion-accion-compensar {
        margin-top: 0.45rem;
      }

      .aviso-compensado {
        padding: 0.45rem 0.65rem;
        background: #fee2e2;
        color: #7f1d1d;
        border-radius: var(--radius-md);
        font-size: 0.76rem;
        font-weight: 700;
        text-align: center;
      }

      .alerta {
        padding: 0.65rem 1rem;
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: 0.82rem;
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
    `
  ],
})
export class SagaMarcasComponent implements OnInit {
  public readonly auth = inject(AuthSsoService);
  private readonly sagaMarcasService = inject(SagaMarcasService);

  public opId: string = crypto.randomUUID();
  public sagaId: string = crypto.randomUUID();
  public evaluacionId: string = 'eval-parcial-01';
  public cursoId: string = 'sec-3b';

  public busquedaId: string = '';
  public readonly marcaActual = signal<MarcaSagaResponse | null>(null);
  public readonly procesando = signal<boolean>(false);
  public readonly mensajeExito = signal<string | null>(null);
  public readonly mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    this.busquedaId = this.opId;
  }

  public generarNuevoUuid(): void {
    this.opId = crypto.randomUUID();
    this.sagaId = crypto.randomUUID();
  }

  public crearMarca(): void {
    this.procesando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const payload: CrearMarcaSagaRequest = {
      operationId: this.opId,
      sagaId: this.sagaId,
      evaluacionId: this.evaluacionId,
      cursoId: this.cursoId,
    };

    this.sagaMarcasService.crearMarca(payload).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.marcaActual.set(res.datos);
        this.busquedaId = res.datos.id;
        this.mensajeExito.set(
          `✓ Marca SAGA confirmada en ms-asistencia (ID: ${res.datos.id} | Estado: ${res.datos.estado})`
        );
      },
      error: () => {
        this.procesando.set(false);
        this.mensajeError.set('Error al registrar la marca SAGA en ms-asistencia');
      },
    });
  }

  public consultarMarca(): void {
    if (!this.busquedaId.trim()) return;

    this.procesando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    this.sagaMarcasService.consultarMarca(this.busquedaId.trim()).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.marcaActual.set(res.datos);
        this.mensajeExito.set(`✓ Marca SAGA encontrada.`);
      },
      error: () => {
        this.procesando.set(false);
        this.mensajeError.set(`No se encontró marca SAGA con identificador: ${this.busquedaId}`);
      },
    });
  }

  public compensarMarcaActual(): void {
    const marca = this.marcaActual();
    if (!marca) return;

    this.procesando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    this.sagaMarcasService
      .compensarMarca(marca.id, 'Simulación de Rollback por fallo en ms-riesgo', marca.sagaId)
      .subscribe({
        next: (res) => {
          this.procesando.set(false);
          this.marcaActual.set(res.datos);
          this.mensajeExito.set(
            `💥 Marca SAGA revertida a estado COMPENSADA exitosamente (Rollback completado).`
          );
        },
        error: () => {
          this.procesando.set(false);
          this.mensajeError.set('Error al ejecutar compensación de marca SAGA');
        },
      });
  }
}
