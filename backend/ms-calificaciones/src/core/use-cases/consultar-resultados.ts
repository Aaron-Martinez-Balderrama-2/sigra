import { Actor, Assignment, promedio, periodId } from '../entities/models';
import { Store } from '../ports/store';
import { Services } from '../ports/services';
import { requireRule } from '../errors/domain-error';
import { readable } from './policy';
import { validateContext } from '../entities/validation';
export interface ResultInput extends Assignment {
  trimestre: number;
  estudianteId: string;
}
export class ConsultarResultados {
  constructor(
    private readonly store: Store,
    private readonly services: Services,
  ) {}
  async evaluations(actor: Actor, input: Assignment & { trimestre: number }) {
    validateContext(input);
    requireRule(
      actor.roles.includes('DOCENTE') || actor.roles.includes('DIRECTOR'),
      'PROHIBIDO',
      'Los padres consultan únicamente resultados trimestrales.',
      403,
    );
    return this.store.transaction(async (tx) => {
      await readable(tx, actor, input);
      const evaluations = await tx.list('evaluaciones', input);
      return Promise.all(
        evaluations.map(async (e) => ({
          ...e,
          notas: await tx.list('calificaciones', { evaluacionId: e.id }),
        })),
      );
    });
  }
  async execute(actor: Actor, input: ResultInput) {
    validateContext(input);
    return this.store.transaction(async (tx) => {
      await readable(tx, actor, input, input.estudianteId);
      const course = await tx.get('cursos', input.cursoId);
      requireRule(
        course?.gestion === input.gestion &&
          course.estudiantes.includes(input.estudianteId),
        'ESTUDIANTE_INVALIDO',
        'Estudiante ajeno al curso.',
        404,
      );
      const period = await tx.get('periodos', periodId(input));
      const staff =
        actor.roles.includes('DIRECTOR') ||
        (actor.roles.includes('DOCENTE') &&
          (await tx.get('accesos', actor.sub))?.asignaciones.some(
            (a) =>
              a.cursoId === input.cursoId &&
              a.materiaId === input.materiaId &&
              a.gestion === input.gestion,
          ));
      requireRule(
        staff || period?.estado === 'CERRADO',
        'RESULTADO_NO_PUBLICADO',
        'El resultado trimestral aún no está publicado.',
        404,
      );
      const evaluations = await tx.list('evaluaciones', {
        cursoId: input.cursoId,
        materiaId: input.materiaId,
        gestion: input.gestion,
        trimestre: input.trimestre,
      });
      const notes = [];
      for (const e of evaluations) {
        const grade = await tx.get(
          'calificaciones',
          e.id + ':' + input.estudianteId,
        );
        notes.push({
          evaluacionId: e.id,
          nombre: e.nombre,
          estado: e.estado,
          nota: grade?.nota ?? null,
        });
      }
      const complete = notes.length > 0 && notes.every((n) => n.nota !== null);
      return {
        ...input,
        estado: period?.estado === 'CERRADO' ? 'PUBLICADO' : 'PROVISIONAL',
        completo: complete,
        promedio: complete ? promedio(notes.map((n) => n.nota!)) : null,
        pendientes: notes.filter((n) => n.nota === null).length,
        ...(staff ? { actividades: notes } : {}),
      };
    });
  }
  async ficha(actor: Actor, input: ResultInput) {
    const calificaciones = await this.execute(actor, input);
    const remote = async (work: () => Promise<unknown>) => {
      try {
        return { disponible: true, datos: await work() };
      } catch {
        return {
          disponible: false,
          motivo: 'Integración no disponible o pendiente de configurar.',
        };
      }
    };
    const [asistencia, alertas] = await Promise.all([
      remote(() =>
        this.services.asistencia(input.estudianteId, input.cursoId, actor),
      ),
      remote(() =>
        this.services.alertas(input.estudianteId, input.cursoId, actor),
      ),
    ]);
    return { calificaciones, asistencia, alertas };
  }
}
