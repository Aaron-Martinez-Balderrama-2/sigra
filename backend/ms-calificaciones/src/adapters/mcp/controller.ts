import { All, Controller, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AuthRequest } from '../auth/auth';
import { ToolsService, contextShape, studentShape } from './tools';
import { DomainError } from '../../core/errors/domain-error';
@Controller('mcp')
export class McpController {
  constructor(private readonly tools: ToolsService) {}
  @All()
  async handle(@Req() req: AuthRequest, @Res() res: Response) {
    const origin = req.headers.origin;
    const allowed = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((x) => x.trim());
    if (origin && !allowed.includes(origin)) {
      res.status(403).json({ mensaje: 'Origen no autorizado.' });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).end();
      return;
    }
    const server = new McpServer({
      name: 'sigra-calificaciones',
      version: '0.1.0',
    });
    const register = (
      name: string,
      description: string,
      schema: typeof contextShape | typeof studentShape,
    ) => {
      server.registerTool(
        name,
        {
          description,
          inputSchema: schema,
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        async (input: unknown) => {
          try {
            const result = await this.tools.call(name, input, req.actor);
            return {
              content: [
                { type: 'text' as const, text: JSON.stringify(result) },
              ],
            };
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text:
                    error instanceof DomainError
                      ? error.message
                      : 'No se pudo consultar la herramienta.',
                },
              ],
            };
          }
        },
      );
    };
    register(
      'consultar_ficha',
      'Consulta autorizada de notas, asistencia y alertas del estudiante.',
      studentShape,
    );
    register(
      'listar_alertas',
      'Consulta autorizada de alertas; requiere el endpoint real de Riesgo.',
      studentShape,
    );
    register(
      'resumen_curso',
      'Resultados del curso para docente asignado o director.',
      contextShape,
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
