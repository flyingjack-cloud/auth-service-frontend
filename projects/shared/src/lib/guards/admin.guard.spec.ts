import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { adminGuard } from './admin.guard';

const ROUTE = {} as ActivatedRouteSnapshot;
const STATE = { url: '/users' } as RouterStateSnapshot;

function mockAuthService(loggedIn: boolean, roles: string[] = []) {
  const user: User | null = loggedIn
    ? { id: '1', username: 'u', phone: null, email: null, roles }
    : null;
  return { isLoggedIn: signal(loggedIn), currentUser: signal(user) };
}

describe('adminGuard', () => {
  let router: jasmine.SpyObj<Router>;

  describe('when user is not logged in', () => {
    beforeEach(() => {
      router = jasmine.createSpyObj('Router', ['createUrlTree']);
      router.createUrlTree.and.returnValue('/login' as any);
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: mockAuthService(false) },
          { provide: Router, useValue: router },
        ],
      });
    });

    it('redirects to /login', () => {
      TestBed.runInInjectionContext(() => adminGuard(ROUTE, STATE));
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('when user is logged in with ROLE_ADMIN', () => {
    beforeEach(() => {
      router = jasmine.createSpyObj('Router', ['createUrlTree']);
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: mockAuthService(true, ['ROLE_ADMIN']) },
          { provide: Router, useValue: router },
        ],
      });
    });

    it('returns true', () => {
      const result = TestBed.runInInjectionContext(() => adminGuard(ROUTE, STATE));
      expect(result).toBeTrue();
    });
  });

  describe('when user is logged in without ROLE_ADMIN', () => {
    beforeEach(() => {
      router = jasmine.createSpyObj('Router', ['createUrlTree']);
      router.createUrlTree.and.returnValue('/403' as any);
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: mockAuthService(true, ['ROLE_USER']) },
          { provide: Router, useValue: router },
        ],
      });
    });

    it('redirects to /403', () => {
      TestBed.runInInjectionContext(() => adminGuard(ROUTE, STATE));
      expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
    });
  });
});
