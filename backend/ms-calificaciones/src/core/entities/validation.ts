import { Assignment } from './models';
import { requireRule } from '../errors/domain-error';
export function validateContext(input: Assignment & { trimestre: number }) {
  requireRule(
    /^[a-zA-Z0-9_.-]{2,64}$/.test(input.cursoId) &&
      /^[a-zA-Z0-9_.-]{2,64}$/.test(input.materiaId),
    'CONTEXTO_INVALIDO',
    'Identificadores académicos inválidos.',
  );
  requireRule(
    Number.isInteger(input.gestion) &&
      input.gestion >= 2020 &&
      input.gestion <= 2100,
    'GESTION_INVALIDA',
    'Gestión inválida.',
  );
  requireRule(
    Number.isInteger(input.trimestre) &&
      input.trimestre >= 1 &&
      input.trimestre <= 3,
    'TRIMESTRE_INVALIDO',
    'Trimestre entre 1 y 3.',
  );
}
