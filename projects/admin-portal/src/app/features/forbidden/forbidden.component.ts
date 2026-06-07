import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'admin-forbidden',
  standalone: true,
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="forbidden-container">
      <h1>403</h1>
      <p>权限不足，您没有访问该页面的权限</p>
      <a mat-stroked-button routerLink="/login">返回登录</a>
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
export class ForbiddenComponent {}
