import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { interval } from 'rxjs';
import { take } from 'rxjs/operators';
import { ApiError } from '../../models/api-error.model';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'sh-code-captcha-field',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  styles: [`
    .field-code-row { display: flex; gap: 8px; align-items: center; }
    .send-code-btn { white-space: nowrap; flex-shrink: 0; }
    .field-error { color: #c00; font-size: 12px; margin: 4px 0 0; }
  `],
  template: `
    <div class="field-code-row">
      <input
        class="text-input"
        [formControl]="control()"
        maxlength="6"
        inputmode="numeric"
        autocomplete="one-time-code"
        [placeholder]="'captcha.codePlaceholder' | translate"
        style="flex:1;min-width:0;"
      />
      <button
        class="send-code-btn"
        type="button"
        [disabled]="!canSend()"
        (click)="send()"
      >
        @if (countdown() > 0) {
          {{ 'captcha.resend' | translate: { s: countdown() } }}
        } @else {
          {{ 'captcha.sendCode' | translate }}
        }
      </button>
    </div>
    @if (sendError()) {
      <p class="field-error">{{ sendError()! | translate }}</p>
    }
  `,
})
export class CodeCaptchaFieldComponent {
  private readonly captchaService = inject(CaptchaService);
  private readonly destroyRef = inject(DestroyRef);

  control = input.required<FormControl>();
  type = input.required<'phone' | 'email'>();
  principal = input.required<string>();

  readonly sending = signal(false);
  readonly countdown = signal(0);
  readonly sendError = signal<string | null>(null);
  readonly canSend = computed(() => this.countdown() === 0 && !this.sending());

  constructor() {
    effect(() => {
      this.principal(); // track; reset countdown when principal changes
      this.countdown.set(0);
      this.sendError.set(null);
    });
  }

  send(): void {
    const p = this.principal();
    if (!p || !this.canSend()) return;

    this.sending.set(true);
    this.sendError.set(null);

    const req$ = this.type() === 'phone'
      ? this.captchaService.sendSmsCaptcha(p)
      : this.captchaService.sendEmailCaptcha(p);

    req$.subscribe({
      next: () => {
        this.sending.set(false);
        this.startCountdown(this.type() === 'phone' ? 60 : 30);
      },
      error: (err: ApiError) => {
        this.sending.set(false);
        this.sendError.set(err.httpStatus === 429 ? 'captcha.tooManyRequests' : 'captcha.sendFailed');
      },
    });
  }

  private startCountdown(seconds: number): void {
    this.countdown.set(seconds);
    interval(1000)
      .pipe(take(seconds), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.countdown.update(s => Math.max(0, s - 1)));
  }
}
