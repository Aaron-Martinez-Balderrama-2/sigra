import { Injectable } from '@nestjs/common';
import { DataStore, Store } from '../../../core/ports/store';
import { Table, Tables } from '../../../core/entities/models';
import { DomainError } from '../../../core/errors/domain-error';

const ALL_TABLES: Table[] = [
  'evaluaciones',
  'calificaciones',
  'periodos',
  'sagas_publicacion',
  'operaciones_procesadas',
  'accesos',
  'cursos',
  'auditoria',
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function matchesFilter<T extends Record<string, any>>(
  item: T,
  filter: Partial<T>,
): boolean {
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && item[k] !== v) {
      return false;
    }
  }
  return true;
}

class MemoryData implements DataStore {
  constructor(protected readonly data: Record<Table, Map<string, any>>) {}

  async get<K extends Table>(table: K, id: string): Promise<Tables[K] | null> {
    const item = this.data[table].get(id);
    return item ? clone(item) : null;
  }

  async list<K extends Table>(
    table: K,
    filter: Partial<Tables[K]>,
  ): Promise<Tables[K][]> {
    const items = Array.from(this.data[table].values())
      .filter((item) => matchesFilter(item, filter as Record<string, any>))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    if (items.length > 1000) {
      throw new DomainError(
        'LIMITE_CONSULTA',
        'La consulta supera 1000 registros; acote curso, materia o trimestre.',
        400,
      );
    }

    return clone(items);
  }

  private checkUniqueConstraints<K extends Table>(
    table: K,
    doc: Tables[K],
    isInsert: boolean,
  ): void {
    const map = this.data[table];
    if (isInsert && map.has(doc.id)) {
      const err: any = new Error(`E11000 duplicate key error on ${table}.id`);
      err.code = 11000;
      throw err;
    }

    if (table === 'calificaciones') {
      const g = doc as unknown as Tables['calificaciones'];
      for (const existing of map.values()) {
        if (
          existing.id !== g.id &&
          existing.evaluacionId === g.evaluacionId &&
          existing.estudianteId === g.estudianteId
        ) {
          const err: any = new Error(
            'E11000 duplicate key error on calificaciones (evaluacionId, estudianteId)',
          );
          err.code = 11000;
          throw err;
        }
      }
    }

    if (table === 'sagas_publicacion') {
      const s = doc as unknown as Tables['sagas_publicacion'];
      for (const existing of map.values()) {
        if (existing.id !== s.id && existing.sagaId === s.sagaId) {
          const err: any = new Error(
            'E11000 duplicate key error on sagas_publicacion.sagaId',
          );
          err.code = 11000;
          throw err;
        }
      }
    }

    if (table === 'periodos') {
      const p = doc as unknown as Tables['periodos'];
      for (const existing of map.values()) {
        if (
          existing.id !== p.id &&
          existing.cursoId === p.cursoId &&
          existing.materiaId === p.materiaId &&
          existing.gestion === p.gestion &&
          existing.trimestre === p.trimestre
        ) {
          const err: any = new Error(
            'E11000 duplicate key error on periodos context',
          );
          err.code = 11000;
          throw err;
        }
      }
    }
  }

  async insert<K extends Table>(table: K, doc: Tables[K]): Promise<void> {
    this.checkUniqueConstraints(table, doc, true);
    this.data[table].set(doc.id, clone(doc));
  }

  async put<K extends Table>(table: K, doc: Tables[K]): Promise<void> {
    this.checkUniqueConstraints(table, doc, false);
    this.data[table].set(doc.id, clone(doc));
  }
}

@Injectable()
export class InMemoryStore extends MemoryData implements Store {
  private lock: Promise<void> = Promise.resolve();

  constructor() {
    const initial = {} as Record<Table, Map<string, any>>;
    for (const t of ALL_TABLES) {
      initial[t] = new Map<string, any>();
    }

    // Seed de cursos escolares oficiales
    initial.cursos.set('sec-3b', {
      id: 'sec-3b',
      nivel: 'SECUNDARIA',
      grado: 3,
      paralelo: 'B',
      gestion: 2026,
      estudiantes: ['est-001', 'est-002', 'est-003'],
    });
    initial.cursos.set('pri-2a', {
      id: 'pri-2a',
      nivel: 'PRIMARIA',
      grado: 2,
      paralelo: 'A',
      gestion: 2026,
      estudiantes: ['est-004'],
    });

    // Seed de periodos escolares
    const materias = ['matematicas', 'mat-mat'];
    for (const m of materias) {
      for (let trim = 1; trim <= 3; trim++) {
        const idPeriodo = `2026:sec-3b:${m}:${trim}`;
        initial.periodos.set(idPeriodo, {
          id: idPeriodo,
          cursoId: 'sec-3b',
          materiaId: m,
          gestion: 2026,
          trimestre: trim,
          estado: trim === 1 ? 'CERRADO' : 'ABIERTO',
        });
      }
    }

    // Seed de evaluaciones oficiales del 1.er Trimestre
    const listaEvaluaciones = [
      {
        id: 'eval-01',
        nombre: 'Diagnóstico Inicial de Álgebra y Aritmética',
        descripcion: 'Operaciones combinadas, potenciación y radicación',
        fecha: '2026-02-20',
      },
      {
        id: 'eval-02',
        nombre: 'Primer Examen Parcial de Álgebra',
        descripcion: 'Ecuaciones de primer grado y sistemas lineales 2x2',
        fecha: '2026-03-18',
      },
      {
        id: 'eval-03',
        nombre: 'Trabajo Práctico y Resolución de Problemas',
        descripcion: 'Cuaderno pedagógico y guía metodológica resuelta',
        fecha: '2026-04-10',
      },
      {
        id: 'eval-04',
        nombre: 'Evaluación Trimestral Centralizadora',
        descripcion: 'Prueba sumativa estandarizada de fin de trimestre',
        fecha: '2026-04-28',
      },
    ];

    const notasEstudiantes: Record<string, number[]> = {
      // Valentina Suárez (estudiante destacada, promedio sobresaliente 97.5)
      'est-002': [98, 95, 100, 97],
      // Mateo Rojas (estudiante en riesgo potencial de rezago, promedio 51.25)
      'est-001': [45, 50, 58, 52],
      // Santiago Flores (estudiante regular con justificativos y atrasos, promedio 64.5)
      'est-003': [65, 60, 70, 63],
    };

    for (const m of materias) {
      for (let i = 0; i < listaEvaluaciones.length; i++) {
        const baseEval = listaEvaluaciones[i];
        const evalId = m === 'mat-mat' ? baseEval.id : `${baseEval.id}-alt`;
        const evalDoc = {
          id: evalId,
          cursoId: 'sec-3b',
          materiaId: m,
          gestion: 2026,
          trimestre: 1,
          nombre: baseEval.nombre,
          descripcion: baseEval.descripcion,
          fecha: baseEval.fecha,
          docenteId: '11111111-1111-4111-8111-111111111111',
          estado: 'PUBLICADA',
          version: 1,
          creadoEn: `${baseEval.fecha}T08:00:00Z`,
          actualizadoEn: `${baseEval.fecha}T12:00:00Z`,
        };
        initial.evaluaciones.set(evalId, evalDoc);

        for (const [estId, notas] of Object.entries(notasEstudiantes)) {
          const gradeId = `${evalId}:${estId}`;
          initial.calificaciones.set(gradeId, {
            id: gradeId,
            evaluacionId: evalId,
            estudianteId: estId,
            nota: notas[i],
            version: 1,
            actualizadoEn: `${baseEval.fecha}T12:30:00Z`,
          });
        }
      }
    }

    // Seed de asignaciones de acceso
    const asignacionesCompletas = [
      { cursoId: 'sec-3b', materiaId: 'matematicas', gestion: 2026 },
      { cursoId: 'sec-3b', materiaId: 'mat-mat', gestion: 2026 },
      { cursoId: 'pri-2a', materiaId: 'matematicas', gestion: 2026 },
      { cursoId: 'pri-2a', materiaId: 'mat-mat', gestion: 2026 },
    ];

    // Docente Carlos Méndez
    initial.accesos.set('11111111-1111-4111-8111-111111111111', {
      id: '11111111-1111-4111-8111-111111111111',
      asignaciones: asignacionesCompletas,
      estudiantes: [],
    });

    // Directora Sofia Morales
    initial.accesos.set('33333333-3333-4333-8333-333333333333', {
      id: '33333333-3333-4333-8333-333333333333',
      asignaciones: asignacionesCompletas,
      estudiantes: ['est-001', 'est-002', 'est-003'],
    });

    // Padre Roberto Flores
    initial.accesos.set('22222222-2222-4222-8222-222222222222', {
      id: '22222222-2222-4222-8222-222222222222',
      asignaciones: [],
      estudiantes: ['est-001', 'est-002', 'est-003'],
    });

    super(initial);
  }

  async transaction<T>(work: (tx: DataStore) => Promise<T>): Promise<T> {
    const prevLock = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((r) => {
      release = r;
    });

    await prevLock;
    try {
      // Snapshot completo para garantizar atomicidad y rollback real ante cualquier fallo
      const snapshot = {} as Record<Table, Map<string, any>>;
      for (const t of ALL_TABLES) {
        snapshot[t] = new Map<string, any>();
        for (const [k, v] of this.data[t].entries()) {
          snapshot[t].set(k, clone(v));
        }
      }

      const txStore = new MemoryData(snapshot);
      const result = await work(txStore);

      // Commit atómico del snapshot modificado
      for (const t of ALL_TABLES) {
        this.data[t] = snapshot[t];
      }

      return result;
    } finally {
      release();
    }
  }

  async ping(): Promise<void> {
    return;
  }

  /**
   * Helpers de inspección y carga directa para pruebas de integración / E2E
   */
  collection(name: Table) {
    const map = this.data[name];
    return {
      insertMany: async (docs: any[]) => {
        for (const d of docs) {
          map.set(d.id, clone(d));
        }
      },
      insertOne: async (doc: any) => {
        map.set(doc.id, clone(doc));
      },
      countDocuments: async (filter: Record<string, any> = {}) => {
        return Array.from(map.values()).filter((item) =>
          matchesFilter(item, filter),
        ).length;
      },
      findOne: async (filter: Record<string, any>) => {
        const found = Array.from(map.values()).find((item) =>
          matchesFilter(item, filter),
        );
        return found ? clone(found) : null;
      },
    };
  }

  async dropDatabase(): Promise<void> {
    for (const t of ALL_TABLES) {
      this.data[t].clear();
    }
  }
}
