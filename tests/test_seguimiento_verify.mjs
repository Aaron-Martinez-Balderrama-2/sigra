import { spawn } from 'node:child_process';
import path from 'node:path';

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
          for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ mask[i % 4];
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
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      this.socket.write(Buffer.concat([header, payload]));
    });
  }

  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.error) console.error('Runtime.evaluate error:', res.error);
    if (res.result?.exceptionDetails) console.error('Exception:', res.result.exceptionDetails);
    return res.result?.result?.value;
  }
}

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.resolve('sigra/.tmp_chrome_seg_verify');
  const proc = spawn(
    chromePath,
    ['--remote-debugging-port=9288', '--user-data-dir=' + userDataDir, '--no-first-run', '--headless=new', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' }
  );

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9288/json/list');
      if (res.ok) {
        const list = await res.json();
        const target = list.find((t) => t.type === 'page');
        if (target?.webSocketDebuggerUrl) {
          const client = new CdpClient(target.webSocketDebuggerUrl);
          await client.connect();
          await client.send('Page.enable');
          await client.send('Runtime.enable');

          console.log('Navegando a http://localhost:4202...');
          await client.send('Page.navigate', { url: 'http://localhost:4202' });
          await new Promise(r => setTimeout(r, 2500));

          const status = await client.evaluate(`
            document.querySelector('[data-testid="status-ms-riesgo"]')?.innerText || 'NO_ENCONTRADO'
          `);
          console.log('ESTADO VISUAL MS-RIESGO:', status);

          const hasN8nNodes = await client.evaluate(`
            document.body.innerText.includes('NODO 1') || document.body.innerText.includes('Automatización y Notificaciones en Vivo (n8n)')
          `);
          console.log('¿DIAGRAMA N8N PRESENTE?:', hasN8nNodes);

          // Clic en Evaluar
          await client.evaluate(`
            const btn = document.querySelector('[data-testid="btn-evaluar-riesgo"]');
            if (btn) btn.click();
          `);

          let banner = 'SIN_BANNER';
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            banner = await client.evaluate(`
              document.querySelector('[data-testid="banner-exito-riesgo"]')?.innerText ||
              document.querySelector('.notice-banner')?.innerText || 'SIN_BANNER'
            `);
            if (banner && banner !== 'SIN_BANNER') break;
          }
          console.log('BANNER EVALUACION:', banner);

          client.socket.destroy();
          proc.kill();
          process.exit(0);
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  proc.kill();
}

run();
