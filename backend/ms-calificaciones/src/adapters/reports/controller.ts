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

function buildDocxBuffer(headers: string[], row: unknown[]): Buffer {
  const paragraphs = [
    `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>SIGRA - Resultado trimestral</w:t></w:r></w:p>`,
    ...headers.map(
      (label, i) =>
        `<w:p><w:r><w:t>${escapeXml(label)}: ${escapeXml(row[i])}</w:t></w:r></w:p>`,
    ),
    `<w:p><w:r><w:t>Prototipo academico: promedio simple. No sustituye la libreta oficial.</w:t></w:r></w:p>`,
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
    const row = [
      result.estudianteId,
      result.cursoId,
      result.materiaId,
      result.gestion,
      result.trimestre,
      result.estado,
      result.promedio ?? 'Pendiente',
    ];
    const headers = [
      'Estudiante',
      'Curso',
      'Materia',
      'Gestión',
      'Trimestre',
      'Estado',
      'Promedio',
    ];
    res.setHeader('Cache-Control', 'no-store');
    res.attachment('resultado-trimestral.' + formato);
    if (formato === 'json') {
      res.json(result);
      return;
    }
    if (formato === 'csv') {
      const cell = (v: unknown) => {
        const s = String(v);
        return (
          '"' +
          (/^[=+\-@\t\r]/.test(s) ? "'" : '') +
          s.replace(/"/g, '""') +
          '"'
        );
      };
      res
        .type('text/csv')
        .send(
          '\uFEFF' +
            [headers, row].map((r) => r.map(cell).join(',')).join('\r\n'),
        );
      return;
    }
    if (formato === 'xlsx') {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Resultado');
      sheet.addRow(headers);
      sheet.addRow(row);
      sheet.columns.forEach((c) => {
        c.width = 22;
      });
      const buffer = await book.xlsx.writeBuffer();
      res
        .type(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .send(Buffer.from(buffer));
      return;
    }
    if (formato === 'docx') {
      const buffer = buildDocxBuffer(headers, row);
      res
        .type(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .send(buffer);
      return;
    }
    const doc = new PDFDocument({ margin: 40 });
    res.type('application/pdf');
    doc.on('error', () => res.destroy());
    doc.pipe(res);
    doc.fontSize(18).text('SIGRA - Resultado trimestral');
    doc.moveDown();
    headers.forEach((label, i) => doc.fontSize(12).text(label + ': ' + row[i]));
    doc
      .moveDown()
      .fontSize(10)
      .text(
        'Prototipo académico: promedio simple. No sustituye la libreta oficial.',
      );
    doc.end();
  }
}
