import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { AccountService, ApiError, AuthService, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    TranslatePipe,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);

  readonly user = this.auth.currentUser;
  readonly editing = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9]{5,15}$/)]],
  });

  memberYear(): string {
    const d = this.user()?.createdAt;
    return d ? new Date(d).getFullYear().toString() : '';
  }

  initials(): string {
    const u = this.user()?.username ?? '';
    return u.slice(0, 2).toUpperCase();
  }

  startEdit(): void {
    this.form.patchValue({ username: this.user()?.username ?? '' });
    this.editing.set(true);
    this.errorMessage.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  onSocialAction(action: string): void {
    console.warn(`not implemented: ${action}`);
  }

  save(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);

    this.account
      .updateProfile({ username: this.form.value.username! })
      .pipe(switchMap(() => this.auth.checkLogin()))
      .subscribe({
        next: () => { this.loading.set(false); this.editing.set(false); },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.errorId === 'error.business.conflict' ? 'profile.error.conflict' : 'profile.error.default',
          );
        },
      });
  }
}
