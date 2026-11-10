export type RolUsuario = 'DIRECTOR' | 'DOCENTE' | 'PADRE';

export interface ActorEscolar {
  sub: string;
  nombre: string;
  roles: RolUsuario[];
  cargo: string;
  email?: string;
}

export interface ContextoEscolar {
  cursoId: string;
  cursoNombre: string;
  materiaId: string;
  materiaNombre: string;
  gestion: number;
  trimestre: number;
}

export interface SesionSso {
  authenticated: boolean;
  token: string;
  actor: ActorEscolar;
  contextoEscolar: ContextoEscolar;
  origenSso: 'KEYCLOAK_OIDC' | 'DEMO_TOKEN';
  expiraEn?: string;
}

export type ModuloActivo = 'DOCENTE_ANGULAR' | 'SEGUIMIENTO_REACT' | 'SEGURIDAD_SSO';

export const PERFILES_DEMO: Record<RolUsuario, SesionSso> = {
  DIRECTOR: {
    authenticated: true,
    token: 'sigra-jwt-rs256-directora-session',
    actor: {
      sub: '33333333-3333-4333-8333-333333333333',
      nombre: 'Lic. Sofia Morales',
      roles: ['DIRECTOR', 'DOCENTE'],
      cargo: 'Directora General',
      email: 'direccion@sigra.edu.bo',
    },
    contextoEscolar: {
      cursoId: 'sec-3b',
      cursoNombre: '3.° B de Secundaria',
      materiaId: 'mat-mat',
      materiaNombre: 'Matemáticas',
      gestion: 2026,
      trimestre: 1,
    },
    origenSso: 'DEMO_TOKEN',
    expiraEn: '2 horas',
  },
  DOCENTE: {
    authenticated: true,
    token: 'sigra-jwt-rs256-prof-01-session',
    actor: {
      sub: '11111111-1111-4111-8111-111111111111',
      nombre: 'Prof. Carlos Méndez',
      roles: ['DOCENTE'],
      cargo: 'Docente de Aula - Matemáticas',
      email: 'carlos.mendez@sigra.edu.bo',
    },
    contextoEscolar: {
      cursoId: 'sec-3b',
      cursoNombre: '3.° B de Secundaria',
      materiaId: 'mat-mat',
      materiaNombre: 'Matemáticas',
      gestion: 2026,
      trimestre: 1,
    },
    origenSso: 'DEMO_TOKEN',
    expiraEn: '2 horas',
  },
  PADRE: {
    authenticated: true,
    token: 'sigra-jwt-rs256-padre-01-session',
    actor: {
      sub: '22222222-2222-4222-8222-222222222222',
      nombre: 'Sr. Roberto Flores',
      roles: ['PADRE'],
      cargo: 'Tutor / Padre de Familia',
      email: 'roberto.flores@sigra.edu.bo',
    },
    contextoEscolar: {
      cursoId: 'sec-3b',
      cursoNombre: '3.° B de Secundaria',
      materiaId: 'mat-mat',
      materiaNombre: 'Matemáticas',
      gestion: 2026,
      trimestre: 1,
    },
    origenSso: 'DEMO_TOKEN',
    expiraEn: '2 horas',
  },
};
