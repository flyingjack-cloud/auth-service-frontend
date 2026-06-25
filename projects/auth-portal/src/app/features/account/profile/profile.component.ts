import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AccountService, ApiError, AuthService, CodeCaptchaFieldComponent, ErrorAlertComponent, User } from '@shared';

@Component({
  selector: 'auth-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    TranslatePipe,
    ErrorAlertComponent,
    CodeCaptchaFieldComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly user = this.auth.currentUser;
  readonly editing = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly editingContact = signal<null | 'email' | 'phone'>(null);
  readonly contactLoading = signal(false);
  readonly contactError = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9]{5,15}$/)]],
  });

  readonly contactForm = inject(FormBuilder).group({
    newContact: ['', [Validators.required]],
    code: ['', [Validators.required]],
    currentPassword: ['', [Validators.required]],
  });

  get codeControl(): FormControl {
    return this.contactForm.get('code') as FormControl;
  }

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
    this.editingContact.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  startContactEdit(type: 'email' | 'phone'): void {
    this.editingContact.set(type);
    this.contactForm.reset();
    this.contactError.set(null);
    this.editing.set(false);

    const ctrl = this.contactForm.get('newContact')!;
    ctrl.setValidators(
      type === 'email'
        ? [Validators.required, Validators.email]
        : [Validators.required, Validators.pattern(/^\d{11}$/)],
    );
    ctrl.updateValueAndValidity();
  }

  cancelContactEdit(): void {
    this.editingContact.set(null);
  }

  onSocialAction(): void {
    this.snackBar.open(this.translate.instant('profile.notAvailable'), '', { duration: 2500 });
  }

  save(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);

    const newUsername = this.form.value.username!;
    this.account
      .updateProfile({ username: newUsername })
      .subscribe({
        next: () => {
          const current = this.user();
          if (current) this.auth.setCurrentUser({ ...current, username: newUsername });
          this.loading.set(false);
          this.editing.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.errorId === 'error.business.conflict' ? 'profile.error.conflict' : 'profile.error.default',
          );
        },
      });
  }

  saveContact(): void {
    if (this.contactLoading() || this.contactForm.invalid) return;
    this.contactLoading.set(true);
    this.contactError.set(null);

    const type = this.editingContact();
    const { newContact, code, currentPassword } = this.contactForm.value;
    const payload = { newContact: newContact!, code: code!, currentPassword: currentPassword! };
    const req$ = type === 'email'
      ? this.account.updateEmail(payload)
      : this.account.updatePhone(payload);

    req$.subscribe({
      next: () => {
        const current = this.user();
        if (current && type) {
          const updated: User = type === 'email'
            ? { ...current, email: newContact! }
            : { ...current, phone: newContact! };
          this.auth.setCurrentUser(updated);
        }
        this.contactLoading.set(false);
        this.editingContact.set(null);
      },
      error: (err: ApiError) => {
        this.contactLoading.set(false);
        if (err.errorId === 'error.user.wrong-password' || err.httpStatus === 401) {
          this.contactError.set('profile.contact.error.wrongPassword');
        } else if (err.errorId === 'error.common.param.miss-captcha' || err.httpStatus === 400) {
          this.contactError.set('profile.contact.error.invalidCode');
        } else if (err.httpStatus === 429) {
          this.contactError.set(
            type === 'email' ? 'profile.contact.error.emailConflict' : 'profile.contact.error.phoneConflict',
          );
        } else {
          this.contactError.set('profile.contact.error.default');
        }
      },
    });
  }
}
