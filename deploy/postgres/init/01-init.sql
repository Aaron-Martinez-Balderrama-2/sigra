-- =============================================================================
-- SIGRA - Script de Inicialización de PostgreSQL
-- Microservicio: ms-asistencia (Spring Boot 3.3 - Java 21 - Arquitectura Hexagonal)
-- Responsable: Guzman Rojas Luis David (Grupo 10)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Asistencia Diaria (CU-01 y CU-02)
CREATE TABLE IF NOT EXISTS asistencias (
    id VARCHAR(36) PRIMARY KEY,
    estudiante_id VARCHAR(36) NOT NULL,
    curso_id VARCHAR(36) NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL, -- PRESENTE, FALTA, ATRASO, FALTA_JUSTIFICADA
    justificativo_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiante_curso_fecha UNIQUE (estudiante_id, curso_id, fecha)
);

-- 2. Tabla de Marcas de Seguimiento (Paso 2 SAGA y Rollback Compensatorio - CU-04 / Req 1.7)
CREATE TABLE IF NOT EXISTS marcas_seguimiento (
    id VARCHAR(36) PRIMARY KEY,
    evaluacion_id VARCHAR(36) NOT NULL,
    curso_id VARCHAR(36) NOT NULL,
    operation_id VARCHAR(64) NOT NULL,
    saga_id VARCHAR(64),
    estado VARCHAR(30) NOT NULL, -- CONFIRMADA, COMPENSADA
    motivo_compensacion VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_marcas_operation_id UNIQUE (operation_id)
);

-- 3. Tabla de Justificativos de Inasistencia (Clasificación CNN Legibilidad - CU-03 / Req 1.8)
CREATE TABLE IF NOT EXISTS justificativos (
    id VARCHAR(36) PRIMARY KEY,
    estudiante_id VARCHAR(36) NOT NULL,
    curso_id VARCHAR(36) NOT NULL,
    fecha_falta DATE NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    imagen_url VARCHAR(255),
    clasificacion_cnn VARCHAR(30) NOT NULL, -- LEGIBLE, ILEGIBLE, PENDIENTE_ANALISIS
    estado VARCHAR(30) NOT NULL, -- PENDIENTE, APROBADO, RECHAZADO
    observaciones_docente VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Auditoría e Idempotencia Offline (Redes Hostiles - CU-01 / Req 1.6)
CREATE TABLE IF NOT EXISTS operaciones_procesadas (
    operation_id VARCHAR(64) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    payload_hash VARCHAR(64),
    response_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante ON asistencias(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_curso_fecha ON asistencias(curso_id, fecha);
CREATE INDEX IF NOT EXISTS idx_marcas_saga ON marcas_seguimiento(saga_id);
CREATE INDEX IF NOT EXISTS idx_marcas_evaluacion ON marcas_seguimiento(evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_justificativos_estudiante ON justificativos(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_justificativos_curso_estado ON justificativos(curso_id, estado);
