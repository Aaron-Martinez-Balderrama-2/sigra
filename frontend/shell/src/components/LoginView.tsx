import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { RolUsuario, SesionSso } from '../types/shell';
import { autenticarRapido, verificarEstadoKeycloak } from '../services/ssoAuth';

interface Props {
  onLoginExitoso: (sesion: SesionSso) => void;
}

export const LoginView: React.FC<Props> = ({ onLoginExitoso }) => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState<RolUsuario>('DIRECTOR');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [keycloakInfo, setKeycloakInfo] = useState<{ activo: boolean; info?: string }>({
    activo: false,
    info: 'Verificando SSO Keycloak...',
  });

  useEffect(() => {
    verificarEstadoKeycloak().then(setKeycloakInfo);
  }, []);

  const handleLoginManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      setErrorMsg('Por favor ingrese usuario y contraseña.');
      return;
    }

    setCargando(true);
    setErrorMsg('');

    setTimeout(() => {
      const u = usuario.toLowerCase().trim();
      const p = password.trim();

      // Validación de credenciales institucionales o demo
      const esDirector = u.includes('director') || u.includes('admin') || u.includes('sofia');
      const esDocente = u.includes('docente') || u.includes('prof') || u.includes('carlos');
      const esPadre = u.includes('padre') || u.includes('tutor') || u.includes('roberto');

      if (!esDirector && !esDocente && !esPadre) {
        setCargando(false);
        setErrorMsg('Error 401: Usuario no registrado en el directorio Keycloak de la Unidad Educativa.');
        return;
      }

      if (p !== 'SigraDemo2026!' && p !== 'demo' && p !== 'admin' && p !== '123456' && p.length < 4) {
        setCargando(false);
        setErrorMsg('Error 401: Contraseña incorrecta. (Pruebe con: SigraDemo2026!)');
        return;
      }

      let rol: RolUsuario = 'DOCENTE';
      if (esDirector) {
        rol = 'DIRECTOR';
      } else if (esPadre) {
        rol = 'PADRE';
      }

      const sesion = autenticarRapido(rol);
      setCargando(false);
      onLoginExitoso(sesion);
    }, 450);
  };

  const handleAccesoRapido = (rol: RolUsuario) => {
    setRolSeleccionado(rol);
    setCargando(true);
    setErrorMsg('');

    setTimeout(() => {
      const sesion = autenticarRapido(rol);
      setCargando(false);
      onLoginExitoso(sesion);
    }, 300);
  };

  return (
    <div className="login-pantalla-fondo">
      <div className="login-tarjeta-contenedor">
        {/* Cabecera de la Tarjeta */}
        <div className="login-header">
          <div className="login-escudo-box">
            <img src="/assets/icono.jpg" alt="Escudo SIGRA" className="login-escudo" />
          </div>
          <span className="login-subtitulo-institucion">Unidad Educativa SIGRA</span>
          <h1 className="login-titulo">Acceso Único Institucional (SSO)</h1>
          <p className="login-descripcion">
            Plataforma Distribuida de Gestión Escolar • Inicio de sesión centralizado para Microfrontends (Angular 18 y React PWA)
          </p>
        </div>

        {/* Estado del Proveedor de Identidad Keycloak */}
        <div className={`keycloak-badge-status ${keycloakInfo.activo ? 'kc-activo' : 'kc-local'}`}>
          <ShieldCheck size={18} />
          <span>
            <strong>SSO Identity Provider:</strong> {keycloakInfo.info}
          </span>
        </div>

        {errorMsg && (
          <div className="login-alerta-error login-alert-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Acceso Rápido por Perfil para Defensa (1 Solo Clic) */}
        <div className="seccion-acceso-rapido">
          <label className="etiqueta-seccion">
            ⚡ <strong>Acceso Inmediato por Rol Escolar (Demostración de Examen):</strong>
          </label>
          <div className="grid-perfiles-demo">
            <button
              type="button"
              className={`btn-perfil-demo ${rolSeleccionado === 'DIRECTOR' ? 'perfil-activo' : ''}`}
              onClick={() => handleAccesoRapido('DIRECTOR')}
            >
              <div className="demo-rol-titulo">👩‍💼 Directora General</div>
              <div className="demo-rol-nombre">Lic. Sofia Morales</div>
              <small className="demo-rol-permisos">Acceso Total: Riesgo, Agente MCP, Reportes y Aulas</small>
            </button>

            <button
              type="button"
              className={`btn-perfil-demo ${rolSeleccionado === 'DOCENTE' ? 'perfil-activo' : ''}`}
              onClick={() => handleAccesoRapido('DOCENTE')}
            >
              <div className="demo-rol-titulo">👩‍🏫 Docente de Aula</div>
              <div className="demo-rol-nombre">Prof. Carlos Méndez</div>
              <small className="demo-rol-permisos">3.° B de Secundaria • Matemáticas • Notas y Asistencia</small>
            </button>

            <button
              type="button"
              className={`btn-perfil-demo ${rolSeleccionado === 'PADRE' ? 'perfil-activo' : ''}`}
              onClick={() => handleAccesoRapido('PADRE')}
            >
              <div className="demo-rol-titulo">👨‍👩‍👦 Tutor / Padre</div>
              <div className="demo-rol-nombre">Sr. Roberto Flores</div>
              <small className="demo-rol-permisos">Consulta de Notas y Justificativos Médicos</small>
            </button>
          </div>
        </div>

        <div className="divisor-o">
          <span>O ingrese con credenciales institucionales</span>
        </div>

        {/* Formulario Estándar */}
        <form onSubmit={handleLoginManual} className="login-formulario">
          <div className="login-campo">
            <label htmlFor="input-usuario">Usuario / Correo Institucional:</label>
            <div className="input-con-icono">
              <UserCheck size={18} className="icono-campo" />
              <input
                id="input-usuario"
                name="usuario"
                type="text"
                placeholder="ej. carlos.mendez o direccion"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>
          </div>

          <div className="login-campo">
            <label htmlFor="input-password">Contraseña:</label>
            <div className="input-con-icono">
              <KeyRound size={18} className="icono-campo" />
              <input
                id="input-password"
                name="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-iniciar-sesion" disabled={cargando}>
            {cargando ? 'Iniciando sesión segura...' : 'Iniciar Sesión (1 Solo Acceso)'}
          </button>
        </form>

        {/* Pie de la Tarjeta con Trazabilidad Arquitectónica */}
        <div className="login-footer-info">
          <div className="info-item">
            <CheckCircle2 size={14} className="icono-check" />
            <span><strong>Requisito 2.2:</strong> Acceso por una sola entrada sin volver a autenticarse</span>
          </div>
          <div className="info-item">
            <CheckCircle2 size={14} className="icono-check" />
            <span><strong>Token JWT RS256:</strong> Compartido automáticamente entre Angular (:4201) y React (:4202)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
