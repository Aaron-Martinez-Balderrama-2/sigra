import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientSession, Db, MongoClient, MongoServerError } from 'mongodb';
import { DataStore, Store } from '../../../core/ports/store';
import { Table, Tables } from '../../../core/entities/models';
import { DomainError } from '../../../core/errors/domain-error';
class MongoData implements DataStore {
  constructor(
    protected readonly db: Db,
    protected readonly session?: ClientSession,
  ) {}
  async get<K extends Table>(table: K, id: string): Promise<Tables[K] | null> {
    const result = await this.db
      .collection(table)
      .findOne({ id }, { session: this.session, projection: { _id: 0 } });
    return result as unknown as Tables[K] | null;
  }
  async list<K extends Table>(
    table: K,
    filter: Partial<Tables[K]>,
  ): Promise<Tables[K][]> {
    const result = await this.db
      .collection(table)
      .find(filter, { session: this.session, projection: { _id: 0 } })
      .sort({ id: 1 })
      .limit(1001)
      .toArray();
    if (result.length > 1000)
      throw new DomainError(
        'LIMITE_CONSULTA',
        'La consulta supera 1000 registros; acote curso, materia o trimestre.',
        400,
      );
    return result as unknown as Tables[K][];
  }
  async insert<K extends Table>(table: K, data: Tables[K]): Promise<void> {
    await this.db
      .collection(table)
      .insertOne({ ...data }, { session: this.session });
  }
  async put<K extends Table>(table: K, data: Tables[K]): Promise<void> {
    await this.db
      .collection(table)
      .replaceOne(
        { id: data.id },
        { ...data },
        { session: this.session, upsert: true },
      );
  }
}
@Injectable()
export class MongoStore
  extends MongoData
  implements Store, OnModuleInit, OnModuleDestroy
{
  private readonly client: MongoClient;
  constructor() {
    const uri = process.env.MONGO_URI;
    if (!uri)
      throw new Error('Configure MONGO_URI en el entorno del servicio.');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    super(client.db(process.env.MONGO_DB ?? 'sigra_calificaciones'));
    this.client = client;
  }
  async onModuleInit() {
    await this.client.connect();
    const hello = await this.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      await this.client.close();
      throw new Error(
        'MongoDB requiere replica set para guardar notas y publicaciones atómicamente. Use compose.dev.yml del servicio; no se modifica el MongoDB compartido.',
      );
    }
    const tables: Table[] = [
      'evaluaciones',
      'calificaciones',
      'periodos',
      'sagas_publicacion',
      'operaciones_procesadas',
      'accesos',
      'cursos',
      'auditoria',
    ];
    for (const table of tables)
      await this.db.collection(table).createIndex({ id: 1 }, { unique: true });
    await this.db
      .collection('calificaciones')
      .createIndex({ evaluacionId: 1, estudianteId: 1 }, { unique: true });
    await this.db
      .collection('sagas_publicacion')
      .createIndex({ sagaId: 1 }, { unique: true });
    // Compatible con el índice sagaId del script compartido: cada Saga también guarda sagaId.
    await this.db
      .collection('evaluaciones')
      .createIndex({ cursoId: 1, materiaId: 1, gestion: 1, trimestre: 1 });
    await this.db
      .collection('periodos')
      .createIndex(
        { cursoId: 1, materiaId: 1, gestion: 1, trimestre: 1 },
        { unique: true },
      );
  }
  async transaction<T>(work: (tx: DataStore) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = this.client.startSession();
      try {
        return (await session.withTransaction(
          () => work(new MongoData(this.db, session)),
          {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            maxCommitTimeMS: 10000,
          },
        )) as T;
      } catch (error) {
        // Dos clientes pueden intentar insertar el mismo operationId simultáneamente.
        // Reejecutar la transacción permite recuperar el resultado ya confirmado.
        if (
          error instanceof MongoServerError &&
          error.code === 11000 &&
          attempt < 2
        )
          continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new DomainError(
      'CONFLICTO',
      'Operación concurrente; reintente con el mismo operationId.',
      409,
    );
  }
  async onModuleDestroy() {
    await this.client.close();
  }
  async ping() {
    await this.db.command({ ping: 1 });
  }
}
