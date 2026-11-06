import { Injectable } from '@nestjs/common';
import { Actor, Evaluation } from '../../core/entities/models';
import { Services } from '../../core/ports/services';
import { DomainError, RemoteError } from '../../core/errors/domain-error';
@Injectable()
export class HttpServices implements Services {
  ready() {
    for (const key of [
      'MS_ASISTENCIA_URL',
      'ASISTENCIA_CREAR_MARCA_PATH',
      'ASISTENCIA_CONSULTAR_MARCA_PATH',
      'ASISTENCIA_COMPENSAR_MARCA_PATH',
      'MS_RIESGO_URL',
    ]) {
      if (!process.env[key])
        throw new DomainError(
          'INTEGRACION_NO_CONFIGURADA',
          'Falta configurar ' + key + '; no se inició la publicación.',
          503,
        );
    }
    if (process.env.ASISTENCIA_CONTRATO_CONFIRMADO !== 'true')
      throw new DomainError(
        'CONTRATO_PENDIENTE',
        'El contrato de Asistencia aún no está confirmado.',
        503,
      );
  }
  private url(base: string, path: string, params: Record<string, string> = {}) {
    const value = process.env[base];
    if (!value || !path)
      throw new DomainError(
        'INTEGRACION_NO_CONFIGURADA',
        'Integración pendiente de configurar.',
        503,
      );
    let resolved = path;
    for (const [key, val] of Object.entries(params))
      resolved = resolved.replace('{' + key + '}', encodeURIComponent(val));
    if (
      resolved.includes('{') ||
      !resolved.startsWith('/') ||
      resolved.startsWith('//')
    )
      throw new DomainError(
        'RUTA_INVALIDA',
        'Ruta de integración inválida.',
        503,
      );
    return value.replace(/\/$/, '') + resolved;
  }
  private async request(
    url: string,
    actor: Actor,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<any> {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + actor.token,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
    } catch {
      throw new RemoteError(
        'Sin respuesta verificable del servicio remoto.',
        true,
      );
    }
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok)
      throw new RemoteError(
        'El servicio remoto respondió HTTP ' + response.status,
        response.status >= 500 ||
          response.status === 408 ||
          response.status === 429,
      );
    try {
      return await response.json();
    } catch {
      throw new RemoteError('Respuesta remota no válida.', true);
    }
  }
  private id(response: any): string {
    const id = response?.datos?.id;
    if (typeof id !== 'string' || !id.length)
      throw new RemoteError('La respuesta remota no contiene datos.id.', true);
    return id;
  }
  async crearMarca(
    e: Evaluation,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ) {
    return this.id(
      await this.request(
        this.url(
          'MS_ASISTENCIA_URL',
          process.env.ASISTENCIA_CREAR_MARCA_PATH ?? '',
        ),
        actor,
        'POST',
        { operationId, sagaId, evaluacionId: e.id, cursoId: e.cursoId },
      ),
    );
  }
  async consultarMarca(operationId: string, actor: Actor) {
    const r = await this.request(
      this.url(
        'MS_ASISTENCIA_URL',
        process.env.ASISTENCIA_CONSULTAR_MARCA_PATH ?? '',
        { operationId },
      ),
      actor,
      'GET',
    );
    return r ? this.id(r) : null;
  }
  async compensarMarca(
    id: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ) {
    await this.request(
      this.url(
        'MS_ASISTENCIA_URL',
        process.env.ASISTENCIA_COMPENSAR_MARCA_PATH ?? '',
        { id },
      ),
      actor,
      'POST',
      {
        operationId,
        sagaId,
        motivo: 'Compensación de publicación de evaluación',
      },
    );
  }
  async crearAnalisis(
    e: Evaluation,
    estudianteId: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ) {
    return this.id(
      await this.request(
        this.url('MS_RIESGO_URL', '/api/v1/riesgo/pendiente'),
        actor,
        'POST',
        {
          operationId,
          sagaId,
          estudianteId,
          cursoId: e.cursoId,
          evaluacionId: e.id,
        },
      ),
    );
  }
  async consultarAnalisis(operationId: string, actor: Actor) {
    const r = await this.request(
      this.url('MS_RIESGO_URL', '/api/v1/riesgo/{id}', { id: operationId }),
      actor,
      'GET',
    );
    return r ? this.id(r) : null;
  }
  async compensarAnalisis(
    id: string,
    operationId: string,
    sagaId: string,
    actor: Actor,
  ) {
    await this.request(
      this.url('MS_RIESGO_URL', '/api/v1/riesgo/{id}/compensar', { id }),
      actor,
      'POST',
      {
        operationId,
        sagaId,
        motivo: 'Compensación de publicación de evaluación',
      },
    );
  }
  async asistencia(estudianteId: string, cursoId: string, actor: Actor) {
    return this.request(
      this.url('MS_ASISTENCIA_URL', process.env.ASISTENCIA_RESUMEN_PATH ?? '', {
        estudianteId,
        cursoId,
      }),
      actor,
      'GET',
    );
  }
  async alertas(estudianteId: string, cursoId: string, actor: Actor) {
    return this.request(
      this.url('MS_RIESGO_URL', process.env.RIESGO_ALERTAS_PATH ?? '', {
        estudianteId,
        cursoId,
      }),
      actor,
      'GET',
    );
  }
}
