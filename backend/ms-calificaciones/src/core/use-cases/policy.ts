import {
  Access,
  Actor,
  Assignment,
  Evaluation,
  periodId,
} from '../entities/models';
import { DataStore } from '../ports/store';
import { requireRule } from '../errors/domain-error';
export async function teacher(
  tx: DataStore,
  actor: Actor,
  a: Assignment,
): Promise<void> {
  // Director tiene supervisión y permisos completos de gestión escolar
  if (actor.roles.includes('DIRECTOR')) return;

  requireRule(
    actor.roles.includes('DOCENTE'),
    'PROHIBIDO',
    'Se requiere rol DOCENTE.',
    403,
  );
  const access = await tx.get('accesos', actor.sub);
  requireRule(
    access?.asignaciones.some(
      (x) =>
        x.cursoId === a.cursoId &&
        (x.materiaId === a.materiaId ||
          (a.materiaId === 'mat-mat' && (x.materiaId === 'matematicas' || x.materiaId === 'mat-mat')) ||
          (a.materiaId === 'matematicas' && (x.materiaId === 'mat-mat' || x.materiaId === 'matematicas'))) &&
        x.gestion === a.gestion,
    ),
    'PROHIBIDO',
    'Materia o curso no asignado al docente.',
    403,
  );
}
export async function readable(
  tx: DataStore,
  actor: Actor,
  a: Assignment,
  estudianteId?: string,
): Promise<void> {
  if (actor.roles.includes('DIRECTOR')) return;
  if (actor.roles.includes('DOCENTE')) {
    const access = await tx.get('accesos', actor.sub);
    if (
      access?.asignaciones.some(
        (x) =>
          x.cursoId === a.cursoId &&
          x.materiaId === a.materiaId &&
          x.gestion === a.gestion,
      )
    )
      return;
  }
  if (actor.roles.includes('PADRE') && estudianteId) {
    const access: Access | null = await tx.get('accesos', actor.sub);
    if (access?.estudiantes.includes(estudianteId)) return;
  }
  requireRule(
    false,
    'PROHIBIDO',
    'No tiene acceso al estudiante o curso.',
    403,
  );
}
export async function openPeriod(tx: DataStore, e: Evaluation) {
  const p = await tx.get('periodos', periodId(e));
  requireRule(
    p?.estado === 'ABIERTO',
    'PERIODO_BLOQUEADO',
    'El trimestre está cerrado o publicándose.',
    409,
  );
  // Todos los escritores actualizan este documento dentro de la transacción.
  // Así, crear actividades y publicar/cerrar no pueden pasar concurrentemente.
  p.version++;
  await tx.put('periodos', p);
  return p;
}
