import { randomUUID } from 'node:crypto';
import { Actor, Evaluation, periodId } from '../entities/models';
import { Store } from '../ports/store';
import { teacher, openPeriod } from './policy';
import { operation } from './operations';
import { requireRule } from '../errors/domain-error';
import { validateContext } from '../entities/validation';
export interface PrepareInput {
  operationId: string;
  evaluacionId?: string;
  versionEsperada?: number;
  nombre: string;
  descripcion?: string;
  fecha: string;
  cursoId: string;
  materiaId: string;
  gestion: number;
  trimestre: number;
}
export class PrepararEvaluacion {
  constructor(private readonly store: Store) {}
  async execute(actor: Actor, input: PrepareInput): Promise<Evaluation> {
    validateContext(input);
    requireRule(
      typeof input.nombre === 'string' &&
        input.nombre.trim().length > 0 &&
        input.nombre.length <= 120,
      'NOMBRE_INVALIDO',
      'Nombre de evaluación entre 1 y 120 caracteres.',
    );
    requireRule(
      !Number.isNaN(Date.parse(input.fecha)) &&
        Number(input.fecha.slice(0, 4)) === input.gestion,
      'FECHA_INVALIDA',
      'La fecha debe pertenecer a la gestión.',
    );
    const { operationId, ...data } = input;
    return operation(
      this.store,
      actor,
      operationId,
      'PREPARAR_EVALUACION',
      data,
      async (tx) => {
        await teacher(tx, actor, input);
        const course = await tx.get('cursos', input.cursoId);
        requireRule(
          course?.gestion === input.gestion,
          'CURSO_INVALIDO',
          'Curso inexistente o gestión incompatible.',
        );
        const now = new Date().toISOString();
        if (input.evaluacionId) {
          const e = await tx.get('evaluaciones', input.evaluacionId);
          requireRule(e, 'NO_ENCONTRADO', 'Evaluación inexistente.', 404);
          requireRule(
            e.docenteId === actor.sub &&
              e.cursoId === input.cursoId &&
              e.materiaId === input.materiaId &&
              e.gestion === input.gestion &&
              e.trimestre === input.trimestre,
            'CONTEXTO_INMUTABLE',
            'No puede cambiar el contexto ni editar una evaluación de otro docente.',
            409,
          );
          requireRule(
            e.estado === 'BORRADOR' && e.version === input.versionEsperada,
            'CONFLICTO_EDICION',
            'Estado o versión incompatibles.',
            409,
          );
          await openPeriod(tx, e);
          Object.assign(e, {
            nombre: input.nombre.trim(),
            descripcion: input.descripcion?.trim() ?? '',
            fecha: input.fecha,
            version: e.version + 1,
            actualizadoEn: now,
          });
          await tx.put('evaluaciones', e);
          return e;
        }
        requireRule(
          input.versionEsperada === undefined,
          'VERSION_INVALIDA',
          'Una creación no recibe versionEsperada.',
        );
        const e: Evaluation = {
          id: randomUUID(),
          cursoId: input.cursoId,
          materiaId: input.materiaId,
          gestion: input.gestion,
          trimestre: input.trimestre,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() ?? '',
          fecha: input.fecha,
          docenteId: actor.sub,
          estado: 'BORRADOR',
          version: 1,
          creadoEn: now,
          actualizadoEn: now,
        };
        const p = await tx.get('periodos', periodId(e));
        if (!p)
          await tx.insert('periodos', {
            id: periodId(e),
            cursoId: e.cursoId,
            materiaId: e.materiaId,
            gestion: e.gestion,
            trimestre: e.trimestre,
            estado: 'ABIERTO',
            version: 1,
          });
        else await openPeriod(tx, e);
        await tx.insert('evaluaciones', e);
        return e;
      },
    );
  }
}
