import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { User, LoginRequest, CaptchaCredentials } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  checkLogin() {
    return this.http.get<User>('/account/check-login').pipe(
      tap(user => this._currentUser.set(user))
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

  logout() {
    return this.http.post<null>('/account/logout', {}).pipe(
      tap(() => this._currentUser.set(null))
    );
  }
}
