import { Component, input } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'sh-captcha-field',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  styles: ['.full-width { width: 100%; }'],
  template: `
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>验证码</mat-label>
      <input matInput [formControl]="control()" placeholder="请输入验证码" autocomplete="off" />
      <mat-hint>captchaId: {{ captchaId() }}</mat-hint>
    </mat-form-field>
  `,
})
export class CaptchaFieldComponent {
  control = input.required<FormControl>();
  captchaId = input.required<string>();
}
