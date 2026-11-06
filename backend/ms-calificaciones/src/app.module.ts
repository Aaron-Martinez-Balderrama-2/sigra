import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLError } from 'graphql';
import { AppController } from './app.controller';
import { KeycloakGuard } from './adapters/auth/auth';
import { MongoStore } from './adapters/persistence/mongo/mongo-store';
import { InMemoryStore } from './adapters/persistence/memory/in-memory-store';
import { HttpServices } from './adapters/http/services';
import { CalificacionesResolver } from './adapters/graphql/resolver';
import { STORE, Store } from './core/ports/store';
import { SERVICES, Services } from './core/ports/services';
import { PrepararEvaluacion } from './core/use-cases/preparar-evaluacion';
import { RegistrarCalificaciones } from './core/use-cases/registrar-calificaciones';
import { PublicarEvaluacion } from './core/use-cases/publicar-evaluacion';
import { ConsultarResultados } from './core/use-cases/consultar-resultados';
import { DomainError } from './core/errors/domain-error';
import { ToolsService } from './adapters/mcp/tools';
import { McpController } from './adapters/mcp/controller';
import { ReportsController } from './adapters/reports/controller';
import { AgentController } from './adapters/agent/controller';
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      path: '/graphql',
      introspection: process.env.GRAPHQL_INTROSPECTION === 'true',
      playground: false,
      csrfPrevention: true,
      includeStacktraceInErrorResponses: false,
      context: ({ req }: { req: unknown }) => ({ req }),
      formatError: (formatted, error) => {
        const original = (error as GraphQLError).originalError;
        if (original instanceof DomainError)
          return {
            message: original.message,
            path: formatted.path,
            extensions: { code: original.code, status: original.status },
          };
        const code = formatted.extensions?.code;
        if (code === 'INTERNAL_SERVER_ERROR')
          return {
            message: 'No se pudo completar la operación.',
            extensions: { code },
          };
        return {
          message: formatted.message,
          path: formatted.path,
          extensions: {
            code,
            ...(formatted.extensions?.originalError
              ? { validation: formatted.extensions.originalError }
              : {}),
          },
        };
      },
    }),
  ],
  controllers: [
    AppController,
    McpController,
    ReportsController,
    AgentController,
  ],
  providers: [
    HttpServices,
    CalificacionesResolver,
    ToolsService,
    {
      provide: STORE,
      useFactory: () =>
        process.env.STORE_DRIVER === 'memory'
          ? new InMemoryStore()
          : new MongoStore(),
    },
    { provide: SERVICES, useExisting: HttpServices },
    {
      provide: PrepararEvaluacion,
      useFactory: (s: Store) => new PrepararEvaluacion(s),
      inject: [STORE],
    },
    {
      provide: RegistrarCalificaciones,
      useFactory: (s: Store) => new RegistrarCalificaciones(s),
      inject: [STORE],
    },
    {
      provide: PublicarEvaluacion,
      useFactory: (s: Store, h: Services) => new PublicarEvaluacion(s, h),
      inject: [STORE, SERVICES],
    },
    {
      provide: ConsultarResultados,
      useFactory: (s: Store, h: Services) => new ConsultarResultados(s, h),
      inject: [STORE, SERVICES],
    },
    { provide: APP_GUARD, useClass: KeycloakGuard },
  ],
})
export class AppModule {}
