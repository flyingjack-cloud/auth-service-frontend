import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { LangService } from '../../lang.service';

@Component({
  selector: 'auth-layout',
  standalone: true,
  imports: [RouterOutlet, MatIconModule, TranslatePipe],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly langService = inject(LangService);
}
