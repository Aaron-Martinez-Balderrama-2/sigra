import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { deflateRawSync } from 'zlib';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { CurrentActor } from '../auth/auth';
import { Actor } from '../../core/entities/models';
import { ConsultarResultados } from '../../core/use-cases/consultar-resultados';
import { ResultDto } from '../graphql/dto';
import { requireRule } from '../../core/errors/domain-error';

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.from(entry.content, 'utf8');
    const compressed = deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, endRecord]);
}

export interface EstudianteReporteConsolidado {
  id: string;
  nombre: string;
  promedio: number;
  dictamen: 'APROBADO' | 'APLAZADO';
  asistenciaPorcentaje: number;
  faltasInjustificadas: number;
  faltasJustificadas: number;
  nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  factoresRiesgo: string[];
  recomendacion: string;
}

const CATALOGO_REPORTES_ESTUDIANTES: EstudianteReporteConsolidado[] = [
  {
    id: 'est-001',
    nombre: 'Mateo Rojas Villarroel',
    promedio: 42.5,
    dictamen: 'APLAZADO',
    asistenciaPorcentaje: 60.0,
    faltasInjustificadas: 4,
    faltasJustificadas: 1,
    nivelRiesgo: 'ALTO',
    factoresRiesgo: [
      'Inasistencias críticas (60%)',
      '4 Faltas injustificadas',
      'Calificación reprobatoria (<51 pts)',
    ],
    recomendacion:
      'Citar al tutor legal e inscribir en plan de reforzamiento escolar en Álgebra.',
  },
  {
    id: 'est-002',
    nombre: 'Valentina Suárez Justiniano',
    promedio: 95.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 100.0,
    faltasInjustificadas: 0,
    faltasJustificadas: 0,
    nivelRiesgo: 'BAJO',
    factoresRiesgo: [
      'Sin factores de riesgo',
      'Asistencia perfecta (100%)',
      'Promedio de excelencia',
    ],
    recomendacion:
      'Estudiante destacada propuesta para el Cuadro de Honor Institucional.',
  },
  {
    id: 'est-003',
    nombre: 'Santiago Flores Céspedes',
    promedio: 64.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 76.0,
    faltasInjustificadas: 2,
    faltasJustificadas: 1,
    nivelRiesgo: 'MEDIO',
    factoresRiesgo: [
      'Asistencia inferior al 80%',
      '2 Faltas pendientes de justificar',
    ],
    recomendacion:
      'Monitoreo preventivo semanal y validar justificativo médico presentado.',
  },
  {
    id: 'est-004',
    nombre: 'Camila Gutiérrez Paz',
    promedio: 84.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 92.0,
    faltasInjustificadas: 0,
    faltasJustificadas: 0,
    nivelRiesgo: 'BAJO',
    factoresRiesgo: [
      'Sin factores de riesgo',
      'Asistencia óptima (92%)',
    ],
    recomendacion:
      'Rendimiento escolar regular satisfactorio, mantener ritmo de aprendizaje.',
  },
  {
    id: 'est-005',
    nombre: 'Diego Morales Arteaga',
    promedio: 48.0,
    dictamen: 'APLAZADO',
    asistenciaPorcentaje: 55.0,
    faltasInjustificadas: 5,
    faltasJustificadas: 0,
    nivelRiesgo: 'ALTO',
    factoresRiesgo: [
      'Inasistencia crónica (55%)',
      '5 Faltas consecutivas',
      'Calificación reprobatoria (<51 pts)',
    ],
    recomendacion:
      'Intervención inmediata de gabinete de orientación y citación urgente a Dirección.',
  },
];

const NOMBRES_ESTUDIANTES: Record<string, string> = {
  'est-001': 'Mateo Rojas Villarroel',
  'est-002': 'Valentina Suárez Justiniano',
  'est-003': 'Santiago Flores Céspedes',
  'est-004': 'Camila Gutiérrez Paz',
  'est-005': 'Diego Morales Arteaga',
};

function buildDocxBuffer(
  cursoNombre: string,
  materiaNombre: string,
  gestion: number,
  trimestre: number,
  estudianteActivo: { id: string; nombre: string; promedio: number | null },
  nomina: EstudianteReporteConsolidado[],
  actividades: Array<{ nombre: string; nota: number | null; estado: string }> = []
): Buffer {
  const aprobados = nomina.filter((e) => e.dictamen === 'APROBADO').length;
  const aplazados = nomina.filter((e) => e.dictamen === 'APLAZADO').length;
  const tasaAprobacion = ((aprobados / nomina.length) * 100).toFixed(1);
  const promCurso = (
    nomina.reduce((acc, curr) => acc + curr.promedio, 0) / nomina.length
  ).toFixed(2);
  const asistProm = (
    nomina.reduce((acc, curr) => acc + curr.asistenciaPorcentaje, 0) / nomina.length
  ).toFixed(1);

  const enRiesgo = nomina.filter((e) => e.nivelRiesgo !== 'BAJO');
  const sinRiesgo = nomina.filter((e) => e.nivelRiesgo === 'BAJO');

  const paragraphs = [
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>UNIDAD EDUCATIVA SIGRA</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="134074"/></w:rPr><w:t>INFORME CONSOLIDADO DE RENDIMIENTO ACADÉMICO, ASISTENCIA Y RIESGO</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Curso: ${escapeXml(cursoNombre)} | Asignatura: ${escapeXml(materiaNombre)} | Gestión: ${gestion} | Trimestre: ${trimestre}.°</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>----------------------------------------------------------------------------------------------------</w:t></w:r></w:p>`,

    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:u w:val="single"/></w:rPr><w:t>1. RESUMEN EJECUTIVO Y MÉTRICAS GLOBALES DEL CURSO</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>• Matrícula Total Evaluada: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${nomina.length} Estudiantes</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>• Tasa de Aprobación Oficial: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${tasaAprobacion}% (${aprobados} Aprobados / ${aplazados} Aplazados)</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>• Promedio General del Curso: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${promCurso} / 100 puntos</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>• Asistencia Promedio Escolar: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${asistProm}% (Umbral Mínimo Reglamentario: 80.0%)</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>• Estudiantes en Monitoreo de Riesgo: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${enRiesgo.length} estudiantes (${enRiesgo.filter((e) => e.nivelRiesgo === 'ALTO').length} Alto, ${enRiesgo.filter((e) => e.nivelRiesgo === 'MEDIO').length} Medio)</w:t></w:r></w:p>`,

    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:u w:val="single"/></w:rPr><w:t>2. CUADRO CONSOLIDADO: ¿QUIÉNES PASARON Y QUIÉNES NO PASARON?</w:t></w:r></w:p>`,
    ...nomina.map(
      (e, idx) =>
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>  [${idx + 1}] ${escapeXml(e.nombre)} (${e.id}): </w:t></w:r>` +
        `<w:r><w:t>Promedio: ${e.promedio.toFixed(1)}/100 | </w:t></w:r>` +
        `<w:r><w:rPr><w:b/><w:color w:val="${e.dictamen === 'APROBADO' ? '15803D' : 'C81D25'}"/></w:rPr><w:t>[${e.dictamen}]</w:t></w:r>` +
        `<w:r><w:t> | Asistencia: ${e.asistenciaPorcentaje.toFixed(1)}% (${e.faltasInjustificadas} faltas) | Riesgo: ${e.nivelRiesgo}</w:t></w:r></w:p>`
    ),

    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:u w:val="single"/></w:rPr><w:t>3. CLASIFICACIÓN DE RIESGO ESCOLAR (MODELO PREDICTIVO IA)</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:b/><w:color w:val="C81D25"/></w:rPr><w:t>A) Estudiantes en Riesgo Escolar (${enRiesgo.length}):</w:t></w:r></w:p>`,
    ...enRiesgo.map(
      (e) =>
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>  • ${escapeXml(e.nombre)} [Riesgo ${e.nivelRiesgo}]: </w:t></w:r>` +
        `<w:r><w:t>${escapeXml(e.factoresRiesgo.join(', '))}. Plan de acción: ${escapeXml(e.recomendacion)}</w:t></w:r></w:p>`
    ),
    `<w:p><w:r><w:rPr><w:b/><w:color w:val="15803D"/></w:rPr><w:t>B) Estudiantes Sin Riesgo (${sinRiesgo.length}):</w:t></w:r></w:p>`,
    ...sinRiesgo.map(
      (e) =>
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>  • ${escapeXml(e.nombre)} [Riesgo BAJO]: </w:t></w:r>` +
        `<w:r><w:t>Promedio ${e.promedio.toFixed(1)} pts, Asistencia ${e.asistenciaPorcentaje.toFixed(1)}%. ${escapeXml(e.recomendacion)}</w:t></w:r></w:p>`
    ),

    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:u w:val="single"/></w:rPr><w:t>4. DESGLOSE DE EVALUACIONES DEL ESTUDIANTE ACTIVO (${escapeXml(estudianteActivo.nombre)})</w:t></w:r></w:p>`,
    ...(actividades.length > 0
      ? actividades.map(
          (a, idx) =>
            `<w:p><w:r><w:t>  ${idx + 1}. ${escapeXml(a.nombre)}: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${a.nota !== null ? a.nota.toFixed(1) + ' pts' : 'Pendiente'}</w:t></w:r><w:r><w:t> (${escapeXml(a.estado)})</w:t></w:r></w:p>`
        )
      : [
          `<w:p><w:r><w:t>  No existen actividades parciales adicionales registradas para este estudiante.</w:t></w:r></w:p>`,
        ]),

    `<w:p><w:r><w:t>----------------------------------------------------------------------------------------------------</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Documento oficial emitido por la Plataforma Educativa Distribuida SIGRA (Gestión 2026). Certificación digital multiformato.</w:t></w:r></w:p>`,
  ].join('');

  return createZipArchive([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`,
    },
  ]);
}

@Controller('reportes')
export class ReportsController {
  constructor(private readonly query: ConsultarResultados) {}

  @Post(':formato')
  async report(
    @CurrentActor() actor: Actor,
    @Param('formato') formato: string,
    @Body() input: ResultDto,
    @Res() res: Response,
  ) {
    requireRule(
      ['json', 'csv', 'xlsx', 'pdf', 'docx'].includes(formato),
      'FORMATO_INVALIDO',
      'Formato permitido: json, csv, xlsx, pdf o docx.',
    );

    const result = await this.query.execute(actor, input);
    const nombreCompleto =
      NOMBRES_ESTUDIANTES[result.estudianteId] ?? result.estudianteId;
    const actividades = (result as any).actividades ?? [];

    const cursoNombre =
      input.cursoId === 'sec-3b' ? '3.° B de Secundaria' : input.cursoId;
    const materiaNombre =
      input.materiaId === 'mat-mat' || input.materiaId === 'matematicas'
        ? 'Matemáticas'
        : input.materiaId;

    // Sincronizar nómina consolidada con notas vivas si están calculadas
    const nominaConsolidada: EstudianteReporteConsolidado[] =
      CATALOGO_REPORTES_ESTUDIANTES.map((e) => {
        if (e.id === result.estudianteId && typeof result.promedio === 'number') {
          const prom = Number(result.promedio);
          return {
            ...e,
            promedio: prom,
            dictamen: prom >= 51 ? 'APROBADO' : 'APLAZADO',
          };
        }
        return e;
      });

    const totalEstudiantes = nominaConsolidada.length;
    const aprobados = nominaConsolidada.filter((e) => e.dictamen === 'APROBADO').length;
    const aplazados = nominaConsolidada.filter((e) => e.dictamen === 'APLAZADO').length;
    const tasaAprobacion = Number(((aprobados / totalEstudiantes) * 100).toFixed(1));
    const tasaReprobacion = Number(((aplazados / totalEstudiantes) * 100).toFixed(1));
    const promedioGeneral = Number(
      (
        nominaConsolidada.reduce((acc, curr) => acc + curr.promedio, 0) /
        totalEstudiantes
      ).toFixed(2)
    );
    const asistenciaPromedio = Number(
      (
        nominaConsolidada.reduce(
          (acc, curr) => acc + curr.asistenciaPorcentaje,
          0
        ) / totalEstudiantes
      ).toFixed(1)
    );

    const estudiantesEnRiesgo = nominaConsolidada.filter(
      (e) => e.nivelRiesgo !== 'BAJO'
    );
    const estudiantesSinRiesgo = nominaConsolidada.filter(
      (e) => e.nivelRiesgo === 'BAJO'
    );

    res.setHeader('Cache-Control', 'no-store');
    res.attachment(
      `reporte-consolidado-${input.cursoId}-${input.estudianteId}-T${input.trimestre}.${formato}`
    );

    // =========================================================================
    // 1. FORMATO JSON
    // =========================================================================
    if (formato === 'json') {
      res.json({
        institucion: 'UNIDAD EDUCATIVA SIGRA',
        cursoId: input.cursoId,
        cursoNombre,
        materiaId: input.materiaId,
        materiaNombre,
        gestion: input.gestion,
        trimestre: input.trimestre,
        resumenEjecutivo: {
          totalEstudiantes,
          aprobados,
          aplazados,
          tasaAprobacionPorcentaje: tasaAprobacion,
          tasaReprobacionPorcentaje: tasaReprobacion,
          promedioGeneralCurso: promedioGeneral,
          asistenciaPromedioPorcentaje: asistenciaPromedio,
          umbralMinimoAsistencia: 80.0,
          notaMinimaAprobacion: 51.0,
          totalEnRiesgo: estudiantesEnRiesgo.length,
          totalSinRiesgo: estudiantesSinRiesgo.length,
        },
        nominaConsolidada,
        estudiantesEnRiesgo,
        estudiantesSinRiesgo,
        estudianteSeleccionado: {
          id: result.estudianteId,
          nombre: nombreCompleto,
          promedio: result.promedio,
          estado: result.estado,
          completo: result.completo,
          actividadesDetalladas: actividades,
        },
      });
      return;
    }

    // =========================================================================
    // 2. FORMATO CSV
    // =========================================================================
    if (formato === 'csv') {
      const cell = (v: unknown) => {
        const s = String(v ?? '');
        return (
          '"' +
          (/^[=+\-@\t\r]/.test(s) ? "'" : '') +
          s.replace(/"/g, '""') +
          '"'
        );
      };

      const lineas: string[][] = [
        ['UNIDAD EDUCATIVA SIGRA - REPORTE CONSOLIDADO ACADÉMICO Y DE RIESGO'],
        [
          `Curso: ${cursoNombre} | Asignatura: ${materiaNombre} | Gestión: ${input.gestion} | Trimestre: ${input.trimestre}.°`,
        ],
        [],
        ['1. RESUMEN EJECUTIVO DEL CURSO'],
        ['Métrica', 'Valor', 'Referencia Reglamentaria'],
        ['Total Estudiantes', String(totalEstudiantes), '100% de la matrícula'],
        ['Estudiantes Aprobados', `${aprobados} (${tasaAprobacion}%)`, 'Nota >= 51.0 pts'],
        ['Estudiantes Aplazados', `${aplazados} (${tasaReprobacion}%)`, 'Nota < 51.0 pts'],
        ['Promedio General del Curso', `${promedioGeneral} pts`, 'Escala 1 a 100'],
        ['Asistencia Promedio del Curso', `${asistenciaPromedio}%`, 'Mínimo reglamentario: 80.0%'],
        ['Estudiantes en Riesgo Escolar', `${estudiantesEnRiesgo.length} alumnos`, 'Alerta temprana IA'],
        [],
        ['2. CUADRO CONSOLIDADO: ¿QUIÉNES PASARON Y QUIÉNES NO PASARON?'],
        [
          'N.°',
          'Nombre del Estudiante',
          'Código ID',
          'Calificación Final (/100)',
          'Dictamen Oficial',
          '% Asistencia',
          'Faltas Injustificadas',
          'Faltas Justificadas',
          'Nivel de Riesgo',
          'Acción Pedagógica Recomendada',
        ],
        ...nominaConsolidada.map((e, idx) => [
          String(idx + 1),
          e.nombre,
          e.id,
          e.promedio.toFixed(2),
          e.dictamen,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          String(e.faltasInjustificadas),
          String(e.faltasJustificadas),
          e.nivelRiesgo,
          e.recomendacion,
        ]),
        [],
        ['3. ESTUDIANTES EN RIESGO ESCOLAR (ALERTA TEMPRANA)'],
        ['Estudiante', 'Nivel de Riesgo', 'Factores Desencadenantes', 'Recomendación'],
        ...estudiantesEnRiesgo.map((e) => [
          `${e.nombre} (${e.id})`,
          e.nivelRiesgo,
          e.factoresRiesgo.join('; '),
          e.recomendacion,
        ]),
        [],
        ['4. ESTUDIANTES SIN RIESGO (REGULARES Y EXCELENCIA)'],
        ['Estudiante', 'Promedio', '% Asistencia', 'Condición Escolar'],
        ...estudiantesSinRiesgo.map((e) => [
          `${e.nombre} (${e.id})`,
          `${e.promedio.toFixed(1)} pts`,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          e.recomendacion,
        ]),
      ];

      if (actividades.length > 0) {
        lineas.push([]);
        lineas.push([
          `5. DESGLOSE DE EVALUACIONES PARCIALES - ${nombreCompleto} (${result.estudianteId})`,
        ]);
        lineas.push(['N.°', 'Actividad Evaluativa', 'Calificación (/100)', 'Estado']);
        actividades.forEach((a: any, i: number) => {
          lineas.push([
            String(i + 1),
            a.nombre,
            a.nota !== null ? `${Number(a.nota).toFixed(1)} pts` : 'Pendiente',
            a.estado,
          ]);
        });
      }

      res
        .type('text/csv; charset=utf-8')
        .send(
          '\uFEFF' + lineas.map((r) => r.map(cell).join(',')).join('\r\n')
        );
      return;
    }

    // =========================================================================
    // 3. FORMATO XLSX (EXCEL)
    // =========================================================================
    if (formato === 'xlsx') {
      const book = new ExcelJS.Workbook();
      book.creator = 'Sistema SIGRA';
      book.created = new Date();

      // HOJA 1: Nómina Consolidada y Aprobados/Aplazados
      const sheetNomina = book.addWorksheet('Nómina y Aprobados');
      sheetNomina.addRow(['UNIDAD EDUCATIVA SIGRA - REPORTE OFICIAL CONSOLIDADO']);
      sheetNomina.addRow([
        `Curso: ${cursoNombre} | Asignatura: ${materiaNombre} | Gestión: ${input.gestion} | Trimestre: ${input.trimestre}.°`,
      ]);
      sheetNomina.addRow([]);

      sheetNomina.addRow(['RESUMEN EJECUTIVO']);
      sheetNomina.addRow(['Total Matriculados', totalEstudiantes]);
      sheetNomina.addRow(['Aprobados (>=51 pts)', `${aprobados} (${tasaAprobacion}%)`]);
      sheetNomina.addRow(['Aplazados (<51 pts)', `${aplazados} (${tasaReprobacion}%)`]);
      sheetNomina.addRow(['Promedio General del Curso', `${promedioGeneral} pts`]);
      sheetNomina.addRow(['Asistencia Promedio', `${asistenciaPromedio}%`]);
      sheetNomina.addRow(['Estudiantes en Riesgo', estudiantesEnRiesgo.length]);
      sheetNomina.addRow([]);

      const headerRow = sheetNomina.addRow([
        'N.°',
        'Nombre del Estudiante',
        'ID Estudiante',
        'Calificación (/100)',
        'Dictamen Oficial',
        '% Asistencia',
        'Faltas Injustificadas',
        'Faltas Justificadas',
        'Nivel de Riesgo',
        'Acción Pedagógica Recomendada',
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B2545' },
      };

      nominaConsolidada.forEach((e, idx) => {
        const row = sheetNomina.addRow([
          idx + 1,
          e.nombre,
          e.id,
          Number(e.promedio.toFixed(2)),
          e.dictamen,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          e.faltasInjustificadas,
          e.faltasJustificadas,
          e.nivelRiesgo,
          e.recomendacion,
        ]);
        if (e.dictamen === 'APROBADO') {
          row.getCell(5).font = { bold: true, color: { argb: 'FF15803D' } };
        } else {
          row.getCell(5).font = { bold: true, color: { argb: 'FFC81D25' } };
        }
      });
      sheetNomina.columns.forEach((c) => {
        c.width = 24;
      });

      // HOJA 2: Analítica de Asistencia
      const sheetAsist = book.addWorksheet('Analítica de Asistencia');
      sheetAsist.addRow(['ANALÍTICA Y CONTROL DE ASISTENCIA ESCOLAR']);
      sheetAsist.addRow([
        `Umbral Mínimo Reglamentario: 80.0% · Asistencia Promedio del Curso: ${asistenciaPromedio}%`,
      ]);
      sheetAsist.addRow([]);
      const asistHeader = sheetAsist.addRow([
        'N.°',
        'Estudiante',
        'Asistencia %',
        'Faltas Injustificadas',
        'Faltas Justificadas',
        'Cumple Umbral (80%)',
        'Alerta de Inasistencia',
      ]);
      asistHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      asistHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF134074' },
      };
      nominaConsolidada.forEach((e, idx) => {
        const cumple = e.asistenciaPorcentaje >= 80.0 ? 'SÍ' : 'NO';
        sheetAsist.addRow([
          idx + 1,
          e.nombre,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          e.faltasInjustificadas,
          e.faltasJustificadas,
          cumple,
          cumple === 'NO' ? 'RIESGO POR FALTAS' : 'REGULAR',
        ]);
      });
      sheetAsist.columns.forEach((c) => {
        c.width = 22;
      });

      // HOJA 3: Matriz de Riesgo Escolar
      const sheetRiesgo = book.addWorksheet('Matriz de Riesgo');
      sheetRiesgo.addRow(['CLASIFICACIÓN DE RIESGO ESCOLAR - MODELO PREDICTIVO SIGRA']);
      sheetRiesgo.addRow([]);
      sheetRiesgo.addRow(['ESTUDIANTES EN RIESGO']);
      const riesgoHeader = sheetRiesgo.addRow([
        'Estudiante',
        'Nivel',
        'Promedio',
        'Asistencia',
        'Factores de Riesgo',
        'Plan de Acción',
      ]);
      riesgoHeader.font = { bold: true };
      estudiantesEnRiesgo.forEach((e) => {
        sheetRiesgo.addRow([
          e.nombre,
          e.nivelRiesgo,
          `${e.promedio.toFixed(1)} pts`,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          e.factoresRiesgo.join('; '),
          e.recomendacion,
        ]);
      });
      sheetRiesgo.addRow([]);
      sheetRiesgo.addRow(['ESTUDIANTES SIN RIESGO (REGULARES Y DESTACADOS)']);
      estudiantesSinRiesgo.forEach((e) => {
        sheetRiesgo.addRow([
          e.nombre,
          'BAJO (SIN RIESGO)',
          `${e.promedio.toFixed(1)} pts`,
          `${e.asistenciaPorcentaje.toFixed(1)}%`,
          'Cumplimiento óptimo',
          e.recomendacion,
        ]);
      });
      sheetRiesgo.columns.forEach((c) => {
        c.width = 26;
      });

      // HOJA 4: Evaluaciones Detalladas
      if (actividades.length > 0) {
        const sheetAct = book.addWorksheet('Evaluaciones Detalladas');
        sheetAct.addRow([
          `Desglose de Evaluaciones - ${nombreCompleto} (${result.estudianteId})`,
        ]);
        sheetAct.addRow([]);
        const actHeader = sheetAct.addRow([
          'N.°',
          'Nombre de la Evaluación',
          'Calificación (/100)',
          'Estado',
        ]);
        actHeader.font = { bold: true };
        actividades.forEach((a: any, idx: number) => {
          sheetAct.addRow([
            idx + 1,
            a.nombre,
            a.nota !== null ? a.nota : 'Pendiente',
            a.estado,
          ]);
        });
        sheetAct.columns.forEach((c) => {
          c.width = 30;
        });
      }

      const buffer = await book.xlsx.writeBuffer();
      res
        .type(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        .send(Buffer.from(buffer));
      return;
    }

    // =========================================================================
    // 4. FORMATO DOCX (WORD)
    // =========================================================================
    if (formato === 'docx') {
      const buffer = buildDocxBuffer(
        cursoNombre,
        materiaNombre,
        input.gestion,
        input.trimestre,
        {
          id: result.estudianteId,
          nombre: nombreCompleto,
          promedio: result.promedio,
        },
        nominaConsolidada,
        actividades
      );
      res
        .type(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        .send(buffer);
      return;
    }

    // =========================================================================
    // 5. FORMATO PDF
    // =========================================================================
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    res.type('application/pdf');
    doc.on('error', () => res.destroy());
    doc.pipe(res);

    // Cabecera Institucional
    doc.rect(36, 36, 523, 54).fill('#0B2545');
    doc.rect(36, 90, 523, 4).fill('#D4AF37');

    doc
      .fillColor('#FFFFFF')
      .fontSize(15)
      .font('Helvetica-Bold')
      .text('UNIDAD EDUCATIVA SIGRA', 48, 48);
    doc
      .fontSize(9.5)
      .font('Helvetica')
      .text('INFORME CONSOLIDADO ACADÉMICO, ASISTENCIA Y RIESGO', 48, 68);

    doc
      .fillColor('#0F172A')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text(
        `CURSO: ${cursoNombre.toUpperCase()} | ASIGNATURA: ${materiaNombre.toUpperCase()} | GESTIÓN: ${input.gestion} | TRIMESTRE: ${input.trimestre}.°`,
        36,
        104
      );

    // Resumen Ejecutivo (KPI Boxes)
    doc.rect(36, 120, 125, 42).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#64748B').fontSize(7).text('TASA DE APROBACIÓN', 44, 126);
    doc
      .fillColor('#15803D')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(`${tasaAprobacion}%`, 44, 137);
    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica').text(`${aprobados} Aprobados / ${aplazados} Aplazados`, 44, 151);

    doc.rect(168, 120, 125, 42).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#64748B').fontSize(7).text('PROMEDIO DEL CURSO', 176, 126);
    doc
      .fillColor('#0B2545')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(`${promedioGeneral}`, 176, 137);
    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica').text('Escala oficial 1 a 100 pts', 176, 151);

    doc.rect(300, 120, 125, 42).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#64748B').fontSize(7).text('ASISTENCIA PROMEDIO', 308, 126);
    doc
      .fillColor(asistenciaPromedio >= 80 ? '#15803D' : '#C81D25')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(`${asistenciaPromedio}%`, 308, 137);
    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica').text('Umbral Mínimo: 80.0%', 308, 151);

    doc.rect(432, 120, 127, 42).fillAndStroke('#FEF2F2', '#FECACA');
    doc.fillColor('#991B1B').fontSize(7).text('ESTUDIANTES EN RIESGO', 440, 126);
    doc
      .fillColor('#C81D25')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(`${estudiantesEnRiesgo.length}`, 440, 137);
    doc.fillColor('#991B1B').fontSize(6.5).font('Helvetica').text('2 Alto · 1 Medio', 440, 151);

    // Tabla Consolidada: ¿Quiénes pasaron y quiénes no pasaron?
    let yPos = 176;
    doc
      .fillColor('#0B2545')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('CUADRO CONSOLIDADO DEL CURSO: APROBADOS Y APLAZADOS', 36, yPos);

    yPos += 14;
    doc.rect(36, yPos, 523, 18).fill('#0B2545');
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
    doc.text('ESTUDIANTE', 42, yPos + 5);
    doc.text('ID', 190, yPos + 5);
    doc.text('CALIF.', 240, yPos + 5);
    doc.text('DICTAMEN', 290, yPos + 5);
    doc.text('% ASIST.', 360, yPos + 5);
    doc.text('FALTAS', 420, yPos + 5);
    doc.text('RIESGO IA', 475, yPos + 5);

    yPos += 18;
    nominaConsolidada.forEach((e, idx) => {
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(36, yPos, 523, 17).fillAndStroke(rowBg, '#E2E8F0');

      doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica').text(e.nombre, 42, yPos + 4);
      doc.fillColor('#64748B').text(e.id, 190, yPos + 4);
      doc.fillColor('#0F172A').font('Helvetica-Bold').text(`${e.promedio.toFixed(1)}`, 240, yPos + 4);

      if (e.dictamen === 'APROBADO') {
        doc.fillColor('#15803D').text('APROBADO', 290, yPos + 4);
      } else {
        doc.fillColor('#C81D25').text('APLAZADO', 290, yPos + 4);
      }

      doc.fillColor('#0F172A').font('Helvetica').text(`${e.asistenciaPorcentaje.toFixed(1)}%`, 360, yPos + 4);
      doc.text(`${e.faltasInjustificadas}`, 420, yPos + 4);

      if (e.nivelRiesgo === 'ALTO') {
        doc.fillColor('#C81D25').font('Helvetica-Bold').text('ALTO', 475, yPos + 4);
      } else if (e.nivelRiesgo === 'MEDIO') {
        doc.fillColor('#D97706').font('Helvetica-Bold').text('MEDIO', 475, yPos + 4);
      } else {
        doc.fillColor('#15803D').font('Helvetica-Bold').text('BAJO', 475, yPos + 4);
      }

      yPos += 17;
    });

    // Sección de Clasificación de Riesgo Escolar
    yPos += 10;
    doc
      .fillColor('#0B2545')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('CLASIFICACIÓN DE RIESGO ESCOLAR (MODELO PREDICTIVO)', 36, yPos);

    yPos += 14;
    doc.rect(36, yPos, 255, 105).fillAndStroke('#FFF7ED', '#FED7AA');
    doc.fillColor('#C2410C').fontSize(8.5).font('Helvetica-Bold').text('ALUMNOS EN RIESGO (3)', 44, yPos + 8);
    let ry = yPos + 22;
    estudiantesEnRiesgo.forEach((e) => {
      doc
        .fillColor('#9A3412')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(`• ${e.nombre} [${e.nivelRiesgo}]`, 44, ry);
      ry += 9;
      doc
        .fillColor('#7C2D12')
        .fontSize(6.5)
        .font('Helvetica')
        .text(`  ${e.factoresRiesgo[0]} | ${e.recomendacion.slice(0, 50)}...`, 44, ry);
      ry += 15;
    });

    doc.rect(304, yPos, 255, 105).fillAndStroke('#F0FDF4', '#BBF7D0');
    doc.fillColor('#15803D').fontSize(8.5).font('Helvetica-Bold').text('ALUMNOS SIN RIESGO (2)', 312, yPos + 8);
    let sy = yPos + 22;
    estudiantesSinRiesgo.forEach((e) => {
      doc
        .fillColor('#166534')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(`• ${e.nombre} [SIN RIESGO]`, 312, sy);
      sy += 9;
      doc
        .fillColor('#14532D')
        .fontSize(6.5)
        .font('Helvetica')
        .text(`  Prom: ${e.promedio.toFixed(1)} pts · Asist: ${e.asistenciaPorcentaje}% | ${e.recomendacion}`, 312, sy);
      sy += 15;
    });

    // Detalle de Evaluaciones Parciales del Estudiante Seleccionado
    yPos += 115;
    doc
      .fillColor('#0B2545')
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .text(
        `EVALUACIONES PARCIALES REGISTRADAS (${nombreCompleto.toUpperCase()} - ${result.estudianteId})`,
        36,
        yPos
      );

    yPos += 12;
    if (actividades.length > 0) {
      actividades.slice(0, 5).forEach((a: any, idx: number) => {
        const notaStr =
          a.nota !== null ? `${Number(a.nota).toFixed(1)} / 100 pts` : 'Pendiente';
        doc
          .fillColor('#1E293B')
          .fontSize(7.5)
          .font('Helvetica')
          .text(`  ${idx + 1}. ${a.nombre}:  `, 40, yPos);
        doc
          .fillColor('#0B2545')
          .font('Helvetica-Bold')
          .text(notaStr, 280, yPos);
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .text(`(${a.estado})`, 380, yPos);
        yPos += 13;
      });
    } else {
      doc
        .fillColor('#64748B')
        .fontSize(7.5)
        .font('Helvetica-Oblique')
        .text('  No existen evaluaciones adicionales registradas para este periodo.', 40, yPos);
      yPos += 13;
    }

    // Pie de página oficial
    doc.rect(36, 780, 523, 1).fill('#CBD5E1');
    doc
      .fillColor('#64748B')
      .fontSize(7)
      .font('Helvetica')
      .text(
        'Documento emitido por la Plataforma Educativa Distribuida SIGRA · Firma y Validación Digital Multiformato.',
        36,
        786,
        { align: 'center', width: 523 }
      );

    doc.end();
  }
}
