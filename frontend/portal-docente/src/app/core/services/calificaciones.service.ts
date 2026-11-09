import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ContextoEscolar } from '../models/sigra.model';

export interface EvaluationItem {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  cursoId: string;
  materiaId: string;
  gestion: number;
  trimestre: number;
  estado: 'BORRADOR' | 'PUBLICANDO' | 'PUBLICADA';
  version: number;
  notas?: Array<{
    estudianteId: string;
    nota: number;
    version: number;
  }>;
}

export interface PrepareEvaluationInput {
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

export interface RegisterGradesInput {
  operationId: string;
  evaluacionId: string;
  versionEsperada: number;
  notas: Array<{
    estudianteId: string;
    nota: number;
  }>;
}

export interface PublishEvaluationInput {
  operationId: string;
  evaluacionId: string;
  versionEsperada: number;
  cerrarTrimestre?: boolean;
}

export interface SagaOrchestrationResult {
  id: string;
  evaluacionId: string;
  estado: 'EN_PROCESO' | 'COMPLETADA' | 'COMPENSADA' | 'RECUPERACION_PENDIENTE';
  cerrarTrimestre: boolean;
  error?: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: { code?: string; status?: number };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class CalificacionesService {
  private readonly http = inject(HttpClient);
  private readonly graphqlUrl =
    typeof window !== 'undefined' && window.location.port === '4201'
      ? '/graphql'
      : 'http://localhost:3000/graphql';

  /**
   * Ejecuta una query o mutación GraphQL contra ms-calificaciones (NestJS)
   */
  private ejecutarGql<T>(query: string, variables?: Record<string, any>): Observable<T> {
    return this.http
      .post<GraphQLResponse<T>>(
        this.graphqlUrl,
        { query, variables },
        { headers: { 'Content-Type': 'application/json' } }
      )
      .pipe(
        map((res) => {
          if (res.errors && res.errors.length > 0) {
            const err = res.errors[0];
            throw new Error(err.message || 'Error en operación GraphQL');
          }
          if (!res.data) {
            throw new Error('Respuesta GraphQL vacía');
          }
          return res.data;
        })
      );
  }

  /**
   * CU-06: Consultar lista de Evaluaciones del Curso por GraphQL
   */
  public consultarEvaluaciones(contexto: ContextoEscolar): Observable<EvaluationItem[]> {
    const query = `
      query ConsultarEvaluaciones($input: ContextInput!) {
        evaluaciones(input: $input) {
          id
          nombre
          descripcion
          fecha
          cursoId
          materiaId
          gestion
          trimestre
          estado
          version
          notas {
            estudianteId
            nota
            version
          }
        }
      }
    `;

    const variables = {
      input: {
        cursoId: contexto.cursoId,
        materiaId: contexto.materiaId,
        gestion: contexto.gestion,
        trimestre: contexto.trimestre,
      },
    };

    return this.ejecutarGql<{ evaluaciones: EvaluationItem[] }>(query, variables).pipe(
      map((d) => d.evaluaciones)
    );
  }

  /**
   * CU-07: Preparar / Crear nueva Evaluación en estado BORRADOR (Mutación GraphQL)
   */
  public prepararEvaluacion(input: PrepareEvaluationInput): Observable<EvaluationItem> {
    const query = `
      mutation PrepararEvaluacion($input: PrepareDto!) {
        prepararEvaluacion(input: $input) {
          id
          nombre
          descripcion
          fecha
          cursoId
          materiaId
          gestion
          trimestre
          estado
          version
        }
      }
    `;

    return this.ejecutarGql<{ prepararEvaluacion: EvaluationItem }>(query, { input }).pipe(
      map((d) => d.prepararEvaluacion)
    );
  }

  /**
   * CU-08: Registrar Calificaciones en Lote Atómico (Mutación GraphQL)
   */
  public registrarCalificaciones(
    input: RegisterGradesInput
  ): Observable<{ evaluacionId: string; version: number; guardadas: number }> {
    const query = `
      mutation RegistrarCalificaciones($input: GradesDto!) {
        registrarCalificaciones(input: $input) {
          evaluacionId
          version
          guardadas
        }
      }
    `;

    return this.ejecutarGql<{
      registrarCalificaciones: { evaluacionId: string; version: number; guardadas: number };
    }>(query, { input }).pipe(map((d) => d.registrarCalificaciones));
  }

  /**
   * CU-09: Publicar Evaluación y Orquestar SAGA Transversal (Mutación GraphQL)
   * Dispara el pipeline distribuido en los 3 microservicios:
   * 1. ms-calificaciones (NestJS / Mongo): PUBLICANDO
   * 2. ms-asistencia (Spring Boot / Postgres): Crear marca de seguimiento
   * 3. ms-riesgo (Laravel / DynamoDB): Crear análisis de riesgo
   */
  public publicarEvaluacion(input: PublishEvaluationInput): Observable<SagaOrchestrationResult> {
    const query = `
      mutation PublicarEvaluacion($input: PublishDto!) {
        publicarEvaluacion(input: $input) {
          id
          evaluacionId
          estado
          cerrarTrimestre
          error
        }
      }
    `;

    return this.ejecutarGql<{ publicarEvaluacion: SagaOrchestrationResult }>(query, {
      input,
    }).pipe(map((d) => d.publicarEvaluacion));
  }

  /**
   * CU-10: Consultar Estado de la Transacción SAGA por GraphQL
   */
  public consultarEstadoSaga(sagaId: string): Observable<SagaOrchestrationResult> {
    const query = `
      query EstadoPublicacion($sagaId: String!) {
        estadoPublicacion(sagaId: $sagaId) {
          id
          evaluacionId
          estado
          cerrarTrimestre
          error
        }
      }
    `;

    return this.ejecutarGql<{ estadoPublicacion: SagaOrchestrationResult }>(query, {
      sagaId,
    }).pipe(map((d) => d.estadoPublicacion));
  }
}
