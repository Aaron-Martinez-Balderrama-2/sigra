import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'asistencia',
    pathMatch: 'full',
  },
  {
    path: 'asistencia',
    loadComponent: () =>
      import('./features/asistencia/planilla-asistencia.component').then(
        (m) => m.PlanillaAsistenciaComponent
      ),
  },
  {
    path: 'calificaciones',
    loadComponent: () =>
      import('./features/calificaciones/calificaciones.component').then(
        (m) => m.CalificacionesComponent
      ),
  },
  {
    path: 'justificativos',
    loadComponent: () =>
      import('./features/justificativos/justificativos.component').then(
        (m) => m.JustificativosComponent
      ),
  },
  {
    path: 'saga-marcas',
    loadComponent: () =>
      import('./features/saga-marcas/saga-marcas.component').then(
        (m) => m.SagaMarcasComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'asistencia',
  },
];
