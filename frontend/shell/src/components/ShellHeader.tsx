import React from 'react';
import {
  LogOut,
  Shield,
  Sparkles,
  BookOpen,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { ModuloActivo, RolUsuario, SesionSso } from '../types/shell';

interface Props {
  sesion: SesionSso;
  moduloActivo: ModuloActivo;
  modoTest: boolean;
  onCambiarModulo: (mod: ModuloActivo) => void;
  onCambiarRol: (rol: RolUsuario) => void;
  onCerrarSesion: () => void;
  onToggleModoTest: () => void;
}

export const ShellHeader: React.FC<Props> = ({
  sesion,
  moduloActivo,
  modoTest,
  onCambiarModulo,
  onCambiarRol,
  onCerrarSesion,
  onToggleModoTest,
}) => {
  const actor = sesion.actor;

  const siguienteRol = (): RolUsuario => {
    if (actor.roles.includes('DIRECTOR')) return 'DOCENTE';
    if (actor.roles.includes('DOCENTE')) return 'PADRE';
    return 'DIRECTOR';
  };

  return (
    <header className="shell-header-institucional">
      {/* Barra Superior con Logo y Perfil */}
      <div className="shell-header-top">
        <div className="shell-marca-colegio">
          <img
            src="/assets/icono.jpg"
            alt="Escudo Unidad Educativa SIGRA"
            className="shell-escudo-header"
          />
          <div className="shell-titulos">
            <span className="shell-eyebrow">
              {modoTest ? 'Plataforma Educativa Distribuida' : 'Sistema de Gestión Escolar'}
            </span>
            <h1 className="shell-nombre-sistema">Unidad Educativa SIGRA</h1>
            <span className="shell-subtitulo-app">
              {modoTest
                ? 'App Shell Orquestador • Keycloak SSO Único • Microfrontends en Vivo'
                : 'Gestión Académica • Asistencia • Seguimiento Estudiantil'}
            </span>
          </div>
        </div>

        {/* Acciones y Perfil de Usuario */}
        <div className="shell-usuario-acciones">
          {/* Badge del Usuario Autenticado */}
          <div className="shell-usuario-badge">
            <div className="shell-avatar">
              {actor.nombre.charAt(0)}
            </div>
            <div className="shell-usuario-datos">
              <span className="shell-usuario-nombre usuario-nombre">{actor.nombre}</span>
              <div className="shell-usuario-meta">
                <span className="shell-rol-tag rol-pill-tag">{actor.roles[0]}</span>
                <span className="shell-contexto-tag usuario-cargo">
                  {actor.roles.includes('DIRECTOR')
                    ? actor.cargo
                    : `${actor.cargo} • ${sesion.contextoEscolar.cursoNombre}`}
                </span>
              </div>
            </div>
          </div>

          {/* Botón Modo Test (Alterna entre vista institucional limpia y auditoría técnica) */}
          <button
            id="btn-toggle-modo-test"
            type="button"
            className={`btn-modo-test ${modoTest ? 'activo' : ''}`}
            onClick={onToggleModoTest}
            title={
              modoTest
                ? 'Modo Test Activo: Se muestran puertos (:4201, :4202), tecnologías y diagnósticos de examen. Clic para ocultar.'
                : 'Modo Test Inactivo: Vista institucional limpia. Clic para activar diagnósticos y requisitos de evaluación.'
            }
          >
            <SlidersHorizontal size={14} />
            <span>Modo Test: <strong>{modoTest ? 'ON' : 'OFF'}</strong></span>
            <span className="indicador-modo-test" aria-hidden="true"></span>
          </button>

          {/* Botón de Alternar Rol Rápido (para defensa de examen) */}
          <button
            id="btn-switch-rol"
            type="button"
            className="btn-alternar-rol btn-switch-rol"
            onClick={() => onCambiarRol(siguienteRol())}
            title="Alterna rápidamente el rol para demostrar restricciones de acceso y SSO"
          >
            <RefreshCw size={14} />
            <span>Alternar Rol: {siguienteRol()}</span>
          </button>

          {/* Botón Salir */}
          <button
            id="btn-logout-shell"
            type="button"
            className="btn-shell-salir btn-logout-shell"
            onClick={onCerrarSesion}
            title="Cerrar sesión SSO central"
          >
            <LogOut size={16} />
            <span className="texto-salir">Salir</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Microfrontends */}
      <nav className="shell-nav-tabs" aria-label="Microfrontends orquestados">
        <div className="shell-tabs-contenedor">
          <button
            id="tab-btn-docente"
            type="button"
            className={`shell-tab-btn ${moduloActivo === 'DOCENTE_ANGULAR' ? 'tab-activa' : ''}`}
            onClick={() => onCambiarModulo('DOCENTE_ANGULAR')}
          >
            <BookOpen size={18} />
            <div className="tab-texto-block">
              <strong>{modoTest ? 'Portal Docente (Angular 18)' : 'Portal Docente'}</strong>
              <small>
                {modoTest
                  ? 'Asistencia, Justificativos CNN y Calificaciones GraphQL (:4201)'
                  : 'Asistencia de Aula, Calificaciones y Justificativos'}
              </small>
            </div>
          </button>

          <button
            id="tab-btn-seguimiento"
            type="button"
            className={`shell-tab-btn ${moduloActivo === 'SEGUIMIENTO_REACT' ? 'tab-activa' : ''}`}
            onClick={() => onCambiarModulo('SEGUIMIENTO_REACT')}
          >
            <Sparkles size={18} />
            <div className="tab-texto-block">
              <strong>{modoTest ? 'Portal de Seguimiento (React PWA)' : 'Portal de Seguimiento'}</strong>
              <small>
                {modoTest
                  ? 'Riesgo ML, Escáner Facial TF.js, Agente MCP y 5 Reportes (:4202)'
                  : 'Seguimiento Escolar, Alertas y Reportes'}
              </small>
            </div>
          </button>

          <button
            id="tab-btn-seguridad"
            type="button"
            className={`shell-tab-btn ${moduloActivo === 'SEGURIDAD_SSO' ? 'tab-activa' : ''}`}
            onClick={() => onCambiarModulo('SEGURIDAD_SSO')}
          >
            <Shield size={18} />
            <div className="tab-texto-block">
              <strong>Monitor de Seguridad y SSO</strong>
              <small>
                {modoTest
                  ? 'Token JWT RS256, Claims y Salud de los 3 Microservicios'
                  : 'Auditoría Institucional y Control de Accesos'}
              </small>
            </div>
          </button>
        </div>
      </nav>
    </header>
  );
};
