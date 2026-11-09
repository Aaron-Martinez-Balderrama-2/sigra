import React, { useState, useEffect } from 'react';
import { ModuloActivo, RolUsuario, SesionSso } from './types/shell';
import {
  obtenerSesionInicial,
  guardarSesion,
  cerrarSesion,
  autenticarRapido,
} from './services/ssoAuth';
import { LoginView } from './components/LoginView';
import { ShellHeader } from './components/ShellHeader';
import { MicrofrontendFrame } from './components/MicrofrontendFrame';
import { SecurityAuditView } from './components/SecurityAuditView';

export const App: React.FC = () => {
  const [sesion, setSesion] = useState<SesionSso | null>(null);
  const [moduloActivo, setModuloActivo] = useState<ModuloActivo>('DOCENTE_ANGULAR');
  const [modoTest, setModoTest] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sigra_modo_test') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const s = obtenerSesionInicial();
    if (s) {
      setSesion(s);
    }
  }, []);

  const handleToggleModoTest = () => {
    setModoTest((prev) => {
      const nuevo = !prev;
      try {
        localStorage.setItem('sigra_modo_test', String(nuevo));
      } catch {
        // ignore
      }
      return nuevo;
    });
  };

  const handleLoginExitoso = (nuevaSesion: SesionSso) => {
    setSesion(nuevaSesion);
    guardarSesion(nuevaSesion);
  };

  const handleCerrarSesion = () => {
    cerrarSesion();
    setSesion(null);
  };

  const handleCambiarRol = (nuevoRol: RolUsuario) => {
    const nuevaSesion = autenticarRapido(nuevoRol);
    setSesion(nuevaSesion);
  };

  // Si no hay sesión autenticada, mostramos la pantalla de login institucional SSO
  if (!sesion) {
    return <LoginView onLoginExitoso={handleLoginExitoso} />;
  }

  return (
    <div className="shell-layout-root">
      {/* Barra Superior del Shell Orquestador */}
      <ShellHeader
        sesion={sesion}
        moduloActivo={moduloActivo}
        modoTest={modoTest}
        onCambiarModulo={setModuloActivo}
        onCambiarRol={handleCambiarRol}
        onCerrarSesion={handleCerrarSesion}
        onToggleModoTest={handleToggleModoTest}
      />

      {/* Contenido Principal: El Microfrontend Seleccionado */}
      <main className="shell-contenido-principal">
        {moduloActivo === 'DOCENTE_ANGULAR' && (
          <MicrofrontendFrame
            url="http://localhost:4201"
            titulo="Portal del Docente"
            tecnologia="Angular 18 • PWA • IndexedDB • GraphQL"
            puerto={4201}
            sesion={sesion}
            modoTest={modoTest}
          />
        )}

        {moduloActivo === 'SEGUIMIENTO_REACT' && (
          <MicrofrontendFrame
            url="http://localhost:4202"
            titulo="Portal de Dirección y Seguimiento Escolar"
            tecnologia="React 18 • PWA • TensorFlow.js • Agente MCP"
            puerto={4202}
            sesion={sesion}
            modoTest={modoTest}
          />
        )}

        {moduloActivo === 'SEGURIDAD_SSO' && <SecurityAuditView sesion={sesion} modoTest={modoTest} />}
      </main>

      {/* Pie Institucional del Shell */}
      <footer className="shell-footer-institucional">
        <p>
          <strong>Unidad Educativa SIGRA</strong> — {modoTest ? 'App Shell Orquestador (Puerto :4200) • Sistema Distribuido de Gestión Escolar • Grupo 10 (Ingeniería de Software II)' : 'Plataforma Integrada de Gestión Escolar y Seguimiento Estudiantil'}
        </p>
      </footer>
    </div>
  );
};

export default App;
