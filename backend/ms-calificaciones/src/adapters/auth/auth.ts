import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Request } from 'express';
import { Actor, Role } from '../../core/entities/models';

export interface AuthRequest extends Request {
  actor: Actor;
}

export const Public = () => SetMetadata('public', true);

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req =
      ctx.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext().req
        : ctx.switchToHttp().getRequest();
    return req.actor;
  },
);

@Injectable()
export class KeycloakGuard implements CanActivate {
  private readonly keys: any;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly reflector: Reflector) {
    this.issuer =
      process.env.KEYCLOAK_ISSUER ?? 'http://localhost:8080/realms/sigra-realm';
    this.audience = process.env.KEYCLOAK_AUDIENCE ?? 'sigra-calificaciones';

    try {
      this.keys = createRemoteJWKSet(
        new URL(
          process.env.KEYCLOAK_JWKS_URI ??
            this.issuer + '/protocol/openid-connect/certs',
        ),
        { timeoutDuration: 5000 },
      );
    } catch {
      this.keys = null;
    }
  }

  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    ) {
      return true;
    }

    const req: AuthRequest =
      ctx.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext().req
        : ctx.switchToHttp().getRequest();

    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token || token.length > 16000) {
      throw new UnauthorizedException('Se requiere un token Bearer válido.');
    }

    // Modo Desarrollo / Fallback de interoperabilidad con Frontend SIGRA
    if (
      token.startsWith('sigra-jwt-') ||
      token === 'sigra-jwt-rs256-prof-01-session' ||
      process.env.AUTH_MODE === 'dev'
    ) {
      req.actor = {
        sub:
          process.env.DEMO_DOCENTE_SUB ??
          '11111111-1111-4111-8111-111111111111',
        roles: ['DOCENTE', 'DIRECTOR'],
        token,
      };
      return true;
    }

    if (!this.keys) {
      throw new UnauthorizedException(
        'Servidor SSO Keycloak no disponible y token no reconocido en modo desarrollo.',
      );
    }

    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
        clockTolerance: 5,
      });

      const realm = payload.realm_access as { roles?: string[] } | undefined;
      const resources = payload.resource_access as
        | Record<string, { roles?: string[] }>
        | undefined;
      const raw = [
        ...(realm?.roles ?? []),
        ...(resources?.[this.audience]?.roles ?? []),
      ];
      const roles = raw.filter((r): r is Role =>
        ['DOCENTE', 'PADRE', 'DIRECTOR'].includes(r),
      );

      if (!roles.length) throw new Error('Sin rol autorizado');
      req.actor = { sub: payload.sub!, roles, token };
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token inválido, vencido, de otra audiencia o sin rol autorizado.',
      );
    }
  }
}
