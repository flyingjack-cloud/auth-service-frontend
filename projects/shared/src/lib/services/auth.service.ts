import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { User, LoginRequest, CaptchaCredentials } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _currentUser = signal<User | null>(null);
  private readonly _isAdmin = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAdmin = this._isAdmin.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  checkLogin() {
    return this.http.get<User>('/account/check-login').pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  // Verifies admin access via a server-side check, since login/check-login
  // responses do not include roles. Caches result in _isAdmin signal.
  checkAdminAccess() {
    return this.http.get('/admin/users', { params: { page: '0', size: '1' } }).pipe(
      tap(() => this._isAdmin.set(true)),
      catchError(() => {
        this._isAdmin.set(false);
        return of(null);
      })
    );
  }

  login(payload: LoginRequest, captcha?: CaptchaCredentials) {
    let headers = new HttpHeaders();
    if (captcha) {
      headers = headers
        .set('X-Captcha-ID', captcha.id)
        .set('X-Captcha-Token', captcha.token);
    }
    return this.http.post<User>('/account/login', payload, { headers }).pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  setCurrentUser(user: User): void {
    this._currentUser.set(user);
  }

  logout() {
    return this.http.post<null>('/account/logout', {}).pipe(
      tap(() => {
        this._currentUser.set(null);
        this._isAdmin.set(false);
      })
    );
  }
}
