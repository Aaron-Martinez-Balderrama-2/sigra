import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Actor } from '../../core/entities/models';
import { ConsultarResultados } from '../../core/use-cases/consultar-resultados';
import { Services, SERVICES } from '../../core/ports/services';
import { Store, STORE } from '../../core/ports/store';
import { readable } from '../../core/use-cases/policy';
import { requireRule } from '../../core/errors/domain-error';
export const contextShape = {
  cursoId: z.string().regex(/^[a-zA-Z0-9_.-]{2,64}$/),
  materiaId: z.string().regex(/^[a-zA-Z0-9_.-]{2,64}$/),
  gestion: z.number().int().min(2020).max(2100),
  trimestre: z.number().int().min(1).max(3),
};
export const studentShape = {
  ...contextShape,
  estudianteId: z.string().regex(/^[a-zA-Z0-9_.-]{2,64}$/),
};
@Injectable()
export class ToolsService {
  constructor(
    private readonly query: ConsultarResultados,
    @Inject(STORE) private readonly store: Store,
    @Inject(SERVICES) private readonly services: Services,
  ) {}
  async call(name: string, input: unknown, actor: Actor): Promise<unknown> {
    let result: unknown;
    if (name === 'consultar_ficha')
      result = await this.query.ficha(
        actor,
        z.object(studentShape).strict().parse(input),
      );
    else if (name === 'listar_alertas') {
      const i = z.object(studentShape).strict().parse(input);
      await this.query.execute(actor, i);
      result = await this.services.alertas(i.estudianteId, i.cursoId, actor);
    } else if (name === 'resumen_curso') {
      const i = z.object(contextShape).strict().parse(input);
      requireRule(
        actor.roles.includes('DOCENTE') || actor.roles.includes('DIRECTOR'),
        'PROHIBIDO',
        'Resumen reservado a docentes y dirección.',
        403,
      );
      await readable(this.store, actor, i);
      const course = await this.store.get('cursos', i.cursoId);
      requireRule(
        course?.gestion === i.gestion,
        'CURSO_INVALIDO',
        'Curso inexistente.',
        404,
      );
      const resultados = [];
      for (const estudianteId of course.estudiantes)
        resultados.push(
          await this.query.execute(actor, { ...i, estudianteId }),
        );
      result = { ...i, estudiantes: resultados.length, resultados };
    } else {
      requireRule(
        false,
        'HERRAMIENTA_INVALIDA',
        'Herramienta no permitida.',
        400,
      );
    }
    await this.store.insert('auditoria', {
      id: randomUUID(),
      actorId: actor.sub,
      accion: 'MCP_' + name,
      recursoId: String((input as { cursoId?: string })?.cursoId ?? ''),
      creadoEn: new Date().toISOString(),
    });
    return result;
  }
}
