import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryStore } from '../../adapters/persistence/memory/in-memory-store';
import { PrepararEvaluacion } from './preparar-evaluacion';
import { RegistrarCalificaciones } from './registrar-calificaciones';
import { ConsultarResultados } from './consultar-resultados';
import { PublicarEvaluacion } from './publicar-evaluacion';
import { Actor, Evaluation } from '../entities/models';
import { Services } from '../ports/services';
import { DomainError, RemoteError } from '../errors/domain-error';

const DOCENTE: Actor = {
  sub: '11111111-1111-4111-8111-111111111111',
  roles: ['DOCENTE'],
  token: 'token-docente',
};

const OTRO_DOCENTE: Actor = {
  sub: '99999999-9999-4999-8999-999999999999',
  roles: ['DOCENTE'],
  token: 'token-otro',
};

const PADRE: Actor = {
  sub: '22222222-2222-4222-8222-222222222222',
  roles: ['PADRE'],
  token: 'token-padre',
};

const DIRECTOR: Actor = {
  sub: '33333333-3333-4333-8333-333333333333',
  roles: ['DIRECTOR'],
  token: 'token-director',
};

class RealPracticeServices implements Services {
  public failAtAnalysisIndex: number | null = null;
  public uncertainFailureAtAnalysisIndex: number | null = null;
  public failAtAttendance = false;
  public marcasCreadas: Array<{
    remoteId: string;
    operationId: string;
    sagaId: string;
    compensada: boolean;
  }> = [];
  public analisisCreados: Array<{
    remoteId: string;
    estudianteId: string;
    operationId: string;
    sagaId: string;
    compensado: boolean;
  }> = [];
  private analysisCounter = 0;

  ready(): void {
    // Servicio confirmado y listo
  }

  async crearMarca(
    _e: Evaluation,
    operationId: string,
    sagaId: string,
    _actor: Actor,
  ): Promise<string> {
    if (this.failAtAttendance) {
      throw new RemoteError('Fallo determinista en ms-asistencia', false);
    }
    const existing = this.marcasCreadas.find(
      (m) => m.operationId === operationId,
    );
    if (existing) return existing.remoteId;
    const remoteId = `marca-${this.marcasCreadas.length + 1}`;
    this.marcasCreadas.push({
      remoteId,
      operationId,
      sagaId,
      compensada: false,
    });
    return remoteId;
  }

  async consultarMarca(
    operationId: string,
    _actor: Actor,
  ): Promise<string | null> {
    const found = this.marcasCreadas.find((m) => m.operationId === operationId);
    return found ? found.remoteId : null;
  }

  async compensarMarca(
    remoteId: string,
    _operationId: string,
    _sagaId: string,
    _actor: Actor,
  ): Promise<void> {
    const found = this.marcasCreadas.find((m) => m.remoteId === remoteId);
    if (found) found.compensada = true;
  }

  async crearAnalisis(
    _e: Evaluation,
    estudianteId: string,
    operationId: string,
    sagaId: string,
    _actor: Actor,
  ): Promise<string> {
    const currentIndex = this.analysisCounter++;
    if (this.uncertainFailureAtAnalysisIndex === currentIndex) {
      // Simula que el servidor remoto sí procesó la operación antes del corte de red (timeout)
      const remoteId = `analisis-${this.analisisCreados.length + 1}`;
      this.analisisCreados.push({
        remoteId,
        estudianteId,
        operationId,
        sagaId,
        compensado: false,
      });
      throw new RemoteError(
        'Tiempo de espera agotado al contactar a ms-riesgo.',
        true,
      );
    }
    if (this.failAtAnalysisIndex === currentIndex) {
      throw new RemoteError(
        `Fallo simulado en ms-riesgo al procesar estudiante ${estudianteId}`,
        false,
      );
    }
    const existing = this.analisisCreados.find(
      (a) => a.operationId === operationId,
    );
    if (existing) return existing.remoteId;
    const remoteId = `analisis-${this.analisisCreados.length + 1}`;
    this.analisisCreados.push({
      remoteId,
      estudianteId,
      operationId,
      sagaId,
      compensado: false,
    });
    return remoteId;
  }

  async consultarAnalisis(
    operationId: string,
    _actor: Actor,
  ): Promise<string | null> {
    const found = this.analisisCreados.find(
      (a) => a.operationId === operationId,
    );
    return found ? found.remoteId : null;
  }

  async compensarAnalisis(
    remoteId: string,
    _operationId: string,
    _sagaId: string,
    _actor: Actor,
  ): Promise<void> {
    const found = this.analisisCreados.find((a) => a.remoteId === remoteId);
    if (found) found.compensado = true;
  }

  async asistencia(
    estudianteId: string,
    cursoId: string,
    _actor: Actor,
  ): Promise<unknown> {
    return {
      estudianteId,
      cursoId,
      porcentajeAsistencia: 92.5,
      faltasInjustificadas: 1,
    };
  }

  async alertas(
    estudianteId: string,
    cursoId: string,
    _actor: Actor,
  ): Promise<unknown> {
    return [
      {
        estudianteId,
        cursoId,
        nivelRiesgo: 'BAJO',
        estado: 'ANALISIS_COMPLETADO',
      },
    ];
  }
}

describe('Casos de Uso de Dominio y Orquestador SAGA en Práctica Real (Clean Architecture)', () => {
  let store: InMemoryStore;
  let services: RealPracticeServices;
  let preparar: PrepararEvaluacion;
  let registrar: RegistrarCalificaciones;
  let consultar: ConsultarResultados;
  let publicar: PublicarEvaluacion;

  beforeEach(async () => {
    store = new InMemoryStore();
    services = new RealPracticeServices();
    preparar = new PrepararEvaluacion(store);
    registrar = new RegistrarCalificaciones(store);
    consultar = new ConsultarResultados(store, services);
    publicar = new PublicarEvaluacion(store, services);

    await store.put('cursos', {
      id: 'CURSO-1A',
      nivel: 'SECUNDARIA',
      grado: 1,
      paralelo: 'A',
      gestion: 2026,
      estudiantes: ['EST-001', 'EST-002', 'EST-003'],
    });
    await store.put('accesos', {
      id: DOCENTE.sub,
      asignaciones: [
        { cursoId: 'CURSO-1A', materiaId: 'MAT-101', gestion: 2026 },
      ],
      estudiantes: [],
    });
    await store.put('accesos', {
      id: PADRE.sub,
      asignaciones: [],
      estudiantes: ['EST-001'],
    });
  });

  describe('1. PrepararEvaluacion e Idempotencia Estricta (Req 1.6)', () => {
    it('crea evaluación en BORRADOR, abre el periodo trimestral y garantiza idempotencia ante reintentos', async () => {
      const input = {
        operationId: randomUUID(),
        nombre: 'Examen Parcial de Álgebra',
        descripcion: 'Ecuaciones lineales y sistemas 2x2',
        fecha: '2026-04-10',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      };

      const ev1 = await preparar.execute(DOCENTE, input);
      const ev2 = await preparar.execute(DOCENTE, input);

      expect(ev1.id).toBe(ev2.id);
      expect(ev1.estado).toBe('BORRADOR');
      expect(ev1.version).toBe(1);

      const periodo = await store.get('periodos', '2026:CURSO-1A:MAT-101:1');
      expect(periodo?.estado).toBe('ABIERTO');
    });

    it('rechaza reutilizar el mismo operationId con distinto payload (OPERACION_REUTILIZADA)', async () => {
      const opId = randomUUID();
      await preparar.execute(DOCENTE, {
        operationId: opId,
        nombre: 'Laboratorio 1',
        fecha: '2026-04-10',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      await expect(
        preparar.execute(DOCENTE, {
          operationId: opId,
          nombre: 'Laboratorio Alterado',
          fecha: '2026-04-10',
          cursoId: 'CURSO-1A',
          materiaId: 'MAT-101',
          gestion: 2026,
          trimestre: 1,
        }),
      ).rejects.toMatchObject({
        code: 'OPERACION_REUTILIZADA',
        status: 409,
      });
    });

    it('edita evaluación incrementando versión y bloquea edición con versión obsoleta (CONFLICTO_EDICION)', async () => {
      const creada = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Práctica Inicial',
        fecha: '2026-04-12',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      const editada = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: creada.id,
        versionEsperada: 1,
        nombre: 'Práctica Inicial Corregida',
        fecha: '2026-04-15',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      expect(editada.version).toBe(2);
      expect(editada.nombre).toBe('Práctica Inicial Corregida');

      await expect(
        preparar.execute(DOCENTE, {
          operationId: randomUUID(),
          evaluacionId: creada.id,
          versionEsperada: 1, // obsoleta, ya está en 2
          nombre: 'Intento obsoleto',
          fecha: '2026-04-16',
          cursoId: 'CURSO-1A',
          materiaId: 'MAT-101',
          gestion: 2026,
          trimestre: 1,
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICTO_EDICION',
        status: 409,
      });
    });
  });

  describe('2. RegistrarCalificaciones y Atomicidad Transaccional', () => {
    it('guarda lote completo de calificaciones y hace rollback total si un estudiante es inválido', async () => {
      const ev = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Examen Final',
        fecha: '2026-05-01',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      // Intento con un estudiante ajeno en la posición 2: debe revertir EST-001 también
      await expect(
        registrar.execute(DOCENTE, {
          operationId: randomUUID(),
          evaluacionId: ev.id,
          versionEsperada: 1,
          notas: [
            { estudianteId: 'EST-001', nota: 95 },
            { estudianteId: 'EST-INTRUSO', nota: 80 },
          ],
        }),
      ).rejects.toMatchObject({ code: 'ESTUDIANTE_INVALIDO' });

      const guardadasTrasFallo = await store.list('calificaciones', {
        evaluacionId: ev.id,
      });
      expect(guardadasTrasFallo).toHaveLength(0);

      // Registro válido de los 3 estudiantes del curso
      const lote = await registrar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 1,
        notas: [
          { estudianteId: 'EST-001', nota: 88.5 },
          { estudianteId: 'EST-002', nota: 74.25 },
          { estudianteId: 'EST-003', nota: 91 },
        ],
      });

      expect(lote.guardadas).toBe(3);
      expect(lote.version).toBe(2);
    });
  });

  describe('3. Orquestador SAGA Transversal y Rollback Compensatorio (Req 1.7)', () => {
    it('ejecuta SAGA completa (Calificaciones -> Asistencia -> Riesgo) y cierra trimestre exitosamente', async () => {
      const ev = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Evaluación Integral Trimestre 1',
        fecha: '2026-05-20',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      await registrar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 1,
        notas: [
          { estudianteId: 'EST-001', nota: 90 },
          { estudianteId: 'EST-002', nota: 80 },
          { estudianteId: 'EST-003', nota: 70 },
        ],
      });

      const saga = await publicar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 2,
        cerrarTrimestre: true,
      });

      expect(saga.estado).toBe('COMPLETADA');
      expect(saga.asistencia.estado).toBe('HECHO');
      expect(saga.analisis).toHaveLength(3);
      expect(saga.analisis.every((a) => a.estado === 'HECHO')).toBe(true);

      const evFinal = await store.get('evaluaciones', ev.id);
      expect(evFinal?.estado).toBe('PUBLICADA');

      const periodoFinal = await store.get(
        'periodos',
        '2026:CURSO-1A:MAT-101:1',
      );
      expect(periodoFinal?.estado).toBe('CERRADO');

      // Ahora el PADRE ya puede consultar el resultado publicado
      const resultadoPadre = await consultar.execute(PADRE, {
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
        estudianteId: 'EST-001',
      });
      expect(resultadoPadre.estado).toBe('PUBLICADO');
      expect(resultadoPadre.promedio).toBe(90);
      expect('actividades' in resultadoPadre).toBe(false); // Padre solo ve consolidado trimestral
    });

    it('ejecuta Rollback SAGA en orden inverso cuando falla ms-riesgo en el 2do estudiante, restaurando evaluación a BORRADOR', async () => {
      const ev = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Evaluación con Fallo en Paso 3',
        fecha: '2026-05-22',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      await registrar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 1,
        notas: [
          { estudianteId: 'EST-001', nota: 85 },
          { estudianteId: 'EST-002', nota: 60 },
          { estudianteId: 'EST-003', nota: 95 },
        ],
      });

      // Simulamos que EST-001 pasa en ms-riesgo, pero EST-002 (índice 1) falla determinísticamente
      services.failAtAnalysisIndex = 1;

      const saga = await publicar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 2,
        cerrarTrimestre: true,
      });

      expect(saga.estado).toBe('COMPENSADA');
      expect(saga.asistencia.estado).toBe('COMPENSADO');
      expect(saga.analisis[0].estado).toBe('COMPENSADO');
      expect(saga.analisis[1].estado).toBe('PENDIENTE');
      expect(saga.analisis[2].estado).toBe('PENDIENTE');

      // Verificar que los servicios remotos recibieron la compensación real
      expect(services.marcasCreadas[0].compensada).toBe(true);
      expect(services.analisisCreados[0].compensado).toBe(true);

      // Verificar que la evaluación regresó a BORRADOR y el trimestre sigue ABIERTO
      const evRestaurada = await store.get('evaluaciones', ev.id);
      expect(evRestaurada?.estado).toBe('BORRADOR');

      const periodoRestaurado = await store.get(
        'periodos',
        '2026:CURSO-1A:MAT-101:1',
      );
      expect(periodoRestaurado?.estado).toBe('ABIERTO');
    });

    it('conserva bloqueo RECUPERACION_PENDIENTE ante timeout incierto y completa la SAGA al reanudar (resume) conciliando estado remoto', async () => {
      const ev = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Evaluación con Timeout de Red',
        fecha: '2026-05-25',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      await registrar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 1,
        notas: [
          { estudianteId: 'EST-001', nota: 78 },
          { estudianteId: 'EST-002', nota: 82 },
          { estudianteId: 'EST-003', nota: 91 },
        ],
      });

      // El 2do análisis sufre timeout incierto (pero sí se guardó en el servidor remoto)
      services.uncertainFailureAtAnalysisIndex = 1;

      const sagaPausada = await publicar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 2,
        cerrarTrimestre: false,
      });

      expect(sagaPausada.estado).toBe('RECUPERACION_PENDIENTE');
      expect(sagaPausada.analisis[1].estado).toBe('INTENTADO');

      const evEnPublicacion = await store.get('evaluaciones', ev.id);
      expect(evEnPublicacion?.estado).toBe('PUBLICANDO');

      // Se restablece la red y el docente o job invoca resume()
      services.uncertainFailureAtAnalysisIndex = null;
      const sagaRecuperada = await publicar.resume(DOCENTE, sagaPausada.id);

      expect(sagaRecuperada.estado).toBe('COMPLETADA');
      expect(sagaRecuperada.analisis.every((a) => a.estado === 'HECHO')).toBe(
        true,
      );

      const evPublicada = await store.get('evaluaciones', ev.id);
      expect(evPublicada?.estado).toBe('PUBLICADA');
    });
  });

  describe('4. ConsultarResultados, Ficha Integral y Segregación RBAC', () => {
    it('entrega ficha integral combinando calificaciones locales con asistencia y alertas remotas', async () => {
      const ev = await preparar.execute(DOCENTE, {
        operationId: randomUUID(),
        nombre: 'Proyecto Práctico',
        fecha: '2026-06-01',
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
      });

      await registrar.execute(DOCENTE, {
        operationId: randomUUID(),
        evaluacionId: ev.id,
        versionEsperada: 1,
        notas: [
          { estudianteId: 'EST-001', nota: 96 },
          { estudianteId: 'EST-002', nota: 84 },
          { estudianteId: 'EST-003', nota: 79 },
        ],
      });

      const ficha = await consultar.ficha(DIRECTOR, {
        cursoId: 'CURSO-1A',
        materiaId: 'MAT-101',
        gestion: 2026,
        trimestre: 1,
        estudianteId: 'EST-001',
      });

      expect(ficha.calificaciones.promedio).toBe(96);
      expect(ficha.asistencia.disponible).toBe(true);
      expect(ficha.alertas.disponible).toBe(true);
    });

    it('bloquea acceso a otro docente sin asignación en el curso', async () => {
      await expect(
        consultar.evaluations(OTRO_DOCENTE, {
          cursoId: 'CURSO-1A',
          materiaId: 'MAT-101',
          gestion: 2026,
          trimestre: 1,
        }),
      ).rejects.toBeInstanceOf(DomainError);
    });
  });
});
