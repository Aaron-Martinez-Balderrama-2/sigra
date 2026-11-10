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
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) break;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) break;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        if (buffer.length < offset + payloadLen) break;

        const payload = buffer.slice(offset, offset + payloadLen);
        buffer = buffer.slice(offset + payloadLen);

        try {
          const msg = JSON.parse(payload.toString('utf8'));
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message));
            else cb.resolve(msg.result);
          }
        } catch {}
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      const str = JSON.stringify({ id, method, params });
      const len = Buffer.byteLength(str);

      let header;
      if (len < 126) {
        header = Buffer.from([0x81, 0x80 | len, 0, 0, 0, 0]);
      } else if (len < 65536) {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(14);
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

async function launchBrowser(port = 9266) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(ROOT_DIR, '.tmp_chrome_form_test_' + port);

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
  console.log('============================================================================');
  console.log('TEST REAL DE FORMULARIOS: ASISTENCIA, CALIFICACIONES Y JUSTIFICATIVOS');
  console.log('============================================================================\n');

  // 1. Verificar endpoints backend
  console.log('--- 1. VERIFICANDO SALUD DE SERVICIOS BACKEND ---');
  const hAsistencia = await fetch('http://127.0.0.1:8081/actuator/health').then(r => r.json()).catch(e => ({ status: e.message }));
  console.log('ms-asistencia (:8081 Spring Boot):', hAsistencia.status);
  if (hAsistencia.status !== 'UP') throw new Error('ms-asistencia no responde UP');

  const hCalificaciones = await fetch('http://127.0.0.1:3000/health').then(r => r.json()).catch(e => ({ status: e.message }));
  console.log('ms-calificaciones (:3000 NestJS):', hCalificaciones.status);
  if (hCalificaciones.status !== 'UP') throw new Error('ms-calificaciones no responde UP');

  const hRiesgo = await fetch('http://127.0.0.1:8001/api/v1/health').then(r => r.json()).catch(e => ({ status: e.message }));
  console.log('ms-riesgo (:8001 Laravel DDD):', hRiesgo.status);
  if (hRiesgo.status !== 'UP') throw new Error('ms-riesgo no responde UP');

  // 2. Abrir navegador real
  console.log('\n--- 2. NAVEGANDO Y PROBANDO CADA FORMULARIO EN CHROME ---');
  const browser = await launchBrowser(9266);
  const cdp = new CdpClient(browser.wsUrl);
  await cdp.connect();

  let asistenciaOk = false;
  let califOk = false;
  let justOk = false;

  try {
    // A. Formulario 1: Asistencia de Aula (:4201/asistencia)
    console.log('\n--- PROBANDO FORMULARIO 1: GUARDAR ASISTENCIA DEL CURSO ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:4201/asistencia' });
    await new Promise((r) => setTimeout(r, 2000));

    await cdp.evaluate(`
      const btn = document.querySelector('.btn-guardar-principal');
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const bannerAsistencia = await cdp.evaluate(`
      document.querySelector('.alerta-exito, .alerta-error, .alerta-offline')?.textContent?.trim() ?? ''
    `);
    console.log('Mensaje en pantalla (Asistencia):', bannerAsistencia);
    asistenciaOk = bannerAsistencia.includes('exitosa') || bannerAsistencia.includes('guardada') || bannerAsistencia.includes('PostgreSQL');
    console.log('Asistencia guardada con éxito:', asistenciaOk ? 'SÍ ✓' : 'NO ✗');

    // B. Formulario 2: Calificaciones (:4201/calificaciones)
    console.log('\n--- PROBANDO FORMULARIO 2: CREAR EVALUACIÓN EN CALIFICACIONES ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:4201/calificaciones' });
    await new Promise((r) => setTimeout(r, 2000));

    // Abrir formulario nueva evaluación
    await cdp.evaluate(`
      const btnToggle = document.querySelector('.controles-evaluacion button');
      if (btnToggle && btnToggle.textContent.includes('Nueva Evaluación')) {
        btnToggle.click();
      }
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Pulsar botón de crear evaluación en MongoDB
    await cdp.evaluate(`
      const btnSubmit = document.querySelector('.form-nueva-evaluacion button[type="submit"]');
      if (btnSubmit) btnSubmit.click();
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const bannerCalificaciones = await cdp.evaluate(`
      document.querySelector('.alerta-exito, .alerta-error')?.textContent?.trim() ?? ''
    `);
    console.log('Mensaje en pantalla (Calificaciones):', bannerCalificaciones);
    califOk = bannerCalificaciones.includes('creada') || bannerCalificaciones.includes('MongoDB');
    console.log('Evaluación creada con éxito:', califOk ? 'SÍ ✓' : 'NO ✗');

    // C. Formulario 3: Justificativos (:4201/justificativos)
    console.log('\n--- PROBANDO FORMULARIO 3: REGISTRAR JUSTIFICATIVO MÉDICO ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:4201/justificativos' });
    await new Promise((r) => setTimeout(r, 2000));

    // Rellenar y enviar justificativo
    await cdp.evaluate(`
      const textarea = document.querySelector('#textarea-motivo-justificativo');
      if (textarea) {
        textarea.value = 'Certificado médico pediátrico por cuadro gripal';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btnReg = document.querySelector('.form-justificativo button[type="submit"]');
      if (btnReg) btnReg.click();
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const bannerJustificativo = await cdp.evaluate(`
      document.querySelector('.alerta-exito, .alerta-error')?.textContent?.trim() ?? ''
    `);
    console.log('Mensaje en pantalla (Justificativo):', bannerJustificativo);
    justOk = !bannerJustificativo.includes('Error') && (bannerJustificativo.includes('registrad') || bannerJustificativo.includes('éxito') || bannerJustificativo.includes('exitosamente'));
    console.log('Justificativo registrado con éxito:', justOk ? 'SÍ ✓' : 'NO ✗');

    console.log('\n============================================================================');
    console.log('RESUMEN DE PRUEBAS DE FORMULARIOS:');
    console.log('1. Formulario Asistencia:     ', asistenciaOk ? 'PASS ✓' : 'FAIL ✗');
    console.log('2. Formulario Calificaciones: ', califOk ? 'PASS ✓' : 'FAIL ✗');
    console.log('3. Formulario Justificativos: ', justOk ? 'PASS ✓' : 'FAIL ✗');
    console.log('============================================================================');

    if (!asistenciaOk || !califOk || !justOk) {
      process.exitCode = 1;
    }
  } finally {
    try {
      if (cdp.socket) cdp.socket.destroy();
      browser.proc.kill();
    } catch {}
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
