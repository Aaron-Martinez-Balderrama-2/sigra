export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export function requireRule(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(code, message, status);
}
export class RemoteError extends DomainError {
  constructor(
    message: string,
    public readonly uncertain: boolean,
  ) {
    super('SERVICIO_EXTERNO', message, 503);
  }
}
