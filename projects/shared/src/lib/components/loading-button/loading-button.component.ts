import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'sh-loading-button',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './loading-button.component.html',
})
export class LoadingButtonComponent {
  loading = input(false);
  disabled = input(false);
  color = input<'primary' | 'accent' | 'warn'>('primary');
  clicked = output<void>();
}
