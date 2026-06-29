import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService, ErrorAlertComponent } from '@shared';

@Component({
  selector: 'auth-oauth2-consent',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, TranslatePipe, ErrorAlertComponent],
  templateUrl: './oauth2-consent.component.html',
  styleUrl: './oauth2-consent.component.scss',
})
export class OAuth2ConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentUser = this.auth.currentUser;

  clientId = '';
  redirectUri = '';
  scope = '';
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
    this.state = p['state'] ?? '';
  }

  authorize(): void {
    this.loading.set(true);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${window.location.origin}/oauth2/authorize`;

    const fields: Record<string, string> = {
      client_id: this.clientId,
      state: this.state,
    };

    // 每个 scope 作为独立的 hidden input，Spring AS 按 Set 接收
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    for (const s of this.scopeList) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'scope';
      input.value = s;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  deny(): void {
    const url = new URL(this.redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (this.state) url.searchParams.set('state', this.state);
    window.location.href = url.toString();
  }
}
