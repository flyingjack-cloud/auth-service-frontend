import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, adminGuard } from '@shared';

const adminLoginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/users']) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'login',
    canActivate: [adminLoginGuard],
    loadComponent: () =>
      import('./features/admin-login/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: '403',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/user-list/user-list.component').then(m => m.UserListComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./features/users/user-detail/user-detail.component').then(
            m => m.UserDetailComponent,
          ),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/client-list/client-list.component').then(
            m => m.ClientListComponent,
          ),
      },
      {
        path: 'clients/new',
        loadComponent: () =>
          import('./features/clients/client-form/client-form.component').then(
            m => m.ClientFormComponent,
          ),
      },
      {
        path: 'clients/:clientId',
        loadComponent: () =>
          import('./features/clients/client-form/client-form.component').then(
            m => m.ClientFormComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
