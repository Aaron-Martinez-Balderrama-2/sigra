import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  JustificativoRequest,
  JustificativoRevisionRequest,
  JustificativoResponse,
} from '../models/sigra.model';

@Injectable({
  providedIn: 'root',
})
export class JustificativosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    typeof window !== 'undefined' && window.location.port === '4201'
      ? '/api/v1/asistencia/justificativos'
      : 'http://localhost:8081/api/v1/asistencia/justificativos';

  /**
   * CU-03: Solicitar / Registrar Justificativo Escolar (con clasificación CNN)
   */
  public solicitar(
    req: JustificativoRequest
  ): Observable<ApiResponse<JustificativoResponse>> {
    return this.http.post<ApiResponse<JustificativoResponse>>(this.baseUrl, req);
  }

  /**
   * CU-03: Listar Justificativos Pendientes de Revisión en un Curso
   */
  public obtenerPendientes(
    cursoId: string
  ): Observable<ApiResponse<JustificativoResponse[]>> {
    return this.http.get<ApiResponse<JustificativoResponse[]>>(
      `${this.baseUrl}/pendientes/curso/${encodeURIComponent(cursoId)}`
    );
  }

  /**
   * CU-03: Revisar / Aprobar / Rechazar Justificativo por el Docente
   */
  public revisar(
    id: string,
    revision: JustificativoRevisionRequest
  ): Observable<ApiResponse<JustificativoResponse>> {
    return this.http.post<ApiResponse<JustificativoResponse>>(
      `${this.baseUrl}/${encodeURIComponent(id)}/revisar`,
      revision
    );
  }
}

