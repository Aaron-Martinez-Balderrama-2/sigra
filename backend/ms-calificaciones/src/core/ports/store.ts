import { Table, Tables } from '../entities/models';
export interface DataStore {
  get<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
  list<K extends Table>(
    table: K,
    filter: Partial<Tables[K]>,
  ): Promise<Tables[K][]>;
  insert<K extends Table>(table: K, data: Tables[K]): Promise<void>;
  put<K extends Table>(table: K, data: Tables[K]): Promise<void>;
}
export interface Store extends DataStore {
  transaction<T>(work: (tx: DataStore) => Promise<T>): Promise<T>;
}
export const STORE = Symbol('STORE');
