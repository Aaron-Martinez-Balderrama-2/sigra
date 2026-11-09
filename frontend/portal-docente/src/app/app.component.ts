import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthSsoService } from './core/services/auth-sso.service';
import { NetworkStatusService } from './core/services/network-status.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="sigra-shell-layout" [class.modo-embebido]="esEmbebido">
      <!-- Barra Superior Institucional (1 Sola Fila Unificada, Idéntica en Estructura a React) -->
      <header class="header-institucional">
        <div class="contenedor-header-unificado">
          <!-- 1. Identidad Institucional Compacta -->
          <div class="identidad-colegio">
            <img
              src="assets/icono.jpg"
              alt="Escudo Unidad Educativa SIGRA"
              class="escudo-institucional"
            />
            <div class="titulos">
              <span class="subtitulo-institucion">Unidad Educativa SIGRA</span>
              <h1 class="titulo-portal">SIGRA — Portal del Docente</h1>
            </div>
          </div>

          <!-- 2. Pestañas de Navegación Compactas y Centradas (Sin Desbordes) -->
          <nav class="nav-pestanas-inline" aria-label="Módulos del Docente">
            <a
              routerLink="/asistencia"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📋 Asistencia
            </a>
            <a
              routerLink="/calificaciones"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📝 Calificaciones
            </a>
            <a
              routerLink="/justificativos"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📄 Justificativos
            </a>
            <a
              routerLink="/saga-marcas"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              🔄 Marcas SAGA
            </a>
          </nav>

          <!-- 3. Acciones de Red y Estado SSO -->
          <div class="header-acciones">
            <!-- Indicador de Red en Vivo -->
            <div
              class="badge-red"
              [class.badge-red-online]="network.estaOnline()"
              [class.badge-red-offline]="!network.estaOnline()"
            >
              <span class="punto-estado"></span>
              {{ network.estaOnline() ? '🟢 Conectado' : '🟡 Offline' }}
            </div>

            <!-- Botón de Simulación de Corte -->
            <button
              class="btn-toggle-red"
              [class.btn-activo]="network.simularCorteRed()"
              (click)="network.alternarSimulacionCorte()"
              title="Simula desconexión de red para probar la cola local en IndexedDB"
            >
              {{ network.simularCorteRed() ? '🔌 Restaurar' : '✂️ Simular Corte en Aula' }}
            </button>

            <!-- Datos del Docente (visible cuando corre independiente en :4201) -->
            <div class="docente-info" *ngIf="!esEmbebido">
              <div class="docente-avatar">
                {{ auth.actor().nombre.charAt(0) }}
              </div>
              <div class="docente-texto">
                <span class="docente-nombre">{{ auth.actor().nombre }}</span>
                <span class="docente-contexto">
                  {{ auth.contextoEscolar().cursoNombre }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Contenedor Principal de la Vista con Ancho Fluido -->
      <main class="contenido-principal">
        <router-outlet></router-outlet>
      </main>

      <!-- Pie de Página Institucional (solo en modo independiente) -->
      <footer class="footer-institucional" *ngIf="!esEmbebido">
        <p>
          <strong>Unidad Educativa SIGRA</strong> — Plataforma Distribuida de Gestión Escolar • Módulo del Docente (Java 21 / Spring Boot 3 + PostgreSQL)
        </p>
      </footer>
    </div>
  `,
  styles: [
    `
      .sigra-shell-layout {
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
        background-color: var(--bg-pagina);
      }

      .sigra-shell-layout.modo-embebido {
        min-height: auto;
      }

      .header-institucional {
        background-color: var(--colegio-azul-oscuro);
        color: #ffffff;
        border-bottom: 2px solid var(--colegio-dorado-principal);
        position: sticky;
        top: 0;
        z-index: 40;
        width: 100%;
      }

      .contenedor-header-unificado {
        max-width: var(--container-max, min(96vw, 120rem));
        margin: 0 auto;
        padding: 0.55rem var(--space-lg, 1.25rem);
        display: grid;
        grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
        align-items: center;
        gap: var(--space-md, 0.75rem);
      }

      .identidad-colegio {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
      }

      .escudo-institucional {
        width: clamp(2rem, 2.4vw, 2.55rem);
        height: clamp(2rem, 2.4vw, 2.55rem);
        border-radius: var(--radius-md, 6px);
        object-fit: cover;
        border: 1.5px solid var(--colegio-dorado-principal);
        background-color: #ffffff;
        flex-shrink: 0;
      }

      .titulos {
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .subtitulo-institucion {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--colegio-dorado-claro);
        font-weight: 600;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .titulo-portal {
        font-size: clamp(0.84rem, 0.95vw, 1.02rem);
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #ffffff;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0;
      }

      /* Pestañas inline en la misma fila central sin scrollbars */
      .nav-pestanas-inline {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        min-width: 0;
      }

      .pestana {
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-sm, 6px);
        padding: 0.42rem 0.72rem;
        font-size: 0.81rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.76);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        white-space: nowrap;
        text-decoration: none;
        min-width: 0;
      }

      .pestana:hover {
        color: #ffffff;
        background-color: rgba(255, 255, 255, 0.08);
      }

      .pestana.pestana-activa {
        color: #ffffff;
        font-weight: 600;
        background-color: var(--colegio-azul-medio);
        border: 1px solid rgba(212, 175, 55, 0.45);
        box-shadow: inset 0 -2px 0 var(--colegio-dorado-principal);
      }

      .header-acciones {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
        min-width: 0;
      }

      .badge-red {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: var(--radius-sm, 6px);
        padding: 0.28rem 0.58rem;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.92);
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        white-space: nowrap;
      }

      .badge-red-online {
        background: rgba(21, 128, 61, 0.2);
        color: #86efac;
        border: 1px solid rgba(134, 239, 172, 0.4);
      }

      .badge-red-offline {
        background: rgba(244, 185, 66, 0.25);
        color: #fde047;
        border: 1px solid rgba(253, 224, 71, 0.5);
      }

      .btn-toggle-red {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: var(--radius-sm, 6px);
        padding: 0.28rem 0.65rem;
        font-size: 0.75rem;
        color: #ffffff;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
      }

      .btn-toggle-red:hover {
        background: rgba(255, 255, 255, 0.18);
      }

      .btn-toggle-red.btn-activo {
        background: var(--colegio-rojo-principal, #ef4444);
        border-color: #fca5a5;
      }

      .docente-info {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        background: rgba(255, 255, 255, 0.08);
        padding: 0.22rem 0.55rem;
        border-radius: var(--radius-sm, 6px);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .docente-avatar {
        width: 22px;
        height: 22px;
        background: var(--colegio-dorado-principal);
        color: var(--colegio-azul-oscuro);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.72rem;
      }

      .docente-texto {
        display: flex;
        flex-direction: column;
        line-height: 1;
      }

      .docente-nombre {
        font-size: 0.75rem;
        font-weight: 700;
        color: #ffffff;
      }

      .docente-contexto {
        font-size: 0.65rem;
        color: #cbd5e1;
      }

      .contenido-principal {
        flex: 1;
        max-width: var(--container-max, min(96vw, 120rem));
        width: 100%;
        margin: 0.75rem auto 1.5rem;
        padding: 0 var(--space-lg, 1.25rem);
      }

      .footer-institucional {
        background: #0f172a;
        color: #94a3b8;
        text-align: center;
        padding: 0.85rem;
        font-size: 0.75rem;
        border-top: 1px solid var(--borde-suave);
      }

      /* Pantallas medianas / Laptops compactas (<= 1180px) */
      @media (max-width: 1180px) {
        .contenedor-header-unificado {
          grid-template-columns: minmax(0, 1fr) auto;
          row-gap: 0.45rem;
        }

        .nav-pestanas-inline {
          grid-column: 1 / -1;
          justify-content: flex-start;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 0.42rem;
          flex-wrap: wrap;
        }
      }

      /* Móviles y pantallas compactas (<= 640px) */
      @media (max-width: 640px) {
        .contenedor-header-unificado {
          grid-template-columns: minmax(0, 1fr);
          padding: 0.5rem var(--space-sm, 0.65rem);
          gap: 0.4rem;
        }

        .header-acciones {
          justify-content: space-between;
          width: 100%;
        }

        .nav-pestanas-inline {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.28rem;
        }

        .pestana {
          padding: 0.4rem 0.45rem;
          font-size: 0.76rem;
          width: 100%;
        }

        .contenido-principal {
          padding: 0 var(--space-sm, 0.65rem);
        }
      }
    `,
  ],
})
export class AppComponent {
  public readonly auth = inject(AuthSsoService);
  public readonly network = inject(NetworkStatusService);
  public readonly esEmbebido = typeof window !== 'undefined' && window.self !== window.top;
}
