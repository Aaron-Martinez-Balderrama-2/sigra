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
      <!-- Barra Superior Institucional (1:1 en Altura, Tipografía y Proporciones con React) -->
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

          <!-- 2. Pestañas de Navegación con Iconografía SVG Vectorial (Idénticas a React) -->
          <nav class="nav-pestanas-inline" aria-label="Módulos del Docente">
            <a
              routerLink="/asistencia"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              <svg class="icono-tab" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
              <span>Asistencia</span>
            </a>
            <a
              routerLink="/calificaciones"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              <svg class="icono-tab" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Calificaciones</span>
            </a>
            <a
              routerLink="/justificativos"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              <svg class="icono-tab" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Justificativos</span>
            </a>
            <a
              routerLink="/saga-marcas"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              <svg class="icono-tab" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span>Marcas SAGA</span>
            </a>
          </nav>

          <!-- 3. Acciones de Red y Estado SSO con Dot CSS e Iconografía Vectorial -->
          <div class="header-acciones">
            <!-- Indicador de Red en Vivo -->
            <div
              class="badge-red"
              [class.badge-red-online]="network.estaOnline()"
              [class.badge-red-offline]="!network.estaOnline()"
            >
              <span class="punto-estado" [class.punto-online]="network.estaOnline()" [class.punto-offline]="!network.estaOnline()"></span>
              <span>{{ network.estaOnline() ? 'Conectado' : 'Offline' }}</span>
            </div>

            <!-- Botón de Simulación de Corte -->
            <button
              class="btn-toggle-red"
              [class.btn-activo]="network.simularCorteRed()"
              (click)="network.alternarSimulacionCorte()"
              title="Simula desconexión de red para probar la cola local en IndexedDB"
            >
              <svg class="icono-tab" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="3"/>
                <circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
              <span>{{ network.simularCorteRed() ? 'Restaurar' : 'Simular Corte en Aula' }}</span>
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

      <!-- Contenedor Principal de la Vista -->
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
        line-height: normal;
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
        line-height: normal;
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

      /* Pestañas inline en la misma fila central sin scrollbars, altura 29px idéntica a React */
      .nav-pestanas-inline {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
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
        gap: 0.4rem;
        line-height: normal;
        transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        white-space: nowrap;
        text-decoration: none;
        min-width: 0;
        box-sizing: border-box;
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

      .icono-tab {
        width: 1.05em;
        height: 1.05em;
        flex-shrink: 0;
        display: inline-block;
        vertical-align: middle;
      }

      .header-acciones {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
        min-width: 0;
        line-height: normal;
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
        gap: 0.4rem;
        white-space: nowrap;
        line-height: normal;
        box-sizing: border-box;
      }

      .punto-estado {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }

      .punto-online {
        background-color: #22c55e;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
      }

      .punto-offline {
        background-color: #f59e0b;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
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
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        line-height: normal;
        transition: all 0.15s ease;
        box-sizing: border-box;
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
        line-height: normal;
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
