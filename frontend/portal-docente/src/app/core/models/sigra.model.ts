export type EstadoAsistencia = 'PRESENTE' | 'FALTA' | 'ATRASO' | 'FALTA_JUSTIFICADA';

export type ClasificacionCnn = 'LEGIBLE' | 'ILEGIBLE' | 'PENDIENTE_ANALISIS';

export type EstadoJustificativo = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface EstudianteEscolar {
  id: string;
  nombre: string;
  cursoId: string;
  cursoNombre: string;
  perfil: string;
  estadoAsignado?: EstadoAsistencia;
  porcentajeAsistencia?: number;
  enRiesgo?: boolean;
}

export const CATALOGO_ESTUDIANTES_COLEGIO: EstudianteEscolar[] = [
  {
    id: 'est-001',
    nombre: 'Mateo Rojas Villarroel',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    perfil: 'Alumno en riesgo potencial (para pruebas de faltas)',
  },
  {
    id: 'est-002',
    nombre: 'Valentina Suárez Justiniano',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    perfil: 'Alumna destacada (asistencia 100% y promedio alto)',
  },
  {
    id: 'est-003',
    nombre: 'Santiago Flores Céspedes',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    perfil: 'Alumno con atrasos y justificativo médico por revisar',
  },
  {
    id: 'est-004',
    nombre: 'Camila Gutiérrez Paz',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    perfil: 'Alumna regular del curso',
  },
  {
    id: 'est-005',
    nombre: 'Diego Morales Arteaga',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    perfil: 'Alumno con inasistencias para prueba de cola Offline',
  },
];

export interface DocenteActor {
  sub: string;
  nombre: string;
  roles: string[];
  cargo?: string;
}

export interface ContextoEscolar {
  cursoId: string;
  cursoNombre: string;
  materiaId: string;
  materiaNombre: string;
  gestion: number;
  trimestre: number;
}

export interface SsoSession {
  authenticated: boolean;
  token: string;
  actor: DocenteActor;
  contextoEscolar: ContextoEscolar;
  origenSso: 'KEYCLOAK_OIDC' | 'SHELL_POSTMESSAGE' | 'SESION_LOCAL_DOCENTE';
}

export interface ApiResponse<T> {
  status: string;
  mensaje: string;
  datos: T;
  timestamp: string;
}

export interface RegistrarAsistenciaRequest {
  operationId: string;
  estudianteId: string;
  cursoId: string;
  fecha: string;
  estado: EstadoAsistencia;
}

export interface EstudianteAsistenciaLoteItem {
  estudianteId: string;
  estado: EstadoAsistencia;
}

export interface RegistrarAsistenciaLoteRequest {
  operationId: string;
  cursoId: string;
  fecha: string;
  estudiantes: EstudianteAsistenciaLoteItem[];
}

export interface AsistenciaResponse {
  id: string;
  operationId: string;
  estudianteId: string;
  cursoId: string;
  fecha: string;
  estado: EstadoAsistencia;
  createdAt?: string;
}

export interface ResumenAsistenciaResponse {
  estudianteId: string;
  cursoId: string;
  totalClases: number;
  presentes: number;
  faltas: number;
  atrasos: number;
  faltasJustificadas: number;
  porcentajeAsistencia: number;
  enRiesgoPorInasistencia: boolean;
}

export interface JustificativoRequest {
  estudianteId: string;
  cursoId: string;
  fechaFalta: string;
  motivo: string;
  imagenUrl?: string;
  clasificacionCnn?: ClasificacionCnn;
}

export interface JustificativoRevisionRequest {
  aprobado: boolean;
  observaciones: string;
}

export interface JustificativoResponse {
  id: string;
  estudianteId: string;
  cursoId: string;
  fechaFalta: string;
  motivo: string;
  imagenUrl?: string;
  clasificacionCnn: ClasificacionCnn;
  estado: EstadoJustificativo;
  observaciones?: string;
  fechaRevision?: string;
  createdAt?: string;
}

export interface MarcaSagaItem {
  id: string;
  sagaId: string;
  evaluacionId: string;
  estudianteId: string;
  tipoMarca: string;
  estado: 'REGISTRADA' | 'COMPENSADA';
  createdAt?: string;
}

export interface RegistroOfflineItem {
  id?: number;
  operationId: string;
  cursoId: string;
  fecha: string;
  timestamp: number;
  payload: RegistrarAsistenciaLoteRequest;
  estadoSync: 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';
  reintentoHttp?: string;
}

