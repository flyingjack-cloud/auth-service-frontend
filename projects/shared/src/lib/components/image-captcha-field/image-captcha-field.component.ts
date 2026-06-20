import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'sh-image-captcha-field',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  styles: [`
    .captcha-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .captcha-img { height: 40px; border-radius: 4px; cursor: pointer; }
    .captcha-refresh { background: none; border: none; cursor: pointer; padding: 4px; color: #555; }
    .captcha-error { font-size: 12px; color: #c00; }
    .text-input { width: 100%; box-sizing: border-box; }
  `],
  template: `
    <div class="captcha-row">
      @if (loading()) {
        <mat-spinner diameter="40" />
      } @else if (error()) {
        <span class="captcha-error">{{ 'captcha.loadFailed' | translate }}</span>
        <button type="button" class="captcha-refresh" (click)="refresh()">
          <mat-icon>refresh</mat-icon>
        </button>
      } @else {
        <img [src]="imageDataUrl()" alt="captcha" class="captcha-img" />
        <button type="button" class="captcha-refresh" (click)="refresh()" [title]="'captcha.refresh' | translate">
          <mat-icon>refresh</mat-icon>
        </button>
      }
    </div>
    <input
      class="text-input"
      [formControl]="control()"
      autocomplete="off"
      [placeholder]="'captcha.imagePlaceholder' | translate"
    />
  `,
})
export class ImageCaptchaFieldComponent implements OnInit {
  private readonly captchaService = inject(CaptchaService);

  control = input.required<FormControl>();
  captchaId = output<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly imageDataUrl = signal('');

  ngOnInit(): void {
    this.fetchImage();
  }

  refresh(): void {
    this.control().reset();
    this.fetchImage();
  }

  private fetchImage(): void {
    this.loading.set(true);
    this.error.set(false);
    this.captchaService.getImageCaptcha().subscribe({
      next: ({ uuid, base64Image }) => {
        this.imageDataUrl.set(`data:image/png;base64,${base64Image}`);
        this.captchaId.emit(uuid);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
