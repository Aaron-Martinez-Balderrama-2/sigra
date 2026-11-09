import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  EstudianteEscolar,
  JustificativoResponse,
  ClasificacionCnn,
} from '../../core/models/sigra.model';
import { JustificativosService } from '../../core/services/justificativos.service';
import { AuthSsoService } from '../../core/services/auth-sso.service';

@Component({
  selector: 'app-justificativos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="espacio-justificativos">
      <!-- Encabezado -->
      <div class="tarjeta encabezado-seccion">
        <div>
          <span class="subtitulo-seccion">Caso de Uso CU-03</span>
          <h2>📄 Gestión y Revisión de Justificativos Escolares</h2>
          <p class="texto-ayuda">
            Recepción de certificados médicos, validación con modelo de Visión CNN y resolución docente con impacto directo en PostgreSQL (asistencia a <code>FALTA_JUSTIFICADA</code>).
          </p>
        </div>
      </div>

      <!-- Alertas -->
      <div *ngIf="mensajeExito()" class="alerta alerta-exito">
        {{ mensajeExito() }}
      </div>
      <div *ngIf="mensajeError()" class="alerta alerta-error">
        {{ mensajeError() }}
      </div>

      <div class="grid-justificativos">
        <!-- COLUMNA 1: Formulario de Registro con Simulación CNN -->
        <div class="tarjeta form-justificativo">
          <div class="tarjeta-titulo">
            <h3>📝 Registrar Justificativo Escolar</h3>
            <p>Ingreso de solicitud con análisis de imagen CNN (TensorFlow.js / Deep Learning)</p>
          </div>

          <form (ngSubmit)="enviarJustificativo()">
            <div class="campo-form">
              <label for="estudiante-select"><strong>Estudiante de Colegio:</strong></label>
              <select
                id="estudiante-select"
                class="input-form"
                [(ngModel)]="estudianteSeleccionado"
                name="estudianteId"
                required
              >
                <option *ngFor="let al of alumnos" [value]="al.id">
                  {{ al.nombre }} ({{ al.id }})
                </option>
              </select>
            </div>

            <div class="campo-form">
              <label for="fecha-falta"><strong>Fecha de la Falta:</strong></label>
              <input
                id="fecha-falta"
                type="date"
                class="input-form"
                [(ngModel)]="fechaFalta"
                name="fechaFalta"
                required
              />
            </div>

            <div class="campo-form">
              <label for="motivo-justificativo"><strong>Motivo / Diagnóstico:</strong></label>
              <textarea
                id="motivo-justificativo"
                rows="3"
                class="input-form"
                [(ngModel)]="motivo"
                name="motivo"
                placeholder="Ej. Certificado médico pediátrico por cuadro respiratorio agudo"
                required
              ></textarea>
            </div>

            <div class="campo-form">
              <label><strong>Simulación de Clasificación por Visión CNN (Deep Learning):</strong></label>
              <div class="opciones-cnn">
                <label class="opcion-radio" [class.seleccionado]="clasificacionCnn === 'LEGIBLE'">
                  <input
                    type="radio"
                    name="clasificacionCnn"
                    value="LEGIBLE"
                    [(ngModel)]="clasificacionCnn"
                  />
                  <span>🟢 <strong>LEGIBLE</strong> (98.4% confianza - Sello y firma claros)</span>
                </label>
                <label class="opcion-radio" [class.seleccionado]="clasificacionCnn === 'ILEGIBLE'">
                  <input
                    type="radio"
                    name="clasificacionCnn"
                    value="ILEGIBLE"
                    [(ngModel)]="clasificacionCnn"
                  />
                  <span>🔴 <strong>ILEGIBLE</strong> (22.1% confianza - Imagen borrosa / dudosa)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-dorado btn-bloque"
              [disabled]="enviando()"
            >
              {{ enviando() ? '⏳ Registrando justificativo...' : '📤 Enviar Justificativo a ms-asistencia' }}
            </button>
          </form>
        </div>

        <!-- COLUMNA 2: Bandeja de Entrada Docente (Revisión y Aprobación) -->
        <div class="tarjeta bandeja-justificativos">
          <div class="tarjeta-titulo flex-entre">
            <div>
              <h3>📬 Bandeja de Justificativos Pendientes</h3>
              <p>Curso: <strong>{{ auth.contextoEscolar().cursoNombre }}</strong></p>
            </div>
            <button class="btn btn-outline" (click)="cargarPendientes()">
              🔄 Actualizar
            </button>
          </div>

          <div *ngIf="cargando()" class="cargando-texto">
            ⏳ Consultando justificativos pendientes en PostgreSQL...
          </div>

          <div *ngIf="!cargando() && pendientes().length === 0" class="sin-pendientes">
            ✓ No hay justificativos pendientes de revisión para este curso.
          </div>

          <div *ngIf="!cargando() && pendientes().length > 0" class="lista-pendientes">
            <div *ngFor="let item of pendientes()" class="tarjeta-pendiente">
              <div class="cabecera-item-pendiente">
                <div>
                  <span class="estudiante-nombre">{{ obtenerNombreAlumno(item.estudianteId) }}</span>
                  <span class="fecha-falta-badge">Falta del {{ item.fechaFalta }}</span>
                </div>
                <span
                  class="badge"
                  [class.badge-presente]="item.clasificacionCnn === 'LEGIBLE'"
                  [class.badge-falta]="item.clasificacionCnn === 'ILEGIBLE'"
                >
                  CNN: {{ item.clasificacionCnn }}
                </span>
              </div>

              <p class="motivo-texto">
                <strong>Motivo:</strong> {{ item.motivo }}
              </p>

              <div class="formulario-revision">
                <input
                  type="text"
                  class="input-form input-obs"
                  placeholder="Observaciones de la revisión docente..."
                  [(ngModel)]="observacionesPorId[item.id]"
                />

                <div class="botones-resolucion">
                  <button
                    class="btn btn-resolucion btn-aprobar"
                    (click)="resolverJustificativo(item.id, true)"
                  >
                    ✓ Aprobar (Falta Justificada)
                  </button>
                  <button
                    class="btn btn-resolucion btn-rechazar"
                    (click)="resolverJustificativo(item.id, false)"
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .espacio-justificativos {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .encabezado-seccion {
        background: linear-gradient(135deg, #ffffff 0%, var(--colegio-azul-claro) 100%);
        border-left: 6px solid var(--colegio-azul-oscuro);
      }

      .subtitulo-seccion {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--colegio-azul-medio);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .texto-ayuda {
        color: var(--texto-secundario);
        font-size: 0.85rem;
        margin-top: 0.25rem;
      }

      .grid-justificativos {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 1.5rem;
      }

      .tarjeta-titulo {
        margin-bottom: 1.25rem;
        border-bottom: 1px solid var(--borde-suave);
        padding-bottom: 0.75rem;
      }

      .flex-entre {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .campo-form {
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .input-form {
        font-family: inherit;
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-md);
        font-size: 0.875rem;
      }

      .opciones-cnn {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .opcion-radio {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-md);
        cursor: pointer;
        font-size: 0.825rem;
      }

      .opcion-radio.seleccionado {
        border-color: var(--colegio-azul-medio);
        background-color: var(--colegio-azul-claro);
      }

      .btn-bloque {
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.75rem;
      }

      .cargando-texto, .sin-pendientes {
        text-align: center;
        padding: 2rem;
        color: var(--texto-secundario);
        font-size: 0.9rem;
      }

      .lista-pendientes {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .tarjeta-pendiente {
        border: 1px solid var(--borde-suave);
        border-radius: var(--radio-md);
        padding: 1rem;
        background: #fdfdfe;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .cabecera-item-pendiente {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .estudiante-nombre {
        font-weight: 700;
        color: var(--colegio-azul-oscuro);
        display: block;
      }

      .fecha-falta-badge {
        font-size: 0.75rem;
        color: var(--texto-secundario);
      }

      .motivo-texto {
        font-size: 0.85rem;
        color: var(--texto-principal);
        background: #f8fafc;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
      }

      .formulario-revision {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .input-obs {
        font-size: 0.8rem;
        padding: 0.4rem 0.65rem;
      }

      .botones-resolucion {
        display: flex;
        gap: 0.5rem;
      }

      .btn-resolucion {
        flex: 1;
        padding: 0.5rem;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: var(--radio-md);
      }

      .btn-aprobar {
        background-color: var(--verde-exito);
        color: #ffffff;
      }
      .btn-aprobar:hover {
        background-color: #166534;
      }

      .btn-rechazar {
        background-color: var(--colegio-rojo-principal);
        color: #ffffff;
      }
      .btn-rechazar:hover {
        background-color: var(--colegio-rojo-hover);
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
    `,
  ],
})
export class JustificativosComponent implements OnInit {
  public readonly auth = inject(AuthSsoService);
  private readonly justificativosService = inject(JustificativosService);

  public readonly alumnos: EstudianteEscolar[] = CATALOGO_ESTUDIANTES_COLEGIO;
  public estudianteSeleccionado: string = 'est-003';
  public fechaFalta: string = '2026-11-07';
  public motivo: string = 'Certificado médico pediátrico por cuadro gripal';
  public clasificacionCnn: ClasificacionCnn = 'LEGIBLE';

  public readonly pendientes = signal<JustificativoResponse[]>([]);
  public readonly cargando = signal<boolean>(false);
  public readonly enviando = signal<boolean>(false);
  public readonly mensajeExito = signal<string | null>(null);
  public readonly mensajeError = signal<string | null>(null);

  public readonly observacionesPorId: Record<string, string> = {};

  ngOnInit(): void {
    this.cargarPendientes();
  }

  public obtenerNombreAlumno(estudianteId: string): string {
    const al = this.alumnos.find((a) => a.id === estudianteId);
    return al ? al.nombre : estudianteId;
  }

  public cargarPendientes(): void {
    this.cargando.set(true);
    const cursoId = this.auth.contextoEscolar().cursoId;

    this.justificativosService.obtenerPendientes(cursoId).subscribe({
      next: (res) => {
        this.pendientes.set(res.datos || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  public enviarJustificativo(): void {
    this.enviando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const payload = {
      estudianteId: this.estudianteSeleccionado,
      cursoId: this.auth.contextoEscolar().cursoId,
      fechaFalta: this.fechaFalta,
      motivo: this.motivo,
      imagenUrl: `certificado_${this.estudianteSeleccionado}.jpg`,
      clasificacionCnn: this.clasificacionCnn,
    };

    this.justificativosService.solicitar(payload).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.mensajeExito.set(
          `✓ Justificativo registrado con éxito (ID: ${res.datos.id}). Clasificación CNN: ${res.datos.clasificacionCnn}`
        );
        this.cargarPendientes();
      },
      error: (err) => {
        this.enviando.set(false);
        this.mensajeError.set('Error al registrar justificativo en ms-asistencia');
      },
    });
  }

  public resolverJustificativo(id: string, aprobado: boolean): void {
    const obs =
      this.observacionesPorId[id] ||
      (aprobado
        ? 'Documento verificado y clasificado como legible. Se actualiza asistencia.'
        : 'Certificado no válido o ilegible.');

    this.justificativosService.revisar(id, { aprobado, observaciones: obs }).subscribe({
      next: (res) => {
        this.mensajeExito.set(
          aprobado
            ? `✓ Justificativo ${id} APROBADO. La falta fue convertida a FALTA_JUSTIFICADA en PostgreSQL.`
            : `✕ Justificativo ${id} RECHAZADO.`
        );
        this.cargarPendientes();
      },
      error: (err) => {
        this.mensajeError.set(`Error al resolver justificativo ${id}`);
      },
    });
  }
}
