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

## 2. Importación en n8n
1. Iniciar los contenedores: `docker compose up -d n8n`
2. Abrir en el navegador: `http://localhost:5678`
3. Crear o iniciar sesión en n8n.
4. En el menú superior de Workflows, hacer clic en **Import from File...** y seleccionar `workflow-notificacion-alertas.json`.
5. Activar el interruptor **Active** (esquina superior derecha).
