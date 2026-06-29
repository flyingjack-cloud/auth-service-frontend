import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { User, LoginRequest, CaptchaCredentials, PendingTokenResponse, LoginResult } from '../models/user.model';
import { TwoFaStatusService } from './two-fa-status.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly twoFaStatus = inject(TwoFaStatusService);

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
    return this.http
      .post<User | PendingTokenResponse>('/account/login', payload, { headers, observe: 'response' })
      .pipe(
        map((response): LoginResult => {
          if (response.status === 202) {
            const body = response.body as PendingTokenResponse;
            return { kind: '2fa', pendingToken: body.pendingToken, redirectTo: body.redirectTo };
          }
          const user = response.body as User;
          this._currentUser.set(user);
          this.twoFaStatus.setEnabled(false);
          return { kind: 'ok', user, redirectTo: user.redirectTo };
        })
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
        this.twoFaStatus.clearStatus();
      })
    );
  }
}
