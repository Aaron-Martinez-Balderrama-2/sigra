import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module';
import { PublicarEvaluacion } from '../dist/core/use-cases/publicar-evaluacion';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { Role } from '../src/core/entities/models';
async function main() {
  const id = process.argv[2];
  const token = process.env.SIGRA_ACCESS_TOKEN;
  if (!id || !token)
    throw new Error(
      'Uso: SIGRA_ACCESS_TOKEN=<token vigente> npm run resume:saga -- <sagaId>',
    );
  const issuer = process.env.KEYCLOAK_ISSUER!;
  const audience = process.env.KEYCLOAK_AUDIENCE!;
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL(issuer + '/protocol/openid-connect/certs')),
    {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    },
  );
  const realm = payload.realm_access as { roles?: string[] } | undefined;
  const resources = payload.resource_access as
    Record<string, { roles?: string[] }> | undefined;
  const roles = [
    ...(realm?.roles ?? []),
    ...(resources?.[audience]?.roles ?? []),
  ].filter((r): r is Role => ['DOCENTE', 'PADRE', 'DIRECTOR'].includes(r));
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log(
      JSON.stringify(
        await app
          .get(PublicarEvaluacion)
          .resume({ sub: payload.sub!, token, roles }, id),
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
