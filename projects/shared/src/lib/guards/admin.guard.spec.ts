import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { adminGuard } from './admin.guard';

const ROUTE = {} as ActivatedRouteSnapshot;
const STATE = { url: '/users' } as RouterStateSnapshot;

function makeAuthService(loggedIn: boolean, roles: string[] = []) {
  const user: User | null = loggedIn
    ? { id: '1', username: 'u', phone: null, email: null, roles }
    : null;
  return { isLoggedIn: signal(loggedIn), currentUser: signal(user) };
}

describe('adminGuard', () => {
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.callFake((cmds: string[]) => cmds[0] as any);
  });

  function run(authService: ReturnType<typeof makeAuthService>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
    return TestBed.runInInjectionContext(() => adminGuard(ROUTE, STATE));
  }

  it('redirects to /login when not logged in', () => {
    run(makeAuthService(false));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('returns true when user has ROLE_ADMIN', () => {
    const result = run(makeAuthService(true, ['ROLE_ADMIN']));
    expect(result).toBeTrue();
  });

  it('redirects to /403 when logged in without ROLE_ADMIN', () => {
    run(makeAuthService(true, ['ROLE_USER']));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/403']);
  });
});
