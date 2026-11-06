import { randomUUID } from 'node:crypto';
import {
  Actor,
  Evaluation,
  RemoteStep,
  Saga,
  periodId,
} from '../entities/models';
import { Store } from '../ports/store';
import { Services } from '../ports/services';
import { DomainError, RemoteError, requireRule } from '../errors/domain-error';
import { teacher, openPeriod } from './policy';
import { operation } from './operations';
import { validateContext } from '../entities/validation';
import { Assignment } from '../entities/models';
export interface PublishInput {
  operationId: string;
  evaluacionId: string;
  versionEsperada: number;
  cerrarTrimestre?: boolean;
}
export class PublicarEvaluacion {
  constructor(
    private readonly store: Store,
    private readonly services: Services,
  ) {}
  async close(
    actor: Actor,
    input: Assignment & { trimestre: number; operationId: string },
  ) {
    validateContext(input);
    const { operationId, ...context } = input;
    return operation(
      this.store,
      actor,
      operationId,
      'CERRAR_TRIMESTRE',
      context,
      async (tx) => {
        await teacher(tx, actor, input);
        const period = await tx.get('periodos', periodId(input));
        requireRule(
          period?.estado === 'ABIERTO',
          'PERIODO_BLOQUEADO',
          'El periodo no está abierto.',
          409,
        );
        const evaluations = await tx.list('evaluaciones', context);
        requireRule(
          evaluations.length > 0 &&
            evaluations.every((e) => e.estado === 'PUBLICADA'),
          'TRIMESTRE_INCOMPLETO',
          'Todas las evaluaciones deben estar publicadas.',
          409,
        );
        const course = await tx.get('cursos', input.cursoId);
        requireRule(
          course && course.estudiantes.length > 0,
          'CURSO_INVALIDO',
          'Curso sin estudiantes.',
          409,
        );
        for (const e of evaluations) {
          const grades = await tx.list('calificaciones', {
            evaluacionId: e.id,
          });
          requireRule(
            course.estudiantes.every((id) =>
              grades.some((g) => g.estudianteId === id),
            ),
            'NOTAS_INCOMPLETAS',
            'Faltan calificaciones para cerrar el trimestre.',
            409,
          );
        }
        period.estado = 'CERRADO';
        period.version++;
        await tx.put('periodos', period);
        return period;
      },
    );
  }
  async execute(actor: Actor, input: PublishInput): Promise<Saga> {
    this.services.ready();
    const { operationId, ...data } = input;
    const original = await operation(
      this.store,
      actor,
      operationId,
      'PUBLICAR_EVALUACION',
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
        const p = await openPeriod(tx, e);
        const course = await tx.get('cursos', e.cursoId);
        const grades = await tx.list('calificaciones', { evaluacionId: e.id });
        requireRule(
          course &&
            course.estudiantes.length > 0 &&
            course.estudiantes.every((id) =>
              grades.some((g) => g.estudianteId === id),
            ),
          'NOTAS_INCOMPLETAS',
          'Registre todas las notas antes de publicar.',
          409,
        );
        if (input.cerrarTrimestre) {
          const others = await tx.list('evaluaciones', {
            cursoId: e.cursoId,
            materiaId: e.materiaId,
            gestion: e.gestion,
            trimestre: e.trimestre,
          });
          requireRule(
            others.every((x) => x.id === e.id || x.estado === 'PUBLICADA'),
            'TRIMESTRE_INCOMPLETO',
            'Publique las demás actividades antes del cierre.',
            409,
          );
          p.estado = 'PUBLICANDO';
          await tx.put('periodos', p);
        }
        e.estado = 'PUBLICANDO';
        e.version++;
        e.actualizadoEn = new Date().toISOString();
        await tx.put('evaluaciones', e);
        const id = randomUUID();
        const saga: Saga = {
          id,
          sagaId: id,
          evaluacionId: e.id,
          actorId: actor.sub,
          estado: 'EN_PROCESO',
          cerrarTrimestre: input.cerrarTrimestre ?? false,
          asistencia: { operationId: randomUUID(), estado: 'PENDIENTE' },
          analisis: course.estudiantes.map((estudianteId) => ({
            operationId: randomUUID(),
            estudianteId,
            estado: 'PENDIENTE',
          })),
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        };
        await tx.insert('sagas_publicacion', saga);
        return saga;
      },
    );
    return this.resume(actor, original.id);
  }
  async resume(actor: Actor, sagaId: string): Promise<Saga> {
    this.services.ready();
    const owner = randomUUID();
    let saga = await this.store.transaction(async (tx) => {
      const s = await tx.get('sagas_publicacion', sagaId);
      requireRule(s, 'NO_ENCONTRADO', 'Saga inexistente.', 404);
      requireRule(
        s.actorId === actor.sub,
        'PROHIBIDO',
        'Solo el docente responsable puede reanudar la publicación.',
        403,
      );
      if (s.estado === 'COMPLETADA' || s.estado === 'COMPENSADA') return s;
      requireRule(
        !s.leaseUntil || s.leaseUntil < Date.now(),
        'PUBLICACION_EN_PROCESO',
        'Otro proceso está ejecutando esta Saga.',
        409,
      );
      s.leaseOwner = owner;
      s.leaseUntil = Date.now() + 60000;
      await tx.put('sagas_publicacion', s);
      return s;
    });
    if (saga.estado === 'COMPLETADA' || saga.estado === 'COMPENSADA')
      return saga;
    const e = await this.store.get('evaluaciones', saga.evaluacionId);
    requireRule(e, 'NO_ENCONTRADO', 'Evaluación inexistente.', 404);
    await teacher(this.store, actor, e);
    const save = async () => {
      saga.actualizadoEn = new Date().toISOString();
      saga.leaseUntil = Date.now() + 60000;
      await this.store.transaction(async (tx) => {
        const current = await tx.get('sagas_publicacion', saga.id);
        requireRule(
          current?.leaseOwner === owner &&
            (current.leaseUntil ?? 0) > Date.now(),
          'LEASE_PERDIDO',
          'Se perdió la exclusividad de la Saga; requiere recuperación.',
          409,
        );
        await tx.put('sagas_publicacion', saga);
      });
    };
    const run = async (step: RemoteStep, attendance: boolean) => {
      if (step.estado === 'HECHO' || step.estado === 'COMPENSADO') return;
      if (step.estado === 'INTENTADO') {
        const found = attendance
          ? await this.services.consultarMarca(step.operationId, actor)
          : await this.services.consultarAnalisis(step.operationId, actor);
        if (!found)
          throw new RemoteError(
            'No se pudo determinar si una operación previa se ejecutó. Se conserva el bloqueo; requiere conciliación con el servicio remoto.',
            true,
          );
        step.remoteId = found;
      } else {
        step.estado = 'INTENTADO';
        await save();
        try {
          step.remoteId = attendance
            ? await this.services.crearMarca(
                e,
                step.operationId,
                saga.id,
                actor,
              )
            : await this.services.crearAnalisis(
                e,
                step.estudianteId!,
                step.operationId,
                saga.id,
                actor,
              );
        } catch (error) {
          if (error instanceof RemoteError && !error.uncertain) {
            step.estado = 'PENDIENTE';
            await save();
          }
          throw error;
        }
      }
      step.estado = 'HECHO';
      await save();
    };
    try {
      if (saga.estado !== 'COMPENSANDO') {
        await run(saga.asistencia, true);
        for (const step of saga.analisis) await run(step, false);
        await this.finish(saga, e, true, owner);
        saga.estado = 'COMPLETADA';
      } else await this.compensate(saga, e, actor, owner, save);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'LEASE_PERDIDO')
        throw error;
      saga.error =
        error instanceof Error ? error.message : 'Error de publicación';
      if (error instanceof RemoteError && !error.uncertain) {
        saga.estado = 'COMPENSANDO';
        await save();
        await this.compensate(saga, e, actor, owner, save);
      } else {
        // No compensar con un resultado remoto desconocido: pudo haberse confirmado.
        // Mantener COMPENSANDO si una compensación ya estaba en curso.
        if (saga.estado !== 'COMPENSANDO')
          saga.estado = 'RECUPERACION_PENDIENTE';
        await save();
      }
    } finally {
      await this.store.transaction(async (tx) => {
        const current = await tx.get('sagas_publicacion', saga.id);
        if (current?.leaseOwner === owner) {
          delete current.leaseOwner;
          delete current.leaseUntil;
          await tx.put('sagas_publicacion', current);
        }
      });
    }
    return (await this.store.get('sagas_publicacion', saga.id))!;
  }
  private async compensate(
    saga: Saga,
    e: Evaluation,
    actor: Actor,
    owner: string,
    save: () => Promise<void>,
  ) {
    try {
      for (const step of [...saga.analisis].reverse())
        if (step.estado === 'HECHO') {
          await this.services.compensarAnalisis(
            step.remoteId!,
            step.operationId + '-comp',
            saga.id,
            actor,
          );
          step.estado = 'COMPENSADO';
          await save();
        }
      if (saga.asistencia.estado === 'HECHO') {
        await this.services.compensarMarca(
          saga.asistencia.remoteId!,
          saga.asistencia.operationId + '-comp',
          saga.id,
          actor,
        );
        saga.asistencia.estado = 'COMPENSADO';
        await save();
      }
      await this.finish(saga, e, false, owner);
      saga.estado = 'COMPENSADA';
    } catch (error) {
      saga.estado = 'COMPENSANDO';
      saga.error =
        error instanceof Error ? error.message : 'Compensación pendiente';
      await save();
    }
  }
  private async finish(
    saga: Saga,
    e: Evaluation,
    success: boolean,
    owner: string,
  ) {
    await this.store.transaction(async (tx) => {
      const current = await tx.get('sagas_publicacion', saga.id);
      requireRule(
        current?.leaseOwner === owner && (current.leaseUntil ?? 0) > Date.now(),
        'LEASE_PERDIDO',
        'Se perdió la exclusividad de la Saga.',
        409,
      );
      const evaluation = await tx.get('evaluaciones', e.id);
      requireRule(
        evaluation?.estado === 'PUBLICANDO',
        'ESTADO_INVALIDO',
        'Estado inesperado de evaluación.',
        409,
      );
      evaluation.estado = success ? 'PUBLICADA' : 'BORRADOR';
      evaluation.version++;
      evaluation.actualizadoEn = new Date().toISOString();
      await tx.put('evaluaciones', evaluation);
      const p = await tx.get('periodos', periodId(e));
      requireRule(p, 'PERIODO_INVALIDO', 'Trimestre inexistente.', 409);
      p.version++;
      if (saga.cerrarTrimestre) p.estado = success ? 'CERRADO' : 'ABIERTO';
      await tx.put('periodos', p);
      current.estado = success ? 'COMPLETADA' : 'COMPENSADA';
      current.actualizadoEn = new Date().toISOString();
      await tx.put('sagas_publicacion', current);
      await tx.insert('auditoria', {
        id: randomUUID(),
        actorId: saga.actorId,
        accion: current.estado,
        recursoId: saga.evaluacionId,
        creadoEn: current.actualizadoEn,
      });
    });
  }
}
