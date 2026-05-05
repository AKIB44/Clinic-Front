import { Routes } from '@angular/router';

export const RxRoutes: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./prescription-form/prescription-form.component').then(
        m => m.PrescriptionFormComponent
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./prescription-form/prescription-form.component').then(
        m => m.PrescriptionFormComponent
      ),
  },
];
