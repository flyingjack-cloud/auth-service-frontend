import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'sh-error-alert',
  standalone: true,
  imports: [MatIconModule],
  styles: [`
    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 4px;
      background-color: var(--mat-sys-error-container, #fce8e6);
      color: var(--mat-sys-on-error-container, #410e0b);
      font-size: 14px;
      margin-bottom: 16px;
    }
  `],
  template: `
    @if (message()) {
      <div class="error-alert">
        <mat-icon>error_outline</mat-icon>
        {{ message() }}
      </div>
    }
  `,
})
export class ErrorAlertComponent {
  message = input<string | null>(null);
}
