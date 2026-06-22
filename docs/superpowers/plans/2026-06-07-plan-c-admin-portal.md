# Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all admin-portal pages: admin login, 403 page, shell layout (toolbar + sidenav), user list (mat-table + paginator + search + slide-toggle), user detail (status toggles + role checkboxes + delete), client list (card grid), and client form (create / edit with two tabs).

**Architecture:** Standalone Angular components with lazy-loaded routes. A local `adminLoginGuard` redirects already-logged-in admins away from `/login`. The `adminGuard` (from `@shared`) protects all management routes and redirects non-admins to `/403`. `AdminShellComponent` is the layout wrapper for all protected routes — top toolbar + left sidenav. Services (`AdminUserService`, `ClientManagementService`) are already implemented in `@shared`.

**Tech Stack:** Angular 20 (Standalone Components), Angular Material (MatTable, MatPaginator, MatSidenav, MatDialog, MatSlideToggle, MatCheckbox, MatTabs), Angular Signals, `@shared` library

> **Note on testing:** Karma requires a browser binary not present in this WSL environment. Component unit tests are skipped; `ng build --configuration development` is the quality gate. Visual/functional testing is done via `ng serve`.

---

## File Map

```
projects/admin-portal/src/app/
  app.ts                                                       MODIFY  (remove scaffold, inline template)
  app.html                                                     DELETE
  app.scss                                                     DELETE
  app.routes.ts                                                MODIFY  (all routes)
  features/
    admin-login/
      admin-login.component.ts                                 CREATE
      admin-login.component.html                               CREATE
      admin-login.component.scss                               CREATE
    forbidden/
      forbidden.component.ts                                   CREATE  (inline template + styles)
    admin-shell/
      admin-shell.component.ts                                 CREATE
      admin-shell.component.html                               CREATE
      admin-shell.component.scss                               CREATE
    users/
      user-list/
        user-list.component.ts                                 CREATE
        user-list.component.html                               CREATE
        user-list.component.scss                               CREATE
      user-detail/
        user-detail.component.ts                               CREATE  (contains DeleteConfirmDialogComponent)
        user-detail.component.html                             CREATE
    clients/
      client-list/
        client-list.component.ts                               CREATE
        client-list.component.html                             CREATE
        client-list.component.scss                             CREATE
      client-form/
        client-form.component.ts                               CREATE  (contains DeleteClientDialogComponent)
        client-form.component.html                             CREATE
```

---

## Task 1: Root app cleanup and route wiring

**Files:**
- Modify: `projects/admin-portal/src/app/app.ts`
- Delete: `projects/admin-portal/src/app/app.html`
- Delete: `projects/admin-portal/src/app/app.scss`
- Modify: `projects/admin-portal/src/app/app.routes.ts`

- [ ] **Step 1: Write `projects/admin-portal/src/app/app.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'admin-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
```

- [ ] **Step 2: Delete app.html and app.scss**

```bash
rm projects/admin-portal/src/app/app.html projects/admin-portal/src/app/app.scss
```

- [ ] **Step 3: Write `projects/admin-portal/src/app/app.routes.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, adminGuard } from '@shared';

const adminLoginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/users']) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'login',
    canActivate: [adminLoginGuard],
    loadComponent: () =>
      import('./features/admin-login/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: '403',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/user-list/user-list.component').then(m => m.UserListComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./features/users/user-detail/user-detail.component').then(
            m => m.UserDetailComponent,
          ),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/client-list/client-list.component').then(
            m => m.ClientListComponent,
          ),
      },
      {
        path: 'clients/new',
        loadComponent: () =>
          import('./features/clients/client-form/client-form.component').then(
            m => m.ClientFormComponent,
          ),
      },
      {
        path: 'clients/:clientId',
        loadComponent: () =>
          import('./features/clients/client-form/client-form.component').then(
            m => m.ClientFormComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
```

> `clients/new` must appear before `clients/:clientId` so Angular matches the literal path first.

- [ ] **Step 4: Verify — build fails only on missing feature components (acceptable)**

```bash
cd /home/flyingjack/code/web/flyingjack-cloud-web/auth-serice-frontend && ng build admin-portal --configuration development 2>&1 | grep -E "^(Error|✔|✘|Application)" | head -10
```

Expected: errors only about `Cannot find module './features/...'` — structural/TypeScript errors are NOT acceptable.

- [ ] **Step 5: Commit**

```bash
git add projects/admin-portal/src/app/app.ts projects/admin-portal/src/app/app.routes.ts
git rm --cached projects/admin-portal/src/app/app.html projects/admin-portal/src/app/app.scss 2>/dev/null || true
git commit -m "feat(admin-portal): wire lazy routes with adminLoginGuard; clean up scaffold root"
```

---

## Task 2: AdminLoginComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/admin-login/admin-login.component.ts`
- Create: `projects/admin-portal/src/app/features/admin-login/admin-login.component.html`
- Create: `projects/admin-portal/src/app/features/admin-login/admin-login.component.scss`

Admin login is always username + password only (no tab switching, no captcha handling). If the login succeeds but the user lacks `ROLE_ADMIN`, `adminGuard` on `/users` will redirect to `/403`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/admin-portal/src/app/features/admin-login
```

- [ ] **Step 2: Write `admin-login.component.ts`**

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiError, AuthService, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'admin-admin-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.value;
    this.auth
      .login({ loginType: 'username', principal: username!, password: password! })
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (err: ApiError) => {
          this.loading.set(false);
          const map: Record<string, string> = {
            'error.security.authenticated.bad-credential': '用户名或密码错误',
            'error.security.authenticated.invalid-account': '账号已被禁用或锁定',
          };
          this.errorMessage.set(map[err.errorId] ?? '登录失败，请稍后重试');
        },
      });
  }
}
```

- [ ] **Step 3: Write `admin-login.component.html`**

```html
<div class="login-container">
  <mat-card class="login-card">
    <mat-card-header>
      <mat-card-title>管理后台</mat-card-title>
      <mat-card-subtitle>请使用管理员账号登录</mat-card-subtitle>
    </mat-card-header>

    <mat-card-content>
      <sh-error-alert [message]="errorMessage()" />

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>用户名</mat-label>
          <input matInput formControlName="username" autocomplete="username" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>密码</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="current-password" />
        </mat-form-field>

        <sh-loading-button
          [loading]="loading()"
          [disabled]="form.invalid"
          (clicked)="onSubmit()"
          class="submit-btn"
        >
          登录
        </sh-loading-button>
      </form>
    </mat-card-content>
  </mat-card>
</div>
```

- [ ] **Step 4: Write `admin-login.component.scss`**

```scss
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 24px;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.full-width {
  width: 100%;
  margin-bottom: 8px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}
```

- [ ] **Step 5: Commit**

```bash
git add projects/admin-portal/src/app/features/admin-login/
git commit -m "feat(admin-portal): add AdminLoginComponent"
```

---

## Task 3: ForbiddenComponent + AdminShellComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/forbidden/forbidden.component.ts`
- Create: `projects/admin-portal/src/app/features/admin-shell/admin-shell.component.ts`
- Create: `projects/admin-portal/src/app/features/admin-shell/admin-shell.component.html`
- Create: `projects/admin-portal/src/app/features/admin-shell/admin-shell.component.scss`

- [ ] **Step 1: Create directories**

```bash
mkdir -p projects/admin-portal/src/app/features/forbidden
mkdir -p projects/admin-portal/src/app/features/admin-shell
```

- [ ] **Step 2: Write `forbidden/forbidden.component.ts`**

```typescript
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
```

- [ ] **Step 3: Write `admin-shell.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '@shared';

@Component({
  selector: 'admin-admin-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
```

- [ ] **Step 4: Write `admin-shell.component.html`**

```html
<mat-toolbar color="primary" class="shell-toolbar">
  <mat-icon class="toolbar-logo">admin_panel_settings</mat-icon>
  <span class="toolbar-title">flyingjack cloud 管理后台</span>
  <span class="spacer"></span>
  <span class="toolbar-username">{{ currentUser()?.username }}</span>
  <button mat-icon-button (click)="logout()" aria-label="退出登录">
    <mat-icon>logout</mat-icon>
  </button>
</mat-toolbar>

<mat-sidenav-container class="sidenav-container">
  <mat-sidenav mode="side" opened class="sidenav">
    <mat-nav-list>
      <a mat-list-item routerLink="/users" routerLinkActive="active-link">
        <mat-icon matListItemIcon>people</mat-icon>
        <span matListItemTitle>用户管理</span>
      </a>
      <a mat-list-item routerLink="/clients" routerLinkActive="active-link">
        <mat-icon matListItemIcon>apps</mat-icon>
        <span matListItemTitle>客户端管理</span>
      </a>
    </mat-nav-list>
  </mat-sidenav>

  <mat-sidenav-content class="content">
    <div class="content-inner">
      <router-outlet />
    </div>
  </mat-sidenav-content>
</mat-sidenav-container>
```

- [ ] **Step 5: Write `admin-shell.component.scss`**

```scss
.shell-toolbar {
  position: sticky;
  top: 0;
  z-index: 200;

  .toolbar-logo {
    margin-right: 8px;
  }

  .toolbar-title {
    font-size: 18px;
  }

  .spacer {
    flex: 1;
  }

  .toolbar-username {
    font-size: 14px;
    margin-right: 8px;
    opacity: 0.9;
  }
}

.sidenav-container {
  height: calc(100vh - 64px);
}

.sidenav {
  width: 220px;
}

.active-link {
  background: rgba(103, 80, 164, 0.12);
  color: var(--mat-sys-primary, #6750a4);
}

.content-inner {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
```

- [ ] **Step 6: Commit**

```bash
git add projects/admin-portal/src/app/features/forbidden/ \
        projects/admin-portal/src/app/features/admin-shell/
git commit -m "feat(admin-portal): add ForbiddenComponent and AdminShellComponent"
```

---

## Task 4: UserListComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/users/user-list/user-list.component.ts`
- Create: `projects/admin-portal/src/app/features/users/user-list/user-list.component.html`
- Create: `projects/admin-portal/src/app/features/users/user-list/user-list.component.scss`

Server-side pagination via `MatPaginator`. Search debounces 500ms via `FormControl.valueChanges`. Clicking a row navigates to `/users/:id`. The enabled `mat-slide-toggle` calls `PUT /admin/users/:id/status` immediately on toggle; `$event.stopPropagation()` prevents row navigation.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/admin-portal/src/app/features/users/user-list
```

- [ ] **Step 2: Write `user-list.component.ts`**

```typescript
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminUserService, User } from '@shared';

@Component({
  selector: 'admin-user-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTableModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private readonly adminUser = inject(AdminUserService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('');
  readonly loading = signal(false);
  readonly users = signal<User[]>([]);
  readonly totalElements = signal(0);

  readonly displayedColumns = ['username', 'email', 'phone', 'roles', 'enabled'];

  pageSize = 20;
  pageIndex = 0;

  ngOnInit(): void {
    this.loadUsers();

    this.searchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageIndex = 0;
        this.loadUsers();
      });
  }

  loadUsers(): void {
    this.loading.set(true);
    const search = this.searchControl.value || undefined;
    this.adminUser.getUsers(this.pageIndex, this.pageSize, search).subscribe({
      next: page => {
        this.users.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
  }

  toggleEnabled(user: User, enabled: boolean): void {
    this.adminUser.updateStatus(user.id, { enabled }).subscribe();
  }

  goToDetail(user: User): void {
    this.router.navigate(['/users', user.id]);
  }
}
```

- [ ] **Step 3: Write `user-list.component.html`**

```html
<div class="list-header">
  <h2>用户管理</h2>
  <mat-form-field appearance="outline" class="search-field">
    <mat-label>搜索用户名</mat-label>
    <mat-icon matPrefix>search</mat-icon>
    <input matInput [formControl]="searchControl" />
  </mat-form-field>
</div>

@if (loading()) {
  <div class="loading-center">
    <mat-spinner diameter="40" />
  </div>
}

@if (!loading()) {
  <table mat-table [dataSource]="users()" class="user-table">
    <ng-container matColumnDef="username">
      <th mat-header-cell *matHeaderCellDef>用户名</th>
      <td mat-cell *matCellDef="let user">{{ user.username }}</td>
    </ng-container>

    <ng-container matColumnDef="email">
      <th mat-header-cell *matHeaderCellDef>邮箱</th>
      <td mat-cell *matCellDef="let user">{{ user.email ?? '—' }}</td>
    </ng-container>

    <ng-container matColumnDef="phone">
      <th mat-header-cell *matHeaderCellDef>手机号</th>
      <td mat-cell *matCellDef="let user">{{ user.phone ?? '—' }}</td>
    </ng-container>

    <ng-container matColumnDef="roles">
      <th mat-header-cell *matHeaderCellDef>角色</th>
      <td mat-cell *matCellDef="let user">{{ user.roles?.join(', ') ?? '—' }}</td>
    </ng-container>

    <ng-container matColumnDef="enabled">
      <th mat-header-cell *matHeaderCellDef>启用</th>
      <td mat-cell *matCellDef="let user" (click)="$event.stopPropagation()">
        <mat-slide-toggle
          [checked]="user.enabled ?? true"
          (change)="toggleEnabled(user, $event.checked)"
        />
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    <tr
      mat-row
      *matRowDef="let row; columns: displayedColumns;"
      class="clickable-row"
      (click)="goToDetail(row)"
    ></tr>
  </table>

  <mat-paginator
    [length]="totalElements()"
    [pageSize]="pageSize"
    [pageIndex]="pageIndex"
    [pageSizeOptions]="[10, 20, 50]"
    (page)="onPage($event)"
  />
}
```

- [ ] **Step 4: Write `user-list.component.scss`**

```scss
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 {
    margin: 0;
  }
}

.search-field {
  width: 280px;
}

.loading-center {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.user-table {
  width: 100%;
}

.clickable-row {
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add projects/admin-portal/src/app/features/users/user-list/
git commit -m "feat(admin-portal): add UserListComponent — mat-table, paginator, search, slide-toggle"
```

---

## Task 5: UserDetailComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/users/user-detail/user-detail.component.ts`
- Create: `projects/admin-portal/src/app/features/users/user-detail/user-detail.component.html`

`DeleteConfirmDialogComponent` is defined in the same `.ts` file (not exported) and opened via `MatDialog`. Role checkboxes use the three role IDs from API.md (1=ROLE_ADMIN, 2=ROLE_USER, 3=ROLE_GUEST) with a cover-replace strategy via `PUT /admin/users/:id/roles`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/admin-portal/src/app/features/users/user-detail
```

- [ ] **Step 2: Write `user-detail.component.ts`**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AdminUserService, ErrorAlertComponent, User } from '@shared';

@Component({
  selector: 'admin-delete-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>确认删除</h2>
    <mat-dialog-content>此操作不可逆，确认删除该用户吗？</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>取消</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">删除</button>
    </mat-dialog-actions>
  `,
})
class DeleteConfirmDialogComponent {}

@Component({
  selector: 'admin-user-detail',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    ErrorAlertComponent,
  ],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminUser = inject(AdminUserService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly user = signal<User | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly roleOptions = [
    { id: 1, name: 'ROLE_ADMIN' },
    { id: 2, name: 'ROLE_USER' },
    { id: 3, name: 'ROLE_GUEST' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.adminUser.getUser(id).subscribe({
      next: user => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('用户不存在或加载失败');
      },
    });
  }

  isRoleSelected(roleId: number): boolean {
    const roleName = this.roleOptions.find(r => r.id === roleId)?.name;
    return this.user()?.roles?.includes(roleName ?? '') ?? false;
  }

  toggleStatus(field: 'enabled' | 'accountNonLocked', checked: boolean): void {
    const user = this.user();
    if (!user) return;
    this.adminUser.updateStatus(user.id, { [field]: checked }).subscribe({
      next: () => this.user.update(u => (u ? { ...u, [field]: checked } : u)),
      error: () => this.errorMessage.set('状态更新失败，请重试'),
    });
  }

  toggleRole(roleId: number, checked: boolean): void {
    const user = this.user();
    if (!user) return;

    const currentIds = this.roleOptions
      .filter(r => user.roles?.includes(r.name))
      .map(r => r.id);
    const newIds = checked
      ? [...new Set([...currentIds, roleId])]
      : currentIds.filter(id => id !== roleId);

    this.adminUser.updateRoles(user.id, { roleIds: newIds }).subscribe({
      next: () => {
        const newNames = this.roleOptions.filter(r => newIds.includes(r.id)).map(r => r.name);
        this.user.update(u => (u ? { ...u, roles: newNames } : u));
      },
      error: () => this.errorMessage.set('角色更新失败，请重试'),
    });
  }

  confirmDelete(): void {
    const ref = this.dialog.open(DeleteConfirmDialogComponent);
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.adminUser.deleteUser(this.user()!.id).subscribe({
          next: () => this.router.navigate(['/users']),
          error: () => this.errorMessage.set('删除失败，请稍后重试'),
        });
      }
    });
  }
}
```

- [ ] **Step 3: Write `user-detail.component.html`**

```html
@if (loading()) {
  <div class="loading-center"><mat-spinner diameter="40" /></div>
}

@if (!loading() && errorMessage()) {
  <sh-error-alert [message]="errorMessage()" />
}

@if (!loading() && user()) {
  <div class="detail-layout">
    <div class="detail-header">
      <a mat-icon-button routerLink="/users" aria-label="返回用户列表">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <h2>{{ user()!.username }}</h2>
    </div>

    <mat-card>
      <mat-card-header>
        <mat-card-title>基本信息</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="info-row"><span class="label">ID</span><span>{{ user()!.id }}</span></div>
        <div class="info-row"><span class="label">用户名</span><span>{{ user()!.username }}</span></div>
        <div class="info-row"><span class="label">邮箱</span><span>{{ user()!.email ?? '—' }}</span></div>
        <div class="info-row"><span class="label">手机号</span><span>{{ user()!.phone ?? '—' }}</span></div>
        <div class="info-row"><span class="label">注册时间</span><span>{{ user()!.createdAt ?? '—' }}</span></div>
      </mat-card-content>
    </mat-card>

    <mat-card>
      <mat-card-header>
        <mat-card-title>账号状态</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="toggle-row">
          <span>启用账号</span>
          <mat-slide-toggle
            [checked]="user()!.enabled ?? true"
            (change)="toggleStatus('enabled', $event.checked)"
          />
        </div>
        <div class="toggle-row">
          <span>账号未锁定</span>
          <mat-slide-toggle
            [checked]="user()!.accountNonLocked ?? true"
            (change)="toggleStatus('accountNonLocked', $event.checked)"
          />
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card>
      <mat-card-header>
        <mat-card-title>角色分配</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @for (role of roleOptions; track role.id) {
          <div class="checkbox-row">
            <mat-checkbox
              [checked]="isRoleSelected(role.id)"
              (change)="toggleRole(role.id, $event.checked)"
            >
              {{ role.name }}
            </mat-checkbox>
          </div>
        }
      </mat-card-content>
    </mat-card>

    <mat-card>
      <mat-card-header>
        <mat-card-title>危险操作</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <button mat-raised-button color="warn" (click)="confirmDelete()">
          <mat-icon>delete</mat-icon>
          删除用户
        </button>
      </mat-card-content>
    </mat-card>
  </div>
}

<style>
  .loading-center { display: flex; justify-content: center; padding: 48px; }
  .detail-layout { display: flex; flex-direction: column; gap: 16px; }
  .detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .detail-header h2 { margin: 0; }
  .info-row { display: flex; gap: 16px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.08); font-size: 14px; }
  .info-row:last-child { border-bottom: none; }
  .label { width: 80px; color: #757575; flex-shrink: 0; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
  .checkbox-row { padding: 4px 0; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add projects/admin-portal/src/app/features/users/user-detail/
git commit -m "feat(admin-portal): add UserDetailComponent — status toggles, role checkboxes, delete"
```

---

## Task 6: ClientListComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/clients/client-list/client-list.component.ts`
- Create: `projects/admin-portal/src/app/features/clients/client-list/client-list.component.html`
- Create: `projects/admin-portal/src/app/features/clients/client-list/client-list.component.scss`

CSS grid card layout. Clicking a card navigates to `/clients/:clientId`. If `avatarUrl` is null, shows a default `apps` icon in a round container.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/admin-portal/src/app/features/clients/client-list
```

- [ ] **Step 2: Write `client-list.component.ts`**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClientManagementService, OAuthClient } from '@shared';

@Component({
  selector: 'admin-client-list',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.scss',
})
export class ClientListComponent implements OnInit {
  private readonly clientService = inject(ClientManagementService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly clients = signal<OAuthClient[]>([]);

  ngOnInit(): void {
    this.clientService.getClients().subscribe({
      next: clients => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToNew(): void {
    this.router.navigate(['/clients/new']);
  }

  goToClient(clientId: string): void {
    this.router.navigate(['/clients', clientId]);
  }
}
```

- [ ] **Step 3: Write `client-list.component.html`**

```html
<div class="list-header">
  <h2>客户端管理</h2>
  <button mat-raised-button color="primary" (click)="goToNew()">
    <mat-icon>add</mat-icon>
    新建客户端
  </button>
</div>

@if (loading()) {
  <div class="loading-center">
    <mat-spinner diameter="40" />
  </div>
}

@if (!loading()) {
  <div class="client-grid">
    @for (client of clients(); track client.clientId) {
      <mat-card class="client-card" (click)="goToClient(client.clientId)">
        <mat-card-header>
          @if (client.avatarUrl) {
            <img mat-card-avatar [src]="client.avatarUrl" [alt]="client.clientName" />
          } @else {
            <div mat-card-avatar class="default-avatar">
              <mat-icon>apps</mat-icon>
            </div>
          }
          <mat-card-title>{{ client.clientName }}</mat-card-title>
          <mat-card-subtitle>{{ client.clientId }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="scope-label">Scopes: {{ client.scopes }}</p>
        </mat-card-content>
      </mat-card>
    }

    @if (clients().length === 0) {
      <p class="empty-hint">暂无客户端，点击"新建客户端"创建第一个</p>
    }
  </div>
}
```

- [ ] **Step 4: Write `client-list.component.scss`**

```scss
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  h2 {
    margin: 0;
  }
}

.loading-center {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.client-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.client-card {
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.default-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(103, 80, 164, 0.12);
  border-radius: 50%;
  width: 40px;
  height: 40px;

  mat-icon {
    color: var(--mat-sys-primary, #6750a4);
  }
}

.scope-label {
  font-size: 12px;
  color: #757575;
  margin: 0;
}

.empty-hint {
  color: #9e9e9e;
  font-size: 14px;
  padding: 48px;
  text-align: center;
  grid-column: 1 / -1;
}
```

- [ ] **Step 5: Commit**

```bash
git add projects/admin-portal/src/app/features/clients/client-list/
git commit -m "feat(admin-portal): add ClientListComponent — card grid"
```

---

## Task 7: ClientFormComponent

**Files:**
- Create: `projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts`
- Create: `projects/admin-portal/src/app/features/clients/client-form/client-form.component.html`

Create and edit modes share this component. Mode is determined by whether `route.snapshot.params['clientId']` is present. In edit mode:
- `clientId`, `scopes`, `authorizationGrantTypes`, `clientAuthenticationMethods`, `requireProofKey` fields are disabled (cannot be changed after creation per `UpdateClientRequest`).
- `clientSecret` validator is removed (leave blank = keep current secret).
- `accessTokenTtlHours` / `refreshTokenTtlDays` are pre-populated only if the backend response adds them in the future (currently `OAuthClient` does not include these — form shows defaults).

`DeleteClientDialogComponent` is defined in the same `.ts` file (not exported) and opened via `MatDialog`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/admin-portal/src/app/features/clients/client-form
```

- [ ] **Step 2: Write `client-form.component.ts`**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiError, ClientManagementService, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'admin-delete-client-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>确认删除</h2>
    <mat-dialog-content>此操作不可逆，确认删除该客户端吗？</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>取消</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">删除</button>
    </mat-dialog-actions>
  `,
})
class DeleteClientDialogComponent {}

@Component({
  selector: 'admin-client-form',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './client-form.component.html',
})
export class ClientFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientManagementService);
  private readonly dialog = inject(MatDialog);

  readonly isEdit = signal(false);
  readonly loadingData = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  editClientId = '';

  readonly form = inject(FormBuilder).group({
    clientId: ['', [Validators.required]],
    clientName: ['', [Validators.required]],
    clientSecret: ['', [Validators.required]],
    redirectUris: ['', [Validators.required]],
    scopes: ['openid', [Validators.required]],
    description: [''],
    contactEmail: [''],
    avatarUrl: [''],
    authorizationGrantTypes: ['authorization_code,refresh_token', [Validators.required]],
    clientAuthenticationMethods: ['client_secret_basic', [Validators.required]],
    requireProofKey: [true],
    accessTokenTtlHours: [2, [Validators.required, Validators.min(1)]],
    refreshTokenTtlDays: [7, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    const param = this.route.snapshot.params['clientId'];
    if (param) {
      this.isEdit.set(true);
      this.editClientId = param;
      // clientSecret optional in edit mode
      this.form.get('clientSecret')!.clearValidators();
      this.form.get('clientSecret')!.updateValueAndValidity();

      this.loadingData.set(true);
      this.clientService.getClient(param).subscribe({
        next: client => {
          this.form.patchValue({
            clientId: client.clientId,
            clientName: client.clientName,
            redirectUris: client.redirectUris,
            scopes: client.scopes,
            description: client.description ?? '',
            contactEmail: client.contactEmail ?? '',
            avatarUrl: client.avatarUrl ?? '',
            authorizationGrantTypes: client.authorizationGrantTypes,
            clientAuthenticationMethods: client.clientAuthenticationMethods,
          });
          // These fields cannot be changed after creation
          for (const f of ['clientId', 'scopes', 'authorizationGrantTypes', 'clientAuthenticationMethods', 'requireProofKey']) {
            this.form.get(f)!.disable();
          }
          this.loadingData.set(false);
        },
        error: () => {
          this.loadingData.set(false);
          this.errorMessage.set('客户端不存在或加载失败');
        },
      });
    }
  }

  save(): void {
    if (this.saving() || this.form.invalid) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    if (this.isEdit()) {
      const v = this.form.value;
      const payload = {
        clientName: v.clientName!,
        redirectUris: v.redirectUris!,
        description: v.description || null,
        contactEmail: v.contactEmail || null,
        avatarUrl: v.avatarUrl || null,
        accessTokenTtlHours: v.accessTokenTtlHours!,
        refreshTokenTtlDays: v.refreshTokenTtlDays!,
        ...(v.clientSecret ? { clientSecret: v.clientSecret } : {}),
      };
      this.clientService.updateClient(this.editClientId, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/clients']);
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.errorMessage.set(err.errorId === 'error.business.conflict' ? '客户端 ID 已存在' : '保存失败，请稍后重试');
        },
      });
    } else {
      const v = this.form.value;
      this.clientService
        .createClient({
          clientId: v.clientId!,
          clientName: v.clientName!,
          clientSecret: v.clientSecret!,
          redirectUris: v.redirectUris!,
          scopes: v.scopes!,
          description: v.description || null,
          contactEmail: v.contactEmail || null,
          avatarUrl: v.avatarUrl || null,
          authorizationGrantTypes: v.authorizationGrantTypes!,
          clientAuthenticationMethods: v.clientAuthenticationMethods!,
          requireProofKey: v.requireProofKey ?? true,
          accessTokenTtlHours: v.accessTokenTtlHours!,
          refreshTokenTtlDays: v.refreshTokenTtlDays!,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.router.navigate(['/clients']);
          },
          error: (err: ApiError) => {
            this.saving.set(false);
            this.errorMessage.set(err.errorId === 'error.business.conflict' ? '客户端 ID 已存在' : '创建失败，请稍后重试');
          },
        });
    }
  }

  confirmDelete(): void {
    const ref = this.dialog.open(DeleteClientDialogComponent);
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.clientService.deleteClient(this.editClientId).subscribe({
          next: () => this.router.navigate(['/clients']),
          error: () => this.errorMessage.set('删除失败，请稍后重试'),
        });
      }
    });
  }
}
```

- [ ] **Step 3: Write `client-form.component.html`**

```html
@if (loadingData()) {
  <div class="loading-center"><mat-spinner diameter="40" /></div>
}

@if (!loadingData()) {
  <div class="form-layout">
    <div class="form-header">
      <a mat-icon-button routerLink="/clients" aria-label="返回客户端列表">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <h2>{{ isEdit() ? '编辑客户端' : '新建客户端' }}</h2>
    </div>

    <sh-error-alert [message]="errorMessage()" />

    <mat-card>
      <mat-card-content>
        <form [formGroup]="form">
          <mat-tab-group>
            <mat-tab label="基本信息">
              <div class="tab-content">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>客户端 ID</mat-label>
                  <input matInput formControlName="clientId" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>客户端名称</mat-label>
                  <input matInput formControlName="clientName" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ isEdit() ? '新密钥（留空保持不变）' : '客户端密钥' }}</mat-label>
                  <input matInput formControlName="clientSecret" type="password" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>回调地址（多个用逗号分隔）</mat-label>
                  <input matInput formControlName="redirectUris" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Scopes（空格分隔）</mat-label>
                  <input matInput formControlName="scopes" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>描述</mat-label>
                  <textarea matInput formControlName="description" rows="2"></textarea>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>联系邮箱</mat-label>
                  <input matInput formControlName="contactEmail" type="email" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>头像 URL</mat-label>
                  <input matInput formControlName="avatarUrl" />
                </mat-form-field>
              </div>
            </mat-tab>

            <mat-tab label="高级设置">
              <div class="tab-content">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>授权类型（逗号分隔）</mat-label>
                  <input matInput formControlName="authorizationGrantTypes" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>客户端认证方式</mat-label>
                  <input matInput formControlName="clientAuthenticationMethods" />
                </mat-form-field>

                <div class="checkbox-row">
                  <mat-checkbox formControlName="requireProofKey">需要 PKCE（requireProofKey）</mat-checkbox>
                </div>

                <div class="ttl-row">
                  <mat-form-field appearance="outline">
                    <mat-label>AccessToken 有效期（小时）</mat-label>
                    <input matInput formControlName="accessTokenTtlHours" type="number" min="1" />
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>RefreshToken 有效期（天）</mat-label>
                    <input matInput formControlName="refreshTokenTtlDays" type="number" min="1" />
                  </mat-form-field>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </form>
      </mat-card-content>

      <mat-card-actions align="end">
        @if (isEdit()) {
          <button mat-stroked-button color="warn" (click)="confirmDelete()" style="margin-right: auto;">
            <mat-icon>delete</mat-icon>
            删除客户端
          </button>
        }
        <sh-loading-button [loading]="saving()" [disabled]="form.invalid" (clicked)="save()">
          {{ isEdit() ? '保存' : '创建' }}
        </sh-loading-button>
      </mat-card-actions>
    </mat-card>
  </div>
}

<style>
  .loading-center { display: flex; justify-content: center; padding: 48px; }
  .form-layout { display: flex; flex-direction: column; gap: 16px; }
  .form-header { display: flex; align-items: center; gap: 8px; }
  .form-header h2 { margin: 0; }
  .tab-content { padding: 20px 0; display: flex; flex-direction: column; gap: 4px; }
  .full-width { width: 100%; }
  .checkbox-row { padding: 8px 0; }
  .ttl-row { display: flex; gap: 16px; }
  .ttl-row mat-form-field { flex: 1; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add projects/admin-portal/src/app/features/clients/client-form/
git commit -m "feat(admin-portal): add ClientFormComponent — create/edit with tabs, delete dialog"
```

---

## Task 8: Final build verification

- [ ] **Step 1: Full build — both apps**

```bash
ng build auth-portal --configuration development 2>&1 | tail -5
```

```bash
ng build admin-portal --configuration development 2>&1 | tail -5
```

Expected: Both end with `Application bundle generation complete.` with no TypeScript or template errors.

If `admin-portal` fails with `Cannot find module` for any feature component, that means a previous task's commit is missing. Check `git log --oneline -10` to identify what's missing.

- [ ] **Step 2: Commit (if any last-minute fixes were needed)**

Only create a commit if fixes were applied in Step 1. Otherwise no commit is needed.

---

## Done

Plan C complete. admin-portal has all pages implemented. The full workspace now has:

- `shared` — API interceptor, guards, services, shared UI components
- `auth-portal` — login, register, reset-password, OAuth2 consent, account profile/security
- `admin-portal` — admin login, 403, shell layout, user list/detail, client list/form
