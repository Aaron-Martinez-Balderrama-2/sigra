import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  FileOutput,
  MessageSquareText,
  ScanLine,
} from 'lucide-react';
import { SsoSession } from './types/sigra';
import { DashboardRiesgo } from './components/DashboardRiesgo';
import { EscanerCnnTfjs } from './components/EscanerCnnTfjs';
import { ChatAgenteMcp } from './components/ChatAgenteMcp';
import { CentroReportes } from './components/CentroReportes';

type VistaActiva = 'RIESGO' | 'CNN' | 'AGENTE' | 'REPORTES';

const SESION_INICIAL_DIRECCION: SsoSession = {
  authenticated: true,
  token: 'demo-jwt-rs256-session',
  actor: {
    sub: 'dir-01',
    nombre: 'Lic. Elena Vargas',
    roles: ['DIRECTOR'],
    cargo: 'Directora de Unidad Educativa',
  },
  contextoEscolar: {
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    materiaId: 'mat-mat',
    materiaNombre: 'Matemáticas',
    gestion: 2026,
    trimestre: 1,
  },
  origenSso: 'SESION_LOCAL_DEMO',
};

export const App: React.FC = () => {
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('RIESGO');
  const [sesionSso, setSesionSso] = useState<SsoSession>(SESION_INICIAL_DIRECCION);
  const [esOnline, setEsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    try {
      const guardada =
        sessionStorage.getItem('sigra_sso_session') ??
        localStorage.getItem('sigra_sso_session');
      if (guardada) {
        const parsed = JSON.parse(guardada) as Partial<SsoSession>;
        if (parsed.token && parsed.actor) {
          setSesionSso({
            authenticated: true,
            token: parsed.token,
            actor: parsed.actor,
            contextoEscolar:
              parsed.contextoEscolar ?? SESION_INICIAL_DIRECCION.contextoEscolar,
            origenSso: 'KEYCLOAK_OIDC',
          });
        }
      }
    } catch {
      // ignore storage errors
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SIGRA_SSO_SESSION' && event.data?.payload) {
        const p = event.data.payload;
        setSesionSso((prev) => {
          const nuevaSesion: SsoSession = {
            authenticated: true,
            token: p.token ?? prev.token,
            actor: p.actor ?? prev.actor,
            contextoEscolar: p.contextoEscolar ?? prev.contextoEscolar,
            origenSso: 'SHELL_POSTMESSAGE',
          };
          try {
            sessionStorage.setItem('sigra_sso_session', JSON.stringify(nuevaSesion));
          } catch {
            // ignore
          }
          return nuevaSesion;
        });
      }
    };

    const handleOnline = () => setEsOnline(true);
    const handleOffline = () => setEsOnline(false);

    window.addEventListener('message', handleMessage);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const alternarPerfilDemo = () => {
    setSesionSso((prev) => {
      const esDirector = prev.actor.roles.includes('DIRECTOR');
      return esDirector
        ? {
            ...prev,
            actor: {
              sub: 'prof-01',
              nombre: 'Prof. Carlos Méndez',
              roles: ['DOCENTE'],
              cargo: 'Docente de Aula — Matemáticas (3.° B)',
            },
          }
        : {
            ...prev,
            actor: {
              sub: 'dir-01',
              nombre: 'Lic. Elena Vargas',
              roles: ['DIRECTOR'],
              cargo: 'Directora de Unidad Educativa',
            },
          };
    });
  };

  const ctx = sesionSso.contextoEscolar;

  return (
    <div className="sigra-app">
      {/* Cabecera Institucional Unificada y Limpia */}
      <header className="sigra-header">
        <div className="sigra-header-inner">
          <div className="sigra-brand">
            <img
              src="/assets/icono.jpg"
              alt="Escudo Unidad Educativa SIGRA"
              className="sigra-logo"
            />
            <div className="sigra-title-block">
              <span className="sigra-title-eyebrow">Dirección y Seguimiento Escolar</span>
              <h1>Unidad Educativa SIGRA</h1>
              <span className="sigra-title-sub">
                Unidad Educativa SIGRA — Portal de Dirección y Seguimiento Escolar
              </span>
            </div>
          </div>

          <nav
            className="sigra-nav-tabs"
            aria-label="Módulos de Dirección y Seguimiento Escolar"
          >
            <button
              type="button"
              className={`nav-tab-btn ${vistaActiva === 'RIESGO' ? 'active' : ''}`}
              onClick={() => setVistaActiva('RIESGO')}
              data-testid="tab-riesgo"
            >
              <Activity />
              <span>Riesgo Académico</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${vistaActiva === 'CNN' ? 'active' : ''}`}
              onClick={() => setVistaActiva('CNN')}
              data-testid="tab-cnn"
            >
              <ScanLine />
              <span>Escáner Documental</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${vistaActiva === 'AGENTE' ? 'active' : ''}`}
              onClick={() => setVistaActiva('AGENTE')}
              data-testid="tab-agente"
            >
              <MessageSquareText />
              <span>Asistente Escolar</span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${vistaActiva === 'REPORTES' ? 'active' : ''}`}
              onClick={() => setVistaActiva('REPORTES')}
              data-testid="tab-reportes"
            >
              <FileOutput />
              <span>Reportes</span>
            </button>
          </nav>

          <div className="sigra-sso-bar">
            <div
              className="sso-pill"
              data-testid="sso-status-pill"
              title={`${sesionSso.actor.nombre} (${sesionSso.actor.roles.join(', ')})`}
            >
              <span className={`status-dot ${esOnline ? 'online' : 'amber'}`} />
              <span className="sso-pill-text">
                {sesionSso.actor.nombre} · {sesionSso.actor.roles[0]}
              </span>
            </div>

            <button
              type="button"
              className="btn-header-role"
              onClick={alternarPerfilDemo}
              data-testid="btn-alternar-rol-sso"
              title="Alternar perfil activo de demostración SSO"
            >
              <ArrowLeftRight />
              <span>{sesionSso.actor.sub}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Franja Contextual Continua del Periodo Escolar */}
      <div className="sigra-context-strip">
        <div className="sigra-context-inner">
          <div className="context-items">
            <span className="context-item">
              Curso: <strong>{ctx.cursoNombre}</strong>
            </span>
            <span className="context-sep">/</span>
            <span className="context-item">
              Área: <strong>{ctx.materiaNombre}</strong>
            </span>
            <span className="context-sep">/</span>
            <span className="context-item">
              Periodo: <strong>Gestión {ctx.gestion} · Trimestre {ctx.trimestre}</strong>
            </span>
          </div>

          <div className="context-items">
            <span className="context-item">
              <span className={`status-dot ${esOnline ? 'online' : 'offline'}`} />
              <strong>{esOnline ? 'Red activa (PWA)' : 'Modo sin conexión (PWA)'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Área Principal de Trabajo */}
      <main className="sigra-main">
        {vistaActiva === 'RIESGO' && (
          <DashboardRiesgo token={sesionSso.token} contexto={ctx} />
        )}
        {vistaActiva === 'CNN' && (
          <EscanerCnnTfjs token={sesionSso.token} contexto={ctx} />
        )}
        {vistaActiva === 'AGENTE' && (
          <ChatAgenteMcp token={sesionSso.token} contexto={ctx} />
        )}
        {vistaActiva === 'REPORTES' && (
          <CentroReportes token={sesionSso.token} contexto={ctx} />
        )}
      </main>
    </div>
  );
};

export default App;
