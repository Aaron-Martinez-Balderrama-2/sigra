import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/sigra.model';

export interface CrearMarcaSagaRequest {
  operationId: string;
  sagaId: string;
  evaluacionId: string;
  cursoId: string;
}

export interface CompensarMarcaRequest {
  motivo: string;
  sagaId?: string;
}

export interface MarcaSagaResponse {
  id: string;
  operationId: string;
  sagaId: string;
  evaluacionId: string;
  cursoId: string;
  estado: 'REGISTRADA' | 'COMPENSADA';
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SagaMarcasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    typeof window !== 'undefined' && window.location.port === '4201'
      ? '/api/v1/asistencia/marcas'
      : 'http://localhost:8081/api/v1/asistencia/marcas';

  /**
   * CU-04 / SAGA Paso 2: Crear marca de seguimiento con idempotencia
   */
  public crearMarca(
    req: CrearMarcaSagaRequest
  ): Observable<ApiResponse<MarcaSagaResponse>> {
    return this.http.post<ApiResponse<MarcaSagaResponse>>(this.baseUrl, req);
  }

  /**
   * CU-04: Consultar marca por ID o por operationId
   */
  public consultarMarca(
    identificador: string
  ): Observable<ApiResponse<MarcaSagaResponse>> {
    return this.http.get<ApiResponse<MarcaSagaResponse>>(
      `${this.baseUrl}/${encodeURIComponent(identificador)}`
    );
  }

  /**
   * CU-04: Rollback SAGA - Compensar marca de asistencia
   */
  public compensarMarca(
    id: string,
    motivo: string,
    sagaId?: string
  ): Observable<ApiResponse<MarcaSagaResponse>> {
    return this.http.post<ApiResponse<MarcaSagaResponse>>(
      `${this.baseUrl}/${encodeURIComponent(id)}/compensar`,
      { motivo, sagaId }
    );
  }
}

