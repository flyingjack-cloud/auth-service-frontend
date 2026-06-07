import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@shared';

@Component({
  selector: 'admin-forbidden',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    <div class="forbidden-container">
      <h1>403</h1>
      <p>权限不足，您没有访问该页面的权限</p>
      <button mat-stroked-button (click)="backToLogin()">返回登录</button>
    </div>
  `,
  styles: [`
    .forbidden-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 16px;
    }
    h1 { font-size: 72px; margin: 0; color: #9e9e9e; }
    p { font-size: 18px; color: #757575; }
  `],
})
export class ForbiddenComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  backToLogin(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
