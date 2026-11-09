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
      <!-- Barra Superior Institucional (1 Sola Fila Unificada y Compacta) -->
      <header class="header-institucional">
        <div class="contenedor-header-unificado">
          <!-- 1. Identidad Compacta -->
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

          <!-- 2. Pestañas de Navegación en la Misma Fila Central -->
          <nav class="nav-pestanas-inline" aria-label="Módulos del Docente">
            <a
              routerLink="/asistencia"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📋 Asistencia (CU-01 / CU-02)
            </a>
            <a
              routerLink="/calificaciones"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📝 Calificaciones y SAGA (GraphQL / NestJS)
            </a>
            <a
              routerLink="/justificativos"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📄 Justificativos Escolares y CNN (CU-03)
            </a>
            <a
              routerLink="/saga-marcas"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              🔄 Monitor Marcas SAGA (CU-04)
            </a>
          </nav>

          <!-- 3. Acciones de Red y Estado -->
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

      <!-- Contenedor Principal de la Vista -->
      <main class="contenido-principal">
        <router-outlet></router-outlet>
      </main>

      <!-- Pie de Página Institucional (oculto dentro del shell) -->
      <footer class="footer-institucional" *ngIf="!esEmbebido">
        <p>
          <strong>Unidad Educativa SIGRA</strong> — Plataforma Distribuida de Gestión Escolar • Módulo de Asistencia Escolar (Java 21 / Spring Boot 3 + PostgreSQL)
        </p>
      </footer>
    </div>
  `,
  styles: [
    `
      .sigra-shell-layout {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: var(--bg-pagina);
      }

      .sigra-shell-layout.modo-embebido {
        min-height: auto;
      }

      .header-institucional {
        background-color: var(--colegio-azul-oscuro);
        color: #ffffff;
        border-bottom: 2px solid var(--colegio-dorado-principal);
        box-shadow: var(--sombra-sm);
        position: sticky;
        top: 0;
        z-index: 100;
        width: 100%;
      }

      .contenedor-header-unificado {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0.45rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.85rem;
      }

      .identidad-colegio {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-shrink: 0;
      }

      .escudo-institucional {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1.5px solid var(--colegio-dorado-principal);
        object-fit: cover;
      }

      .titulos {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }

      .subtitulo-institucion {
        font-size: 0.65rem;
        color: var(--colegio-dorado-claro);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }

      .titulo-portal {
        font-size: 0.95rem;
        color: #ffffff;
        margin: 0;
        font-weight: 800;
        white-space: nowrap;
      }

      /* Pestañas inline en la misma fila central */
      .nav-pestanas-inline {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex: 1;
        justify-content: center;
        overflow-x: auto;
      }

      .pestana {
        padding: 0.42rem 0.85rem;
        font-size: 0.82rem;
        font-weight: 600;
        color: #cbd5e1;
        border-radius: var(--radio-sm, 6px);
        text-decoration: none;
        white-space: nowrap;
        transition: all 0.15s ease;
      }

      .pestana:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      .pestana.pestana-activa {
        color: #ffffff;
        background: rgba(212, 175, 55, 0.25);
        border: 1px solid var(--colegio-dorado-principal);
        box-shadow: 0 0 8px rgba(212, 175, 55, 0.2);
      }

      .header-acciones {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-shrink: 0;
      }

      .badge-red {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
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
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.28rem 0.65rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
      }

      .btn-toggle-red:hover {
        background: rgba(255, 255, 255, 0.2);
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
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .docente-avatar {
        width: 24px;
        height: 24px;
        background: var(--colegio-dorado-principal);
        color: var(--colegio-azul-oscuro);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.75rem;
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
        max-width: 1400px;
        width: 100%;
        margin: 0.85rem auto;
        padding: 0 1.25rem;
      }

      .footer-institucional {
        background: #0f172a;
        color: #94a3b8;
        text-align: center;
        padding: 1rem;
        font-size: 0.75rem;
        border-top: 1px solid var(--borde-suave);
      }

      @media (max-width: 900px) {
        .contenedor-header-unificado {
          flex-wrap: wrap;
        }
        .nav-pestanas-inline {
          order: 3;
          width: 100%;
          justify-content: flex-start;
          padding-top: 0.35rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
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
