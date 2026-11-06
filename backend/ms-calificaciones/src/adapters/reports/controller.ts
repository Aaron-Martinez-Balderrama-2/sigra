import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { CurrentActor } from '../auth/auth';
import { Actor } from '../../core/entities/models';
import { ConsultarResultados } from '../../core/use-cases/consultar-resultados';
import { ResultDto } from '../graphql/dto';
import { requireRule } from '../../core/errors/domain-error';
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
      ['json', 'csv', 'xlsx', 'pdf'].includes(formato),
      'FORMATO_INVALIDO',
      'Formato permitido: json, csv, xlsx o pdf.',
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
