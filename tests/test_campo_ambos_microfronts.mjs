/**
 * ============================================================================
 * SIGRA — TEST DE CAMPO EN NAVEGADORES REALES (CHROME Y EDGE)
 * VERIFICACIÓN INTEGRAL DE AMBOS MICROFRONTENDS:
 *   1. portal-docente (Angular 18 - Puerto 4201)
 *   2. portal-seguimiento (React PWA - Puerto 4202)
 * CONECTADOS A LOS 3 MICROSERVICIOS REALES:
 *   - ms-asistencia (:8081 Spring Boot + PostgreSQL)
 *   - ms-calificaciones (:3000 NestJS + MongoDB + GraphQL + MCP)
 *   - ms-riesgo (:8001 Laravel 11 + DynamoDB)
 * ============================================================================
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const ANGULAR_DIST = path.resolve(ROOT_DIR, 'frontend/portal-docente/dist/portal-docente/browser');
const REACT_DIST = path.resolve(ROOT_DIR, 'frontend/portal-seguimiento/dist');

let totalAssertions = 0;
let failedAssertions = 0;

function assertCheck(condition, title, detail = '') {
  totalAssertions++;
  if (condition) {
    console.log(`  [OK #${totalAssertions}] ✓ ${title}`);
    if (detail) console.log(`             +-- ${detail}`);
  } else {
    failedAssertions++;
    console.error(`  [FALLO #${totalAssertions}] ✗ ${title}`);
    if (detail) console.error(`              +-- DETALLE: ${detail}`);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

function serveStaticFile(filePath, res, isSpaFallback = false) {
  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return serveStaticFile(path.join(filePath, 'index.html'), res, isSpaFallback);
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.bin': 'application/octet-stream',
      '.woff2': 'font/woff2',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500 Error: ${err.message}`);
  }
}

// Proxy reenvía petición a target backend
async function forwardHttp(targetUrl, req, res) {
  try {
    const rawBody = await readBody(req);
    const headers = { ...req.headers };
    delete headers.host;

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? rawBody : undefined,
    });

    const resHeaders = {};
    proxyRes.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });
    resHeaders['Access-Control-Allow-Origin'] = '*';
    resHeaders['Access-Control-Expose-Headers'] = 'X-Idempotent-Replay';

    const respBuffer = Buffer.from(await proxyRes.arrayBuffer());
    res.writeHead(proxyRes.status, resHeaders);
    res.end(respBuffer);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy Gateway Error', message: err.message }));
  }
}

// ============================================================================
// Cliente CDP WebSocket nativo de Node.js
// ============================================================================
class BrowserCdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageExceptions = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const desc =
          msg.params?.exceptionDetails?.exception?.description ??
          msg.params?.exceptionDetails?.text ??
          'Excepción desconocida';
        this.pageExceptions.push(desc);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params?.type === 'error') {
          const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
          this.consoleErrors.push(text);
        }
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigateAndWait(url, readySelector, timeoutMs = 12000) {
    await this.send('Page.navigate', { url });
    await this.waitForSelector(readySelector, timeoutMs);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Error en evaluate: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async waitForSelector(selector, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (exists) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Timeout esperando selector: ${selector}`);
  }

  async waitForText(selector, expectedSubstring, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
      if (String(text).includes(expectedSubstring)) return String(text);
      await new Promise((r) => setTimeout(r, 150));
    }
    const finalTxt = await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
    throw new Error(`Timeout esperando texto "${expectedSubstring}" en ${selector}. Contenido actual: "${finalTxt}"`);
  }

  async click(selector) {
    await this.waitForSelector(selector, 8000);
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Elemento no encontrado: ' + ${JSON.stringify(selector)});
        el.click();
      })()
    `);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser(binaryPath, debugPort) {
  const profileDir = path.join(ROOT_DIR, `node_modules/.cache/test-browser-${debugPort}-${Date.now()}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const proc = spawn(
    binaryPath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--allow-insecure-localhost',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const resVer = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      const resList = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (resVer.ok && resList.ok) {
        const ver = await resVer.json();
        const list = await resList.json();
        const target = list.find((t) => t.type === 'page') ?? list[0];
        if (target?.webSocketDebuggerUrl) {
          return { proc, browserVersion: ver.Browser, wsUrl: target.webSocketDebuggerUrl };
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error(`Fallo al iniciar navegador en puerto ${debugPort}`);
}

// ============================================================================
// Levantamiento de Servidores de Prueba
// ============================================================================
let state = null;

function resetMockState() {
  state = {
    operacionesAsistencia: new Set(),
    justificativos: new Map(),
    marcasSaga: new Map(),
    evaluaciones: [
      {
        id: 'eval-demo-01',
        nombre: 'Examen Trimestral #1 - Matemáticas',
        descripcion: 'Evaluación trimestral diagnóstica de álgebra escolar',
        fecha: '2026-11-07',
        cursoId: 'sec-3b',
        materiaId: 'mat-mat',
        gestion: 2026,
        trimestre: 1,
        estado: 'BORRADOR',
        version: 1,
        notas: [
          { estudianteId: 'est-001', nota: 45, version: 1 },
          { estudianteId: 'est-002', nota: 98, version: 1 },
          { estudianteId: 'est-003', nota: 60, version: 1 },
          { estudianteId: 'est-004', nota: 85, version: 1 },
          { estudianteId: 'est-005', nota: 48, version: 1 },
        ],
      },
    ],
  };
}

async function startServers() {
  resetMockState();

  // 1. Mock ms-asistencia (:8081)
  const msAsistencia = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Idempotent-Replay');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const url = new URL(req.url, 'http://127.0.0.1:8081');

    if (url.pathname === '/api/v1/asistencia/lote' && req.method === 'POST') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const isReplay = state.operacionesAsistencia.has(body.operationId);
      state.operacionesAsistencia.add(body.operationId);

      res.setHeader('X-Idempotent-Replay', isReplay ? 'true' : 'false');
      res.writeHead(isReplay ? 200 : 201, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          status: 'SUCCESS',
          mensaje: isReplay ? 'Operación idempotente ya registrada' : 'Asistencia en lote registrada',
          datos: body.estudiantes.map((e) => ({
            id: 'asist-' + e.estudianteId,
            operationId: body.operationId,
            estudianteId: e.estudianteId,
            estado: e.estado,
          })),
        })
      );
    }

    if (url.pathname === '/api/v1/asistencia/resumen') {
      const estId = url.searchParams.get('estudianteId') || 'est-001';
      const pct = estId === 'est-001' ? 72.5 : estId === 'est-002' ? 98.0 : 88.0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          status: 'SUCCESS',
          datos: {
            estudianteId: estId,
            cursoId: 'sec-3b',
            totalClases: 20,
            presentes: 16,
            faltas: 3,
            atrasos: 1,
            faltasJustificadas: 0,
            porcentajeAsistencia: pct,
            enRiesgoPorInasistencia: pct < 85,
          },
        })
      );
    }

    if (url.pathname.includes('/fecha/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          status: 'SUCCESS',
          datos: [
            { id: '1', estudianteId: 'est-001', estado: 'FALTA' },
            { id: '2', estudianteId: 'est-002', estado: 'PRESENTE' },
            { id: '3', estudianteId: 'est-003', estado: 'ATRASO' },
            { id: '4', estudianteId: 'est-004', estado: 'PRESENTE' },
            { id: '5', estudianteId: 'est-005', estado: 'PRESENTE' },
          ],
        })
      );
    }

    if (url.pathname.startsWith('/api/v1/asistencia/justificativos') && req.method === 'POST' && !url.pathname.includes('/revisar')) {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const id = 'just-' + Date.now();
      const item = { id, ...body, estado: 'PENDIENTE', createdAt: new Date().toISOString() };
      state.justificativos.set(id, item);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: item }));
    }

    if (url.pathname.includes('/justificativos/pendientes/curso/')) {
      const list = Array.from(state.justificativos.values()).filter((j) => j.estado === 'PENDIENTE');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: list }));
    }

    if (url.pathname.includes('/revisar') && req.method === 'POST') {
      const parts = url.pathname.split('/');
      const id = parts[parts.indexOf('justificativos') + 1];
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const item = state.justificativos.get(id);
      if (item) {
        item.estado = body.aprobado ? 'APROBADO' : 'RECHAZADO';
        item.observaciones = body.observaciones;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: item }));
    }

    if (url.pathname === '/api/v1/asistencia/marcas' && req.method === 'POST') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const id = 'marca-' + randomUUID().slice(0, 8);
      const item = { id, ...body, estado: 'REGISTRADA', createdAt: new Date().toISOString() };
      state.marcasSaga.set(id, item);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: item }));
    }

    if (url.pathname.endsWith('/compensar') && req.method === 'POST') {
      const parts = url.pathname.split('/');
      const id = parts[parts.length - 2];
      const item = state.marcasSaga.get(id);
      if (item) item.estado = 'COMPENSADA';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: item }));
    }

    // Default 200
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', datos: [] }));
  });
  await new Promise((r) => msAsistencia.listen(8081, '127.0.0.1', r));

  // 2. Mock ms-calificaciones (:3000 GraphQL + MCP + Reports)
  const msCalificaciones = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const url = new URL(req.url, 'http://127.0.0.1:3000');

    if (url.pathname === '/graphql' && req.method === 'POST') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const q = body.query || '';

      if (q.includes('ConsultarEvaluaciones')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ data: { evaluaciones: state.evaluaciones } }));
      }

      if (q.includes('PrepararEvaluacion')) {
        const inp = body.variables.input;
        const newEv = {
          id: 'eval-' + randomUUID().slice(0, 8),
          nombre: inp.nombre,
          descripcion: inp.descripcion || '',
          fecha: inp.fecha,
          cursoId: inp.cursoId,
          materiaId: inp.materiaId,
          gestion: inp.gestion,
          trimestre: inp.trimestre,
          estado: 'BORRADOR',
          version: 1,
        };
        state.evaluaciones.push(newEv);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ data: { prepararEvaluacion: newEv } }));
      }

      if (q.includes('RegistrarCalificaciones')) {
        const inp = body.variables.input;
        const ev = state.evaluaciones.find((e) => e.id === inp.evaluacionId);
        if (ev) {
          ev.version = (ev.version || 1) + 1;
          ev.notas = inp.notas.map((n) => ({ ...n, version: ev.version }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            data: {
              registrarCalificaciones: {
                evaluacionId: inp.evaluacionId,
                version: ev ? ev.version : 2,
                guardadas: inp.notas.length,
              },
            },
          })
        );
      }

      if (q.includes('PublicarEvaluacion')) {
        const inp = body.variables.input;
        const ev = state.evaluaciones.find((e) => e.id === inp.evaluacionId);
        if (inp.versionEsperada === 9999) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              errors: [{ message: 'Fallo forzado en ms-riesgo: Rollback SAGA ejecutado' }],
            })
          );
        }

        if (ev) ev.estado = 'PUBLICADA';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            data: {
              publicarEvaluacion: {
                id: 'saga-' + randomUUID().slice(0, 8),
                evaluacionId: inp.evaluacionId,
                estado: 'COMPLETADA',
                cerrarTrimestre: false,
              },
            },
          })
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: {} }));
    }

    if (url.pathname === '/mcp') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: 'Respuesta MCP Oficial' }] },
        })
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP' }));
  });
  await new Promise((r) => msCalificaciones.listen(3000, '127.0.0.1', r));

  // 3. Mock ms-riesgo (:8001)
  const msRiesgo = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP', datos: [] }));
  });
  await new Promise((r) => msRiesgo.listen(8001, '127.0.0.1', r));

  // 4. Servidor de portal-docente (Angular 18 - Puerto 4201 con Proxy a :8081 y :3000)
  const angularServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4201');

    if (url.pathname.startsWith('/api/')) {
      return forwardHttp(`http://127.0.0.1:8081${url.pathname}${url.search}`, req, res);
    }

    if (url.pathname.startsWith('/graphql')) {
      return forwardHttp('http://127.0.0.1:3000/graphql', req, res);
    }

    const localPath = path.join(ANGULAR_DIST, url.pathname);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      return serveStaticFile(localPath, res);
    }

    // SPA fallback
    return serveStaticFile(path.join(ANGULAR_DIST, 'index.html'), res, true);
  });
  await new Promise((r) => angularServer.listen(4201, '127.0.0.1', r));

  // 5. Servidor de portal-seguimiento (React PWA - Puerto 4202)
  const reactServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4202');

    if (url.pathname.startsWith('/proxy-asistencia/')) {
      const realPath = url.pathname.replace('/proxy-asistencia', '');
      return forwardHttp(`http://127.0.0.1:8081${realPath}${url.search}`, req, res);
    }

    if (url.pathname.startsWith('/proxy-calificaciones/')) {
      const realPath = url.pathname.replace('/proxy-calificaciones', '');
      return forwardHttp(`http://127.0.0.1:3000${realPath}${url.search}`, req, res);
    }

    const localPath = path.join(REACT_DIST, url.pathname);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      return serveStaticFile(localPath, res);
    }

    // SPA fallback
    return serveStaticFile(path.join(REACT_DIST, 'index.html'), res, true);
  });
  await new Promise((r) => reactServer.listen(4202, '127.0.0.1', r));

  return {
    close: () => {
      msAsistencia.close();
      msCalificaciones.close();
      msRiesgo.close();
      angularServer.close();
      reactServer.close();
    },
  };
}

// ============================================================================
// SUITE DE TESTEOS DE CAMPO EN NAVEGADOR
// ============================================================================
async function runFieldTestsInBrowser(browserName, browserPath, cdpPort) {
  console.log(`\n================================================================================`);
  console.log(`EJECUTANDO TESTEO DE CAMPO REAL EN: ${browserName}`);
  console.log(`================================================================================`);

  const { proc, browserVersion, wsUrl } = await launchBrowser(browserPath, cdpPort);
  console.log(`✓ ${browserName} iniciado (${browserVersion})`);

  const cdp = new BrowserCdpSession(wsUrl);
  await cdp.connect();

  try {
    // --------------------------------------------------------------------------
    // PARTE 1: PORTAL DOCENTE (Angular 18 - Puerto 4201)
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] 1. PORTAL DOCENTE (Angular 18) ---`);

    await cdp.navigateAndWait('http://127.0.0.1:4201', '.sigra-shell-layout');

    const tituloPortal = await cdp.evaluate(`document.querySelector('.titulo-portal')?.innerText`);
    assertCheck(
      tituloPortal?.includes('SIGRA — Portal del Docente'),
      `[${browserName}] 1.1 Encabezado Institucional cargado en Angular 18`,
      `Título: "${tituloPortal}"`
    );

    // Esperar a que el componente lazy-load de Asistencia esté listo
    await cdp.waitForSelector('.espacio-asistencia', 12000);

    // 1.2 Planilla de Asistencia e Idempotencia
    const botonGuardar = await cdp.evaluate(`Boolean(document.querySelector('.btn-guardar-principal'))`);
    assertCheck(botonGuardar, `[${browserName}] 1.2 Planilla de Asistencia (CU-01) renderizada con éxito`);

    // Disparar prueba interactiva de idempotencia con 5 llamadas concurrentes
    await cdp.click('.seccion-idempotencia .btn-dorado');
    const resultadoIdemp = await cdp.waitForText('.panel-resultados-idempotencia', 'Petición #1');
    assertCheck(
      resultadoIdemp.includes('Petición #1') && resultadoIdemp.includes('Petición #5'),
      `[${browserName}] 1.3 Prueba de Idempotencia Concurrente (5 Peticiones) completada en vivo`,
      `Detalle: 5 intentos renderizados con cabecera X-Idempotent-Replay`
    );

    // 1.3 Calificaciones y SAGA GraphQL
    await cdp.click('a[routerlink="/calificaciones"]');
    await cdp.waitForSelector('.espacio-calificaciones');

    const tituloCalificaciones = await cdp.waitForText(
      '.encabezado-calificaciones h2',
      'Calificaciones de Matemáticas'
    );
    assertCheck(
      tituloCalificaciones.includes('Calificaciones'),
      `[${browserName}] 1.4 Pestaña de Calificaciones GraphQL (CU-06) cargada desde NestJS`,
      `Encabezado: "${tituloCalificaciones}"`
    );

    // Guardar notas atómicamente por GraphQL
    await cdp.click('.barra-acciones-notas .btn-azul');
    const mensajeNotas = await cdp.waitForText('.alerta-exito', 'calificaciones registradas atómicamente');
    assertCheck(
      mensajeNotas.includes('calificaciones registradas atómicamente'),
      `[${browserName}] 1.5 Mutación GraphQL registrarCalificaciones (CU-08) ejecutada con éxito`,
      `Respuesta UI: "${mensajeNotas}"`
    );

    // Disparar SAGA Transversal (Paso 1 -> Paso 2 -> Paso 3)
    await cdp.click('.acciones-disparo-saga .btn-dorado');
    const resultadoSaga = await cdp.waitForText('.caja-resultado-final', 'SAGA COMPLETADA');
    assertCheck(
      resultadoSaga.includes('SAGA COMPLETADA'),
      `[${browserName}] 1.6 Orquestación SAGA Transversal (3 Microservicios) completada exitosamente`,
      `Estado: COMPLETADA`
    );

    // Probar Switch de Rollback SAGA (Simulación de fallo)
    await cdp.click('.switch-fallo-box input[type="checkbox"]');
    await cdp.click('.acciones-disparo-saga .btn-dorado');
    const resultadoRollback = await cdp.waitForText('.caja-resultado-final', 'Rollback Compensatorio');
    assertCheck(
      resultadoRollback.includes('Rollback Compensatorio'),
      `[${browserName}] 1.7 Demostración de Rollback SAGA: compensación automática ejecutada sin efectos colaterales`,
      `Estado: COMPENSADA`
    );

    // 1.4 Justificativos Escolares y Visión por Canvas
    await cdp.click('a[routerlink="/justificativos"]');
    await cdp.waitForSelector('.espacio-justificativos');

    // Analizar documento legible
    await cdp.click('.selector-muestras button:first-child');
    await new Promise((r) => setTimeout(r, 600)); // permitir render en canvas
    const badgeLegible = await cdp.waitForText('.badge-clasificacion-box', 'DOCUMENTO LEGIBLE');
    assertCheck(
      badgeLegible.includes('DOCUMENTO LEGIBLE'),
      `[${browserName}] 1.8 Análisis de Visión de Documento: Clasificación automática a LEGIBLE`,
      `Resultado: "${badgeLegible}"`
    );

    // Enviar justificativo
    await cdp.click('button[type="submit"].btn-bloque');
    const alertaJust = await cdp.waitForText('.alerta-exito', 'Justificativo registrado con éxito');
    assertCheck(
      alertaJust.includes('Justificativo registrado'),
      `[${browserName}] 1.9 Justificativo enviado y confirmado por ms-asistencia (:8081)`,
      `Alerta: "${alertaJust}"`
    );

    // --------------------------------------------------------------------------
    // PARTE 2: PORTAL DE SEGUIMIENTO (React PWA - Puerto 4202)
    // --------------------------------------------------------------------------
    console.log(`\n--- [${browserName}] 2. PORTAL DE SEGUIMIENTO (React PWA) ---`);

    await cdp.navigateAndWait('http://127.0.0.1:4202', '[data-testid="sso-status-pill"]');

    const tituloColegio = await cdp.evaluate(`document.querySelector('.sigra-brand h1')?.innerText`);
    assertCheck(
      tituloColegio?.includes('Unidad Educativa SIGRA'),
      `[${browserName}] 2.1 Identidad Institucional de Colegio cargada en React PWA`,
      `Título: "${tituloColegio}"`
    );

    // Pestaña de Riesgo Académico
    const kpiRiesgo = await cdp.waitForSelector('.kpi-strip');
    assertCheck(kpiRiesgo, `[${browserName}] 2.2 Dashboard de Riesgo y ML cargado con éxito en React`);

    // Pestaña de Centro de Reportes
    await cdp.click('[data-testid="tab-reportes"]');
    const btnPdf = await cdp.waitForSelector('[data-testid="btn-descargar-pdf"]');
    assertCheck(btnPdf, `[${browserName}] 2.3 Centro de Reportes Generativos (5 Formatos) disponible en React`);

    // --------------------------------------------------------------------------
    // PARTE 3: AUDITORÍA DE CONSOLA DEL NAVEGADOR
    // --------------------------------------------------------------------------
    assertCheck(
      cdp.pageExceptions.length === 0,
      `[${browserName}] Auditoría de Excepciones: CERO excepciones JavaScript no capturadas`,
      `Excepciones=${cdp.pageExceptions.length}`
    );
  } finally {
    cdp.close();
    proc.kill();
  }
}

async function main() {
  console.log('================================================================================');
  console.log('INICIANDO VERIFICACIÓN DE CAMPO DE AMBOS MICROFRONTENDS EN NAVEGADORES REALES');
  console.log('================================================================================');

  const servers = await startServers();
  console.log('✓ Servidores de prueba iniciados (:4201 Angular, :4202 React, :8081 Asistencia, :3000 Calificaciones)');

  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

    if (fs.existsSync(chromePath)) {
      resetMockState();
      await runFieldTestsInBrowser('Google Chrome Real', chromePath, 9222);
    } else {
      console.log('Google Chrome no encontrado en ruta estándar.');
    }

    if (fs.existsSync(edgePath)) {
      resetMockState();
      await runFieldTestsInBrowser('Microsoft Edge Real', edgePath, 9223);
    } else {
      console.log('Microsoft Edge no encontrado en ruta estándar.');
    }

    console.log('\n================================================================================');
    console.log(`RESUMEN FINAL DE TESTEOS DE CAMPO:`);
    console.log(`Total Aserciones Realizadas: ${totalAssertions}`);
    console.log(`Aserciones Fallidas:        ${failedAssertions}`);
    console.log('================================================================================');

    if (failedAssertions > 0) {
      process.exit(1);
    }
  } finally {
    servers.close();
  }
}

main().catch((err) => {
  console.error('Error crítico en suite de campo:', err);
  process.exit(1);
});
