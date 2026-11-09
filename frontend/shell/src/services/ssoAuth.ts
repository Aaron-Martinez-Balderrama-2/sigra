import { PERFILES_DEMO, RolUsuario, SesionSso } from '../types/shell';

const STORAGE_KEY = 'sigra_sso_session';

export function obtenerSesionInicial(): SesionSso | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.authenticated && parsed.token && parsed.actor) {
        return parsed as SesionSso;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export function guardarSesion(sesion: SesionSso): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  } catch (err) {
    console.error('Error al guardar sesión en storage:', err);
  }

  // Notificar a todos los iframes o ventanas hijas
  notificarSesionAMicrofrontends(sesion);
}

export function cerrarSesion(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error al limpiar storage:', err);
  }

  // Notificar cierre de sesión
  if (typeof window !== 'undefined') {
    window.postMessage({ type: 'SIGRA_SSO_LOGOUT' }, '*');
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage({ type: 'SIGRA_SSO_LOGOUT' }, '*');
      } catch {}
    });
  }
}

export function notificarSesionAMicrofrontends(sesion: SesionSso): void {
  if (typeof window === 'undefined') return;

  const payload = {
    type: 'SIGRA_SSO_SESSION',
    payload: {
      token: sesion.token,
      actor: sesion.actor,
      contextoEscolar: sesion.contextoEscolar,
    },
  };

  window.postMessage(payload, '*');

  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(payload, '*');
    } catch {}
  });
}

export async function verificarEstadoKeycloak(): Promise<{ activo: boolean; info?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:8080/realms/sigra-realm/.well-known/openid-configuration', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return { activo: true, info: 'Keycloak 26.4 OIDC Activo (:8080)' };
    }
  } catch {
    // keycloak offline
  }
  return { activo: false, info: 'Modo Local / Tokens RS256 de Demostración' };
}

export function autenticarRapido(rol: RolUsuario): SesionSso {
  const perfil = PERFILES_DEMO[rol] || PERFILES_DEMO.DOCENTE;
  guardarSesion(perfil);
  return perfil;
}
