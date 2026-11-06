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
  private readonly keys;
  private readonly issuer: string;
  private readonly audience: string;
  constructor(private readonly reflector: Reflector) {
    this.issuer = process.env.KEYCLOAK_ISSUER ?? '';
    this.audience = process.env.KEYCLOAK_AUDIENCE ?? '';
    if (!this.issuer || !this.audience)
      throw new Error(
        'Configure KEYCLOAK_ISSUER y KEYCLOAK_AUDIENCE. No existe modo de autenticación omitida.',
      );
    this.keys = createRemoteJWKSet(
      new URL(
        process.env.KEYCLOAK_JWKS_URI ??
          this.issuer + '/protocol/openid-connect/certs',
      ),
      { timeoutDuration: 5000 },
    );
  }
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req: AuthRequest =
      ctx.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(ctx).getContext().req
        : ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token || token.length > 16000)
      throw new UnauthorizedException('Se requiere un token Bearer válido.');
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
        Record<string, { roles?: string[] }> | undefined;
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
