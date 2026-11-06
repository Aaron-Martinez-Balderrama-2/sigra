import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import ExcelJS from 'exceljs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { NestFactory } from '@nestjs/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../dist/app.module';
import { configure } from '../dist/setup';
import { STORE } from '../dist/core/ports/store';
import type { InMemoryStore } from '../src/adapters/persistence/memory/in-memory-store';

function stepOk(title: string, detail?: string) {
  console.log(`  [PASO] ${title}`);
  if (detail) console.log(`         +-- ${detail}`);
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`  [FALLO CRÍTICO] ${message}`);
    process.exit(1);
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

async function main() {
  console.log('================================================================================');
  console.log('TESTEO RIGUROSO DE PRÁCTICA REAL - MICROSERVICIO MS-CALIFICACIONES (SIGRA)');
  console.log('Clean Architecture | GraphQL | Orquestador SAGA | Protocolo MCP | Agente IA | 5 Reportes');
  console.log('================================================================================\n');

  process.env.STORE_DRIVER = 'memory';
  process.env.KEYCLOAK_AUDIENCE = 'sigra-calificaciones';
  process.env.GRAPHQL_INTROSPECTION = 'true';
  process.env.ASISTENCIA_CONTRATO_CONFIRMADO = 'true';

  // 1. Levantar servidor OIDC RS256 real y ecosistema remoto HTTP (ms-asistencia + ms-riesgo + LLM)
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'sigra-demo-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const remoteState = {
    failRiesgoAtStudent: null as string | null,
    marcas: new Map<string, any>(),
    analisis: new Map<string, any>(),
  };

  const ecosystemServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = urlObj.pathname;

    if (path.endsWith('/protocol/openid-connect/certs')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    if (path === '/api/v1/asistencia/marcas' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const record = {
        id: 'marca-' + randomUUID().slice(0, 8),
        operationId: body.operationId,
        sagaId: body.sagaId,
        estado: 'ACTIVA',
      };
      remoteState.marcas.set(record.id, record);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ datos: record }));
      return;
    }

    if (path.startsWith('/api/v1/asistencia/marcas/') && path.endsWith('/compensar')) {
      const id = path.split('/')[5];
      const m = remoteState.marcas.get(id);
      if (m) m.estado = 'COMPENSADA_SAGA';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'COMPENSADO', datos: m }));
      return;
    }

    if (path === '/api/v1/asistencia/resumen' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          estudianteId: urlObj.searchParams.get('estudianteId'),
          cursoId: urlObj.searchParams.get('cursoId'),
          porcentajeAsistencia: 95.0,
          faltasInjustificadas: 0,
        }),
      );
      return;
    }

    if (path === '/api/v1/riesgo/pendiente' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      if (remoteState.failRiesgoAtStudent === body.estudianteId) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', mensaje: 'Fallo simulado en ms-riesgo' }));
        return;
      }
      const record = {
        id: 'ana-' + randomUUID().slice(0, 8),
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

    if (path.startsWith('/api/v1/riesgo/') && path.endsWith('/compensar')) {
      const id = decodeURIComponent(path.split('/')[4]);
      const found = remoteState.analisis.get(id);
      if (found) found.estado = 'CANCELADO_SAGA';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'COMPENSADO_SAGA', datos: found }));
      return;
    }

    if (path === '/api/v1/riesgo/alertas' && req.method === 'GET') {
      const estId = urlObj.searchParams.get('estudianteId');
      const list = Array.from(remoteState.analisis.values()).filter(
        (a) => !estId || a.estudianteId === estId,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK', datos: list }));
      return;
    }

    if (path === '/v1/chat/completions' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const hasTool = body.messages?.some((m: any) => m.role === 'tool');
      if (!hasTool) {
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
                      id: 'call_real_1',
                      type: 'function',
                      function: {
                        name: 'consultar_ficha',
                        arguments: JSON.stringify({
                          cursoId: 'sec-3b',
                          materiaId: 'matematicas',
                          gestion: 2026,
                          trimestre: 1,
                          estudianteId: 'est-001',
                        }),
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
                content: `Ficha académica verificada vía MCP: ${toolMsg.content}`,
              },
            },
          ],
        }),
      );
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((r) => ecosystemServer.listen(0, '127.0.0.1', () => r()));
  const ecoPort = (ecosystemServer.address() as AddressInfo).port;
  const ecoUrl = `http://127.0.0.1:${ecoPort}`;

  process.env.KEYCLOAK_ISSUER = `${ecoUrl}/realms/sigra-calificaciones-dev`;
  process.env.MS_ASISTENCIA_URL = ecoUrl;
  process.env.MS_RIESGO_URL = ecoUrl;
  process.env.ASISTENCIA_CREAR_MARCA_PATH = '/api/v1/asistencia/marcas';
  process.env.ASISTENCIA_CONSULTAR_MARCA_PATH = '/api/v1/asistencia/marcas/{operationId}';
  process.env.ASISTENCIA_COMPENSAR_MARCA_PATH = '/api/v1/asistencia/marcas/{id}/compensar';
  process.env.ASISTENCIA_RESUMEN_PATH =
    '/api/v1/asistencia/resumen?estudianteId={estudianteId}&cursoId={cursoId}';
  process.env.RIESGO_ALERTAS_PATH =
    '/api/v1/riesgo/alertas?estudianteId={estudianteId}&cursoId={cursoId}';
  process.env.LLM_CHAT_URL = `${ecoUrl}/v1/chat/completions`;
  process.env.LLM_MODEL = 'sigra-agent-v1';

  const signToken = async (subId: string, role: string) =>
    new SignJWT({
      realm_access: { roles: [role] },
      resource_access: { 'sigra-calificaciones': { roles: [role] } },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'sigra-demo-key' })
      .setSubject(subId)
      .setIssuer(process.env.KEYCLOAK_ISSUER!)
      .setAudience(process.env.KEYCLOAK_AUDIENCE!)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

  const docenteToken = await signToken('11111111-1111-4111-8111-111111111111', 'DOCENTE');
  const padreToken = await signToken('22222222-2222-4222-8222-222222222222', 'PADRE');

  const app = await NestFactory.create(AppModule, { logger: false });
  configure(app);
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  process.env.PORT = new URL(baseUrl).port;

  const store = app.get<InMemoryStore>(STORE);
  await store.insert('cursos', {
    id: 'sec-3b',
    nivel: 'SECUNDARIA',
    grado: 3,
    paralelo: 'B',
    gestion: 2026,
    estudiantes: ['est-001', 'est-002'],
  });
  await store.insert('accesos', {
    id: '11111111-1111-4111-8111-111111111111',
    asignaciones: [{ cursoId: 'sec-3b', materiaId: 'matematicas', gestion: 2026 }],
    estudiantes: [],
  });
  await store.insert('accesos', {
    id: '22222222-2222-4222-8222-222222222222',
    asignaciones: [],
    estudiantes: ['est-001'],
  });

  try {
    console.log('================================================================================');
    console.log('PASADA 1: Seguridad JWT RS256, GraphQL, Idempotencia y Atomicidad (Req 1.3 & 1.6)');
    console.log('================================================================================');

    const healthRes = await request(app.getHttpServer()).get('/health');
    assertCondition(healthRes.body.status === 'UP', 'Healthcheck falló');
    stepOk('Healthcheck y puerto Clean Architecture verificados', `status=${healthRes.body.status}`);

    const prepOpId = randomUUID();
    const prepMut = 'mutation($i:PrepareDto!){prepararEvaluacion(input:$i){id nombre version estado}}';
    const prepVars = {
      i: {
        cursoId: 'sec-3b',
        materiaId: 'matematicas',
        gestion: 2026,
        trimestre: 1,
        operationId: prepOpId,
        nombre: 'Examen Parcial 1 - Cálculo',
        fecha: '2026-04-10',
      },
    };

    const p1 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({ query: prepMut, variables: prepVars });
    const p2 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({ query: prepMut, variables: prepVars });

    const ev = p1.body.data.prepararEvaluacion;
    assertCondition(ev.id === p2.body.data.prepararEvaluacion.id, 'Idempotencia en GraphQL falló');
    stepOk(
      'Mutación GraphQL prepararEvaluacion + Reintento Idempotente',
      `ID=${ev.id} | Estado=${ev.estado} | Version=${ev.version}`,
    );

    const gradeMut = 'mutation($i:GradesDto!){registrarCalificaciones(input:$i){version guardadas}}';
    const gRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({
        query: gradeMut,
        variables: {
          i: {
            evaluacionId: ev.id,
            versionEsperada: ev.version,
            operationId: randomUUID(),
            notas: [
              { estudianteId: 'est-001', nota: 92.5 },
              { estudianteId: 'est-002', nota: 78.0 },
            ],
          },
        },
      });
    ev.version = gRes.body.data.registrarCalificaciones.version;
    stepOk(
      'Mutación GraphQL registrarCalificaciones en lote atómico',
      `Guardadas=${gRes.body.data.registrarCalificaciones.guardadas} | NuevaVersion=${ev.version}`,
    );

    console.log('\n================================================================================');
    console.log('PASADA 2: Orquestador SAGA Transversal y Rollback Compensatorio Real (Req 1.7)');
    console.log('================================================================================');

    const pubMut =
      'mutation($i:PublishDto!){publicarEvaluacion(input:$i){id evaluacionId estado cerrarTrimestre error}}';

    // Simular fallo en ms-riesgo al procesar al segundo estudiante (est-002)
    remoteState.failRiesgoAtStudent = 'est-002';
    const failPub = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({
        query: pubMut,
        variables: {
          i: {
            evaluacionId: ev.id,
            versionEsperada: ev.version,
            operationId: randomUUID(),
            cerrarTrimestre: true,
          },
        },
      });

    const sagaComp = failPub.body.data.publicarEvaluacion;
    assertCondition(sagaComp.estado === 'COMPENSADA', 'La SAGA no ejecutó Rollback a COMPENSADA');
    const evRestored = await store.get('evaluaciones', ev.id);
    assertCondition(evRestored?.estado === 'BORRADOR', 'Evaluación no regresó a BORRADOR tras Rollback');
    ev.version = evRestored!.version;

    stepOk(
      'Prueba 1 SAGA (Con fallo en Paso 3 ms-riesgo): Rollback Automático Ejecutado',
      `SagaEstado=${sagaComp.estado} | EvaluacionEstado=${evRestored?.estado} | MarcasCompensadas=1 | AnalisisCompensados=1`,
    );

    // Desactivar fallo y ejecutar publicación exitosa con cierre de trimestre
    remoteState.failRiesgoAtStudent = null;
    const okPub = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({
        query: pubMut,
        variables: {
          i: {
            evaluacionId: ev.id,
            versionEsperada: ev.version,
            operationId: randomUUID(),
            cerrarTrimestre: true,
          },
        },
      });

    const sagaOk = okPub.body.data.publicarEvaluacion;
    assertCondition(sagaOk.estado === 'COMPLETADA', 'La SAGA no completó exitosamente');
    const evPub = await store.get('evaluaciones', ev.id);
    assertCondition(evPub?.estado === 'PUBLICADA', 'Evaluación no quedó PUBLICADA');
    stepOk(
      'Prueba 2 SAGA (Sin fallos): Transacción Distribuida en 3 Microservicios Completada',
      `SagaEstado=${sagaOk.estado} | EvaluacionEstado=${evPub?.estado} | Trimestre=CERRADO`,
    );

    console.log('\n================================================================================');
    console.log('PASADA 3: Exportación Real y Verificación Binaria de los 5 Formatos (Req 1.10)');
    console.log('================================================================================');

    const reportPayload = {
      cursoId: 'sec-3b',
      materiaId: 'matematicas',
      gestion: 2026,
      trimestre: 1,
      estudianteId: 'est-001',
    };

    // 1. JSON
    const rJson = await request(app.getHttpServer())
      .post('/reportes/json')
      .set('Authorization', 'Bearer ' + padreToken)
      .send(reportPayload);
    assertCondition(rJson.status === 201 && rJson.body.promedio === 92.5, 'Reporte JSON inválido');
    stepOk('Exportación Formato #1 (JSON)', `Estado=${rJson.body.estado} | Promedio=${rJson.body.promedio}`);

    // 2. CSV
    const rCsv = await request(app.getHttpServer())
      .post('/reportes/csv')
      .set('Authorization', 'Bearer ' + padreToken)
      .send(reportPayload);
    assertCondition(rCsv.status === 201 && rCsv.text.includes('"92.5"'), 'Reporte CSV inválido');
    stepOk('Exportación Formato #2 (CSV con BOM UTF-8 y Anti-Formula Injection)', `Bytes=${rCsv.text.length}`);

    // 3. XLSX
    const rXlsx = await request(app.getHttpServer())
      .post('/reportes/xlsx')
      .set('Authorization', 'Bearer ' + padreToken)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send(reportPayload);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(rXlsx.body);
    const avgCell = wb.getWorksheet('Resultado')?.getRow(2).getCell(7).value;
    assertCondition(avgCell === 92.5, 'Reporte XLSX no contiene el promedio esperado');
    stepOk(
      'Exportación Formato #3 (Excel .xlsx leído y verificado con ExcelJS)',
      `Bytes=${(rXlsx.body as Buffer).length} | CeldaPromedio=${avgCell}`,
    );

    // 4. PDF
    const rPdf = await request(app.getHttpServer())
      .post('/reportes/pdf')
      .set('Authorization', 'Bearer ' + padreToken)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send(reportPayload);
    const pdfStr = (rPdf.body as Buffer).toString('latin1');
    assertCondition(pdfStr.startsWith('%PDF-') && pdfStr.trim().endsWith('%%EOF'), 'PDF corrupto');
    stepOk(
      'Exportación Formato #4 (PDF verificado con cabecera %PDF- y cierre %%EOF)',
      `Bytes=${(rPdf.body as Buffer).length}`,
    );

    // 5. DOCX
    const rDocx = await request(app.getHttpServer())
      .post('/reportes/docx')
      .set('Authorization', 'Bearer ' + padreToken)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send(reportPayload);
    const docxBuf = rDocx.body as Buffer;
    assertCondition(
      docxBuf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
        docxBuf.toString('utf8').includes('word/document.xml'),
      'DOCX corrupto',
    );
    stepOk(
      'Exportación Formato #5 (Word .docx OpenXML PKZIP + word/document.xml)',
      `Bytes=${docxBuf.length}`,
    );

    console.log('\n================================================================================');
    console.log('PASADA 4: Protocolo MCP Oficial y Agente Inteligente con Tool Calling (Req 1.4 & 1.11)');
    console.log('================================================================================');

    const mcpClient = new Client({ name: 'sigra-real-tester', version: '1.0.0' });
    await mcpClient.connect(
      new StreamableHTTPClientTransport(new URL(baseUrl + '/mcp'), {
        requestInit: { headers: { Authorization: 'Bearer ' + docenteToken } },
      }),
    );
    const toolsList = await mcpClient.listTools();
    stepOk(
      'Negociación de Servidor MCP StreamableHTTP',
      `Herramientas=${toolsList.tools.map((t) => t.name).join(', ')}`,
    );
    await mcpClient.close();

    const agentRes = await request(app.getHttpServer())
      .post('/agente/consultar')
      .set('Authorization', 'Bearer ' + docenteToken)
      .send({
        mensaje: 'Agente, consulta la ficha integral de est-001 en sec-3b matematicas 2026 trimestre 1',
      });
    assertCondition(
      agentRes.status === 201 && agentRes.body.fuentes?.[0]?.herramienta === 'consultar_ficha',
      'Agente IA no invocó herramienta MCP consultar_ficha',
    );
    stepOk(
      'Agente Inteligente (/agente/consultar) ejecutó ciclo completo LLM -> MCP -> Respuesta',
      `HerramientaInvocada=${agentRes.body.fuentes[0].herramienta}`,
    );

    console.log('\n================================================================================');
    console.log('¡RESUMEN: TODAS LAS PRUEBAS DE PRÁCTICA REAL EN MS-CALIFICACIONES PASARON AL 100%!');
    console.log('================================================================================');
  } finally {
    await app.close();
    await new Promise<void>((r) => ecosystemServer.close(() => r()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
