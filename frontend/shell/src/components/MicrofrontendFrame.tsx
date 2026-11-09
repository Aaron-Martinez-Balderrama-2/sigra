import React, { useRef, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SesionSso } from '../types/shell';

interface Props {
  url: string;
  titulo: string;
  tecnologia: string;
  puerto: number;
  sesion: SesionSso;
  modoTest?: boolean;
}

export const MicrofrontendFrame: React.FC<Props> = ({
  url,
  titulo,
  tecnologia,
  puerto,
  sesion,
  modoTest = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Cada vez que cambia la sesión o el iframe se recarga, notificamos vía postMessage
  const transmitirSesionSso = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const payload = {
        type: 'SIGRA_SSO_SESSION',
        payload: {
          token: sesion.token,
          actor: sesion.actor,
          contextoEscolar: sesion.contextoEscolar,
          modoTest: modoTest,
        },
      };

      try {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } catch (err) {
        console.warn('Advertencia al emitir postMessage a iframe:', err);
      }
    }
  };

  useEffect(() => {
    transmitirSesionSso();
    const interval = setInterval(transmitirSesionSso, 2000);
    return () => clearInterval(interval);
  }, [sesion, iframeKey, modoTest]);

  const handleIframeLoad = () => {
    setCargando(false);
    setErrorCarga(false);
    transmitirSesionSso();
  };

  const recargarIframe = () => {
    setCargando(true);
    setErrorCarga(false);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="shell-frame-wrapper">
      {/* Barra de Diagnóstico del Microfrontend (Visible únicamente en Modo Test) */}
      {modoTest && (
        <div className="shell-frame-toolbar">
          <div className="frame-info-meta">
            <span className="badge-puerto">:{puerto}</span>
            <span className="frame-titulo-texto">
              <strong>{titulo}</strong> ({tecnologia})
            </span>
            <span className="badge-sso-sync mfe-pill-status">
              <CheckCircle2 size={13} />
              <span>Sesión SSO Inyectada</span>
            </span>
          </div>

          <div className="frame-acciones">
            <button
              type="button"
              className="btn-toolbar-accion"
              onClick={recargarIframe}
              title="Recargar este microfrontend"
            >
              <RefreshCw size={14} className={cargando ? 'anim-girar' : ''} />
              <span>Recargar</span>
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-toolbar-accion"
              title="Abrir microfrontend en ventana independiente"
            >
              <ExternalLink size={14} />
              <span>Abrir en ventana</span>
            </a>
          </div>
        </div>
      )}

      {/* Contenedor Iframe con Fallback */}
      <div className="shell-iframe-container">
        {cargando && (
          <div className="shell-iframe-loader">
            <div className="loader-spinner"></div>
            <span>Conectando e inyectando sesión SSO en {titulo}...</span>
          </div>
        )}

        <iframe
          id="mfe-iframe"
          key={iframeKey}
          ref={iframeRef}
          src={url}
          title={titulo}
          className="shell-microfrontend-iframe"
          onLoad={handleIframeLoad}
          onError={() => {
            setCargando(false);
            setErrorCarga(true);
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          allow="camera; microphone; clipboard-write"
        />

        {errorCarga && (
          <div className="shell-iframe-error-card">
            <AlertTriangle size={32} className="icono-alerta" />
            <h3>No se pudo cargar el microfrontend en el puerto :{puerto}</h3>
            <p>
              Asegúrese de tener el servicio corriendo en <code>http://localhost:{puerto}</code>.
            </p>
            <button type="button" className="btn-reintentar" onClick={recargarIframe}>
              <RefreshCw size={14} />
              <span>Reintentar Conexión</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
