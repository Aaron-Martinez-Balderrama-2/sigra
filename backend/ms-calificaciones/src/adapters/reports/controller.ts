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
  return String(value)
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
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0, 6); // General purpose bit flag
    localHeader.writeUInt16LE(8, 8); // Compression method: Deflate (8)
    localHeader.writeUInt16LE(0, 10); // Last mod file time
    localHeader.writeUInt16LE(0, 12); // Last mod file date
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(rawBuf.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory file header signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed to extract
    centralHeader.writeUInt16LE(0, 8); // General purpose bit flag
    centralHeader.writeUInt16LE(8, 10); // Compression method: Deflate
    centralHeader.writeUInt16LE(0, 12); // Last mod file time
    centralHeader.writeUInt16LE(0, 14); // Last mod file date
    centralHeader.writeUInt32LE(crc, 16); // CRC-32
    centralHeader.writeUInt32LE(compressed.length, 20); // Compressed size
    centralHeader.writeUInt32LE(rawBuf.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28); // File name length
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(0, 38); // External file attributes
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  endRecord.writeUInt16LE(0, 4); // Number of this disk
  endRecord.writeUInt16LE(0, 6); // Disk where central directory starts
  endRecord.writeUInt16LE(entries.length, 8); // Number of central directory records on this disk
  endRecord.writeUInt16LE(entries.length, 10); // Total number of central directory records
  endRecord.writeUInt32LE(centralDir.length, 12); // Size of central directory
  endRecord.writeUInt32LE(offset, 16); // Offset of start of central directory
  endRecord.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localParts, centralDir, endRecord]);
}

const NOMBRES_ESTUDIANTES: Record<string, string> = {
  'est-001': 'Mateo Rojas Villarroel',
  'est-002': 'Valentina Suárez Justiniano',
  'est-003': 'Santiago Flores Céspedes',
  'est-004': 'Camila Gutiérrez Paz',
  'est-005': 'Diego Morales Arteaga',
};

function buildDocxBuffer(
  headers: string[],
  row: unknown[],
  actividades: Array<{ nombre: string; nota: number | null }> = []
): Buffer {
  const paragraphs = [
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>UNIDAD EDUCATIVA SIGRA - BOLETÍN DE CALIFICACIONES</w:t></w:r></w:p>`,
    ...headers.map(
      (label, i) =>
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(label)}: </w:t></w:r><w:r><w:t>${escapeXml(row[i])}</w:t></w:r></w:p>`,
    ),
    ...(actividades.length > 0
      ? [
          `<w:p><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>DESGLOSE DETALLADO DE EVALUACIONES:</w:t></w:r></w:p>`,
          ...actividades.map(
            (a, idx) =>
              `<w:p><w:r><w:t>  ${idx + 1}. ${escapeXml(a.nombre)}: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${a.nota !== null ? a.nota.toFixed(1) + ' pts' : 'Pendiente'}</w:t></w:r></w:p>`,
          ),
        ]
      : []),
    `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Sistema Integral de Gestión y Rendimiento Académico (SIGRA 2026).</w:t></w:r></w:p>`,
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

    const row = [
      `${nombreCompleto} (${result.estudianteId})`,
      result.cursoId === 'sec-3b' ? '3.° B de Secundaria' : result.cursoId,
      result.materiaId === 'mat-mat' || result.materiaId === 'matematicas'
        ? 'Matemáticas'
        : result.materiaId,
      result.gestion,
      `${result.trimestre}.° Trimestre`,
      result.estado,
      result.promedio !== null ? `${Number(result.promedio).toFixed(2)} / 100` : 'Pendiente',
    ];
    const headers = [
      'Estudiante',
      'Curso',
      'Materia',
      'Gestión',
      'Trimestre',
      'Estado',
      'Promedio Trimestral',
    ];
    res.setHeader('Cache-Control', 'no-store');
    res.attachment(`boletin-${result.estudianteId}.${formato}`);

    if (formato === 'json') {
      res.json({
        ...result,
        nombreEstudiante: nombreCompleto,
        actividadesDetalladas: actividades,
      });
      return;
    }

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
        ['UNIDAD EDUCATIVA SIGRA - REPORTE DE RENDIMIENTO ACADÉMICO'],
        [],
        headers,
        row.map(String),
      ];

      if (actividades.length > 0) {
        lineas.push([]);
        lineas.push(['DESGLOSE DE EVALUACIONES PARCIALES']);
        lineas.push(['N.°', 'Actividad Evaluativa', 'Calificación', 'Estado']);
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
        .type('text/csv')
        .send(
          '\uFEFF' +
            lineas.map((r) => r.map(cell).join(',')).join('\r\n'),
        );
      return;
    }

    if (formato === 'xlsx') {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Resumen de Calificaciones');
      sheet.addRow(['UNIDAD EDUCATIVA SIGRA - BOLETÍN OFICIAL DE CALIFICACIONES']);
      sheet.addRow([]);
      sheet.addRow(headers);
      sheet.addRow(row);
      sheet.columns.forEach((c) => {
        c.width = 26;
      });

      if (actividades.length > 0) {
        const sheetDetalle = book.addWorksheet('Desglose de Evaluaciones');
        sheetDetalle.addRow([
          `Evaluaciones Registradas - ${nombreCompleto} (${result.estudianteId})`,
        ]);
        sheetDetalle.addRow([]);
        sheetDetalle.addRow([
          'N.°',
          'Nombre de la Evaluación',
          'Calificación Obtenida (/100)',
          'Estado',
        ]);
        actividades.forEach((a: any, idx: number) => {
          sheetDetalle.addRow([
            idx + 1,
            a.nombre,
            a.nota !== null ? a.nota : 'Pendiente',
            a.estado,
          ]);
        });
        sheetDetalle.columns.forEach((c) => {
          c.width = 30;
        });
      }

      const buffer = await book.xlsx.writeBuffer();
      res
        .type(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .send(Buffer.from(buffer));
      return;
    }

    if (formato === 'docx') {
      const buffer = buildDocxBuffer(headers, row, actividades);
      res
        .type(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .send(buffer);
      return;
    }

    // PDF oficial
    const doc = new PDFDocument({ margin: 40 });
    res.type('application/pdf');
    doc.on('error', () => res.destroy());
    doc.pipe(res);

    doc.fontSize(16).text('UNIDAD EDUCATIVA SIGRA', { align: 'center' });
    doc.fontSize(12).text('BOLETÍN OFICIAL DE RENDIMIENTO TRIMESTRAL', { align: 'center' });
    doc.moveDown(1.2);

    headers.forEach((label, i) => {
      doc.fontSize(11).text(`${label}: ${row[i]}`);
    });

    if (actividades.length > 0) {
      doc.moveDown(1);
      doc.fontSize(13).text('DETALLE DE ACTIVIDADES Y EVALUACIONES:');
      doc.moveDown(0.5);
      actividades.forEach((a: any, idx: number) => {
        const notaStr = a.nota !== null ? `${Number(a.nota).toFixed(1)} / 100` : 'Pendiente';
        doc.fontSize(10).text(`  ${idx + 1}. ${a.nombre}:  ${notaStr} (${a.estado})`);
      });
    }

    doc.moveDown(1.5);
    doc
      .fontSize(9)
      .text(
        'Documento emitido por la Plataforma Educativa Distribuida SIGRA - Validación Digital.',
        { align: 'center' }
      );
    doc.end();
  }
}
