-- =============================================================================
-- SIGRA - Script de Inicialización de PostgreSQL
-- Microservicio: ms-asistencia (Spring Boot - Java)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Esquema de asistencia
CREATE TABLE IF NOT EXISTS asistencias (
    id VARCHAR(36) PRIMARY KEY,
    estudiante_id VARCHAR(36) NOT NULL,
    curso_id VARCHAR(36) NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL, -- PRESENTE, FALTA, ATRASO, FALTA_JUSTIFICADA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiante_curso_fecha UNIQUE (estudiante_id, curso_id, fecha)
);

-- Marcas de seguimiento (usado en la transacción SAGA con rollback)
CREATE TABLE IF NOT EXISTS marcas_seguimiento (
    id VARCHAR(36) PRIMARY KEY,
    evaluacion_id VARCHAR(36) NOT NULL,
    curso_id VARCHAR(36) NOT NULL,
    estado VARCHAR(30) NOT NULL, -- PENDIENTE, CONFIRMADA, COMPENSADA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de idempotencia para sincronización offline
CREATE TABLE IF NOT EXISTS operaciones_procesadas (
    operation_id VARCHAR(64) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    payload_hash VARCHAR(64),
    response_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante ON asistencias(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_curso_fecha ON asistencias(curso_id, fecha);
