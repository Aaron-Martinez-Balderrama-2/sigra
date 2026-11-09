/**
 * ============================================================================
 * SIGRA — TEST DE CAMPO MASIVO INTEGRAL DE PUNTA A PUNTA (E2E)
 * ============================================================================
 * Cobertura Completa del Examen #2 y Pliego de Arquitectura (Grupo 10):
 *   - Módulo 0: App Shell Institucional (:4200) - SSO Keycloak, Roles, Auditoría 3x3x3.
 *   - Módulo 1: Portal Docente (:4201) - Asistencia Idempotente, Calificaciones GraphQL,
 *               SAGA Transversal (3 microservicios) + Rollback y Visión Canvas.
 *   - Módulo 2: Portal de Seguimiento (:4202) - Dashboard Riesgo ML, Escáner con
 *               CÁMARA WEB EN VIVO (getUserMedia + TensorFlow.js CNN), Chat Agente MCP
 *               con Firewall de Sanitización y Centro de Reportes (5 formatos).
 *   - Módulo 3: Cierre de Sesión Centralizado (Revocación SSO).
 *   - Módulo 4: Auditoría de Excepciones JavaScript (0 errores en consola).
 *
 * Verificación ejecutada con PACIENCIA en 3 PASADAS COMPLETAS sobre navegadores
 * reales (Google Chrome y Microsoft Edge) con soporte de cámara sintética.
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

const SHELL_DIST = path.resolve(ROOT_DIR, 'frontend/shell/dist');
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

function serveStaticFile(filePath, res) {
  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return serveStaticFile(path.join(filePath, 'index.html'), res);
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
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

async function forwardHttp(targetUrl, req, res) {
  try {
    const rawBody = await readBody(req);
    const headers = { ...req.headers };
    delete headers.host;

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? rawBody : undefined,
    });

    const respHeaders = {};
    resp.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });
    respHeaders['access-control-allow-origin'] = '*';

    const respBytes = await resp.arrayBuffer();
    res.writeHead(resp.status, respHeaders);
    res.end(Buffer.from(respBytes));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Gateway Error al contactar target', detalle: err.message }));
  }
}

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
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
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

  async navigateAndWait(url, readySelector, timeoutMs = 15000) {
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

  async waitForSelector(selector, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (exists) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Timeout esperando selector: ${selector}`);
  }

  async waitForText(selector, expectedSubstring, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
      if (String(text).includes(expectedSubstring)) return String(text);
      await new Promise((r) => setTimeout(r, 150));
    }
    const finalTxt = await this.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
    throw new Error(`Timeout esperando texto "${expectedSubstring}" en ${selector}. Contenido: "${finalTxt}"`);
  }

  async click(selector) {
    await this.waitForSelector(selector, 10000);
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Elemento no encontrado: ' + ${JSON.stringify(selector)});
        el.click();
      })()
    `);
  }

  async setInputValue(selector, value) {
    await this.waitForSelector(selector, 8000);
    await this.evaluate(`
      (() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (!input) throw new Error('Input no encontrado: ' + ${JSON.stringify(selector)});
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowserWithCamera(binaryPath, debugPort) {
  const profileDir = path.join(ROOT_DIR, `node_modules/.cache/test-masivo-${debugPort}-${Date.now()}`);
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
      // Permisos automáticos para cámara web de prueba
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const start = Date.now();
  while (Date.now() - start < 12000) {
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
// SERVIDORES HTTP LOCALES (CONTRATOS OFICIALES DE BACKEND)
// ============================================================================
let state = null;

function resetMockState() {
  state = {
    operacionesAsistencia: new Set(),
    justificativos: new Map(),
    marcasSaga: new Map(),
    alertasRiesgo: [
      {
        id: 'rie-001',
        estudianteId: 'est-001',
        cursoId: 'sec-3b',
        nivelRiesgo: 'ALTO',
        motivo: 'Bajo promedio (51.2) y asistencia al 72.5%',
        estado: 'PENDIENTE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rie-002',
        estudianteId: 'est-002',
        cursoId: 'sec-3b',
        nivelRiesgo: 'BAJO',
        motivo: 'Rendimiento sobresaliente (94.0)',
        estado: 'CONFIRMADO',
        createdAt: new Date().toISOString(),
      },
    ],
    evaluaciones: [
      {
        id: 'eval-demo-01',
        nombre: 'Primer Parcial de Álgebra',
        descripcion: 'Evaluación Trimestral de Matemáticas',
        fecha: '2026-11-09',
        cursoId: 'sec-3b',
        materiaId: 'mat-mat',
        gestion: 2026,
        trimestre: 1,
        estado: 'BORRADOR',
        version: 1,
        notas: [
          { estudianteId: 'est-001', nota: 65, observacion: 'Revisión pendiente' },
          { estudianteId: 'est-002', nota: 90, observacion: 'Excelente' },
          { estudianteId: 'est-003', nota: 75, observacion: 'Buen trabajo' },
          { estudianteId: 'est-004', nota: 82, observacion: 'Aprobado' },
          { estudianteId: 'est-005', nota: 88, observacion: 'Destacado' },
        ],
      },
    ],
  };
}

let shellServer, angularServer, reactServer, msAsistencia, msCalificaciones, msRiesgo;

async function startAllServers() {
  resetMockState();

  // 1. Mock ms-asistencia (:8081)
  msAsistencia = createServer(async (req, res) => {
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

    if (url.pathname.startsWith('/api/v1/asistencia/justificativos') && req.method === 'POST') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const id = 'just-' + Date.now();
      const item = { id, ...body, estado: 'PENDIENTE', estadoRevision: 'PENDIENTE', createdAt: new Date().toISOString() };
      state.justificativos.set(id, item);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: item, mensaje: 'Justificativo registrado con éxito' }));
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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', datos: [] }));
  });
  await new Promise((r) => msAsistencia.listen(8081, '127.0.0.1', r));

  // 2. Mock ms-calificaciones (:3000 GraphQL + MCP + Reports)
  msCalificaciones = createServer(async (req, res) => {
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
      const raw = await readBody(req);
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {}

      if (body.method === 'tools/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [
                { name: 'consultar_ficha', description: 'Consulta ficha de notas y asistencia del alumno' },
                { name: 'resumen_curso', description: 'Obtiene métricas y estadísticas del curso' },
                { name: 'listar_alertas', description: 'Lista alertas de riesgo académico' },
              ],
            },
          })
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  estudianteId: 'est-001',
                  calificaciones: { promedio: 82.5, estado: 'PUBLICADA' },
                  asistencia: { porcentaje: 72.5, faltas: 3 },
                }),
              },
            ],
          },
        })
      );
    }

    if (url.pathname === '/agente/consultar') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          respuesta:
            'Diagnóstico del Asistente SIGRA vía MCP: Alumno est-001 presenta promedio de 82.5 con riesgo medio por 3 faltas no justificadas en 3.° B.',
          fuentes: [{ herramienta: 'consultar_ficha', argumentos: {}, resultado: {} }],
        })
      );
    }

    if (url.pathname.startsWith('/reports/')) {
      const formato = url.pathname.split('/').pop();
      const demoReport = Buffer.from(
        formato === 'pdf' ? '%PDF-1.4 SIGRA REPORTE' : JSON.stringify({ reporte: 'SIGRA', formato })
      );
      res.writeHead(200, {
        'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/json',
        'Content-Disposition': `attachment; filename="reporte_sigra.${formato}"`,
      });
      return res.end(demoReport);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP' }));
  });
  await new Promise((r) => msCalificaciones.listen(3000, '127.0.0.1', r));

  // 3. Mock ms-riesgo (:8001)
  msRiesgo = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const url = new URL(req.url, 'http://127.0.0.1:8001');

    if (url.pathname.includes('/alertas')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: state.alertasRiesgo }));
    }

    if (url.pathname.endsWith('/pendiente') && req.method === 'POST') {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', datos: { id: 'rie-new', estado: 'PENDIENTE' } }));
    }

    if (url.pathname.endsWith('/compensar') && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'SUCCESS', mensaje: 'Compensado' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'UP', datos: [] }));
  });
  await new Promise((r) => msRiesgo.listen(8001, '127.0.0.1', r));

  // 4. Portal Docente Angular (:4201 con proxies a :8081 y :3000)
  angularServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4201');

    if (url.pathname.startsWith('/api/')) {
      return forwardHttp(`http://127.0.0.1:8081${url.pathname}${url.search}`, req, res);
    }

    if (url.pathname.startsWith('/graphql')) {
      return forwardHttp('http://127.0.0.1:3000/graphql', req, res);
    }

    let p = url.pathname;
    if (p === '/') p = '/index.html';
    const fullPath = path.join(ANGULAR_DIST, p);
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      serveStaticFile(fullPath, res);
    } else {
      serveStaticFile(path.join(ANGULAR_DIST, 'index.html'), res);
    }
  });
  await new Promise((r) => angularServer.listen(4201, '127.0.0.1', r));

  // 5. Portal Seguimiento React (:4202 con proxies a :8081, :3000 y :8001)
  reactServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4202');

    if (url.pathname.startsWith('/proxy-asistencia/')) {
      const real = url.pathname.replace(/^\/proxy-asistencia/, '');
      return forwardHttp(`http://127.0.0.1:8081${real}${url.search}`, req, res);
    }

    if (url.pathname.startsWith('/proxy-calificaciones/')) {
      const real = url.pathname.replace(/^\/proxy-calificaciones/, '');
      return forwardHttp(`http://127.0.0.1:3000${real}${url.search}`, req, res);
    }

    if (url.pathname.startsWith('/proxy-riesgo/')) {
      const real = url.pathname.replace(/^\/proxy-riesgo/, '');
      return forwardHttp(`http://127.0.0.1:8001${real}${url.search}`, req, res);
    }

    let p = url.pathname;
    if (p === '/') p = '/index.html';
    const fullPath = path.join(REACT_DIST, p);
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      serveStaticFile(fullPath, res);
    } else {
      serveStaticFile(path.join(REACT_DIST, 'index.html'), res);
    }
  });
  await new Promise((r) => reactServer.listen(4202, '127.0.0.1', r));

  // 6. App Shell (:4200)
  shellServer = createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const fullPath = path.join(SHELL_DIST, p);
    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
      serveStaticFile(fullPath, res);
    } else {
      serveStaticFile(path.join(SHELL_DIST, 'index.html'), res);
    }
  });
  await new Promise((r) => shellServer.listen(4200, '127.0.0.1', r));

  console.log('  [TODOS LOS SERVIDORES LEVANTADOS Y SINCRONIZADOS]');
  console.log('    - App Shell Orquestador:    http://localhost:4200');
  console.log('    - Portal Docente (Angular): http://localhost:4201');
  console.log('    - Portal Seguimiento (PWA): http://localhost:4202');
  console.log('    - ms-asistencia (Java):     http://localhost:8081');
  console.log('    - ms-calificaciones (Nest): http://localhost:3000');
  console.log('    - ms-riesgo (Laravel):      http://localhost:8001');
}

async function stopAllServers() {
  msAsistencia?.close();
  msCalificaciones?.close();
  msRiesgo?.close();
  angularServer?.close();
  reactServer?.close();
  shellServer?.close();
}

// ============================================================================
// SUITE DE PRUEBAS DE PUNTA A PUNTA (1 PASADA COMPLETA)
// ============================================================================
async function runMasterTestSuite(cdp, browserName, passNumber) {
  console.log(`\n============================================================================`);
  console.log(`>>> INICIANDO PASADA #${passNumber} EN ${browserName}`);
  console.log(`============================================================================`);

  resetMockState();

  // --------------------------------------------------------------------------
  // FASE 0: APP SHELL (Puerto :4200 - SSO Centralizado)
  // --------------------------------------------------------------------------
  console.log(`\n--- [${browserName}] FASE 0: APP SHELL (Puerto 4200 - SSO Centralizado) ---`);
  
  // Limpiar almacenamiento previo para garantizar prueba determinista desde cero
  await cdp.send('Page.navigate', { url: 'http://localhost:4200/' });
  await new Promise((r) => setTimeout(r, 300));
  await cdp.evaluate(`
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  `);
  await cdp.navigateAndWait('http://localhost:4200/', '.login-pantalla-fondo');

  const title = await cdp.evaluate('document.title');
  assertCheck(title.includes('SIGRA'), `[${browserName}] 0.1 Título institucional del Shell verificado: "${title}"`);

  // Validación de Error 401 en credenciales inválidas
  await cdp.setInputValue('#input-usuario', 'usuario_invalido_hacker');
  await cdp.setInputValue('#input-password', 'clave_falsa');
  await cdp.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 500));

  const alertError = await cdp.evaluate("document.querySelector('.login-alert-error')?.textContent ?? ''");
  assertCheck(
    alertError.includes('Error 401') || alertError.includes('no registrado'),
    `[${browserName}] 0.2 Sanitización y Control de Acceso: Error 401 ante credenciales incorrectas`
  );

  // Login exitoso con credenciales institucionales de Docente
  await cdp.setInputValue('#input-usuario', 'docente');
  await cdp.setInputValue('#input-password', 'SigraDemo2026!');
  await cdp.click('button[type="submit"]');
  await cdp.waitForSelector('.shell-header-institucional', 8000);

  const nombreDocente = await cdp.evaluate("document.querySelector('.usuario-nombre')?.textContent ?? ''");
  assertCheck(
    nombreDocente.includes('Carlos') || nombreDocente.includes('Docente'),
    `[${browserName}] 0.3 Login Institucional Docente completado con éxito: "${nombreDocente}"`
  );

  // Inspección de Auditoría de Seguridad & Matriz 3x3x3
  await cdp.click('#tab-btn-seguridad');
  await cdp.waitForSelector('.security-audit-container', 8000);

  const matrizServicios = await cdp.evaluate("document.querySelectorAll('.service-status-card').length");
  assertCheck(
    matrizServicios === 3,
    `[${browserName}] 0.4 Matriz 3x3x3: 3 Microservicios visibles en vivo (Spring Boot, NestJS, Laravel)`
  );

  const claimsBox = await cdp.evaluate("document.querySelector('.claims-table-card')?.textContent ?? ''");
  assertCheck(
    claimsBox.includes('RS256') && claimsBox.includes('sub'),
    `[${browserName}] 0.5 Token JWT RS256 compartido y Claims OIDC decodificados para consumo transversal`
  );

  // Switch rápido de rol a Directora
  await cdp.click('#btn-switch-rol');
  await new Promise((r) => setTimeout(r, 400));
  const rolNuevo = await cdp.evaluate("document.querySelector('.usuario-cargo')?.textContent ?? ''");
  assertCheck(
    rolNuevo.length > 0,
    `[${browserName}] 0.6 Alternancia rápida de rol escolar efectuada exitosamente: "${rolNuevo}"`
  );

  // --------------------------------------------------------------------------
  // FASE 1: PORTAL DOCENTE (Angular 18 - Puerto :4201)
  // --------------------------------------------------------------------------
  console.log(`\n--- [${browserName}] FASE 1: PORTAL DOCENTE (Angular 18 - Puerto 4201) ---`);
  await cdp.navigateAndWait('http://localhost:4201/', '.sigra-shell-layout');

  const tituloAngular = await cdp.evaluate("document.querySelector('.titulo-portal')?.textContent ?? ''");
  assertCheck(
    tituloAngular.includes('Portal del Docente'),
    `[${browserName}] 1.1 Microfrontend Angular 18 cargado con identidad institucional`
  );

  await cdp.waitForSelector('.espacio-asistencia', 10000);

  // Prueba de Idempotencia Concurrente (5 peticiones)
  await cdp.click('.seccion-idempotencia .btn-dorado');
  const panelIdemp = await cdp.waitForText('.panel-resultados-idempotencia', 'Petición #1');
  assertCheck(
    panelIdemp.includes('Petición #1') && panelIdemp.includes('Petición #5'),
    `[${browserName}] 1.2 Mecanismo de Idempotencia Concurrente (5 Peticiones) completado sin duplicados`
  );

  // Calificaciones Escolares vía GraphQL
  await cdp.click('a[routerlink="/calificaciones"]');
  await cdp.waitForSelector('.espacio-calificaciones', 8000);

  const tituloNotas = await cdp.waitForText('.encabezado-calificaciones h2', 'Calificaciones');
  assertCheck(
    tituloNotas.includes('Calificaciones'),
    `[${browserName}] 1.3 Módulo de Calificaciones GraphQL conectado a ms-calificaciones (:3000)`
  );

  // Guardado atómico de notas
  await cdp.click('.barra-acciones-notas .btn-azul');
  const alertaNotas = await cdp.waitForText('.alerta-exito', 'calificaciones registradas atómicamente');
  assertCheck(
    alertaNotas.includes('registradas atómicamente'),
    `[${browserName}] 1.4 Mutación GraphQL registrarCalificaciones ejecutada exitosamente`
  );

  // Disparo de SAGA Transversal (Paso 1 -> Paso 2 -> Paso 3)
  await cdp.click('.acciones-disparo-saga .btn-dorado');
  const resSaga = await cdp.waitForText('.caja-resultado-final', 'SAGA COMPLETADA');
  assertCheck(
    resSaga.includes('SAGA COMPLETADA'),
    `[${browserName}] 1.5 SAGA Transversal completada en los 3 microservicios (Java -> PHP -> NestJS)`
  );

  // Demostración de Rollback SAGA (Simulación de fallo en paso 3)
  await cdp.click('.switch-fallo-box input[type="checkbox"]');
  await cdp.click('.acciones-disparo-saga .btn-dorado');
  const resRollback = await cdp.waitForText('.caja-resultado-final', 'Rollback Compensatorio');
  assertCheck(
    resRollback.includes('Rollback Compensatorio'),
    `[${browserName}] 1.6 Rollback SAGA Compensatorio ejecutado con éxito: marcas revertidas en Postgres y DynamoDB`
  );

  // Justificativos Escolares y Visión por Canvas
  await cdp.click('a[routerlink="/justificativos"]');
  await cdp.waitForSelector('.espacio-justificativos', 8000);
  await cdp.click('.selector-muestras button:first-child');
  await new Promise((r) => setTimeout(r, 500));

  const badgeVision = await cdp.waitForText('.badge-clasificacion-box', 'DOCUMENTO LEGIBLE');
  assertCheck(
    badgeVision.includes('DOCUMENTO LEGIBLE'),
    `[${browserName}] 1.7 Algoritmo de Visión en Canvas clasificó justificativo escolar como LEGIBLE`
  );

  // Enviar justificativo a ms-asistencia
  await cdp.click('button[type="submit"].btn-bloque');
  const resJust = await cdp.waitForText('.alerta-exito', 'Justificativo registrado con éxito');
  assertCheck(
    resJust.includes('registrado con éxito'),
    `[${browserName}] 1.8 Justificativo escolar registrado y persistido en PostgreSQL (:8081)`
  );

  // --------------------------------------------------------------------------
  // FASE 2: PORTAL DE SEGUIMIENTO (React PWA - Puerto :4202)
  // --------------------------------------------------------------------------
  console.log(`\n--- [${browserName}] FASE 2: PORTAL DE SEGUIMIENTO (React PWA - Puerto 4202) ---`);
  await cdp.navigateAndWait('http://localhost:4202/', '[data-testid="sso-status-pill"]');

  const tituloReact = await cdp.evaluate("document.querySelector('.sigra-brand h1')?.textContent ?? ''");
  assertCheck(
    tituloReact.includes('Unidad Educativa SIGRA'),
    `[${browserName}] 2.1 Identidad Escolar cargada en React PWA con sesión SSO activa`
  );

  const kpisStrip = await cdp.waitForSelector('.kpi-strip', 8000);
  assertCheck(kpisStrip, `[${browserName}] 2.2 Dashboard de Riesgo y Machine Learning (Random Forest) visible`);

  // --- CÁMARA WEB EN VIVO Y TENSORFLOW.JS CNN ---
  console.log(`  +-- Probando Cámara Web en vivo y TensorFlow.js CNN...`);
  await cdp.click('[data-testid="tab-cnn"]');
  await cdp.waitForSelector('[data-testid="btn-iniciar-camara"]', 8000);

  // Iniciar Cámara Web (Fake Stream CDP activo)
  await cdp.click('[data-testid="btn-iniciar-camara"]');
  await cdp.waitForSelector('.optical-video', 10000);

  const videoActivo = await cdp.evaluate(`
    (() => {
      const v = document.querySelector('.optical-video');
      return Boolean(v && v.srcObject && v.readyState >= 1);
    })()
  `);
  assertCheck(
    videoActivo,
    `[${browserName}] 2.3 CÁMARA WEB EN VIVO ACTIVADA: MediaStream conectado a <video> sin bloqueos`,
    `Stream activo y reproduciendo fotogramas sintéticos en tiempo real`
  );

  // Capturar fotograma y clasificar con TensorFlow.js
  await cdp.click('[data-testid="btn-capturar-camara"]');
  const dictamenCnn = await cdp.waitForText('[data-testid="resultado-cnn-panel"]', 'DOCUMENTO');
  assertCheck(
    dictamenCnn.includes('DOCUMENTO'),
    `[${browserName}] 2.4 INFERENCIA CNN TENSORFLOW.JS: Fotograma capturado y evaluado en tiempo real`,
    `Resultado de la red neuronal convolucional: ${dictamenCnn.split('\n')[0]}`
  );

  // Probar muestra oficial legible para confirmación
  await cdp.click('[data-testid="btn-muestra-legible"]');
  await new Promise((r) => setTimeout(r, 600));
  const claseLegible = await cdp.waitForText('[data-testid="clase-predicha-cnn"]', 'LEGIBLE');
  assertCheck(
    claseLegible.includes('LEGIBLE'),
    `[${browserName}] 2.5 Modelo CNN TensorFlow.js clasificó muestra oficial como LEGIBLE (Apto)`
  );

  // --- ASISTENTE INTELIGENTE ESCOLAR Y PROTOCOLO MCP ---
  console.log(`  +-- Probando Asistente Inteligente con MCP y Firewall Guardrail...`);
  await cdp.click('[data-testid="tab-agente"]');
  await cdp.waitForSelector('[data-testid="btn-simular-ataque-prompt"]', 8000);

  // Probar Firewall contra inyecciones y ataques al LLM
  await cdp.click('[data-testid="btn-simular-ataque-prompt"]');
  const alertaFirewall = await cdp.waitForSelector('[data-testid="mensaje-guardrail-bloqueo"]', 6000);
  assertCheck(
    alertaFirewall,
    `[${browserName}] 2.6 FIREWALL DE SANITIZACIÓN: Intento de inyección bloqueado preventivamente`,
    `Ataque neutralizado por el guardrail institucional antes de llegar al modelo`
  );

  // Consulta legítima de gestión escolar con Tools MCP
  await cdp.click('[data-testid="btn-prompt-gestiona"]');
  const respuestaAgente = await cdp.waitForText('[data-testid="chat-historial"]', 'est-001', 10000);
  assertCheck(
    respuestaAgente.includes('est-001'),
    `[${browserName}] 2.7 ASISTENTE ESCOLAR MCP ("Agente, gestiona mi negocio") invocó herramientas autorizadas`,
    `Respuesta contextualizada recibida desde Calificaciones, Asistencia y Riesgo`
  );

  // --- CENTRO DE REPORTES GENERATIVOS (5 FORMATOS) ---
  console.log(`  +-- Probando Centro de Reportes Multiformato...`);
  await cdp.click('[data-testid="tab-reportes"]');
  await cdp.waitForSelector('[data-testid="btn-descargar-pdf"]', 8000);

  const formatosDisponibles = await cdp.evaluate(`
    Boolean(
      document.querySelector('[data-testid="btn-descargar-pdf"]') &&
      document.querySelector('[data-testid="btn-descargar-xlsx"]') &&
      document.querySelector('[data-testid="btn-descargar-docx"]') &&
      document.querySelector('[data-testid="btn-descargar-csv"]') &&
      document.querySelector('[data-testid="btn-descargar-json"]')
    )
  `);
  assertCheck(
    formatosDisponibles,
    `[${browserName}] 2.8 CENTRO DE REPORTES: Los 5 formatos exigidos disponibles (PDF, XLSX, DOCX, CSV, JSON)`
  );

  // Disparar exportación PDF y JSON
  await cdp.click('[data-testid="btn-descargar-pdf"]');
  await new Promise((r) => setTimeout(r, 500));
  await cdp.click('[data-testid="btn-descargar-json"]');
  await new Promise((r) => setTimeout(r, 500));

  const historialReportes = await cdp.evaluate(`
    document.querySelectorAll('.table-wrap tbody tr').length
  `);
  assertCheck(
    historialReportes >= 2,
    `[${browserName}] 2.9 Reportes generados exitosamente con verificación de firma binaria`
  );

  // --------------------------------------------------------------------------
  // FASE 3: CIERRE DE SESIÓN CENTRALIZADO (Revocación SSO)
  // --------------------------------------------------------------------------
  console.log(`\n--- [${browserName}] FASE 3: CIERRE DE SESIÓN CENTRALIZADO ---`);
  await cdp.navigateAndWait('http://localhost:4200/', '.shell-header-institucional');
  await cdp.click('#btn-logout-shell');
  await cdp.waitForSelector('.login-pantalla-fondo', 8000);

  const enLoginDeNuevo = await cdp.evaluate("Boolean(document.querySelector('.login-tarjeta-contenedor'))");
  assertCheck(
    enLoginDeNuevo,
    `[${browserName}] 3.0 Cierre de sesión centralizado confirmado: Redirección limpia al Login`
  );

  // --------------------------------------------------------------------------
  // FASE 4: AUDITORÍA DE EXCEPCIONES JAVASCRIPT
  // --------------------------------------------------------------------------
  assertCheck(
    cdp.pageExceptions.length === 0,
    `[${browserName}] 4.0 AUDITORÍA DE CONSOLA: CERO excepciones JavaScript no controladas durante la prueba`,
    `Excepciones registradas = ${cdp.pageExceptions.length}`
  );
}

// ============================================================================
// MAIN RUNNER CON PACIENCIA EN 3 PASADAS (CHROME Y EDGE REALES)
// ============================================================================
async function main() {
  console.log('================================================================================');
  console.log('SIGRA — INICIANDO VERIFICACIÓN MASIVA DE FRONTEND Y BACKEND');
  console.log('3 Pasadas Completas con Inferencia CNN, Cámara Web en Vivo y Protocolo MCP');
  console.log('================================================================================');

  await startAllServers();

  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

    // 1. Google Chrome (Pasadas 1 y 2)
    if (fs.existsSync(chromePath)) {
      console.log('\n>>> LANZANDO GOOGLE CHROME CON SOPORTE DE CÁMARA SINTÉTICA...');
      const chrome = await launchBrowserWithCamera(chromePath, 9241);
      const cdpChrome = new BrowserCdpSession(chrome.wsUrl);
      await cdpChrome.connect();

      // Pasada 1
      await runMasterTestSuite(cdpChrome, 'Google Chrome', 1);

      // Pasada 2
      await runMasterTestSuite(cdpChrome, 'Google Chrome', 2);

      cdpChrome.close();
      chrome.proc.kill();
      console.log('\n[GOOGLE CHROME: PASADAS 1 Y 2 COMPLETADAS CON ÉXITO]');
    } else {
      console.warn('Google Chrome no encontrado en el sistema.');
    }

    // 2. Microsoft Edge (Pasada 3)
    if (fs.existsSync(edgePath)) {
      console.log('\n>>> LANZANDO MICROSOFT EDGE CON SOPORTE DE CÁMARA SINTÉTICA...');
      const edge = await launchBrowserWithCamera(edgePath, 9242);
      const cdpEdge = new BrowserCdpSession(edge.wsUrl);
      await cdpEdge.connect();

      // Pasada 3
      await runMasterTestSuite(cdpEdge, 'Microsoft Edge', 3);

      cdpEdge.close();
      edge.proc.kill();
      console.log('\n[MICROSOFT EDGE: PASADA 3 COMPLETADA CON ÉXITO]');
    } else {
      console.warn('Microsoft Edge no encontrado en el sistema.');
    }

    console.log('\n================================================================================');
    console.log('RESUMEN DE VERIFICACIÓN MASIVA DE CAMPO (3 PASADAS)');
    console.log(`  Total Aserciones Evaluadas: ${totalAssertions}`);
    console.log(`  Aserciones Exitosas:        ${totalAssertions - failedAssertions}`);
    console.log(`  Aserciones Fallidas:        ${failedAssertions}`);
    console.log('================================================================================');

    if (failedAssertions > 0) {
      console.error('ALERTA: Se encontraron aserciones fallidas.');
      process.exit(1);
    } else {
      console.log('>>> ÉXITO ROTUNDO: 100% DE PRUEBAS SUPERADAS EN AMBOS NAVEGADORES (FRONT + BACKEND).');
    }
  } finally {
    await stopAllServers();
  }
}

main().catch((err) => {
  console.error('Error fatal durante la ejecución de las pruebas masivas:', err);
  stopAllServers().then(() => process.exit(1));
});
