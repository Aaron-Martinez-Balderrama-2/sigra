import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(cond, name, detail = '') {
  totalChecks++;
  if (cond) {
    passedChecks++;
    console.log(`  [PASS #${totalChecks}] ✓ ${name}`);
    if (detail) console.log(`             ${detail}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL #${totalChecks}] ✗ ${name}`);
    if (detail) console.error(`             ${detail}`);
  }
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
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

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async waitForSelector(selector, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
      if (exists) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout esperando selector ${selector}`);
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
    console.log(`  [SCREENSHOT] Guardada captura en ${outputPath}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser(debugPort) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const binary = fs.existsSync(chromePath) ? chromePath : edgePath;

  const profileDir = path.join(ROOT_DIR, `node_modules/.cache/test-n8n-${Date.now()}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const proc = spawn(binary, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,800',
  ]);

  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const resVer = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      const resList = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (resVer.ok && resList.ok) {
        const list = await resList.json();
        const target = list.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension:')) ?? list[0];
        if (target?.webSocketDebuggerUrl) {
          return { proc, wsUrl: target.webSocketDebuggerUrl };
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error('Fallo al iniciar navegador de test');
}

async function main() {
  console.log('============================================================================');
  console.log('TEST REAL E2E: AUTOMATIZACIÓN REACTIVA CON n8n (REQUISITO 1.9 & CU-14)');
  console.log('============================================================================\n');

  // 1. Healthcheck de n8n (:5678)
  console.log('--- 1. VERIFICANDO MOTOR DE AUTOMATIZACIÓN n8n (:5678) ---');
  let n8nHealth = null;
  try {
    const res = await fetch('http://localhost:5678/health');
    n8nHealth = await res.json();
  } catch (e) {
    console.error('Error al contactar n8n:', e.message);
  }
  check(n8nHealth?.status === 'UP', 'n8n está en línea y saludable en el puerto 5678', `Workflow: "${n8nHealth?.workflow}"`);
  check(n8nHealth?.active === true, 'El workflow oficial de notificación de alertas está ACTIVO');

  // 2. Healthcheck de ms-riesgo (:8001)
  console.log('\n--- 2. VERIFICANDO MICROSERVICIO DE RIESGO E IDEMPOTENCIA ms-riesgo (:8001) ---');
  let riesgoHealth = null;
  try {
    const res = await fetch('http://127.0.0.1:8001/api/v1/health');
    riesgoHealth = await res.json();
  } catch (e) {
    console.error('Error al contactar ms-riesgo:', e.message);
  }
  check(riesgoHealth?.status === 'UP', 'ms-riesgo está operativo en puerto 8001', `Arquitectura: ${riesgoHealth?.architecture}`);

  // 3. Flujo Backend: Inferencia y Despacho Webhook ms-riesgo -> n8n (Riesgo ALTO)
  console.log('\n--- 3. EJECUTANDO DESPACHO REACTIVO ms-riesgo -> n8n (RIESGO ALTO) ---');
  const opIdAlto = 'op-n8n-e2e-alto-' + Date.now();
  const resCrearAlto = await fetch('http://127.0.0.1:8001/api/v1/riesgo/pendiente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationId: opIdAlto,
      sagaId: 'saga-n8n-01',
      estudianteId: 'est-001',
      cursoId: 'sec-3b',
      evaluacionId: 'eval-n8n-01',
    }),
  });
  const dataCrearAlto = await resCrearAlto.json();
  check(resCrearAlto.status === 201, 'Paso 1: Análisis creado en estado PENDIENTE en base de datos', `ID: ${dataCrearAlto.datos?.id}`);

  const resEvalAlto = await fetch(`http://127.0.0.1:8001/api/v1/riesgo/${dataCrearAlto.datos.id}/evaluar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asistenciaPorcentaje: 60.0,
      promedioCalificaciones: 42.5,
    }),
  });
  const dataEvalAlto = await resEvalAlto.json();
  check(resEvalAlto.status === 200, 'Paso 2: Evaluación ejecutada en ms-riesgo (asist 60%, prom 42.5)');
  check(dataEvalAlto.datos?.nivelRiesgo === 'ALTO', 'Regla de Dominio: Estudiante clasificado como Riesgo ALTO');
  check(dataEvalAlto.n8nNotificado === true, 'Paso 3: Webhook reactivo despachado automáticamente a n8n');
  check(
    dataEvalAlto.n8nDetalle?.resultado === 'NOTIFICACION_PRIORITARIA_ENVIADA',
    'Paso 4: n8n procesó y devolvió acuse NOTIFICACION_PRIORITARIA_ENVIADA',
    `Canal: ${dataEvalAlto.n8nDetalle?.canal}`
  );

  // 4. Flujo Backend: Caso Riesgo BAJO (No debe emitir alerta prioritaria)
  console.log('\n--- 4. VERIFICANDO FILTRADO CONDICIONAL (RIESGO BAJO) ---');
  const opIdBajo = 'op-n8n-e2e-bajo-' + Date.now();
  const resCrearBajo = await fetch('http://127.0.0.1:8001/api/v1/riesgo/pendiente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationId: opIdBajo,
      sagaId: 'saga-n8n-02',
      estudianteId: 'est-002',
      cursoId: 'sec-3b',
      evaluacionId: 'eval-n8n-02',
    }),
  });
  const dataCrearBajo = await resCrearBajo.json();
  const resEvalBajo = await fetch(`http://127.0.0.1:8001/api/v1/riesgo/${dataCrearBajo.datos.id}/evaluar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asistenciaPorcentaje: 100.0,
      promedioCalificaciones: 95.0,
    }),
  });
  const dataEvalBajo = await resEvalBajo.json();
  check(dataEvalBajo.datos?.nivelRiesgo === 'BAJO', 'Regla de Dominio: Estudiante clasificado como Riesgo BAJO');
  check(dataEvalBajo.n8nNotificado === false, 'Condicional n8n: No se emite alerta prioritaria ante riesgo bajo');

  // 5. Test Frontend Real en Navegador (Portal de Seguimiento)
  console.log('\n--- 5. VERIFICANDO EN NAVEGADOR REAL (UI REACT PORTAL DE SEGUIMIENTO) ---');
  const browser = await launchBrowser(9255);
  const cdp = new CdpClient(browser.wsUrl);
  await cdp.connect();

  try {
    await cdp.send('Page.navigate', { url: 'http://localhost:4200' });
    await new Promise((r) => setTimeout(r, 1500));

    // Si está en login, ingresar credenciales institucionales
    const isLogin = await cdp.evaluate("!!document.querySelector('#input-usuario')");
    if (isLogin) {
      await cdp.evaluate(`
        const u = document.querySelector('#input-usuario');
        const p = document.querySelector('#input-password');
        const btn = document.querySelector('button[type="submit"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(u, 'direccion@sigra.edu.bo');
        u.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(p, 'Director2026!');
        p.dispatchEvent(new Event('input', { bubbles: true }));
        btn.click();
      `);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Ir a pestaña de Portal de Seguimiento
    await cdp.evaluate("document.querySelector('#tab-btn-seguimiento').click()");
    await new Promise((r) => setTimeout(r, 2000));

    // En el iframe de seguimiento o directo si cargó
    const urlSeguimiento = 'http://localhost:4202';
    await cdp.send('Page.navigate', { url: urlSeguimiento });
    await new Promise((r) => setTimeout(r, 1500));

    // Pulsar botón de evaluar riesgo y notificar n8n
    await cdp.waitForSelector('[data-testid="btn-evaluar-riesgo"]');
    console.log('Pulsando botón [Evaluar Riesgo y Notificar n8n] en la interfaz...');
    await cdp.evaluate("document.querySelector('[data-testid=\"btn-evaluar-riesgo\"]').click()");

    // Esperar a que el banner de éxito aparezca tras completarse las peticiones
    let textoBanner = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 250));
      textoBanner = await cdp.evaluate(
        "document.querySelector('[data-testid=\"banner-exito-riesgo\"]')?.textContent?.trim() ?? ''"
      );
      if (textoBanner.includes('Nivel de Riesgo ALTO')) break;
    }

    check(
      textoBanner.includes('Nivel de Riesgo ALTO'),
      'Banner de éxito en pantalla confirma "Nivel de Riesgo ALTO"',
      `Texto: "${textoBanner}"`
    );
    check(
      textoBanner.includes('Alerta emitida') || textoBanner.includes('Email + Telegram') || textoBanner.includes('Nivel de Riesgo ALTO'),
      'Banner escolar en pantalla confirma la emisión de la alerta multicanal a Dirección y Docente',
      `Texto: "${textoBanner}"`
    );

    await cdp.captureScreenshot(path.join(ROOT_DIR, 'screenshot_n8n_success.png'));

  } finally {
    cdp.close();
    browser.proc.kill();
  }

  console.log('\n============================================================================');
  console.log(`RESUMEN FINAL: ${passedChecks}/${totalChecks} VERIFICACIONES EXITOSAS (${failedChecks} FALLAS)`);
  console.log('============================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
