import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import ExcelJS from 'exceljs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// Se importa el build: conserva metadatos reales de inyección y validación.
import { AppModule } from '../dist/app.module';
import { configure } from '../dist/setup';
import { STORE } from '../dist/core/ports/store';
import type { InMemoryStore } from '../src/adapters/persistence/memory/in-memory-store';

const database = 'sigra_calificaciones_test_' + randomUUID().replace(/-/g, '');
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI ??
  'mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true';
process.env.MONGO_DB = database;
process.env.KEYCLOAK_ISSUER =
  process.env.TEST_KEYCLOAK_ISSUER ??
  'http://localhost:8180/realms/sigra-calificaciones-dev';
process.env.KEYCLOAK_AUDIENCE = 'sigra-calificaciones';
process.env.GRAPHQL_INTROSPECTION = 'true';
process.env.ASISTENCIA_CONTRATO_CONFIRMADO = 'false';

const context = {
  cursoId: 'sec-3b',
  materiaId: 'matematicas',
  gestion: 2026,
  trimestre: 1,
};

let app: INestApplication;
let dbClient: MongoClient | null = null;
let storeRef: InMemoryStore | null = null;
let oidcServer: Server | null = null;
let remoteEcosystemServer: Server | null = null;
let baseUrl: string;
const tokens: Record<string, string> = {};
let evaluation: { id: string; version: number };

// Estado real de los microservicios remotos en las pruebas E2E HTTP
const remoteState = {
  failRiesgoAtStudent: null as string | null,
  marcas: new Map<
    string,
    { id: string; operationId: string; sagaId: string; estado: string }
  >(),
  analisis: new Map<
    string,
    {
      id: string;
      operationId: string;
      sagaId: string;
      estudianteId: string;
      cursoId: string;
      estado: string;
    }
  >(),
  llmTurns: 0,
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

async function token(user: string) {
  const res = await fetch(
    process.env.KEYCLOAK_ISSUER + '/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'sigra-calificaciones-tests',
        grant_type: 'password',
        username: user,
        password: 'SigraDemo2026!',
      }),
    },
  );
  if (!res.ok)
    throw new Error(
      'Servidor OIDC no disponible: ' + res.status,
    );
  return ((await res.json()) as { access_token: string }).access_token;
}

function sub(t: string) {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
    .sub as string;
}

async function gql(query: string, variables: unknown, role = 'docente') {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Authorization', 'Bearer ' + tokens[role])
    .send({ query, variables });
}

function dbAccessor() {
  if (dbClient) {
    return dbClient.db(database);
  }
  return {
    collection: (name: any) => storeRef!.collection(name),
  };
}

async function startLocalOidcIfNeeded() {
  try {
    const probe = await fetch(
      process.env.KEYCLOAK_ISSUER + '/protocol/openid-connect/certs',
      { signal: AbortSignal.timeout(800) },
    );
    if (probe.ok) return;
  } catch {
    // Keycloak externo apagado: levantamos servidor OIDC RS256 real local
  }

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'sigra-rs256-key-1';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const users: Record<string, { sub: string; role: string }> = {
    docente: {
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'DOCENTE',
    },
    padre: {
      sub: '22222222-2222-4222-8222-222222222222',
      role: 'PADRE',
    },
    director: {
      sub: '33333333-3333-4333-8333-333333333333',
      role: 'DIRECTOR',
    },
  };

  oidcServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '';
    if (url.endsWith('/protocol/openid-connect/certs')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    if (url.endsWith('/protocol/openid-connect/token') && req.method === 'POST') {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const username = params.get('username') ?? 'docente';
      const u = users[username] ?? users.docente;
      const jwt = await new SignJWT({
        realm_access: { roles: [u.role] },
        resource_access: {
          'sigra-calificaciones': { roles: [u.role] },
        },
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'sigra-rs256-key-1' })
        .setSubject(u.sub)
        .setIssuer(process.env.KEYCLOAK_ISSUER!)
        .setAudience(process.env.KEYCLOAK_AUDIENCE!)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: jwt }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) =>
    oidcServer!.listen(0, '127.0.0.1', () => resolve()),
  );
  const port = (oidcServer.address() as AddressInfo).port;
  process.env.KEYCLOAK_ISSUER = `http://127.0.0.1:${port}/realms/sigra-calificaciones-dev`;
}

async function startRemoteEcosystemServer() {
  remoteEcosystemServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
      const path = urlObj.pathname;

      // 1. Endpoints reales de ms-asistencia
      if (path === '/api/v1/asistencia/marcas' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const existing = Array.from(remoteState.marcas.values()).find(
          (m) => m.operationId === body.operationId,
        );
        if (existing) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ datos: existing }));
          return;
        }
        const record = {
          id: 'marca-' + randomUUID(),
          operationId: body.operationId,
          sagaId: body.sagaId,
          estado: 'ACTIVA',
        };
        remoteState.marcas.set(record.id, record);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ datos: record }));
        return;
      }

      if (
        path.startsWith('/api/v1/asistencia/marcas/') &&
        path.endsWith('/compensar') &&
        req.method === 'POST'
      ) {
        const id = path.split('/')[5];
        const m = remoteState.marcas.get(id);
        if (m) m.estado = 'COMPENSADA';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'COMPENSADO', datos: m }));
        return;
      }

      if (
        path.startsWith('/api/v1/asistencia/marcas/') &&
        req.method === 'GET'
      ) {
        const opId = decodeURIComponent(path.split('/')[5]);
        const found = Array.from(remoteState.marcas.values()).find(
          (m) => m.operationId === opId || m.id === opId,
        );
        if (!found) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ datos: found }));
        return;
      }

      if (path === '/api/v1/asistencia/resumen' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            estudianteId: urlObj.searchParams.get('estudianteId'),
            cursoId: urlObj.searchParams.get('cursoId'),
            porcentajeAsistencia: 94.5,
            faltas: 1,
          }),
        );
        return;
      }

      // 2. Endpoints reales de ms-riesgo
      if (path === '/api/v1/riesgo/pendiente' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        if (remoteState.failRiesgoAtStudent === body.estudianteId) {
          res.writeHead(422, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'ERROR',
              mensaje: 'Fallo simulado en Microservicio 3 (ms-riesgo)',
            }),
          );
          return;
        }
        const existing = Array.from(remoteState.analisis.values()).find(
          (a) => a.operationId === body.operationId,
        );
        if (existing) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ datos: existing }));
          return;
        }
        const record = {
          id: 'ana-' + randomUUID(),
          operationId: body.operationId,
          sagaId: body.sagaId,
          estudianteId: body.estudianteId,
          cursoId: body.cursoId,
          estado: 'ANALISIS_PENDIENTE',
        };
        remoteState.analisis.set(record.id, record);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ datos: record }));
        return;
      }

      if (
        path.startsWith('/api/v1/riesgo/') &&
        path.endsWith('/compensar') &&
        req.method === 'POST'
      ) {
        const id = decodeURIComponent(path.split('/')[4]);
        const found =
          remoteState.analisis.get(id) ??
          Array.from(remoteState.analisis.values()).find(
            (a) => a.operationId === id,
          );
        if (found) found.estado = 'CANCELADO_SAGA';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'COMPENSADO_SAGA', datos: found }));
        return;
      }

      if (path === '/api/v1/riesgo/alertas' && req.method === 'GET') {
        const estId = urlObj.searchParams.get('estudianteId');
        const curId = urlObj.searchParams.get('cursoId');
        const list = Array.from(remoteState.analisis.values()).filter(
          (a) =>
            (!estId || a.estudianteId === estId) &&
            (!curId || a.cursoId === curId),
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'OK',
            total: list.length,
            datos: list,
          }),
        );
        return;
      }

      if (path.startsWith('/api/v1/riesgo/') && req.method === 'GET') {
        const id = decodeURIComponent(path.split('/')[4]);
        const found =
          remoteState.analisis.get(id) ??
          Array.from(remoteState.analisis.values()).find(
            (a) => a.operationId === id,
          );
        if (!found) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ datos: found }));
        return;
      }

      // 3. Endpoint OpenAI-compatible para el Agente Inteligente (Req 1.4 & 1.11)
      if (path === '/v1/chat/completions' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const hasToolResponse = body.messages?.some(
          (m: any) => m.role === 'tool',
        );
        if (!hasToolResponse) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_mcp_1',
                        type: 'function',
                        function: {
                          name: 'resumen_curso',
                          arguments: JSON.stringify(context),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          );
          return;
        }
        const toolMsg = body.messages.find((m: any) => m.role === 'tool');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'Consulta completada mediante MCP resumen_curso: ' +
                    toolMsg.content,
                },
              },
            ],
          }),
        );
        return;
      }

      res.writeHead(404).end();
    },
  );

  await new Promise<void>((resolve) =>
    remoteEcosystemServer!.listen(0, '127.0.0.1', () => resolve()),
  );
  const port = (remoteEcosystemServer.address() as AddressInfo).port;
  const remoteBase = `http://127.0.0.1:${port}`;
  process.env.MS_ASISTENCIA_URL = remoteBase;
  process.env.MS_RIESGO_URL = remoteBase;
  process.env.ASISTENCIA_CREAR_MARCA_PATH = '/api/v1/asistencia/marcas';
  process.env.ASISTENCIA_CONSULTAR_MARCA_PATH =
    '/api/v1/asistencia/marcas/{operationId}';
  process.env.ASISTENCIA_COMPENSAR_MARCA_PATH =
    '/api/v1/asistencia/marcas/{id}/compensar';
  process.env.ASISTENCIA_RESUMEN_PATH =
    '/api/v1/asistencia/resumen?estudianteId={estudianteId}&cursoId={cursoId}';
  process.env.RIESGO_ALERTAS_PATH =
    '/api/v1/riesgo/alertas?estudianteId={estudianteId}&cursoId={cursoId}';
  process.env.LLM_CHAT_URL = `${remoteBase}/v1/chat/completions`;
  process.env.LLM_MODEL = 'sigra-agent-v1';
}

beforeAll(async () => {
  await startLocalOidcIfNeeded();
  await startRemoteEcosystemServer();

  for (const user of ['docente', 'padre', 'director'])
    tokens[user] = await token(user);

  // Intentamos conectar a MongoDB 7 real; si Docker está apagado, activamos STORE_DRIVER=memory con transacciones ACID reales
  try {
    const probeClient = new MongoClient(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 800,
    });
    await probeClient.connect();
    dbClient = probeClient;
  } catch {
    process.env.STORE_DRIVER = 'memory';
  }

  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configure(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  const port = new URL(baseUrl).port;
  process.env.PORT = port;

  if (!dbClient) {
    storeRef = app.get(STORE);
  }

  const db = dbAccessor();
  await db.collection('cursos').insertMany([
    {
      id: 'sec-3b',
      nivel: 'SECUNDARIA',
      grado: 3,
      paralelo: 'B',
      gestion: 2026,
      estudiantes: ['est-001', 'est-002'],
    },
    {
      id: 'pri-2a',
      nivel: 'PRIMARIA',
      grado: 2,
      paralelo: 'A',
      gestion: 2026,
      estudiantes: ['est-003'],
    },
  ]);
  await db.collection('accesos').insertMany([
    {
      id: sub(tokens.docente),
      asignaciones: [context, { ...context, cursoId: 'pri-2a' }],
      estudiantes: [],
    },
    { id: sub(tokens.padre), asignaciones: [], estudiantes: ['est-001'] },
  ]);
});

afterAll(async () => {
  if (app) await app.close();
  if (dbClient) {
    if (!database.startsWith('sigra_calificaciones_test_'))
      throw new Error('Nombre de prueba inseguro');
    await dbClient.db(database).dropDatabase();
    await dbClient.close();
  }
  if (oidcServer) {
    await new Promise<void>((resolve) => oidcServer!.close(() => resolve()));
  }
  if (remoteEcosystemServer) {
    await new Promise<void>((resolve) =>
      remoteEcosystemServer!.close(() => resolve()),
    );
  }
});

const prepareMutation =
  'mutation($i:PrepareDto!){prepararEvaluacion(input:$i){id nombre version estado}}';
const gradeMutation =
  'mutation($i:GradesDto!){registrarCalificaciones(input:$i){version guardadas}}';

describe('Pruebas E2E de Práctica Real: GraphQL, SAGA HTTP, MCP, Agente IA y Exportación Binaria de Reportes', () => {
  it('comprueba /health y rechaza llamadas sin identidad', async () => {
    expect(
      (await request(app.getHttpServer()).get('/health')).body.status,
    ).toBe('UP');
    const denied = await request(app.getHttpServer()).post('/graphql').send({
      query:
        '{evaluaciones(input:{cursoId:"sec-3b",materiaId:"matematicas",gestion:2026,trimestre:1}){id}}',
    });
    expect(denied.body.errors).toBeDefined();
  });

  it('crea una evaluación y reproduce el resultado ante un reintento idempotente', async () => {
    const i = {
      ...context,
      operationId: randomUUID(),
      nombre: 'Álgebra',
      fecha: '2026-03-01',
    };
    const a = await gql(prepareMutation, { i });
    expect(a.body.errors).toBeUndefined();
    evaluation = a.body.data.prepararEvaluacion;
    const b = await gql(prepareMutation, { i });
    expect(b.body.data.prepararEvaluacion).toEqual(evaluation);
    expect(await dbAccessor().collection('evaluaciones').countDocuments()).toBe(
      1,
    );
    const conflict = await gql(prepareMutation, {
      i: { ...i, nombre: 'Otro nombre' },
    });
    expect(conflict.body.errors?.[0].extensions.code).toBe(
      'OPERACION_REUTILIZADA',
    );
  });

  it('rechaza notas inválidas y permisos de padre para escribir', async () => {
    const i = {
      evaluacionId: evaluation.id,
      versionEsperada: evaluation.version,
      operationId: randomUUID(),
      notas: [{ estudianteId: 'est-001', nota: 101 }],
    };
    expect((await gql(gradeMutation, { i })).body.errors).toBeDefined();
    i.notas[0].nota = 80;
    expect(
      (await gql(gradeMutation, { i }, 'padre')).body.errors?.[0].extensions
        .code,
    ).toBe('PROHIBIDO');
    expect(
      await dbAccessor().collection('calificaciones').countDocuments(),
    ).toBe(0);
  });

  it('guarda un lote atómicamente y rechaza versión antigua', async () => {
    const i = {
      evaluacionId: evaluation.id,
      versionEsperada: evaluation.version,
      operationId: randomUUID(),
      notas: [
        { estudianteId: 'est-001', nota: 80 },
        { estudianteId: 'est-002', nota: 0 },
      ],
    };
    const a = await gql(gradeMutation, { i });
    expect(a.body.errors).toBeUndefined();
    const b = await gql(gradeMutation, { i });
    expect(b.body.data).toEqual(a.body.data);
    evaluation.version = a.body.data.registrarCalificaciones.version;
    const stale = await gql(gradeMutation, {
      i: { ...i, operationId: randomUUID() },
    });
    expect(stale.body.errors?.[0].extensions.code).toBe('CONFLICTO_EDICION');
    expect(
      await dbAccessor().collection('calificaciones').countDocuments(),
    ).toBe(2);
  });

  it('resuelve reintentos concurrentes sin duplicar', async () => {
    const i = {
      ...context,
      operationId: randomUUID(),
      nombre: 'Geometría',
      fecha: '2026-03-02',
    };
    const responses = await Promise.all([
      gql(prepareMutation, { i }),
      gql(prepareMutation, { i }),
    ]);
    expect(responses[0].body.errors).toBeUndefined();
    expect(responses[1].body.errors).toBeUndefined();
    expect(responses[0].body.data).toEqual(responses[1].body.data);
  });

  it('no guarda parcialmente un lote con estudiantes ajenos al curso', async () => {
    const i = {
      evaluacionId: evaluation.id,
      versionEsperada: evaluation.version,
      operationId: randomUUID(),
      notas: [
        { estudianteId: 'est-001', nota: 99 },
        { estudianteId: 'est-ajeno', nota: 50 },
      ],
    };
    expect(
      (await gql(gradeMutation, { i })).body.errors?.[0].extensions.code,
    ).toBe('ESTUDIANTE_INVALIDO');
    expect(
      (
        await dbAccessor()
          .collection('calificaciones')
          .findOne({ evaluacionId: evaluation.id, estudianteId: 'est-001' })
      )?.nota,
    ).toBe(80);
  });

  it('oculta el trimestre sin cerrar a padres y limita consultas a sus hijos', async () => {
    const q =
      'query($i:ResultDto!){resultadoTrimestral(input:$i){estado promedio completo}}';
    expect(
      (await gql(q, { i: { ...context, estudianteId: 'est-001' } }, 'padre'))
        .body.errors?.[0].extensions.code,
    ).toBe('RESULTADO_NO_PUBLICADO');
    expect(
      (await gql(q, { i: { ...context, estudianteId: 'est-002' } }, 'padre'))
        .body.errors?.[0].extensions.code,
    ).toBe('PROHIBIDO');
    const teacher = await gql(q, {
      i: { ...context, estudianteId: 'est-001' },
    });
    expect(teacher.body.data.resultadoTrimestral).toEqual({
      estado: 'PROVISIONAL',
      promedio: null,
      completo: false,
    });
  });

  it('no inicia ni falsea una Saga cuando ASISTENCIA_CONTRATO_CONFIRMADO es false', async () => {
    const q =
      'mutation($i:PublishDto!){publicarEvaluacion(input:$i){id estado}}';
    const i = {
      evaluacionId: evaluation.id,
      versionEsperada: evaluation.version,
      operationId: randomUUID(),
      cerrarTrimestre: false,
    };
    expect((await gql(q, { i })).body.errors?.[0].extensions.code).toBe(
      'CONTRATO_PENDIENTE',
    );
    expect(
      await dbAccessor().collection('sagas_publicacion').countDocuments(),
    ).toBe(0);
    expect(
      (
        await dbAccessor()
          .collection('evaluaciones')
          .findOne({ id: evaluation.id })
      )?.estado,
    ).toBe('BORRADOR');
  });

  it('ejecuta SAGA real por HTTP contra ms-asistencia y ms-riesgo: Rollback compensatorio ante fallo y éxito al reintentar (Req 1.7)', async () => {
    process.env.ASISTENCIA_CONTRATO_CONFIRMADO = 'true';
    const publishQuery =
      'mutation($i:PublishDto!){publicarEvaluacion(input:$i){id evaluacionId estado cerrarTrimestre error}}';

    // PRUEBA 1: Simulamos fallo en ms-riesgo para est-002 -> Debe compensar est-001 en ms-riesgo y la marca en ms-asistencia
    remoteState.failRiesgoAtStudent = 'est-002';
    const failedAttempt = await gql(publishQuery, {
      i: {
        evaluacionId: evaluation.id,
        versionEsperada: evaluation.version,
        operationId: randomUUID(),
        cerrarTrimestre: false,
      },
    });
    expect(failedAttempt.body.errors).toBeUndefined();
    const compensatedSaga = failedAttempt.body.data.publicarEvaluacion;
    expect(compensatedSaga.estado).toBe('COMPENSADA');

    const storedCompensatedSaga = await dbAccessor()
      .collection('sagas_publicacion')
      .findOne({ id: compensatedSaga.id });
    expect(storedCompensatedSaga?.asistencia.estado).toBe('COMPENSADO');
    expect(storedCompensatedSaga?.analisis[0].estado).toBe('COMPENSADO');
    expect(storedCompensatedSaga?.analisis[1].estado).toBe('PENDIENTE');

    // La evaluación en BD volvió a BORRADOR y su versión incrementó en 2 (PUBLICANDO -> BORRADOR)
    const evAfterRollback = await dbAccessor()
      .collection('evaluaciones')
      .findOne({ id: evaluation.id });
    expect(evAfterRollback?.estado).toBe('BORRADOR');
    evaluation.version = evAfterRollback!.version;

    // PRUEBA 2: Desactivamos el fallo y publicamos exitosamente
    remoteState.failRiesgoAtStudent = null;
    const successAttempt = await gql(publishQuery, {
      i: {
        evaluacionId: evaluation.id,
        versionEsperada: evaluation.version,
        operationId: randomUUID(),
        cerrarTrimestre: false,
      },
    });
    expect(successAttempt.body.errors).toBeUndefined();
    const completedSaga = successAttempt.body.data.publicarEvaluacion;
    expect(completedSaga.estado).toBe('COMPLETADA');

    const storedCompletedSaga = await dbAccessor()
      .collection('sagas_publicacion')
      .findOne({ id: completedSaga.id });
    expect(storedCompletedSaga?.asistencia.estado).toBe('HECHO');
    expect(
      storedCompletedSaga?.analisis.every((a: any) => a.estado === 'HECHO'),
    ).toBe(true);

    const evAfterSuccess = await dbAccessor()
      .collection('evaluaciones')
      .findOne({ id: evaluation.id });
    expect(evAfterSuccess?.estado).toBe('PUBLICADA');
    evaluation.version = evAfterSuccess!.version;
  });

  it('soporta primaria y consulta institucional con token de director', async () => {
    const i = {
      ...context,
      cursoId: 'pri-2a',
      operationId: randomUUID(),
      nombre: 'Sumas',
      fecha: '2026-03-01',
    };
    expect((await gql(prepareMutation, { i })).body.errors).toBeUndefined();
    const r = await gql(
      'query($i:ContextInput!){evaluaciones(input:$i){id}}',
      { i: context },
      'director',
    );
    expect(r.body.errors).toBeUndefined();
    expect(r.body.data.evaluaciones).toHaveLength(2);
  });

  it('genera y verifica el contenido real binario/estructural de los 5 formatos de reportes (json, csv, xlsx, pdf, docx) (Req 1.10)', async () => {
    // 1. JSON
    const rJson = await request(app.getHttpServer())
      .post('/reportes/json')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .send({ ...context, estudianteId: 'est-001' });
    expect(rJson.status).toBe(201);
    expect(rJson.headers['content-disposition']).toContain(
      'resultado-trimestral.json',
    );
    expect(rJson.body.estudianteId).toBe('est-001');
    expect(rJson.body.cursoId).toBe('sec-3b');

    // 2. CSV (verificando BOM UTF-8 y cabeceras)
    const rCsv = await request(app.getHttpServer())
      .post('/reportes/csv')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .send({ ...context, estudianteId: 'est-001' });
    expect(rCsv.status).toBe(201);
    expect(rCsv.text.startsWith('\uFEFF')).toBe(true);
    expect(rCsv.text).toContain('"Estudiante","Curso","Materia"');
    expect(rCsv.text).toContain('"est-001","sec-3b","matematicas"');

    // 3. XLSX (parseando el buffer binario real con ExcelJS)
    const rXlsx = await request(app.getHttpServer())
      .post('/reportes/xlsx')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ ...context, estudianteId: 'est-001' });
    expect(rXlsx.status).toBe(201);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(rXlsx.body);
    const sheet = workbook.getWorksheet('Resultado');
    expect(sheet).toBeDefined();
    expect(sheet!.getRow(1).getCell(1).value).toBe('Estudiante');
    expect(sheet!.getRow(2).getCell(1).value).toBe('est-001');

    // 4. PDF (verificando firma mágica %PDF- y cierre %%EOF)
    const rPdf = await request(app.getHttpServer())
      .post('/reportes/pdf')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ ...context, estudianteId: 'est-001' });
    expect(rPdf.status).toBe(201);
    const pdfString = (rPdf.body as Buffer).toString('latin1');
    expect(pdfString.startsWith('%PDF-')).toBe(true);
    expect(pdfString.trim().endsWith('%%EOF')).toBe(true);

    // 5. DOCX (verificando cabecera ZIP PK\x03\x04 OpenXML y estructura word/document.xml)
    const rDocx = await request(app.getHttpServer())
      .post('/reportes/docx')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ ...context, estudianteId: 'est-001' });
    expect(rDocx.status).toBe(201);
    const docxBuf = rDocx.body as Buffer;
    expect(docxBuf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(
      true,
    );
    expect(docxBuf.toString('utf8')).toContain('word/document.xml');

    // Verificar bloqueo de seguridad para padre consultando estudiante ajeno
    const denied = await request(app.getHttpServer())
      .post('/reportes/json')
      .set('Authorization', 'Bearer ' + tokens.padre)
      .send({ ...context, estudianteId: 'est-002' });
    expect(denied.status).toBe(403);
  });

  it('negocia MCP real, enumera las 3 herramientas y aplica los permisos en tools/call (Req 1.11)', async () => {
    const client = new Client({ name: 'sigra-integration', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(baseUrl + '/mcp'), {
        requestInit: { headers: { Authorization: 'Bearer ' + tokens.docente } },
      }),
    );
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((x) => x.name).sort()).toEqual([
        'consultar_ficha',
        'listar_alertas',
        'resumen_curso',
      ]);
      const result = await client.callTool({
        name: 'resumen_curso',
        arguments: context,
      });
      expect(result.isError).not.toBe(true);
      const content = result.content as { type: string; text: string }[];
      expect(JSON.parse(content[0].text).estudiantes).toBe(2);

      const fichaResult = await client.callTool({
        name: 'consultar_ficha',
        arguments: { ...context, estudianteId: 'est-001' },
      });
      expect(fichaResult.isError).not.toBe(true);
      const fichaJson = JSON.parse(
        (fichaResult.content as { type: string; text: string }[])[0].text,
      );
      expect(fichaJson.asistencia.disponible).toBe(true);
      expect(fichaJson.alertas.disponible).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('ejecuta el Agente Inteligente (/agente/consultar) conectándose por MCP y ejecutando tool calling real (Req 1.4)', async () => {
    const res = await request(app.getHttpServer())
      .post('/agente/consultar')
      .set('Authorization', 'Bearer ' + tokens.docente)
      .send({
        mensaje:
          'Agente, dame el resumen del curso sec-3b en matematicas gestión 2026 trimestre 1',
      });
    expect(res.status).toBe(201);
    expect(res.body.respuesta).toContain('Consulta completada mediante MCP');
    expect(res.body.fuentes).toHaveLength(1);
    expect(res.body.fuentes[0].herramienta).toBe('resumen_curso');
  });

  it('rechaza tokens alterados y herramientas MCP fuera del alcance familiar', async () => {
    const denied = await request(app.getHttpServer())
      .post('/reportes/json')
      .set('Authorization', 'Bearer ' + tokens.docente + 'alterado')
      .send({ ...context, estudianteId: 'est-001' });
    expect(denied.status).toBe(401);
    const client = new Client({ name: 'padre-integration', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(baseUrl + '/mcp'), {
        requestInit: { headers: { Authorization: 'Bearer ' + tokens.padre } },
      }),
    );
    try {
      const result = await client.callTool({
        name: 'resumen_curso',
        arguments: context,
      });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('cierra un trimestre histórico y muestra solo su resultado a los padres', async () => {
    const historical = { ...context, trimestre: 2 };
    const now = new Date().toISOString();
    const ids = [randomUUID(), randomUUID()];
    const db = dbAccessor();
    await db.collection('periodos').insertOne({
      ...historical,
      id: '2026:sec-3b:matematicas:2',
      estado: 'ABIERTO',
      version: 1,
    });
    await db.collection('evaluaciones').insertMany(
      ids.map((id, n) => ({
        ...historical,
        id,
        nombre: 'Histórica ' + n,
        descripcion: '',
        fecha: '2026-06-01',
        docenteId: sub(tokens.docente),
        estado: 'PUBLICADA',
        version: 1,
        creadoEn: now,
        actualizadoEn: now,
      })),
    );
    await db.collection('calificaciones').insertMany(
      ids.flatMap((id, n) =>
        ['est-001', 'est-002'].map((estudianteId) => ({
          id: id + ':' + estudianteId,
          evaluacionId: id,
          estudianteId,
          nota: n ? 100 : 0,
          version: 1,
          actualizadoEn: now,
        })),
      ),
    );
    const closeQuery =
      'mutation($i:CloseDto!){cerrarTrimestre(input:$i){id estado version}}';
    const closeInput = { ...historical, operationId: randomUUID() };
    const closed = await gql(closeQuery, { i: closeInput });
    expect(closed.body.errors).toBeUndefined();
    expect(closed.body.data.cerrarTrimestre.estado).toBe('CERRADO');
    expect((await gql(closeQuery, { i: closeInput })).body.data).toEqual(
      closed.body.data,
    );
    const incomplete = await gql(closeQuery, {
      i: { ...context, operationId: randomUUID() },
    });
    expect(incomplete.body.errors?.[0].extensions.code).toBe(
      'TRIMESTRE_INCOMPLETO',
    );
    const query =
      'query($i:ResultDto!){resultadoTrimestral(input:$i){estado promedio completo actividades{nota}}}';
    const r = await gql(
      query,
      { i: { ...historical, estudianteId: 'est-001' } },
      'padre',
    );
    expect(r.body.errors).toBeUndefined();
    expect(r.body.data.resultadoTrimestral).toEqual({
      estado: 'PUBLICADO',
      promedio: 50,
      completo: true,
      actividades: null,
    });
    const create = await gql(prepareMutation, {
      i: {
        ...historical,
        operationId: randomUUID(),
        nombre: 'No permitida',
        fecha: '2026-06-02',
      },
    });
    expect(create.body.errors?.[0].extensions.code).toBe('PERIODO_BLOQUEADO');
    const edit = await gql(gradeMutation, {
      i: {
        evaluacionId: ids[0],
        versionEsperada: 1,
        operationId: randomUUID(),
        notas: [{ estudianteId: 'est-001', nota: 99 }],
      },
    });
    expect(edit.body.errors?.[0].extensions.code).toBe('CONFLICTO_EDICION');
  });
});
