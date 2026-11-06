import { Actor, Evaluation } from '../entities/models';
export interface Services {
  ready(): void;
  crearMarca(
    e: Evaluation,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ): Promise<string>;
  consultarMarca(operationId: string, actor: Actor): Promise<string | null>;
  compensarMarca(
    id: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ): Promise<void>;
  crearAnalisis(
    e: Evaluation,
    estudianteId: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ): Promise<string>;
  consultarAnalisis(operationId: string, actor: Actor): Promise<string | null>;
  compensarAnalisis(
    id: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ): Promise<void>;
  asistencia(
    estudianteId: string,
    cursoId: string,
    actor: Actor,
  ): Promise<unknown>;
  alertas(
    estudianteId: string,
    cursoId: string,
    actor: Actor,
  ): Promise<unknown>;
}
export const SERVICES = Symbol('SERVICES');
