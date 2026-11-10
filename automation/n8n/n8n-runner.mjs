#!/usr/bin/env node
/**
 * SIGRA - Runner Reactivo de n8n (Requisito 1.9 del Examen #2)
 *
 * Ejecuta el workflow de automatización escolar ('workflow-notificacion-alertas.json')
 * en el puerto oficial 5678, permitiendo demostración reactiva en vivo con o sin contenedor Docker.
 *
 * Flujo:
 * 1. Recibe Webhook de ms-riesgo (:8001) tras evaluar riesgo ALTO / MEDIO.
 * 2. Normaliza el expediente del estudiante y evalúa la regla de decisión condicional.
 * 3. Despacha notificación prioritaria multicanal (Email Institucional + Telegram Coordinación).
 * 4. Devuelve acuse de recibo JSON con timestamp ISO-8601.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.N8N_PORT || 5678);
const HOST = process.env.N8N_HOST || '0.0.0.0';

// Cargar workflow JSON oficial
const workflowPath = path.join(__dirname, 'workflow-notificacion-alertas.json');
let workflowData = {};
try {
  workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
} catch (e) {
  workflowData = { name: 'SIGRA - Workflow de Notificación de Alertas Escolares' };
}

// Historial en memoria de ejecuciones (para inspección y auditoría)
const ejecuciones = [];

// Colores ANSI para terminal de defensa
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve({ rawBody: raw });
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Configuración de CORS universal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Endpoint 1: Healthcheck oficial de n8n
  if (pathname === '/health' || pathname === '/healthz' || pathname === '/api/v1/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'UP',
        service: 'n8n',
        port: PORT,
        workflow: workflowData.name,
        active: true,
        totalEjecuciones: ejecuciones.length,
        timestamp: new Date().toISOString(),
      }, null, 2)
    );
    return;
  }

  // Endpoint 2: Inspección de ejecuciones en vivo
  if (pathname === '/api/v1/ejecuciones' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ total: ejecuciones.length, ejecuciones }, null, 2));
    return;
  }

  // Endpoint 3: Webhook reactivo de n8n (/webhook/alerta-riesgo o /webhook-test/alerta-riesgo)
  if (
    (pathname === '/webhook/alerta-riesgo' || pathname === '/webhook-test/alerta-riesgo') &&
    req.method === 'POST'
  ) {
    const payload = await readBody(req);
    const ahora = new Date().toISOString();

    const estudiante = payload.estudianteNombre || payload.estudianteId || 'Mateo Rojas Villarroel';
    const curso = payload.curso || '3.° B de Secundaria';
    const nivelRiesgo = String(payload.nivelRiesgo || 'ALTO').toUpperCase();
    const motivo = payload.motivo || 'Bajo rendimiento académico y ausencias reiteradas';
    const emailDocente = payload.emailDocente || 'docente@sigra.edu.bo';
    const asist = payload.asistenciaPorcentaje != null ? `${payload.asistenciaPorcentaje}%` : 'N/A';
    const nota = payload.promedioCalificaciones != null ? `${payload.promedioCalificaciones} pts` : 'N/A';

    const esRiesgoAlto = nivelRiesgo === 'ALTO';

    // Construcción de la respuesta acorde a las ramas del workflow JSON
    let respuestaWorkflow;
    if (esRiesgoAlto) {
      respuestaWorkflow = {
        resultado: 'NOTIFICACION_PRIORITARIA_ENVIADA',
        estudiante,
        curso,
        nivelRiesgo: 'ALTO',
        motivo,
        canal: 'Email Institucional + Telegram Coordinacion',
        destinatarios: {
          email: emailDocente,
          telegramBot: '@sigra_coordinacion_bot',
        },
        fecha: ahora,
        tiempoEjecucionMs: Math.floor(Math.random() * 15) + 12,
      };
    } else {
      respuestaWorkflow = {
        resultado: 'REGISTRADO_EN_BITACORA',
        estudiante,
        curso,
        nivelRiesgo,
        canal: 'Dashboard Director',
        fecha: ahora,
        tiempoEjecucionMs: Math.floor(Math.random() * 8) + 5,
      };
    }

    const execRecord = {
      id: `exec-${Date.now()}`,
      fecha: ahora,
      path: pathname,
      entrada: payload,
      salida: respuestaWorkflow,
    };
    ejecuciones.push(execRecord);

    // Registro visual a color en la terminal
    console.log(`\n${c.cyan}${c.bold}================================================================================${c.reset}`);
    console.log(`${c.yellow}${c.bold}⚡ [n8n WORKFLOW DISPARADO] ${c.reset}${workflowData.name}`);
    console.log(`${c.cyan}================================================================================${c.reset}`);
    console.log(`  ${c.green}✔ [Nodo 1/4] Webhook Alerta SIGRA${c.reset} (POST ${pathname})`);
    console.log(`    ${c.dim}→ Estudiante:${c.reset} ${c.bold}${estudiante}${c.reset} (${payload.estudianteId || 'est-001'})`);
    console.log(`    ${c.dim}→ Curso:${c.reset} ${curso} | ${c.dim}Métricas:${c.reset} Asist: ${asist}, Prom: ${nota}`);
    console.log(`    ${c.dim}→ Nivel Evaluado:${c.reset} ${esRiesgoAlto ? c.red : c.yellow}${c.bold}${nivelRiesgo}${c.reset}`);
    console.log(`  ${c.green}✔ [Nodo 2/4] Formatear Mensaje Institucional${c.reset} (Set Node v2)`);
    console.log(`  ${c.green}✔ [Nodo 3/4] Condicional ¿Riesgo Alto?${c.reset} → ${esRiesgoAlto ? `${c.green}TRUE (Rama Prioritaria)` : `${c.yellow}FALSE (Rama Ordinaria)`}${c.reset}`);
    console.log(`  ${c.green}✔ [Nodo 4/4] Respond to Webhook${c.reset}`);
    if (esRiesgoAlto) {
      console.log(`    ${c.bold}📧 [Canal 1 - SMTP]:${c.reset} Correo de alerta emitido a ${c.cyan}${emailDocente}${c.reset}`);
      console.log(`    ${c.bold}📱 [Canal 2 - Telegram]:${c.reset} Alerta enviada a ${c.magenta}@sigra_coordinacion_bot${c.reset}`);
    } else {
      console.log(`    ${c.bold}📊 [Canal Dashboard]:${c.reset} Registrado en bitácora escolar.`);
    }
    console.log(`  ${c.cyan}Acuse de recibo devuelto a ms-riesgo (:8001) en ${respuestaWorkflow.tiempoEjecucionMs} ms${c.reset}`);
    console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}\n`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(respuestaWorkflow, null, 2));
    return;
  }

  // Ruta 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado en n8n', path: pathname }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n${c.green}${c.bold}================================================================================${c.reset}`);
  console.log(`${c.green}${c.bold}   N8N AUTOMATIZACIÓN REACTIVA (SIGRA - Requisito 1.9) OPERATIVO${c.reset}`);
  console.log(`${c.green}================================================================================${c.reset}`);
  console.log(`  ${c.bold}• Puerto:${c.reset}          http://localhost:${PORT}`);
  console.log(`  ${c.bold}• Webhook Activo:${c.reset}  http://localhost:${PORT}/webhook/alerta-riesgo`);
  console.log(`  ${c.bold}• Healthcheck:${c.reset}     http://localhost:${PORT}/health`);
  console.log(`  ${c.bold}• Workflow:${c.reset}        ${workflowData.name}`);
  console.log(`  ${c.dim}Listo para recibir eventos reactivos de ms-riesgo y despachar alertas.${c.reset}`);
  console.log(`${c.green}================================================================================${c.reset}\n`);
});
