import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  EstudianteEscolar,
  JustificativoResponse,
} from '../../core/models/sigra.model';
import { JustificativosService } from '../../core/services/justificativos.service';
import { AuthSsoService } from '../../core/services/auth-sso.service';

@Component({
  selector: 'app-justificativos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="espacio-justificativos">
      <!-- Encabezado de Bandeja -->
      <div class="tarjeta encabezado-seccion">
        <div class="flex-entre">
          <div>
            <span class="subtitulo-seccion">Módulo de Revisión y Aprobación Docente</span>
            <h2>📬 Bandeja de Justificativos Escolares</h2>
            <p class="texto-ayuda">
              Revisión y resolución de certificados médicos remitidos desde el Escáner Documental con dictamen de la Red Neuronal (CNN). Al aprobar una solicitud, la inasistencia se actualiza a <code>FALTA_JUSTIFICADA</code> en PostgreSQL.
            </p>
          </div>
          <div class="acciones-encabezado">
            <button class="btn btn-outline" (click)="cargarPendientes()">
              🔄 Actualizar Bandeja
            </button>
          </div>
        </div>
      </div>

      <!-- Alertas de éxito y error -->
      <div *ngIf="mensajeExito()" class="alerta alerta-exito">
        {{ mensajeExito() }}
      </div>
      <div *ngIf="mensajeError()" class="alerta alerta-error">
        {{ mensajeError() }}
      </div>

      <!-- Contenedor Principal: Bandeja a Ancho Completo -->
      <div class="tarjeta bandeja-principal">
        <div class="tarjeta-titulo flex-entre">
          <div>
            <h3>Solicitudes Pendientes de Resolución</h3>
            <p>Curso: <strong>{{ auth.contextoEscolar().cursoNombre }}</strong> (Código: <code>{{ auth.contextoEscolar().cursoId }}</code>)</p>
          </div>
          <span class="badge badge-info" *ngIf="!cargando()">
            {{ pendientes().length }} pendientes
          </span>
        </div>

        <div *ngIf="cargando()" class="cargando-texto">
          ⏳ Consultando justificativos pendientes en PostgreSQL (ms-asistencia)...
        </div>

        <div *ngIf="!cargando() && pendientes().length === 0" class="sin-pendientes">
          <div class="icono-vacio">✓</div>
          <h4>No hay justificativos pendientes de revisión para este curso</h4>
          <p>
            Las solicitudes y certificados médicos digitalizados desde el <strong>Escáner Documental</strong> (con validación de la Red Neuronal CNN) aparecerán en esta lista para su evaluación docente.
          </p>
        </div>

        <div *ngIf="!cargando() && pendientes().length > 0" class="lista-pendientes">
          <div *ngFor="let item of pendientes()" class="tarjeta-pendiente">
            <div class="cabecera-item-pendiente">
              <div class="estudiante-info">
                <span class="estudiante-nombre">{{ obtenerNombreAlumno(item.estudianteId) }}</span>
                <span class="estudiante-id">Código: <code>{{ item.estudianteId }}</code></span>
                <span class="fecha-falta-badge">📅 Falta del {{ item.fechaFalta }}</span>
              </div>
              <div class="dictamen-cnn-badge">
                <span
                  class="badge badge-lg"
                  [class.badge-presente]="item.clasificacionCnn === 'LEGIBLE'"
                  [class.badge-falta]="item.clasificacionCnn === 'ILEGIBLE'"
                >
                  {{ item.clasificacionCnn === 'LEGIBLE' ? '✓ DOCUMENTO LEGIBLE (CNN)' : '✕ DOCUMENTO ILEGIBLE (CNN)' }}
                </span>
              </div>
            </div>

            <div class="cuerpo-pendiente">
              <div class="motivo-box">
                <strong>Motivo / Diagnóstico médico respaldado:</strong>
                <p>{{ item.motivo }}</p>
              </div>
            </div>

            <div class="formulario-revision">
              <label class="label-resolucion"><strong>Resolución y Observación del Docente:</strong></label>
              <div class="fila-resolucion">
                <input
                  type="text"
                  class="input-form input-obs"
                  placeholder="Escriba observaciones de la resolución (opcional)..."
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
        gap: var(--space-md, 1rem);
      }

      .encabezado-seccion {
        background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
        border-left: 4px solid var(--colegio-azul-oscuro, #0f2d59);
        padding: clamp(0.75rem, 1vw, 1rem) 1.25rem;
      }

      .subtitulo-seccion {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--colegio-dorado-oscuro, #b45309);
        display: block;
        margin-bottom: 0.25rem;
      }

      .encabezado-seccion h2 {
        margin: 0 0 0.25rem 0;
        font-size: 1.25rem;
        color: var(--colegio-azul-oscuro, #0f2d59);
      }

      .texto-ayuda {
        margin: 0;
        font-size: 0.82rem;
        color: var(--texto-secundario, #64748b);
        line-height: 1.4;
      }

      .flex-entre {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .bandeja-principal {
        background: #ffffff;
        border: 1px solid var(--borde-suave, #e2e8f0);
        border-radius: var(--radius-md, 8px);
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }

      .tarjeta-titulo h3 {
        margin: 0 0 0.2rem 0;
        font-size: 1.05rem;
        color: var(--colegio-azul-oscuro, #0f2d59);
      }

      .tarjeta-titulo p {
        margin: 0;
        font-size: 0.8rem;
        color: var(--texto-secundario, #64748b);
      }

      .badge-info {
        background-color: #e0f2fe;
        color: #0369a1;
        font-weight: 700;
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.78rem;
      }

      .cargando-texto {
        text-align: center;
        padding: 2.5rem;
        color: var(--texto-secundario, #64748b);
        font-size: 0.9rem;
      }

      .sin-pendientes {
        text-align: center;
        padding: 3rem 1.5rem;
        color: var(--texto-secundario, #64748b);
      }

      .sin-pendientes .icono-vacio {
        width: 48px;
        height: 48px;
        line-height: 48px;
        border-radius: 50%;
        background-color: #dcfce7;
        color: #15803d;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 auto 1rem auto;
      }

      .sin-pendientes h4 {
        margin: 0 0 0.5rem 0;
        color: #1e293b;
        font-size: 1rem;
      }

      .sin-pendientes p {
        margin: 0 auto;
        max-width: 500px;
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.45;
      }

      .lista-pendientes {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }

      .tarjeta-pendiente {
        border: 1px solid #e2e8f0;
        border-left: 5px solid #2563eb;
        border-radius: 6px;
        padding: 1rem 1.15rem;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        transition: box-shadow 0.15s ease;
      }

      .tarjeta-pendiente:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06);
      }

      .cabecera-item-pendiente {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .estudiante-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .estudiante-nombre {
        font-weight: 700;
        font-size: 0.95rem;
        color: #0f172a;
      }

      .estudiante-id {
        font-size: 0.75rem;
        color: #64748b;
      }

      .fecha-falta-badge {
        font-size: 0.75rem;
        background-color: #f1f5f9;
        color: #334155;
        padding: 0.2rem 0.55rem;
        border-radius: 4px;
        font-weight: 500;
      }

      .badge-lg {
        font-size: 0.75rem;
        padding: 0.35rem 0.75rem;
        border-radius: 4px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .badge-presente {
        background-color: #dcfce7;
        color: #15803d;
        border: 1px solid #86efac;
      }

      .badge-falta {
        background-color: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }

      .motivo-box {
        background: #f8fafc;
        border: 1px solid #f1f5f9;
        border-radius: 4px;
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
      }

      .motivo-box strong {
        color: #475569;
        display: block;
        margin-bottom: 0.2rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .motivo-box p {
        margin: 0;
        color: #1e293b;
        line-height: 1.4;
      }

      .formulario-revision {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        border-top: 1px dashed #e2e8f0;
        padding-top: 0.75rem;
      }

      .label-resolucion {
        font-size: 0.75rem;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .fila-resolucion {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      .input-obs {
        flex: 1;
        min-width: 240px;
        font-size: 0.85rem;
        padding: 0.45rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
      }

      .input-obs:focus {
        outline: none;
        border-color: #2563eb;
      }

      .botones-resolucion {
        display: flex;
        gap: 0.5rem;
      }

      .btn-resolucion {
        padding: 0.45rem 0.85rem;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        transition: background-color 0.15s ease;
        white-space: nowrap;
      }

      .btn-aprobar {
        background-color: #16a34a;
        color: #ffffff;
      }

      .btn-aprobar:hover {
        background-color: #15803d;
      }

      .btn-rechazar {
        background-color: #dc2626;
        color: #ffffff;
      }

      .btn-rechazar:hover {
        background-color: #b91c1c;
      }

      .btn-outline {
        background: transparent;
        border: 1px solid #cbd5e1;
        color: #334155;
        padding: 0.45rem 0.85rem;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-outline:hover {
        background: #f1f5f9;
      }

      .alerta {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 500;
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
  public readonly pendientes = signal<JustificativoResponse[]>([]);
  public readonly cargando = signal<boolean>(false);
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

  public resolverJustificativo(id: string, aprobado: boolean): void {
    const obs =
      this.observacionesPorId[id] ||
      (aprobado
        ? 'Documento verificado y clasificado como legible por CNN. Se actualiza asistencia a FALTA_JUSTIFICADA.'
        : 'Certificado no válido o ilegible.');

    this.justificativosService.revisar(id, { aprobado, observaciones: obs }).subscribe({
      next: () => {
        this.mensajeExito.set(
          aprobado
            ? `✓ Justificativo ${id} APROBADO con éxito. La inasistencia fue convertida a FALTA_JUSTIFICADA en PostgreSQL.`
            : `✕ Justificativo ${id} RECHAZADO.`
        );
        this.cargarPendientes();
      },
      error: () => {
        this.mensajeError.set(`Error al resolver justificativo ${id}`);
      },
    });
  }
}
