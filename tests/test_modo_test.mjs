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

  async click(selector) {
    await this.waitForSelector(selector);
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('No encontrado: ' + ${JSON.stringify(selector)});
        el.click();
      })()
    `);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser(debugPort) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const binary = fs.existsSync(chromePath) ? chromePath : edgePath;

  const profileDir = path.join(ROOT_DIR, `node_modules/.cache/test-modo-test-${Date.now()}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const proc = spawn(binary, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
  ]);

  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const resVer = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      const resList = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (resVer.ok && resList.ok) {
        const list = await resList.json();
        const target = list.find((t) => t.type === 'page') ?? list[0];
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
  console.log('TEST REAL: VERIFICACIÓN DEL BOTÓN "MODO TEST" Y VISTA INSTITUCIONAL LIMPIA');
  console.log('============================================================================\n');

  const browser = await launchBrowser(9249);
  const cdp = new CdpClient(browser.wsUrl);
  await cdp.connect();

  try {
    // 1. Navegar a localhost:4200
    await cdp.send('Page.navigate', { url: 'http://localhost:4200' });
    await new Promise((r) => setTimeout(r, 1500));

    // Si está en la pantalla de Login, iniciar sesión con el primer botón demo
    const isLogin = await cdp.evaluate("!!document.querySelector('.btn-perfil-demo')");
    if (isLogin) {
      console.log('Iniciando sesión con perfil demo...');
      await cdp.click('.btn-perfil-demo');
      await cdp.waitForSelector('.shell-header-institucional', 8000);
    }

    await cdp.waitForSelector('.shell-header-institucional');
    console.log('App Shell cargado correctamente.\n');

    // 2. Comprobar existencia del botón #btn-toggle-modo-test
    const btnExiste = await cdp.evaluate("!!document.querySelector('#btn-toggle-modo-test')");
    check(btnExiste, 'El botón #btn-toggle-modo-test existe en la barra superior');

    // 3. Comprobar estado POR DEFECTO (OFF)
    console.log('\n--- VERIFICANDO ESTADO POR DEFECTO (MODO TEST = OFF) ---');
    const textoBtnInicial = await cdp.evaluate("document.querySelector('#btn-toggle-modo-test')?.textContent?.trim() ?? ''");
    check(textoBtnInicial.includes('Modo Test: OFF'), `Texto del botón por defecto es "Modo Test: OFF" (actual: "${textoBtnInicial}")`);

    const toolbarVisibleInicial = await cdp.evaluate("!!document.querySelector('.shell-frame-toolbar')");
    check(!toolbarVisibleInicial, 'La barra de diagnóstico técnico blanca (.shell-frame-toolbar) está COMPLETAMENTE OCULTA por defecto');

    const subDocenteInicial = await cdp.evaluate("document.querySelector('#tab-btn-docente small')?.textContent?.trim() ?? ''");
    check(
      subDocenteInicial.includes('Asistencia de Aula, Calificaciones y Justificativos') && !subDocenteInicial.includes(':4201'),
      `Subtítulo Docente limpio y pedagógico (sin puerto :4201): "${subDocenteInicial}"`
    );

    const subSeguimientoInicial = await cdp.evaluate("document.querySelector('#tab-btn-seguimiento small')?.textContent?.trim() ?? ''");
    check(
      subSeguimientoInicial.includes('Seguimiento Escolar, Alertas y Reportes') && !subSeguimientoInicial.includes(':4202'),
      `Subtítulo Seguimiento limpio (sin puerto :4202): "${subSeguimientoInicial}"`
    );

    const eyebrowInicial = await cdp.evaluate("document.querySelector('.shell-eyebrow')?.textContent?.trim() ?? ''");
    check(
      eyebrowInicial.includes('Sistema de Gestión Escolar'),
      `Eyebrow institucional limpio: "${eyebrowInicial}"`
    );

    // 4. Hacer clic para ACTIVAR el Modo Test (ON)
    console.log('\n--- ACTIVANDO MODO TEST (CLIC #btn-toggle-modo-test) ---');
    await cdp.click('#btn-toggle-modo-test');
    await new Promise((r) => setTimeout(r, 400));

    const textoBtnActivo = await cdp.evaluate("document.querySelector('#btn-toggle-modo-test')?.textContent?.trim() ?? ''");
    check(textoBtnActivo.includes('Modo Test: ON'), `Texto del botón cambia a "Modo Test: ON" (actual: "${textoBtnActivo}")`);

    const tieneClaseActivo = await cdp.evaluate("document.querySelector('#btn-toggle-modo-test')?.classList.contains('activo')");
    check(tieneClaseActivo, 'El botón adquiere la clase CSS .activo (dorado con indicador verde)');

    const toolbarVisibleActivo = await cdp.evaluate("!!document.querySelector('.shell-frame-toolbar')");
    check(toolbarVisibleActivo, 'La barra de diagnóstico (.shell-frame-toolbar) AHORA ES VISIBLE para la evaluación del examen');

    const badgePuerto = await cdp.evaluate("document.querySelector('.badge-puerto')?.textContent?.trim() ?? ''");
    check(badgePuerto === ':4201', `La barra muestra el puerto del microfrontend actual: "${badgePuerto}"`);

    const ssoStatus = await cdp.evaluate("document.querySelector('.badge-sso-sync')?.textContent?.trim() ?? ''");
    check(ssoStatus.includes('Sesión SSO Inyectada'), `Inyección SSO acreditada en toolbar: "${ssoStatus}"`);

    const subDocenteTecnico = await cdp.evaluate("document.querySelector('#tab-btn-docente small')?.textContent?.trim() ?? ''");
    check(
      subDocenteTecnico.includes(':4201') && subDocenteTecnico.includes('GraphQL'),
      `Subtítulo Docente muestra requerimientos de examen (:4201, GraphQL): "${subDocenteTecnico}"`
    );

    // 5. Cambiar a pestaña Seguimiento con Modo Test ON
    console.log('\n--- CAMBIANDO A PESTAÑA SEGUIMIENTO CON MODO TEST ON ---');
    await cdp.click('#tab-btn-seguimiento');
    await new Promise((r) => setTimeout(r, 600));

    const badgePuertoSeguimiento = await cdp.evaluate("document.querySelector('.badge-puerto')?.textContent?.trim() ?? ''");
    check(badgePuertoSeguimiento === ':4202', `La barra de diagnóstico se actualiza automáticamente al puerto :4202 (React)`);

    // 6. Hacer clic de nuevo para DESACTIVAR el Modo Test (OFF)
    console.log('\n--- DESACTIVANDO MODO TEST (VOLVIENDO A VISTA LIMPIA) ---');
    await cdp.click('#btn-toggle-modo-test');
    await new Promise((r) => setTimeout(r, 400));

    const textoBtnFinal = await cdp.evaluate("document.querySelector('#btn-toggle-modo-test')?.textContent?.trim() ?? ''");
    check(textoBtnFinal.includes('Modo Test: OFF'), `Texto del botón vuelve a "Modo Test: OFF"`);

    const toolbarVisibleFinal = await cdp.evaluate("!!document.querySelector('.shell-frame-toolbar')");
    check(!toolbarVisibleFinal, 'La barra blanca de diagnóstico desaparece nuevamente sin dejar rastro');

    // 7. Inspección de Emojis
    console.log('\n--- INSPECCIÓN DE ICONOGRAFÍA (0 EMOJIS DE WHATSAPP) ---');
    const hasWhatsAppEmojis = await cdp.evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        // Regex para emojis unicode comunes de WhatsApp/móviles
        const regex = /[\\u{1F300}-\\u{1F9FF}]|[\\u{2600}-\\u{26FF}]|[\\u{2700}-\\u{27BF}]/u;
        return regex.test(bodyText);
      })()
    `);
    check(!hasWhatsAppEmojis, 'Cero emojis unicode / WhatsApp en la interfaz del Shell (solo iconos vectoriales SVG de alta definición)');

    console.log('\n============================================================================');
    console.log(`RESUMEN: ${passedChecks}/${totalChecks} VERIFICACIONES EXITOSAS (${failedChecks} FALLAS)`);
    console.log('============================================================================\n');

  } finally {
    cdp.close();
    browser.proc.kill();
  }
}

main().catch((err) => {
  console.error('Error fatal durante la prueba:', err);
  process.exit(1);
});
