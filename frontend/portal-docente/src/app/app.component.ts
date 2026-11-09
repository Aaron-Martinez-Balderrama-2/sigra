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
    <div class="sigra-shell-layout">
      <!-- Barra Superior Institucional -->
      <header class="header-institucional">
        <div class="contenedor-header">
          <div class="identidad-colegio">
            <img
              src="assets/icono.jpg"
              alt="Escudo Unidad Educativa SIGRA"
              class="escudo-institucional"
            />
            <div class="titulos">
              <span class="subtitulo-institucion">Unidad Educativa Escolar</span>
              <h1 class="titulo-portal">SIGRA — Portal del Docente</h1>
            </div>
          </div>

          <div class="header-acciones">
            <!-- Indicador de Red en Vivo -->
            <div
              class="badge-red"
              [class.badge-red-online]="network.estaOnline()"
              [class.badge-red-offline]="!network.estaOnline()"
            >
              <span class="punto-estado"></span>
              {{ network.estaOnline() ? '🟢 Conectado' : '🟡 Modo Offline (IndexedDB)' }}
            </div>

            <!-- Botón de Simulación de Corte -->
            <button
              class="btn-toggle-red"
              [class.btn-activo]="network.simularCorteRed()"
              (click)="network.alternarSimulacionCorte()"
              title="Simula desconexión de red para probar la cola local en IndexedDB"
            >
              {{ network.simularCorteRed() ? '🔌 Restaurar Internet' : '✂️ Simular Corte en Aula' }}
            </button>

            <!-- Datos del Docente Autenticado vía SSO -->
            <div class="docente-info">
              <div class="docente-avatar">
                {{ auth.actor().nombre.charAt(0) }}
              </div>
              <div class="docente-texto">
                <span class="docente-nombre">{{ auth.actor().nombre }}</span>
                <span class="docente-contexto">
                  {{ auth.contextoEscolar().cursoNombre }} • {{ auth.contextoEscolar().materiaNombre }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pestañas de Navegación del Portal Docente -->
        <nav class="nav-pestanas">
          <div class="contenedor-nav">
            <a
              routerLink="/asistencia"
              routerLinkActive="pestana-activa"
              class="pestana"
            >
              📋 Planilla de Asistencia (CU-01 / CU-02)
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
              🔄 Marcas SAGA de Asistencia (CU-04)
            </a>
          </div>
        </nav>
      </header>

      <!-- Contenedor Principal de la Vista -->
      <main class="contenido-principal">
        <router-outlet></router-outlet>
      </main>

      <!-- Pie de Página Institucional -->
      <footer class="footer-institucional">
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

      .header-institucional {
        background-color: var(--colegio-azul-oscuro);
        color: #ffffff;
        box-shadow: var(--sombra-md);
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .contenedor-header {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0.85rem 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .identidad-colegio {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .escudo-institucional {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: 2px solid var(--colegio-dorado-principal);
        object-fit: cover;
        box-shadow: 0 0 10px rgba(212, 175, 55, 0.4);
      }

      .subtitulo-institucion {
        font-size: 0.725rem;
        color: var(--colegio-dorado-claro);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        display: block;
      }

      .titulo-portal {
        font-size: 1.25rem;
        color: #ffffff;
        margin: 0;
        font-weight: 800;
      }

      .header-acciones {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .badge-red {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: var(--radio-full);
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
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.4rem 0.85rem;
        border-radius: var(--radio-md);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .btn-toggle-red:hover {
        background: rgba(255, 255, 255, 0.22);
      }

      .btn-toggle-red.btn-activo {
        background: var(--colegio-rojo-principal);
        border-color: #fca5a5;
      }

      .docente-info {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        background: rgba(255, 255, 255, 0.08);
        padding: 0.35rem 0.75rem;
        border-radius: var(--radio-full);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .docente-avatar {
        width: 32px;
        height: 32px;
        background: var(--colegio-dorado-principal);
        color: var(--colegio-azul-oscuro);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.9rem;
      }

      .docente-texto {
        display: flex;
        flex-direction: column;
      }

      .docente-nombre {
        font-size: 0.825rem;
        font-weight: 700;
        color: #ffffff;
      }

      .docente-contexto {
        font-size: 0.7rem;
        color: #cbd5e1;
      }

      .nav-pestanas {
        background-color: var(--colegio-azul-medio);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .contenedor-nav {
        max-width: 1280px;
        margin: 0 auto;
        display: flex;
        padding: 0 1.5rem;
        overflow-x: auto;
      }

      .pestana {
        padding: 0.75rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: #cbd5e1;
        border-bottom: 3px solid transparent;
        white-space: nowrap;
        transition: all 0.2s;
      }

      .pestana:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.05);
      }

      .pestana.pestana-activa {
        color: var(--colegio-dorado-claro);
        border-bottom-color: var(--colegio-dorado-principal);
        background: rgba(0, 0, 0, 0.15);
      }

      .contenido-principal {
        flex: 1;
        max-width: 1280px;
        width: 100%;
        margin: 1.5rem auto;
        padding: 0 1.5rem;
      }

      .footer-institucional {
        background: #0f172a;
        color: #94a3b8;
        text-align: center;
        padding: 1.25rem;
        font-size: 0.8rem;
        border-top: 1px solid var(--borde-suave);
      }
    `,
  ],
})
export class AppComponent {
  public readonly auth = inject(AuthSsoService);
  public readonly network = inject(NetworkStatusService);
}

