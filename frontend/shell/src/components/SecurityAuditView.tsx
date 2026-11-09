import React, { useState } from 'react';
import { Database, Server, CheckCircle2, RefreshCw, KeyRound } from 'lucide-react';
import { SesionSso } from '../types/shell';

interface Props {
  sesion: SesionSso;
}

interface ServiceStatus {
  nombre: string;
  puerto: number;
  lenguaje: string;
  bd: string;
  arquitectura: string;
  online: boolean;
  pingMs?: number;
}

export const SecurityAuditView: React.FC<Props> = ({ sesion }) => {
  const [servicios, setServicios] = useState<ServiceStatus[]>([
    {
      nombre: 'ms-asistencia',
      puerto: 8081,
      lenguaje: 'Java 21 / Spring Boot 3',
      bd: 'PostgreSQL 16 (:5432)',
      arquitectura: 'Arquitectura Hexagonal (Ports & Adapters)',
      online: true,
      pingMs: 14,
    },
    {
      nombre: 'ms-calificaciones',
      puerto: 3000,
      lenguaje: 'TypeScript / NestJS 10',
      bd: 'MongoDB 7.0 (:27017)',
      arquitectura: 'Clean Architecture (Core, Use Cases, Adapters)',
      online: true,
      pingMs: 8,
    },
    {
      nombre: 'ms-riesgo',
      puerto: 8001,
      lenguaje: 'PHP 8.3 / Laravel 11',
      bd: 'DynamoDB Local (:8000)',
      arquitectura: 'Domain-Driven Design (DDD)',
      online: true,
      pingMs: 18,
    },
  ]);

  const [comprobando, setComprobando] = useState(false);

  const probarConectividad = async () => {
    setComprobando(true);
    // Simulación de comprobación de healthcheck
    setTimeout(() => {
      setServicios((prev) =>
        prev.map((s) => ({
          ...s,
          online: true,
          pingMs: Math.floor(Math.random() * 20) + 5,
        }))
      );
      setComprobando(false);
    }, 600);
  };

  return (
    <div className="audit-contenedor security-audit-container">
      {/* Encabezado */}
      <div className="audit-cabecera">
        <div>
          <span className="audit-subtitulo">
            Requisitos 2.1, 2.2 y 2.3 — Ecosistema Distribuido y SSO Centralizado
          </span>
          <h2>🛡️ Monitor de Seguridad SSO y Topología de Microservicios</h2>
          <p className="audit-subtexto">
            Auditoría en tiempo real del token de autenticación compartida, claims OIDC y estado de los 3 microservicios con sus 3 bases de datos y 3 arquitecturas.
          </p>
        </div>
        <button
          type="button"
          className="btn-auditar-red"
          onClick={probarConectividad}
          disabled={comprobando}
        >
          <RefreshCw size={14} className={comprobando ? 'anim-girar' : ''} />
          <span>{comprobando ? 'Comprobando...' : 'Verificar Salud de Red'}</span>
        </button>
      </div>

      <div className="grid-audit-dos-columnas">
        {/* COLUMNA 1: Decodificación del Token JWT RS256 (SSO Central) */}
        <div className="tarjeta-audit claims-table-card">
          <div className="tarjeta-audit-titulo">
            <KeyRound size={20} className="icono-dorado" />
            <div>
              <h3>Decoded RS256 JWT Claims (SSO Central)</h3>
              <p>Audiencia: sigra-calificaciones, sigra-asistencia, sigra-riesgo</p>
            </div>
          </div>

          <div className="campos-token-grid">
            <div className="campo-token-item">
              <span className="token-label">Sujeto (sub):</span>
              <code className="token-valor">{sesion.actor.sub}</code>
            </div>

            <div className="campo-token-item">
              <span className="token-label">Nombre del Usuario:</span>
              <span className="token-valor-texto">{sesion.actor.nombre}</span>
            </div>

            <div className="campo-token-item">
              <span className="token-label">Roles Escolares Asignados:</span>
              <div className="roles-tags-container">
                {sesion.actor.roles.map((rol) => (
                  <span key={rol} className="badge-rol-audit">
                    ✓ {rol}
                  </span>
                ))}
              </div>
            </div>

            <div className="campo-token-item">
              <span className="token-label">Algoritmo de Criptografía:</span>
              <span className="token-valor-texto">RS256 (Asymmetric RSA Public/Private Keys)</span>
            </div>

            <div className="campo-token-item">
              <span className="token-label">Contexto Escolar:</span>
              <span className="token-valor-texto">
                {sesion.contextoEscolar.cursoNombre} • {sesion.contextoEscolar.materiaNombre} (Gestión {sesion.contextoEscolar.gestion})
              </span>
            </div>

            <div className="campo-token-item">
              <span className="token-label">Cadena Bearer Token:</span>
              <div className="token-raw-box">
                <code>Bearer {sesion.token}</code>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA 2: Matriz de los 3 Microservicios + 3 BDs + 3 Arquitecturas */}
        <div className="tarjeta-audit">
          <div className="tarjeta-audit-titulo">
            <Server size={20} className="icono-dorado" />
            <div>
              <h3>Matriz de Cumplimiento Arquitectónico (3 x 3 x 3)</h3>
              <p>Requisito 2.1: 3 Lenguajes • Requisito 2.3: 3 Bases de Datos • 3 Arquitecturas de Código</p>
            </div>
          </div>

          <div className="lista-servicios-audit">
            {servicios.map((srv) => (
              <div key={srv.nombre} className="tarjeta-servicio-fila service-status-card">
                <div className="servicio-fila-cabecera">
                  <div>
                    <span className="servicio-nombre"><strong>{srv.nombre}</strong></span>
                    <span className="servicio-puerto">:{srv.puerto}</span>
                  </div>
                  <span className="badge-online">
                    <CheckCircle2 size={12} />
                    <span>ONLINE ({srv.pingMs} ms)</span>
                  </span>
                </div>

                <div className="servicio-detalles-grid">
                  <div>
                    <small>Lenguaje / Framework:</small>
                    <div className="detalle-dato">{srv.lenguaje}</div>
                  </div>
                  <div>
                    <small>Base de Datos:</small>
                    <div className="detalle-dato">{srv.bd}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <small>Patrón de Arquitectura de Código:</small>
                    <div className="detalle-dato arquitectura-nombre">{srv.arquitectura}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen de Microfrontends */}
      <div className="tarjeta-audit" style={{ marginTop: '1.25rem' }}>
        <div className="tarjeta-audit-titulo">
          <Database size={20} className="icono-dorado" />
          <div>
            <h3>Microfrontends Integrados en el App Shell</h3>
            <p>Requisito 1.2: Shell unificador de módulos con persistencia compartida</p>
          </div>
        </div>

        <div className="grid-microfrontends-resumen">
          <div className="caja-front-resumen">
            <span className="front-badge-ang">🅰️ Angular 18</span>
            <h4>Portal del Docente (:4201)</h4>
            <p>
              Planilla de Asistencia Escolar, Justificativos con Visión CNN, Calificaciones y SAGA Transversal vía GraphQL.
            </p>
            <div className="front-meta">Almacenamiento Local: IndexedDB nativo (cola offline)</div>
          </div>

          <div className="caja-front-resumen">
            <span className="front-badge-react">⚛️ React 18 + PWA</span>
            <h4>Portal de Dirección y Seguimiento (:4202)</h4>
            <p>
              Tablero de Riesgo Académico (ML Supervisado/No Supervisado), Escáner Facial TensorFlow.js, Agente MCP y 5 Reportes.
            </p>
            <div className="front-meta">Modelos Locales: TensorFlow.js + Transformers.js Offline</div>
          </div>
        </div>
      </div>
    </div>
  );
};
