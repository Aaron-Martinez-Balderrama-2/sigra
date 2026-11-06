import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { DomainError } from '../../core/errors/domain-error';
import { Response } from 'express';
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    if (host.getType<string>() === 'graphql') throw error;
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (error instanceof DomainError)
      return res
        .status(error.status)
        .json({ codigo: error.code, mensaje: error.message });
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    return res
      .status(500)
      .json({
        codigo: 'ERROR_INTERNO',
        mensaje: 'No se pudo completar la operación.',
      });
  }
}
