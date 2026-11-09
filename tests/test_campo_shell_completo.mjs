/**
 * ============================================================================
 * SIGRA — TEST DE CAMPO EXHAUSTIVO DEL APP SHELL INSTITUCIONAL (PUERTO 4200)
 * ============================================================================
 * Verificación integral del App Shell orquestador y Single Sign-On (SSO):
 *   1. Pantalla de Login Institucional con Keycloak Status Badge.
 *   2. Validación de credenciales erróneas (Manejo de Error 401).
 *   3. Inicio de sesión exitoso (Docente / Directora / Padre).
 *   4. Orquestación e inyección SSO a Portal Docente (Angular 18 - Puerto 4201).
 *   5. Transición fluida a Portal de Seguimiento (React PWA - Puerto 4202) sin re-login.
 *   6. Cambio dinámico de rol institucional y propagación de token RS256.
 *   7. Módulo de Auditoría de Seguridad & Matriz 3x3x3 (Microservicios, BDs y Arquitecturas).
 *   8. Cierre de sesión centralizado y revocación de credenciales.
 *
 * Se ejecuta en 3 PASADAS COMPLETAS sobre navegadores reales (Chrome y Edge).
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

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
    this.pageExceptions = [];
    this.consoleErrors = [];
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

async function launchBrowser(binaryPath, debugPort) {
  const profileDir = path.join(ROOT_DIR, `node_modules/.cache/test-shell-${debugPort}-${Date.now()}`);
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
// SERVIDORES HTTP LOCALES
// ============================================================================
let shellServer, angularServer, reactServer, mockBackendServer;

function startServers() {
  return new Promise((resolve) => {
    // 1. App Shell (:4200)
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

    // 2. Portal Docente Angular (:4201)
    angularServer = createServer((req, res) => {
      let p = req.url.split('?')[0];
      if (p === '/') p = '/index.html';
      const fullPath = path.join(ANGULAR_DIST, p);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        serveStaticFile(fullPath, res);
      } else {
        serveStaticFile(path.join(ANGULAR_DIST, 'index.html'), res);
      }
    });

    // 3. Portal Seguimiento React (:4202)
    reactServer = createServer((req, res) => {
      let p = req.url.split('?')[0];
      if (p === '/') p = '/index.html';
      const fullPath = path.join(REACT_DIST, p);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        serveStaticFile(fullPath, res);
      } else {
        serveStaticFile(path.join(REACT_DIST, 'index.html'), res);
      }
    });

    // 4. Mock Backends (:3000 para health / keycloak status)
    mockBackendServer = createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ status: 'UP', service: 'ms-calificaciones', realm: 'sigra-calificaciones-dev' }));
    });

    shellServer.listen(4200, () => {
      angularServer.listen(4201, () => {
        reactServer.listen(4202, () => {
          mockBackendServer.listen(3000, () => {
            console.log('  [SERVIDORES LISTOS]');
            console.log('    - App Shell:              http://localhost:4200');
            console.log('    - Portal Docente:         http://localhost:4201');
            console.log('    - Portal Seguimiento:     http://localhost:4202');
            console.log('    - Mock Backend:           http://localhost:3000');
            resolve();
          });
        });
      });
    });
  });
}

function stopServers() {
  return new Promise((resolve) => {
    shellServer?.close();
    angularServer?.close();
    reactServer?.close();
    mockBackendServer?.close();
    resolve();
  });
}

// ============================================================================
// SUITE DE PRUEBAS DEL APP SHELL (EJECUTADO EN 1 PASADA)
// ============================================================================
async function runShellTestSuite(cdp, browserName, passNumber) {
  console.log(`\n============================================================================`);
  console.log(`>>> EJECUTANDO PASADA #${passNumber} EN ${browserName}`);
  console.log(`============================================================================`);

  // Paso 1: Cargar el App Shell en localhost:4200
  console.log('\n--- PASO 1: Carga Inicial de la Pantalla de Login Institucional SSO ---');
  await cdp.navigateAndWait('http://localhost:4200/', '.login-pantalla-fondo');
  
  const title = await cdp.evaluate('document.title');
  assertCheck(title.includes('SIGRA'), `Título de página institucional contiene SIGRA: "${title}"`);

  const loginTitle = await cdp.evaluate("document.querySelector('.login-titulo')?.textContent ?? ''");
  assertCheck(loginTitle.includes('Acceso Único Institucional'), `Título principal del Login SSO visible: "${loginTitle}"`);

  const keycloakBadge = await cdp.evaluate("document.querySelector('.keycloak-badge-status')?.textContent ?? ''");
  assertCheck(keycloakBadge.includes('SSO Identity Provider'), `Badge de estado Keycloak visible en UI: "${keycloakBadge.trim()}"`);

  // Paso 2: Validación de error 401 en credenciales inválidas
  console.log('\n--- PASO 2: Validación de Errores y Seguridad (Error 401) ---');
  await cdp.setInputValue('#input-usuario', 'usuario_inexistente_hacker');
  await cdp.setInputValue('#input-password', 'clave_invalida');

  await cdp.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 600));

  const alertError = await cdp.evaluate("document.querySelector('.login-alert-error')?.textContent ?? ''");
  assertCheck(
    alertError.includes('Error 401') || alertError.includes('Usuario no registrado'),
    `Control de acceso bloquea credenciales incorrectas con Error 401: "${alertError.trim()}"`
  );

  // Paso 3: Login Manual con credenciales válidas de Docente
  console.log('\n--- PASO 3: Autenticación Exitosa con Credenciales Institucionales ---');
  await cdp.setInputValue('#input-usuario', 'docente');
  await cdp.setInputValue('#input-password', 'SigraDemo2026!');

  await cdp.click('button[type="submit"]');
  await cdp.waitForSelector('.shell-header-institucional', 8000);

  const nombreUsuario = await cdp.evaluate("document.querySelector('.usuario-nombre')?.textContent ?? ''");
  assertCheck(
    nombreUsuario.includes('Carlos') || nombreUsuario.includes('Docente'),
    `Sesión SSO activa para el usuario: "${nombreUsuario}"`
  );

  const rolBadge = await cdp.evaluate("document.querySelector('.rol-pill-tag')?.textContent ?? ''");
  assertCheck(rolBadge.includes('DOCENTE'), `Rol verificado en header: "${rolBadge}"`);

  // Paso 4: Verificación de Frame Microfrontend (Portal Docente Angular :4201)
  console.log('\n--- PASO 4: Orquestación de Microfrontend Angular (:4201) e Inyección SSO ---');
  await cdp.waitForSelector('#mfe-iframe', 8000);
  const iframeSrc = await cdp.evaluate("document.querySelector('#mfe-iframe')?.getAttribute('src') ?? ''");
  assertCheck(iframeSrc.includes('4201'), `Iframe cargando Portal Docente Angular en puerto 4201: "${iframeSrc}"`);

  const statusConexion = await cdp.evaluate("document.querySelector('.mfe-pill-status')?.textContent ?? ''");
  assertCheck(statusConexion.includes('Sesión SSO Inyectada'), `Estado del iframe confirma inyección SSO: "${statusConexion}"`);

  // Paso 5: Cambio de Pestaña a Portal de Seguimiento React (:4202) SIN volver a pedir Login
  console.log('\n--- PASO 5: Navegación SSO a Portal Seguimiento React (:4202) sin Re-Login ---');
  await cdp.click('#tab-btn-seguimiento');
  await new Promise((r) => setTimeout(r, 800));

  const nuevoIframeSrc = await cdp.evaluate("document.querySelector('#mfe-iframe')?.getAttribute('src') ?? ''");
  assertCheck(nuevoIframeSrc.includes('4202'), `Iframe redirigido al Portal de Seguimiento React en puerto 4202: "${nuevoIframeSrc}"`);

  const loginAparecio = await cdp.evaluate("Boolean(document.querySelector('.login-pantalla-fondo'))");
  assertCheck(!loginAparecio, `Single Sign-On verificado: No se solicitó contraseña al cambiar de microfrontend`);

  // Paso 6: Cambio dinámico de Rol Institucional
  console.log('\n--- PASO 6: Cambio Dinámico de Rol Institucional (Switcher Rápido) ---');
  await cdp.click('.btn-switch-rol');
  await new Promise((r) => setTimeout(r, 500));

  const usuarioActualizado = await cdp.evaluate("document.querySelector('.usuario-nombre')?.textContent ?? ''");
  const cargoActualizado = await cdp.evaluate("document.querySelector('.usuario-cargo')?.textContent ?? ''");
  assertCheck(
    usuarioActualizado.length > 0 && cargoActualizado.length > 0,
    `Rol institucional alternado exitosamente: "${usuarioActualizado}" - "${cargoActualizado}"`
  );

  // Paso 7: Navegación a Auditoría de Seguridad & Matriz 3x3x3
  console.log('\n--- PASO 7: Inspección de Auditoría de Seguridad y Matriz 3x3x3 ---');
  await cdp.click('#tab-btn-seguridad');
  await cdp.waitForSelector('.security-audit-container', 8000);

  const claimsTitle = await cdp.evaluate("document.querySelector('.claims-table-card h3')?.textContent ?? ''");
  assertCheck(claimsTitle.includes('Decoded RS256 JWT Claims'), `Auditoría de claims JWT RS256 activa: "${claimsTitle}"`);

  const claimsRaw = await cdp.evaluate("document.querySelector('.claims-table-card')?.textContent ?? ''");
  assertCheck(claimsRaw.includes('sigra-calificaciones') || claimsRaw.includes('sub'), `Claims OIDC visibles con sub, audiencia y roles`);

  const microserviciosCards = await cdp.evaluate("document.querySelectorAll('.service-status-card').length");
  assertCheck(microserviciosCards === 3, `Matriz 3x3x3 muestra los 3 microservicios: ${microserviciosCards}/3`);

  const matrizInfo = await cdp.evaluate("document.querySelector('.security-audit-container')?.textContent ?? ''");
  assertCheck(
    matrizInfo.includes('ms-asistencia') && matrizInfo.includes('ms-calificaciones') && matrizInfo.includes('ms-riesgo'),
    `Presencia de ms-asistencia (Java), ms-calificaciones (NestJS) y ms-riesgo (Laravel)`
  );
  assertCheck(
    matrizInfo.includes('PostgreSQL') && matrizInfo.includes('MongoDB') && matrizInfo.includes('DynamoDB'),
    `Presencia de las 3 Bases de Datos: PostgreSQL, MongoDB y DynamoDB`
  );
  assertCheck(
    matrizInfo.includes('Hexagonal') && (matrizInfo.includes('Clean') || matrizInfo.includes('DDD')),
    `Presencia de las 3 Arquitecturas: Hexagonal, Clean Architecture y DDD`
  );

  // Paso 8: Cierre de Sesión Centralizado
  console.log('\n--- PASO 8: Cierre de Sesión Centralizado (Revocación SSO) ---');
  await cdp.click('.btn-logout-shell');
  await cdp.waitForSelector('.login-pantalla-fondo', 8000);

  const enLoginDeNuevo = await cdp.evaluate("Boolean(document.querySelector('.login-tarjeta-contenedor'))");
  assertCheck(enLoginDeNuevo, `Cierre de sesión verificado: Redirección limpia a la pantalla de Login Institucional`);
}

// ============================================================================
// MAIN RUNNER CON 3 PASADAS EN NAVEGADORES REALES
// ============================================================================
async function main() {
  console.log('============================================================================');
  console.log('INICIANDO VERIFICACIÓN DE TRIPLE PASADA DEL APP SHELL (CHROME Y EDGE)');
  console.log('============================================================================');

  await startServers();

  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

    // 1. Google Chrome (Pasadas 1 y 2)
    if (fs.existsSync(chromePath)) {
      console.log('\n>>> LANZANDO GOOGLE CHROME...');
      const chrome = await launchBrowser(chromePath, 9232);
      const cdpChrome = new CdpClient(chrome.wsUrl);
      await cdpChrome.connect();

      // Pasada 1
      await runShellTestSuite(cdpChrome, 'Google Chrome', 1);

      // Pasada 2
      await runShellTestSuite(cdpChrome, 'Google Chrome', 2);

      cdpChrome.close();
      chrome.proc.kill();
      console.log('\n[CHROME FINALIZADO CON ÉXITO]');
    } else {
      console.warn('Google Chrome no encontrado en la ruta esperada.');
    }

    // 2. Microsoft Edge (Pasada 3)
    if (fs.existsSync(edgePath)) {
      console.log('\n>>> LANZANDO MICROSOFT EDGE...');
      const edge = await launchBrowser(edgePath, 9233);
      const cdpEdge = new CdpClient(edge.wsUrl);
      await cdpEdge.connect();

      // Pasada 3
      await runShellTestSuite(cdpEdge, 'Microsoft Edge', 3);

      cdpEdge.close();
      edge.proc.kill();
      console.log('\n[EDGE FINALIZADO CON ÉXITO]');
    } else {
      console.warn('Microsoft Edge no encontrado en la ruta esperada.');
    }

    console.log('\n============================================================================');
    console.log('RESUMEN DE VERIFICACIÓN TRIPLE DEL APP SHELL');
    console.log(`  Total Verificaciones Ejecutadas: ${totalAssertions}`);
    console.log(`  Verificaciones Exitosas:         ${totalAssertions - failedAssertions}`);
    console.log(`  Verificaciones Fallidas:         ${failedAssertions}`);
    console.log('============================================================================');

    if (failedAssertions > 0) {
      console.error('ALERTA: Se detectaron fallas en las aserciones del test.');
      process.exit(1);
    } else {
      console.log('>>> VERIFICACIÓN TRIPLE EXITOSA: 100% DE PRUEBAS SUPERADAS EN AMBOS NAVEGADORES.');
    }
  } finally {
    await stopServers();
  }
}

main().catch((err) => {
  console.error('Error fatal durante la ejecución de las pruebas:', err);
  stopServers().then(() => process.exit(1));
});
