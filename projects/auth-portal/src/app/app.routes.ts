import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, authGuard } from '@shared';

const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/account']) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/reset-password/reset-password.component').then(
            m => m.ResetPasswordComponent,
          ),
      },
      {
        path: '2fa-verify',
        loadComponent: () =>
          import('./features/two-fa-verify/two-fa-verify.component').then(m => m.TwoFaVerifyComponent),
      },
    ],
  },
  {
    path: 'consent',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/oauth2-consent/oauth2-consent.component').then(
        m => m.OAuth2ConsentComponent,
      ),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account-shell/account-shell.component').then(
        m => m.AccountShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/account/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/account/security/security.component').then(m => m.SecurityComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
