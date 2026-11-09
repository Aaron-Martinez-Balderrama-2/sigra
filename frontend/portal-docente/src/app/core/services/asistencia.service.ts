import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  AsistenciaResponse,
  RegistrarAsistenciaRequest,
  RegistrarAsistenciaLoteRequest,
  ResumenAsistenciaResponse,
} from '../models/sigra.model';

export interface IdempotenciaResultado {
  intento: number;
  statusHttp: number;
  headerIdempotentReplay: string | null;
  mensaje: string;
  esReplay: boolean;
  tiempoRespuestaMs: number;
}

@Injectable({
  providedIn: 'root',
})
export class AsistenciaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    typeof window !== 'undefined' && window.location.port === '4201'
      ? '/api/v1/asistencia'
      : 'http://localhost:8081/api/v1/asistencia';

  /**
   * CU-01: Registrar Asistencia Individual con Idempotencia
   */
  public registrarIndividual(
    req: RegistrarAsistenciaRequest
  ): Observable<ApiResponse<AsistenciaResponse>> {
    return this.http.post<ApiResponse<AsistenciaResponse>>(this.baseUrl, req);
  }

  /**
   * CU-01: Registrar Asistencia por Lote (todo el curso) con Idempotencia
   */
  public registrarLote(
    req: RegistrarAsistenciaLoteRequest
  ): Observable<HttpResponse<ApiResponse<AsistenciaResponse[]>>> {
    return this.http.post<ApiResponse<AsistenciaResponse[]>>(
      `${this.baseUrl}/lote`,
      req,
      { observe: 'response' }
    );
  }

  /**
   * CU-02: Consultar Planilla de Asistencia de un Curso en una Fecha
   */
  public obtenerPlanillaCursoFecha(
    cursoId: string,
    fecha: string
  ): Observable<ApiResponse<AsistenciaResponse[]>> {
    return this.http.get<ApiResponse<AsistenciaResponse[]>>(
      `${this.baseUrl}/curso/${encodeURIComponent(cursoId)}/fecha/${encodeURIComponent(fecha)}`
    );
  }

  /**
   * CU-02: Consultar Resumen y Porcentaje Efectivo de un Alumno
   */
  public obtenerResumenEstudiante(
    estudianteId: string,
    cursoId: string
  ): Observable<ApiResponse<ResumenAsistenciaResponse>> {
    return this.http.get<ApiResponse<ResumenAsistenciaResponse>>(
      `${this.baseUrl}/resumen?estudianteId=${encodeURIComponent(estudianteId)}&cursoId=${encodeURIComponent(cursoId)}`
    );
  }

  /**
   * CU-02: Consultar Historial Completo de un Alumno
   */
  public obtenerHistorialEstudiante(
    estudianteId: string,
    cursoId: string
  ): Observable<ApiResponse<AsistenciaResponse[]>> {
    return this.http.get<ApiResponse<AsistenciaResponse[]>>(
      `${this.baseUrl}/historial?estudianteId=${encodeURIComponent(estudianteId)}&cursoId=${encodeURIComponent(cursoId)}`
    );
  }

  /**
   * REQUISITO 1.6 — DEFENSA DE IDEMPOTENCIA EN VIVO:
   * Dispara 5 peticiones concurrentes con EXACTAMENTE el mismo UUID (operationId).
   * La 1.ª devuelve 201 Created (X-Idempotent-Replay: false).
   * Las 4 restantes devuelven 200 OK (X-Idempotent-Replay: true).
   */
  public probarIdempotenciaConcurrente(
    payload: RegistrarAsistenciaLoteRequest
  ): Observable<IdempotenciaResultado[]> {
    const peticiones = [1, 2, 3, 4, 5].map((indice) => {
      const inicio = performance.now();
      return this.http
        .post<ApiResponse<AsistenciaResponse[]>>(`${this.baseUrl}/lote`, payload, {
          observe: 'response',
        })
        .pipe(
          map((res) => {
            const fin = performance.now();
            const replayHeader = res.headers.get('X-Idempotent-Replay');
            return {
              intento: indice,
              statusHttp: res.status,
              headerIdempotentReplay: replayHeader,
              mensaje: res.body?.mensaje || 'Procesado',
              esReplay: replayHeader === 'true',
              tiempoRespuestaMs: Math.round(fin - inicio),
            };
          })
        );
    });

    return forkJoin(peticiones);
  }
}

