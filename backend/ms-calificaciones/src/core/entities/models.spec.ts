import { promedio } from './models';
import { stable } from '../use-cases/operations';
describe('Reglas académicas y comparación de reintentos', () => {
  it('distingue datos pendientes de una nota cero', () => {
    expect(promedio([])).toBeNull();
    expect(promedio([0])).toBe(0);
  });
  it('calcula un promedio simple con precisión de dos decimales', () => {
    expect(promedio([70, 80, 90])).toBe(80);
    expect(promedio([0, 100, 100])).toBe(66.67);
  });
  it('compara el contenido independientemente del orden de sus campos, conservando el orden de notas', () => {
    expect(stable({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stable({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(stable([1, 2])).not.toBe(stable([2, 1]));
    expect(stable({ nota: 0 })).not.toBe(stable({}));
  });
});
