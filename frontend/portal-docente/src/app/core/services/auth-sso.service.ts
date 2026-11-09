import { Injectable, signal, computed } from '@angular/core';
import { SsoSession, DocenteActor, ContextoEscolar } from '../models/sigra.model';

const SESION_DOCENTE_DEFAULT: SsoSession = {
  authenticated: true,
  token: 'sigra-jwt-rs256-prof-01-session',
  actor: {
    sub: 'prof-01',
    nombre: 'Prof. Carlos Méndez',
    roles: ['DOCENTE', 'PROFESOR'],
    cargo: 'Profesor de Aula - Matemáticas',
  },
  contextoEscolar: {
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    materiaId: 'mat-mat',
    materiaNombre: 'Matemáticas',
    gestion: 2026,
    trimestre: 1,
  },
  origenSso: 'SESION_LOCAL_DOCENTE',
};

const STORAGE_KEY = 'sigra_sso_session';

@Injectable({
  providedIn: 'root',
})
export class AuthSsoService {
  private readonly _sesion = signal<SsoSession>(this.cargarSesionInicial());

  public readonly sesion = this._sesion.asReadonly();
  public readonly token = computed(() => this._sesion().token);
  public readonly actor = computed(() => this._sesion().actor);
  public readonly contextoEscolar = computed(() => this._sesion().contextoEscolar);
  public readonly origenSso = computed(() => this._sesion().origenSso);
  public readonly modoTest = signal<boolean>(
    typeof window !== 'undefined' && localStorage.getItem('sigra_modo_test') === 'true'
  );

  constructor() {
    this.iniciarOyenteMensajesSso();
  }

  private cargarSesionInicial(): SsoSession {
    if (typeof window === 'undefined') {
      return SESION_DOCENTE_DEFAULT;
    }

    try {
      const guardada = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (guardada) {
        const parsed = JSON.parse(guardada) as Partial<SsoSession>;
        if (parsed.token && parsed.actor) {
          return {
            authenticated: true,
            token: parsed.token,
            actor: parsed.actor as DocenteActor,
            contextoEscolar: (parsed.contextoEscolar as ContextoEscolar) || SESION_DOCENTE_DEFAULT.contextoEscolar,
            origenSso: 'KEYCLOAK_OIDC',
          };
        }
      }
    } catch {
      // Fallback a sesión por defecto
    }

    return SESION_DOCENTE_DEFAULT;
  }

  private iniciarOyenteMensajesSso(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'SIGRA_SSO_SESSION' && event.data?.payload) {
        const payload = event.data.payload;
        const nuevaSesion: SsoSession = {
          authenticated: true,
          token: payload.token || this._sesion().token,
          actor: payload.actor || this._sesion().actor,
          contextoEscolar: payload.contextoEscolar || this._sesion().contextoEscolar,
          origenSso: 'SHELL_POSTMESSAGE',
        };

        if (typeof payload.modoTest === 'boolean') {
          this.modoTest.set(payload.modoTest);
        }

        this._sesion.set(nuevaSesion);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaSesion));
        } catch {
          // ignore
        }
      }
    });
  }

  public actualizarToken(token: string): void {
    this._sesion.update((prev) => {
      const updated = { ...prev, token };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }
}

