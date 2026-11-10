const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://luis20arevalo20_db_user:hkUf3f1YmpfNXCSx@sigra-cluster.lxfnwef.mongodb.net/sigra_calificaciones?retryWrites=true&w=majority";

async function run() {
  console.log("Conectando a MongoDB Atlas en Google Cloud...");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    console.log("✅ ¡Conexión exitosa a MongoDB Atlas!");
    
    const db = client.db('sigra_calificaciones');
    
    // 1. Crear colecciones si no existen
    const existing = (await db.listCollections().toArray()).map(c => c.name);
    console.log("Colecciones existentes:", existing);
    
    for (const colName of ['evaluaciones', 'calificaciones', 'sagas_publicacion', 'cursos', 'accesos']) {
      if (!existing.includes(colName)) {
        await db.createCollection(colName);
        console.log(`+ Colección creada: ${colName}`);
      }
    }
    
    // 2. Crear índices requeridos para consultas y SAGA
    await db.collection('evaluaciones').createIndex({ "cursoId": 1, "nombre": 1 });
    await db.collection('calificaciones').createIndex({ "evaluacionId": 1, "estudianteId": 1 }, { unique: true });
    await db.collection('sagas_publicacion').createIndex({ "sagaId": 1 }, { unique: true });
    console.log("✅ Índices optimizados creados.");
    
    // 3. Insertar datos iniciales de cursos
    const courses = [
      {
        id: 'sec-3b',
        nivel: 'SECUNDARIA',
        grado: 3,
        paralelo: 'B',
        gestion: 2026,
        estudiantes: ['est-001', 'est-002', 'est-003', 'est-004', 'est-005'],
      },
      {
        id: 'pri-2a',
        nivel: 'PRIMARIA',
        grado: 2,
        paralelo: 'A',
        gestion: 2026,
        estudiantes: ['est-003', 'est-004'],
      },
    ];
    for (const course of courses) {
      await db.collection('cursos').updateOne(
        { id: course.id },
        { $setOnInsert: course },
        { upsert: true }
      );
    }
    
    // 4. Accesos para roles de la institución
    const docenteSub = '11111111-1111-4111-8111-111111111111';
    const padreSub = '22222222-2222-4222-8222-222222222222';
    for (const grant of [
      {
        id: docenteSub,
        asignaciones: courses.map((c) => ({
          cursoId: c.id,
          materiaId: 'matematicas',
          gestion: 2026,
        })),
        estudiantes: [],
      },
      { id: padreSub, asignaciones: [], estudiantes: ['est-001', 'est-003'] },
    ]) {
      await db.collection('accesos').updateOne(
        { id: grant.id },
        { $setOnInsert: grant },
        { upsert: true }
      );
    }
    
    console.log("✅ Cursos y accesos oficiales de SIGRA inicializados con éxito.");
    
    const countCursos = await db.collection('cursos').countDocuments();
    const countColecciones = (await db.listCollections().toArray()).length;
    console.log(`Estado en Atlas: ${countColecciones} colecciones listas, ${countCursos} cursos registrados.`);
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});

