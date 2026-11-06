import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { CurrentActor } from '../auth/auth';
import { Actor } from '../../core/entities/models';
import { PrepararEvaluacion } from '../../core/use-cases/preparar-evaluacion';
import { RegistrarCalificaciones } from '../../core/use-cases/registrar-calificaciones';
import { PublicarEvaluacion } from '../../core/use-cases/publicar-evaluacion';
import { ConsultarResultados } from '../../core/use-cases/consultar-resultados';
import { Store, STORE } from '../../core/ports/store';
import { requireRule } from '../../core/errors/domain-error';
import {
  CloseDto,
  PeriodView,
  ContextInput,
  EvaluationView,
  FileView,
  GradesDto,
  PrepareDto,
  PublishDto,
  ResultDto,
  ResultView,
  SagaView,
  SavedView,
} from './dto';
@Resolver()
export class CalificacionesResolver {
  constructor(
    private readonly prepare: PrepararEvaluacion,
    private readonly grades: RegistrarCalificaciones,
    private readonly publish: PublicarEvaluacion,
    private readonly query: ConsultarResultados,
    @Inject(STORE) private readonly store: Store,
  ) {}
  @Mutation(() => EvaluationView)
  prepararEvaluacion(@CurrentActor() a: Actor, @Args('input') i: PrepareDto) {
    return this.prepare.execute(a, i);
  }
  @Mutation(() => SavedView)
  registrarCalificaciones(
    @CurrentActor() a: Actor,
    @Args('input') i: GradesDto,
  ) {
    return this.grades.execute(a, i);
  }
  @Mutation(() => SagaView)
  publicarEvaluacion(@CurrentActor() a: Actor, @Args('input') i: PublishDto) {
    return this.publish.execute(a, i);
  }
  @Mutation(() => SagaView)
  reanudarPublicacion(@CurrentActor() a: Actor, @Args('sagaId') id: string) {
    return this.publish.resume(a, id);
  }
  @Mutation(() => PeriodView)
  cerrarTrimestre(@CurrentActor() a: Actor, @Args('input') input: CloseDto) {
    return this.publish.close(a, input);
  }
  @Query(() => [EvaluationView])
  evaluaciones(@CurrentActor() a: Actor, @Args('input') i: ContextInput) {
    return this.query.evaluations(a, i);
  }
  @Query(() => ResultView)
  resultadoTrimestral(@CurrentActor() a: Actor, @Args('input') i: ResultDto) {
    return this.query.execute(a, i);
  }
  @Query(() => FileView)
  async fichaEstudiante(@CurrentActor() a: Actor, @Args('input') i: ResultDto) {
    const r = await this.query.ficha(a, i);
    const external = (v: {
      disponible: boolean;
      datos?: unknown;
      motivo?: string;
    }) => ({
      disponible: v.disponible,
      motivo: v.motivo,
      datosJson: v.disponible ? JSON.stringify(v.datos) : undefined,
    });
    return {
      calificaciones: r.calificaciones,
      asistencia: external(r.asistencia),
      alertas: external(r.alertas),
    };
  }
  @Query(() => SagaView)
  async estadoPublicacion(
    @CurrentActor() a: Actor,
    @Args('sagaId') id: string,
  ) {
    const s = await this.store.get('sagas_publicacion', id);
    requireRule(s, 'NO_ENCONTRADO', 'Saga inexistente.', 404);
    requireRule(
      s.actorId === a.sub || a.roles.includes('DIRECTOR'),
      'PROHIBIDO',
      'No tiene acceso a la Saga.',
      403,
    );
    return s;
  }
}
