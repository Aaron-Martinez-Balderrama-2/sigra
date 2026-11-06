export type Role = 'DOCENTE' | 'PADRE' | 'DIRECTOR';
export interface Actor {
  sub: string;
  roles: Role[];
  token: string;
}
export interface Assignment {
  cursoId: string;
  materiaId: string;
  gestion: number;
}
export interface Access {
  id: string;
  asignaciones: Assignment[];
  estudiantes: string[];
}
export interface Course {
  id: string;
  nivel: 'PRIMARIA' | 'SECUNDARIA';
  grado: number;
  paralelo: string;
  gestion: number;
  estudiantes: string[];
}
export interface Evaluation extends Assignment {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  trimestre: number;
  docenteId: string;
  estado: 'BORRADOR' | 'PUBLICANDO' | 'PUBLICADA';
  version: number;
  creadoEn: string;
  actualizadoEn: string;
}
export interface Grade {
  id: string;
  evaluacionId: string;
  estudianteId: string;
  nota: number;
  version: number;
  actualizadoEn: string;
}
export interface Period extends Assignment {
  id: string;
  trimestre: number;
  estado: 'ABIERTO' | 'PUBLICANDO' | 'CERRADO';
  version: number;
}
export interface Operation {
  id: string;
  actorId: string;
  hash: string;
  resultado: unknown;
  creadoEn: string;
}
export interface RemoteStep {
  operationId: string;
  estudianteId?: string;
  estado: 'PENDIENTE' | 'INTENTADO' | 'HECHO' | 'COMPENSADO';
  remoteId?: string;
}
export interface Saga {
  id: string;
  sagaId: string;
  evaluacionId: string;
  actorId: string;
  estado:
    | 'EN_PROCESO'
    | 'COMPENSANDO'
    | 'COMPENSADA'
    | 'COMPLETADA'
    | 'RECUPERACION_PENDIENTE';
  cerrarTrimestre: boolean;
  asistencia: RemoteStep;
  analisis: RemoteStep[];
  error?: string;
  leaseOwner?: string;
  leaseUntil?: number;
  creadoEn: string;
  actualizadoEn: string;
}
export interface Audit {
  id: string;
  actorId: string;
  accion: string;
  recursoId: string;
  creadoEn: string;
}
export interface Tables {
  evaluaciones: Evaluation;
  calificaciones: Grade;
  periodos: Period;
  sagas_publicacion: Saga;
  operaciones_procesadas: Operation;
  accesos: Access;
  cursos: Course;
  auditoria: Audit;
}
export type Table = keyof Tables;
export function periodId(a: Assignment & { trimestre: number }): string {
  return [a.gestion, a.cursoId, a.materiaId, a.trimestre].join(':');
}
export function promedio(notas: number[]): number | null {
  return notas.length
    ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
    : null;
}
