import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

const ROUTE = {} as ActivatedRouteSnapshot;
const STATE = { url: '/account/profile' } as RouterStateSnapshot;

describe('authGuard', () => {
  let isLoggedIn: ReturnType<typeof signal<boolean>>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    isLoggedIn = signal(false);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue('/login' as any);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when logged in', () => {
    isLoggedIn.set(true);
    const result = TestBed.runInInjectionContext(() => authGuard(ROUTE, STATE));
    expect(result).toBeTrue();
  });

  it('redirects to /login when not logged in', () => {
    isLoggedIn.set(false);
    TestBed.runInInjectionContext(() => authGuard(ROUTE, STATE));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
