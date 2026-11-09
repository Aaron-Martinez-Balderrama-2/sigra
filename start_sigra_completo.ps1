Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  SISTEMA INTELIGENTE DE GESTION Y RIESGO ACADEMICO (SIGRA)                   " -ForegroundColor Cyan
Write-Host "  Iniciando Infraestructura Docker, 3 Microservicios y 3 Frontends...          " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan

Set-Location "D:\software-2\sigra"

Write-Host "`n[1/7] Levantando Infraestructura Docker..." -ForegroundColor Yellow
docker compose up -d

Write-Host "[2/7] Levantando ms-calificaciones (NestJS :3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\backend\ms-calificaciones'; npm run start:dev"

Write-Host "[3/7] Levantando ms-riesgo (Laravel PHP :8001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\backend\ms-riesgo'; C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8001"

Write-Host "[4/7] Levantando ms-asistencia (Spring Boot :8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\backend\ms-asistencia'; .\mvnw.cmd spring-boot:run"

Write-Host "[5/7] Levantando portal-docente (Angular :4201)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\frontend\portal-docente'; npm start"

Write-Host "[6/7] Levantando portal-seguimiento (React PWA :4202)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\frontend\portal-seguimiento'; npm run dev"

Write-Host "[7/7] Levantando App Shell Orquestador SSO (:4200)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'D:\software-2\sigra\frontend\shell'; npm run dev"

Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "  ¡ECOSISTEMA SIGRA INICIADO CON EXITO!" -ForegroundColor Green
Write-Host "  Abriendo en tu navegador el portal unificado SSO: http://localhost:4200" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green

Start-Sleep -Seconds 5
Start-Process "http://localhost:4200"
