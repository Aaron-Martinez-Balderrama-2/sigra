import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// Se importa el build: conserva metadatos reales de inyección y validación.
import { AppModule } from '../dist/app.module';
import { configure } from '../dist/setup';

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
let dbClient: MongoClient;
let baseUrl: string;
const tokens: Record<string, string> = {};
let evaluation: { id: string; version: number };
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
      'Keycloak real no disponible: ' +
        res.status +
        '. Inicie compose.dev.yml.',
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
beforeAll(async () => {
  for (const user of ['docente', 'padre', 'director'])
    tokens[user] = await token(user);
  dbClient = new MongoClient(process.env.MONGO_URI!);
  await dbClient.connect();
  const db = dbClient.db(database);
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
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configure(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
afterAll(async () => {
  if (app) await app.close();
  if (dbClient) {
    if (!database.startsWith('sigra_calificaciones_test_'))
      throw new Error('Nombre de prueba inseguro');
    await dbClient.db(database).dropDatabase();
    await dbClient.close();
  }
});
const prepareMutation =
  'mutation($i:PrepareDto!){prepararEvaluacion(input:$i){id nombre version estado}}';
const gradeMutation =
  'mutation($i:GradesDto!){registrarCalificaciones(input:$i){version guardadas}}';
describe('MongoDB 7 y Keycloak reales, sin servicios simulados', () => {
  it('comprueba MongoDB y rechaza llamadas sin identidad', async () => {
    expect(
      (await request(app.getHttpServer()).get('/health')).body.status,
    ).toBe('UP');
    const denied = await request(app.getHttpServer()).post('/graphql').send({
      query:
        '{evaluaciones(input:{cursoId:"sec-3b",materiaId:"matematicas",gestion:2026,trimestre:1}){id}}',
    });
    expect(denied.body.errors).toBeDefined();
  });
  it('crea en MongoDB una evaluación y reproduce el resultado ante un reintento', async () => {
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
    expect(
      await dbClient.db(database).collection('evaluaciones').countDocuments(),
    ).toBe(1);
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
      await dbClient.db(database).collection('calificaciones').countDocuments(),
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
      await dbClient.db(database).collection('calificaciones').countDocuments(),
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
        await dbClient
          .db(database)
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
  it('no inicia ni falsea una Saga cuando falta el contrato real de Asistencia', async () => {
    const q =
      'mutation($i:PublishDto!){publicarEvaluacion(input:$i){id estado}}';
    const i = {
      evaluacionId: evaluation.id,
      versionEsperada: evaluation.version,
      operationId: randomUUID(),
      cerrarTrimestre: false,
    };
    expect((await gql(q, { i })).body.errors?.[0].extensions.code).toBe(
      'INTEGRACION_NO_CONFIGURADA',
    );
    expect(
      await dbClient
        .db(database)
        .collection('sagas_publicacion')
        .countDocuments(),
    ).toBe(0);
    expect(
      (
        await dbClient
          .db(database)
          .collection('evaluaciones')
          .findOne({ id: evaluation.id })
      )?.estado,
    ).toBe('BORRADOR');
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
  it('genera reportes reales y conserva permisos', async () => {
    for (const format of ['json', 'csv', 'xlsx', 'pdf']) {
      const r = await request(app.getHttpServer())
        .post('/reportes/' + format)
        .set('Authorization', 'Bearer ' + tokens.docente)
        .send({ ...context, estudianteId: 'est-001' });
      expect(r.status).toBe(201);
      expect(r.headers['content-disposition']).toContain(
        'resultado-trimestral.' + format,
      );
    }
    const denied = await request(app.getHttpServer())
      .post('/reportes/json')
      .set('Authorization', 'Bearer ' + tokens.padre)
      .send({ ...context, estudianteId: 'est-002' });
    expect(denied.status).toBe(403);
  });
  it('negocia MCP real, enumera herramientas y aplica los permisos en tools/call', async () => {
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
    } finally {
      await client.close();
    }
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
    // Datos históricos ficticios persistidos en Mongo real; no simulan llamadas remotas ni éxito de Saga.
    const historical = { ...context, trimestre: 2 };
    const now = new Date().toISOString();
    const ids = [randomUUID(), randomUUID()];
    const db = dbClient.db(database);
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
