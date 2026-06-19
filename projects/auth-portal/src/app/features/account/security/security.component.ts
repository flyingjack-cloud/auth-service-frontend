import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AccountService, ApiError, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-security',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    TranslatePipe,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  private readonly account = inject(AccountService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
  });

  onManageSessions(): void {
    console.warn('not implemented: manage sessions');
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { oldPassword, newPassword } = this.form.value;
    this.account.changePassword({ oldPassword: oldPassword!, newPassword: newPassword! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('security.success');
        this.form.reset();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.errorId === 'error.user.wrong-password'
            ? 'security.error.wrongPassword'
            : 'security.error.default',
        );
      },
    });
  }
}
