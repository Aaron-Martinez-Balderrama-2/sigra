@echo off
title SIGRA - Iniciador de Ecosistema Completo (Grupo 10)
cd /d "D:\software-2\sigra"

echo ===============================================================================
echo   SISTEMA INTELIGENTE DE GESTION Y RIESGO ACADEMICO (SIGRA)
echo   Iniciando Infraestructura Docker, 3 Microservicios y 3 Frontends...
echo ===============================================================================

echo [1/7] Levantando Infraestructura Docker...
docker compose up -d

echo [2/7] Levantando ms-calificaciones (NestJS :3000)...
start "ms-calificaciones (:3000)" cmd /k "cd /d D:\software-2\sigra\backend\ms-calificaciones && npm run start:dev"

echo [3/7] Levantando ms-riesgo (Laravel :8001)...
start "ms-riesgo (:8001)" cmd /k "cd /d D:\software-2\sigra\backend\ms-riesgo && C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8001"

echo [4/7] Levantando ms-asistencia (Spring Boot :8081)...
start "ms-asistencia (:8081)" cmd /k "cd /d D:\software-2\sigra\backend\ms-asistencia && mvnw.cmd spring-boot:run"

echo [5/7] Levantando portal-docente (Angular :4201)...
start "portal-docente (:4201)" cmd /k "cd /d D:\software-2\sigra\frontend\portal-docente && npm start"

echo [6/7] Levantando portal-seguimiento (React :4202)...
start "portal-seguimiento (:4202)" cmd /k "cd /d D:\software-2\sigra\frontend\portal-seguimiento && npm run dev"

echo [7/7] Levantando App Shell SSO (:4200)...
start "App Shell SSO (:4200)" cmd /k "cd /d D:\software-2\sigra\frontend\shell && npm run dev"

echo ===============================================================================
echo   ECOSISTEMA SIGRA INICIADO CON EXITO
echo   Abriendo en el navegador: http://localhost:4200
echo ===============================================================================
timeout /t 5 > nul
start http://localhost:4200