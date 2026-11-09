@echo off
chcp 65001 > nul
title SIGRA — Iniciador de Ecosistema Completo (Grupo 10)
echo ===============================================================================
echo   SISTEMA INTELIGENTE DE GESTIÓN Y RIESGO ACADÉMICO (SIGRA)
echo   Iniciando Infraestructura Docker, 3 Microservicios y 3 Frontends...
echo ===============================================================================

cd /d "D:\software-2\sigra"

echo.
echo [1/7] Levantando Infraestructura Docker (Postgres, Mongo, DynamoDB, Keycloak, n8n)...
docker compose up -d

echo.
echo [2/7] Levantando Backend: ms-calificaciones (NestJS :3000)...
start "SIGRA - ms-calificaciones (:3000)" cmd /k "cd /d D:\software-2\sigra\backend\ms-calificaciones && npm run start:dev"

echo.
echo [3/7] Levantando Backend: ms-riesgo (Laravel PHP :8001)...
start "SIGRA - ms-riesgo (:8001)" cmd /k "cd /d D:\software-2\sigra\backend\ms-riesgo && C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8001"

echo.
echo [4/7] Levantando Backend: ms-asistencia (Spring Boot :8081)...
start "SIGRA - ms-asistencia (:8081)" cmd /k "cd /d D:\software-2\sigra\backend\ms-asistencia && mvnw.cmd spring-boot:run"

echo.
echo [5/7] Levantando Frontend: portal-docente (Angular :4201)...
start "SIGRA - portal-docente (:4201)" cmd /k "cd /d D:\software-2\sigra\frontend\portal-docente && npm start"

echo.
echo [6/7] Levantando Frontend: portal-seguimiento (React PWA :4202)...
start "SIGRA - portal-seguimiento (:4202)" cmd /k "cd /d D:\software-2\sigra\frontend\portal-seguimiento && npm run dev"

echo.
echo [7/7] Levantando Frontend: App Shell Orquestador SSO (:4200)...
start "SIGRA - App Shell SSO (:4200)" cmd /k "cd /d D:\software-2\sigra\frontend\shell && npm run dev"

echo.
echo ===============================================================================
echo   ¡ECOSISTEMA SIGRA INICIADO CON ÉXITO!
echo   Abra en su navegador el portal unificado SSO:
echo   --> http://localhost:4200
echo ===============================================================================
timeout /t 5 > nul
start http://localhost:4200
