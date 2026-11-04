# SIGRA — Sistema Inteligente de Gestión y Riesgo Académico
## Plataforma Distribuida de Gestión Escolar — Grupo 10

**Universidad:** Universidad Autónoma Gabriel René Moreno (UAGRM)  
**Facultad:** Ingeniería en Ciencias de la Computación y Telecomunicaciones  
**Materia:** Ingeniería de Software II — INF 512-SB  
**Docente:** Ing. Rolando Antonio Martínez Canedo  
**Periodo:** II/2026 — Santa Cruz de la Sierra, Bolivia  
**Hito 1 (Entrega preliminar):** 10 de Noviembre de 2026  
**Hito 2 (Defensa de Proyecto Final):** 15 de Noviembre de 2026  

---

## 1. Distribución del Equipo y Responsabilidades

| Integrante | Rol / Módulo | Stack Tecnológico | Base de Datos | Arquitectura de Código |
|---|---|---|---|---|
| **Martínez Balderrama Aarón** | `ms-riesgo` | PHP 8.3 / Laravel 11 | Amazon DynamoDB Local | **Domain-Driven Design (DDD)** |
| **Mendieta Albán Letizia** | `ms-calificaciones` | TypeScript / NestJS 10 | MongoDB 7.0 | **Clean Architecture** |
| **Guzman Rojas Luis David** | `ms-asistencia` | Java 21 / Spring Boot 3 | PostgreSQL 16 | **Arquitectura Hexagonal (Ports & Adapters)** |

---

## 2. Estructura del Repositorio

```text
sigra/
├── .env.example                         # Plantilla de variables de entorno globales
├── .gitignore                           # Exclusiones de Git estándar
├── docker-compose.yml                   # Orquestador de infraestructura compartida
├── README.md                            # Documentación general del proyecto
│
├── deploy/                              # Scripts de inicialización de infraestructura
│   ├── postgres/init/01-init.sql        # Esquema de asistencias e idempotencia
│   ├── mongo/init/01-init.js            # Colecciones e índices de evaluaciones
│   ├── dynamodb/init/create-tables.sh   # Tablas de riesgo y bloqueos idempotentes
│   └── keycloak/                        # Configuración de realm para SSO (OIDC + PKCE)
│
├── backend/                             # Microservicios Políglotas
│   ├── ms-asistencia/                   # Spring Boot (Java 21) - Hexagonal
│   │   ├── src/main/java/.../domain/    # Modelos y Puertos (In/Out)
│   │   ├── src/main/java/.../application/
│   │   └── src/main/java/.../infrastructure/ # Adaptadores REST y JPA
│   │
│   ├── ms-calificaciones/               # NestJS 10 (TypeScript) - Clean Architecture
│   │   ├── src/core/                    # Entidades y Casos de Uso
│   │   └── src/adapters/                # GraphQL, MCP, REST y Persistencia Mongo
│   │
│   └── ms-riesgo/                       # Laravel 11 (PHP 8.3) - DDD
│       ├── app/Domain/                  # Modelos, Value Objects, Eventos, Repositorios
│       ├── app/Application/             # Casos de uso
│       └── app/Infrastructure/          # Adaptadores DynamoDB Local
│
├── frontend/                            # Capa de Microfrontends
│   ├── shell/                           # Contenedor Host (Login SSO y navegación)
│   ├── portal-docente/                  # Angular 18 (PWA - Registro y notas)
│   └── portal-seguimiento/              # React 18 (PWA - Dashboard, Agente IA, Cámara)
│
├── ai-models/                           # Modelos de Machine Learning y Deep Learning
│   ├── notebooks/                       # Entrenamiento (Random Forest, K-Means, CNN Keras)
│   └── exported/                        # Modelos exportados para TensorFlow.js / ONNX
│
└── automation/                          # Automatización de Procesos
    └── n8n/                             # Workflows exportados en JSON
```

---

## 3. Inicio Rápido de la Infraestructura

### Requisitos Previos
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución con backend WSL 2.
* [Node.js](https://nodejs.org/) v20 o superior y npm.

### Paso 1: Clonar y Preparar Entorno
```bash
cp .env.example .env
```

### Paso 2: Encender Bases de Datos y Servicios
```bash
docker compose up -d
```

### Paso 3: Verificar Servicios Activos
```bash
docker compose ps
```

| Servicio | Contenedor | Puerto Local | Propósito |
|---|---|---|---|
| **PostgreSQL 16** | `sigra-postgres` | `localhost:5432` | Persistencia relacional de `ms-asistencia` |
| **MongoDB 7.0** | `sigra-mongodb` | `localhost:27017` | Persistencia documental de `ms-calificaciones` |
| **DynamoDB Local** | `sigra-dynamodb` | `localhost:8000` | Persistencia clave-valor de `ms-riesgo` |
| **Keycloak** | `sigra-keycloak` | `localhost:8080` | Servidor de Identidad y Single Sign-On (SSO) |
| **n8n** | `sigra-n8n` | `localhost:5678` | Motor de automatización reactiva por eventos |

---

## 4. Ejecución de Microservicios en Desarrollo

Cada integrante puede ejecutar su servicio en su máquina local apuntando a los contenedores:

* **ms-asistencia (Java):**
  ```bash
  cd backend/ms-asistencia
  ./mvnw spring-boot:run
  # Escucha en: http://localhost:8081
  ```

* **ms-calificaciones (NestJS):**
  ```bash
  cd backend/ms-calificaciones
  npm run start:dev
  # Escucha en: http://localhost:3000
  ```

* **ms-riesgo (Laravel):**
  ```bash
  cd backend/ms-riesgo
  php artisan serve --port=8001
  # Escucha en: http://localhost:8001
  ```

---

## 5. Matriz de Cumplimiento del Pliego (EXAMEN #2)

| # Requisito | Concepto / Tecnología | Implementación en SIGRA |
|---|---|---|
| **1.1 & 2.1** | 3 Microservicios en 3 lenguajes | `ms-asistencia` (Java), `ms-calificaciones` (NestJS), `ms-riesgo` (PHP). |
| **1.2 & Front** | Microfrontends (Angular + React) + Shell | Shell unificador + `portal-docente` (Angular) + `portal-seguimiento` (React). |
| **1.3** | GraphQL en Gestión | Resolvers `@nestjs/graphql` en `ms-calificaciones` para ficha y notas. |
| **1.4** | Agente Inteligente ("Gestiona mi negocio") | Agente LLM en NestJS con Tool Calling sobre herramientas MCP. |
| **1.5 & 1.8** | IA Local Offline + TensorFlow (Imágenes) | CNN en TensorFlow.js ejecutada en navegador y PWA sin conexión para justificativos. |
| **1.6** | Idempotencia y Redes Hostiles | `operationId` UUID + tabla de bloqueos atómicos en DynamoDB Local. |
| **1.7** | Transacción SAGA con Rollback (≥3 MS) | Publicar evaluación: NestJS $\rightarrow$ Spring Boot $\rightarrow$ Laravel con compensación inversa. |
| **1.9** | Automatización con n8n | Webhook reactivo que despacha correo de alerta tras confirmación de riesgo. |
| **1.10** | Reportes Multimodales | Dictado por voz (Web Speech API) + exportación a PDF, XLSX, CSV y JSON. |
| **1.11** | Protocolo MCP | Servidor MCP estándar `@modelcontextprotocol/sdk` en NestJS. |
| **1.12** | Sanitización Integral | Validadores DTO en los 3 servicios + consultas parametrizadas + RBAC en Keycloak. |
| **2.3** | 3 Bases de Datos | PostgreSQL (Relacional), MongoDB (Documental) y DynamoDB Local (Clave-Valor). |
| **2.4** | Single Sign-On (1 Solo Login) | Keycloak OIDC con PKCE compartido entre Angular y React. |
| **2.5** | 3 Arquitecturas de Código | Hexagonal (Spring), Clean Architecture (NestJS) y DDD (Laravel). |
