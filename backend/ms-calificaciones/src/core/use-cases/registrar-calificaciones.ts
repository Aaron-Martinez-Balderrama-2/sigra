import { Actor, Grade } from '../entities/models';
import { Store } from '../ports/store';
import { requireRule } from '../errors/domain-error';
import { teacher, openPeriod } from './policy';
import { operation } from './operations';
export interface GradesInput {
  operationId: string;
  evaluacionId: string;
  versionEsperada: number;
  notas: { estudianteId: string; nota: number }[];
}
export class RegistrarCalificaciones {
  constructor(private readonly store: Store) {}
  execute(actor: Actor, input: GradesInput) {
    requireRule(
      input.notas.length > 0 && input.notas.length <= 100,
      'LOTE_INVALIDO',
      'Envíe entre 1 y 100 calificaciones.',
    );
    const { operationId, ...data } = input;
    return operation(
      this.store,
      actor,
      operationId,
      'REGISTRAR_CALIFICACIONES',
      data,
      async (tx) => {
        const e = await tx.get('evaluaciones', input.evaluacionId);
        requireRule(e, 'NO_ENCONTRADO', 'Evaluación inexistente.', 404);
        await teacher(tx, actor, e);
        requireRule(
          e.docenteId === actor.sub,
          'PROHIBIDO',
          'La evaluación pertenece a otro docente.',
          403,
        );
        requireRule(
          e.estado === 'BORRADOR' && e.version === input.versionEsperada,
          'CONFLICTO_EDICION',
          'Estado o versión incompatibles.',
          409,
        );
        await openPeriod(tx, e);
        const course = await tx.get('cursos', e.cursoId);
        requireRule(course, 'CURSO_INVALIDO', 'Curso inexistente.');
        requireRule(
          new Set(input.notas.map((x) => x.estudianteId)).size ===
            input.notas.length,
          'ESTUDIANTE_REPETIDO',
          'No repita estudiantes en el mismo envío.',
        );
        for (const n of input.notas) {
          requireRule(
            course.estudiantes.includes(n.estudianteId),
            'ESTUDIANTE_INVALIDO',
            'El estudiante no pertenece al curso.',
          );
          requireRule(
            Number.isFinite(n.nota) && n.nota >= 0 && n.nota <= 100,
            'NOTA_INVALIDA',
            'La nota debe estar entre 0 y 100.',
          );
          const id = e.id + ':' + n.estudianteId;
          const old = await tx.get('calificaciones', id);
          const grade: Grade = {
            id,
            evaluacionId: e.id,
            estudianteId: n.estudianteId,
            nota: n.nota,
            version: (old?.version ?? 0) + 1,
            actualizadoEn: new Date().toISOString(),
          };
          await tx.put('calificaciones', grade);
        }
        e.version++;
        e.actualizadoEn = new Date().toISOString();
        await tx.put('evaluaciones', e);
        return {
          evaluacionId: e.id,
          version: e.version,
          guardadas: input.notas.length,
        };
      },
    );
  }
}
