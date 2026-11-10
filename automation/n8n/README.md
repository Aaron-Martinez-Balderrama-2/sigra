# Automatización de Alertas Escolares con n8n (Requisito 1.9)

Este módulo implementa el flujo de automatización exigido por el pliego del proyecto mediante **n8n**.

## 1. Topología del Workflow
- **Contenedor:** `sigra-n8n` (Puerto `http://localhost:5678`)
- **Webhook Endpoint:** `POST http://localhost:5678/webhook/alerta-riesgo`
- **Lógica:**
  1. Recibe el payload del análisis de riesgo o de publicación de calificaciones.
  2. Extrae y formatea el expediente del alumno, nivel de riesgo y correo del docente.
  3. Evalúa si el riesgo es `ALTO`:
     - **Riesgo ALTO:** Emite notificación prioritaria multicanal (Email Institucional + Telegram Coordinación).
     - **Riesgo MEDIO/BAJO:** Registra el evento en la bitácora del Dashboard Directivo.
  4. Responde con acuse de recibo JSON para confirmación de la transacción.

## 2. Ejecución y Demostración

### Opción A: Runner Reactivo Integrado (Para defensa ágil sin Docker)
Permite levantar el motor de automatización reactivo en segundos con logs a color en terminal para mostrar al docente en vivo:
```bash
node automation/n8n/n8n-runner.mjs
```
El motor escuchará en `http://localhost:5678` respondiendo al webhook `POST /webhook/alerta-riesgo` e imprimiendo el desglose paso a paso de cada nodo ejecutado.

### Opción B: Contenedor Oficial Docker n8n
1. Iniciar los contenedores: `docker compose up -d n8n`
2. Abrir en el navegador: `http://localhost:5678`
3. Crear o iniciar sesión en n8n.
4. En el menú superior de Workflows, hacer clic en **Import from File...** y seleccionar `workflow-notificacion-alertas.json`.
5. Activar el interruptor **Active** (esquina superior derecha).
