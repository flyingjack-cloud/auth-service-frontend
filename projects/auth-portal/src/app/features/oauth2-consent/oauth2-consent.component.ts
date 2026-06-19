import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, ErrorAlertComponent } from '@shared';

interface AuthorizeResponse {
  code: string;
}

@Component({
  selector: 'auth-oauth2-consent',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, TranslatePipe, ErrorAlertComponent],
  templateUrl: './oauth2-consent.component.html',
  styleUrl: './oauth2-consent.component.scss',
})
export class OAuth2ConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentUser = this.auth.currentUser;

  clientId = '';
  redirectUri = '';
  scope = '';
  codeChallenge = '';
  codeChallengeMethod = '';
  state = '';

  get scopeList(): string[] {
    return this.scope.split(/\s+/).filter(Boolean);
  }

  get userIdentifier(): string {
    const u = this.currentUser();
    return u?.email ?? u?.phone ?? u?.username ?? '';
  }

  scopeIcon(scope: string): string {
    const icons: Record<string, string> = {
      openid: 'person',
      profile: 'account_circle',
      email: 'mail',
      phone: 'phone',
    };
    return icons[scope] ?? 'check_circle';
  }

  scopeKey(scope: string): string {
    const known = ['openid', 'profile', 'email', 'phone'];
    return known.includes(scope) ? `consent.scope.${scope}` : scope;
  }

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.clientId = p['client_id'] ?? '';
    this.redirectUri = p['redirect_uri'] ?? '';
    this.scope = p['scope'] ?? '';
    this.codeChallenge = p['code_challenge'] ?? '';
    this.codeChallengeMethod = p['code_challenge_method'] ?? 'S256';
    this.state = p['state'] ?? '';
  }

  authorize(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const body = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      code_challenge: this.codeChallenge,
      code_challenge_method: this.codeChallengeMethod,
      state: this.state,
    });

    this.http
      .post<AuthorizeResponse>('/oauth2/authorize', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: res => {
          const url = new URL(this.redirectUri);
          url.searchParams.set('code', res.code);
          if (this.state) url.searchParams.set('state', this.state);
          window.location.href = url.toString();
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('consent.error.default');
        },
      });
  }

  deny(): void {
    const url = new URL(this.redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (this.state) url.searchParams.set('state', this.state);
    window.location.href = url.toString();
  }
}
