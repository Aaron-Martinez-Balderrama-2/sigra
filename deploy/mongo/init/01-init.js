// =============================================================================
// SIGRA - Script de Inicialización de MongoDB
// Microservicio: ms-calificaciones (NestJS - TypeScript)
// =============================================================================

db = db.getSiblingDB('sigra_calificaciones');

// Crear colecciones con índices para optimizar consultas GraphQL
db.createCollection('evaluaciones');
db.createCollection('calificaciones');
db.createCollection('sagas_publicacion');

// Índices únicos y de búsqueda
db.evaluaciones.createIndex({ "cursoId": 1, "nombre": 1 });
db.calificaciones.createIndex({ "evaluacionId": 1, "estudianteId": 1 }, { unique: true });
db.sagas_publicacion.createIndex({ "sagaId": 1 }, { unique: true });

print("MongoDB: Colecciones e índices de SIGRA creados exitosamente.");
