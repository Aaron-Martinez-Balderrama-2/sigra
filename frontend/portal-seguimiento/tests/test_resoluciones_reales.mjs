/**
 * ============================================================================
 * AUDITORÍA RESPONSIVE EN NAVEGADOR REAL (CHROME CDP)
 * Verifica las 69 resoluciones exactas exigidas (desde 320x240 hasta 6016x3384)
 * en los 4 módulos del Bloque 3 (Riesgo, CNN, Agente, Reportes).
 * ============================================================================
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');

const RESOLUCIONES = [
  [320, 240], [320, 480], [320, 533], [320, 568],
  [360, 640], [360, 740], [360, 800], [375, 667],
  [375, 812], [384, 832], [390, 844], [393, 873],
  [412, 892], [412, 915], [414, 736], [414, 896],
  [428, 926], [430, 932], [480, 800], [533, 853],
  [576, 1024], [600, 1024], [601, 966], [640, 960],
  [753, 1205], [768, 1024], [800, 600], [800, 1280],
  [810, 1080], [820, 1180], [992, 1440], [1024, 600],
  [1024, 768], [1024, 1366], [1200, 1600], [1280, 720],
  [1280, 800], [1280, 960], [1280, 1024], [1366, 768],
  [1400, 1050], [1440, 900], [1440, 2560], [1440, 3200],
  [1536, 864], [1600, 900], [1600, 1200], [1680, 1050],
  [1812, 2176], [1920, 1080], [1920, 1200], [1920, 1440],
  [2048, 1536], [2048, 2732], [2208, 1768], [2560, 1080],
  [2560, 1440], [2560, 1600], [2560, 1800], [2880, 1800],
  [2880, 1920], [3072, 1920], [3440, 1440], [3840, 1600],
  [3840, 2160], [4096, 2160], [5120, 1440], [5120, 2880],
  [6016, 3384],
];

const TABS = ['tab-riesgo', 'tab-cnn', 'tab-agente', 'tab-reportes'];

async function launchChrome(debugPort) {
  const binaryPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(
    FRONTEND_DIR,
    `node_modules/.cache/responsive-profile-${debugPort}-${Date.now()}`
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(
    binaryPath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const resList = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (resList.ok) {
        const list = await resList.json();
        const pageTarget = list.find((t) => t.type === 'page') ?? list[0];
        if (pageTarget?.webSocketDebuggerUrl) {
          return { proc, wsUrl: pageTarget.webSocketDebuggerUrl };
        }
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  proc.kill();
  throw new Error('No se pudo conectar a Chrome CDP para auditoría responsive');
}

async function main() {
  const viteServer = await createViteServer({
    root: FRONTEND_DIR,
    server: { port: 4215, host: '127.0.0.1' },
  });
  await viteServer.listen();

  const { proc, wsUrl } = await launchChrome(9245);
  const ws = new WebSocket(wsUrl);
  let msgId = 0;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res.result?.value;
  };

  let totalChecks = 0;
  const fallos = [];

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:4215' });

    // Esperar render inicial
    for (let i = 0; i < 40; i++) {
      const ok = await evaluate(`Boolean(document.querySelector('[data-testid="sso-status-pill"]'))`);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 120));
    }

    for (const tabId of TABS) {
      await evaluate(`document.querySelector('[data-testid="${tabId}"]')?.click()`);
      await new Promise((r) => setTimeout(r, 60));

      for (const [width, height] of RESOLUCIONES) {
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });

        const check = await evaluate(`
          (() => {
            const docEl = document.documentElement;
            const header = document.querySelector('header.sigra-header');
            const main = document.querySelector('main.sigra-main');
            const logo = document.querySelector('img.sigra-logo');
            const hRect = header ? header.getBoundingClientRect() : null;
            const mRect = main ? main.getBoundingClientRect() : null;
            const lRect = logo ? logo.getBoundingClientRect() : null;

            return {
              innerWidth: window.innerWidth,
              scrollWidth: docEl.scrollWidth,
              overflowX: docEl.scrollWidth - window.innerWidth,
              headerFits: Boolean(hRect && hRect.width <= window.innerWidth + 1 && hRect.height > 0),
              mainFits: Boolean(mRect && mRect.width <= window.innerWidth + 1 && mRect.height > 0),
              logoVisible: Boolean(lRect && lRect.width >= 16 && lRect.height >= 16),
            };
          })()
        `);

        totalChecks++;
        if (
          check.overflowX > 1 ||
          !check.headerFits ||
          !check.mainFits ||
          !check.logoVisible
        ) {
          fallos.push({
            tabId,
            resolucion: `${width}x${height}`,
            ...check,
          });
        }
      }
    }
  } finally {
    ws.close();
    proc.kill();
    await viteServer.close();
  }

  console.log(
    `AUDITORÍA RESPONSIVE COMPLETADA: ${totalChecks - fallos.length}/${totalChecks} verificaciones pasaron (${RESOLUCIONES.length} resoluciones × ${TABS.length} vistas).`
  );

  if (fallos.length > 0) {
    console.error('Fallos detectados:', JSON.stringify(fallos.slice(0, 10), null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
