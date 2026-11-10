import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const wsModule = await import('node:http');
    const u = new URL(this.wsUrl);

    return new Promise((resolve, reject) => {
      const req = wsModule.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        },
      });

      req.on('upgrade', (res, socket) => {
        this.socket = socket;
        this.setupSocket();
        resolve();
      });

      req.on('error', reject);
      req.end();
    });
  }

  setupSocket() {
    let buffer = Buffer.alloc(0);
    this.socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const secondByte = buffer[1];
        const isMasked = (secondByte & 0x80) === 0x80;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        const maskSize = isMasked ? 4 : 0;
        if (buffer.length < offset + maskSize + payloadLen) return;

        let payload = buffer.subarray(offset + maskSize, offset + maskSize + payloadLen);
        if (isMasked) {
          const mask = buffer.subarray(offset, offset + 4);
          const unmasked = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i % 4];
          }
          payload = unmasked;
        }

        buffer = buffer.subarray(offset + maskSize + payloadLen);

        try {
          const msg = JSON.parse(payload.toString('utf8'));
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            cb(msg);
          }
        } catch {}
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = this.id++;
      const payloadObj = { id: msgId, method, params };
      this.callbacks.set(msgId, resolve);

      const str = JSON.stringify(payloadObj);
      const len = Buffer.byteLength(str);
      let header;

      if (len < 126) {
        header = Buffer.alloc(2 + 4);
        header[0] = 0x81;
        header[1] = 0x80 | len;
      } else if (len <= 0xffff) {
        header = Buffer.alloc(4 + 4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(10 + 4);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(len), 2);
      }

      const mask = Buffer.from([1, 2, 3, 4]);
      mask.copy(header, header.length - 4);

      const payload = Buffer.from(str);
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }

      this.socket.write(Buffer.concat([header, payload]));
    });
  }

  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }
}

async function launchBrowser(port = 9277) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(ROOT_DIR, '.tmp_chrome_seguimiento_test_' + port);

  const proc = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const target = list.find((t) => t.type === 'page');
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
  console.log('--- TEST PORTAL DE SEGUIMIENTO Y ESTADO DEL SERVICIO ---');
  const { proc, wsUrl } = await launchBrowser(9277);
  const client = new CdpClient(wsUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  try {
    // 1. Navegar a Portal de Seguimiento (:4202)
    console.log('1. Navegando a http://localhost:4202...');
    await client.send('Page.navigate', { url: 'http://localhost:4202' });
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Verificar estado de conexion de ms-riesgo
    console.log('2. Verificando estado visual del servicio...');
    const statusText = await client.evaluate(`
      (() => {
        const badge = document.querySelector('.status-pill');
        return badge ? badge.innerText.trim() : null;
      })()
    `);
    console.log('Texto de estado reportado en UI:', statusText);

    // 3. Probar clic en botón Sincronizar
    console.log('3. Haciendo clic en "Sincronizar"...');
    await client.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sincronizar'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const statusAfterSync = await client.evaluate(`
      (() => {
        const badge = document.querySelector('.status-pill');
        return badge ? badge.innerText.trim() : null;
      })()
    `);
    console.log('Texto de estado tras sincronizar:', statusAfterSync);

    // 4. Probar evaluación de riesgo
    console.log('4. Probando evaluación de riesgo para Mateo Rojas...');
    const clickEval = await client.evaluate(`
      (() => {
        const btn = document.querySelector('button.btn-primary');
        if (btn && btn.innerText.includes('Evaluar')) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Botón evaluar pulsado:', clickEval);

    // Esperar resultado
    let bannerText = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      bannerText = await client.evaluate(`
        (() => {
          const b = document.querySelector('.notice-banner.success') || document.querySelector('.notice-banner.danger');
          return b ? b.innerText.trim() : null;
        })()
      `);
      if (bannerText) break;
    }
    console.log('Resultado de evaluación de riesgo:', bannerText);

    // 5. Verificar que el visualizador de n8n NO exista en el DOM
    const hasN8nVisualizer = await client.evaluate(`
      (() => {
        const text = document.body.innerText;
        return text.includes('Automatización y Notificaciones en Vivo (n8n)') || text.includes('NODO 1 · TRIGGER');
      })()
    `);
    console.log('¿Existe visualizador técnico de n8n en pantalla?:', hasN8nVisualizer ? 'SÍ (ERROR)' : 'NO (LIMPIO Y CORRECTO)');

    if (!hasN8nVisualizer && (statusAfterSync?.includes('Conectado') || statusText?.includes('Conectado'))) {
      console.log('\n>>> PORTAL DE SEGUIMIENTO VERIFICADO: ESTADO CONECTADO Y SIN INTERFAZ TÉCNICA <<<');
    }
  } finally {
    proc.kill();
  }
}

main().catch(e => {
  console.error('ERROR EN TEST:', e);
  process.exit(1);
});
