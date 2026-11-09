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

