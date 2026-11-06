import 'dotenv/config';
import { MongoClient } from 'mongodb';
async function main() {
  if (!process.env.MONGO_URI) throw new Error('Configure MONGO_URI.');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DB ?? 'sigra_calificaciones');
    const docente = process.env.DEMO_DOCENTE_SUB;
    const padre = process.env.DEMO_PADRE_SUB;
    if (!docente || !padre)
      throw new Error(
        'Configure DEMO_DOCENTE_SUB y DEMO_PADRE_SUB con los sub reales.',
      );
    const courses = [
      {
        id: 'sec-3b',
        nivel: 'SECUNDARIA',
        grado: 3,
        paralelo: 'B',
        gestion: 2026,
        estudiantes: ['est-001', 'est-002'],
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
    for (const course of courses)
      await db
        .collection('cursos')
        .updateOne(
          { id: course.id },
          { $setOnInsert: course },
          { upsert: true },
        );
    for (const grant of [
      {
        id: docente,
        asignaciones: courses.map((c) => ({
          cursoId: c.id,
          materiaId: 'matematicas',
          gestion: 2026,
        })),
        estudiantes: [],
      },
      { id: padre, asignaciones: [], estudiantes: ['est-001', 'est-003'] },
    ])
      await db
        .collection('accesos')
        .updateOne({ id: grant.id }, { $setOnInsert: grant }, { upsert: true });
    console.log(
      'Referencias ficticias creadas sin sobrescribir registros existentes. No se crearon notas ni publicaciones.',
    );
  } finally {
    await client.close();
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
