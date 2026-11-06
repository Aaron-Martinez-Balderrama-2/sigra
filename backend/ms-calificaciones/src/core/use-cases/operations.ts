import { createHash, randomUUID } from 'node:crypto';
import { Actor } from '../entities/models';
import { DataStore, Store } from '../ports/store';
import { requireRule } from '../errors/domain-error';
export function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function operation<T>(
  store: Store,
  actor: Actor,
  operationId: string,
  action: string,
  input: unknown,
  work: (tx: DataStore) => Promise<T>,
): Promise<T> {
  requireRule(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      operationId,
    ),
    'OPERACION_INVALIDA',
    'operationId debe ser UUID v4.',
  );
  const hash = createHash('sha256')
    .update(stable({ action, input }))
    .digest('hex');
  return store.transaction(async (tx) => {
    const previous = await tx.get('operaciones_procesadas', operationId);
    if (previous) {
      requireRule(
        previous.actorId === actor.sub && previous.hash === hash,
        'OPERACION_REUTILIZADA',
        'operationId ya fue usado con otros datos o usuario.',
        409,
      );
      return previous.resultado as T;
    }
    const result = await work(tx);
    await tx.insert('operaciones_procesadas', {
      id: operationId,
      actorId: actor.sub,
      hash,
      resultado: result,
      creadoEn: new Date().toISOString(),
    });
    await tx.insert('auditoria', {
      id: randomUUID(),
      actorId: actor.sub,
      accion: action,
      recursoId: operationId,
      creadoEn: new Date().toISOString(),
    });
    return result;
  });
}
