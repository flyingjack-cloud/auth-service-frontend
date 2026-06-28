# OAuth2 客户端密钥自动生成 & 一次性展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许创建 OAuth2 客户端时省略 `clientSecret`，后台自动生成，并在创建成功后通过一次性弹窗展示明文密钥。

**Architecture:** 分三步：先更新 shared 层的模型与服务类型，再调整表单校验与 payload 构造，最后新增 `SecretRevealDialogComponent` 并接入创建成功回调。无新路由，无新文件，所有改动内聚在现有四个文件内。

**Tech Stack:** Angular 18+, Angular Material (MatDialog, MatCheckbox), RxJS

## Global Constraints

- 所有文件路径以 `projects/` 为根，均在 monorepo 内
- Angular standalone 组件风格，无 NgModule
- `MatDialogModule` 已在 `client-form.component.ts` 的 imports 中（用于删除确认弹窗）
- `MatCheckboxModule` 需新增到 `client-form.component.ts` 的 imports 中
- 构建命令：`ng build shared && ng build admin-portal`（在项目根目录运行）
- 不修改编辑模式（`isEdit`）逻辑

---

### Task 1: 更新模型与服务类型

**Files:**
- Modify: `projects/shared/src/lib/models/client.model.ts`
- Modify: `projects/shared/src/lib/services/client-management.service.ts`

**Interfaces:**
- Produces:
  - `CreateClientResponse` interface — `{ client: OAuthClient; plainSecret: string }`
  - `CreateClientRequest.clientSecret` — `string | undefined`（optional）
  - `ClientManagementService.createClient()` — 返回 `Observable<CreateClientResponse>`

- [ ] **Step 1: 修改 `client.model.ts`**

将 `clientSecret` 改为可选，新增 `CreateClientResponse`：

```typescript
// projects/shared/src/lib/models/client.model.ts
export interface OAuthClient {
  id: number;
  clientId: string;
  clientIdIssuedAt: string;
  clientName: string;
  clientAuthenticationMethods: string;
  authorizationGrantTypes: string;
  redirectUris: string;
  scopes: string;
  description: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
}

export interface CreateClientRequest {
  clientId: string;
  clientName: string;
  clientSecret?: string;
  authorizationGrantTypes: string;
  clientAuthenticationMethods: string;
  redirectUris: string;
  scopes: string;
  requireProofKey: boolean;
  accessTokenTtlHours: number;
  refreshTokenTtlDays: number;
  description: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
}

export interface CreateClientResponse {
  client: OAuthClient;
  plainSecret: string;
}

export interface UpdateClientRequest {
  clientName?: string;
  clientSecret?: string;
  redirectUris?: string;
  accessTokenTtlHours?: number;
  refreshTokenTtlDays?: number;
  description?: string | null;
  avatarUrl?: string | null;
  contactEmail?: string | null;
}
```

- [ ] **Step 2: 修改 `client-management.service.ts`**

`createClient()` 返回类型改为 `CreateClientResponse`：

```typescript
// projects/shared/src/lib/services/client-management.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OAuthClient, CreateClientRequest, CreateClientResponse, UpdateClientRequest } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientManagementService {
  private readonly http = inject(HttpClient);

  getClients() {
    return this.http.get<OAuthClient[]>('/clients/');
  }

  getClient(clientId: string) {
    return this.http.get<OAuthClient>(`/clients/${clientId}`);
  }

  createClient(payload: CreateClientRequest) {
    return this.http.post<CreateClientResponse>('/clients/', payload);
  }

  updateClient(clientId: string, payload: UpdateClientRequest) {
    return this.http.put<OAuthClient>(`/clients/${clientId}`, payload);
  }

  deleteClient(clientId: string) {
    return this.http.delete<void>(`/clients/${clientId}`);
  }
}
```

- [ ] **Step 3: 构建 shared 验证类型正确**

```bash
ng build shared
```

期望：构建成功，无类型错误。

- [ ] **Step 4: Commit**

```bash
git add projects/shared/src/lib/models/client.model.ts \
        projects/shared/src/lib/services/client-management.service.ts
git commit -m "feat(shared): make clientSecret optional, add CreateClientResponse type"
```

---

### Task 2: 更新表单校验与 payload 构造

**Files:**
- Modify: `projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts`
- Modify: `projects/admin-portal/src/app/features/clients/client-form/client-form.component.html`

**Interfaces:**
- Consumes: `CreateClientRequest`（`clientSecret?: string`，来自 Task 1）
- Produces: 表单新建模式下 `clientSecret` 选填，payload 中空值不传

- [ ] **Step 1: 移除新建模式下 `clientSecret` 的必填校验**

在 `client-form.component.ts` 的 `form` 定义中，`clientSecret` 控件去掉 `Validators.required`：

```typescript
readonly form = inject(FormBuilder).group({
  clientId: ['', [Validators.required]],
  clientName: ['', [Validators.required]],
  clientSecret: [''],          // 新建时选填，编辑时同样选填（逻辑不变）
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
```

同时删除 `ngOnInit` 中编辑模式清除 `clientSecret` 校验的代码（已不再需要）：

```typescript
ngOnInit(): void {
  const param = this.route.snapshot.params['clientId'];
  if (param) {
    this.isEdit.set(true);
    this.editClientId = param;
    // 删除这两行（clientSecret 已全局选填，不再需要在编辑时单独清除）
    // this.form.get('clientSecret')!.clearValidators();
    // this.form.get('clientSecret')!.updateValueAndValidity();

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
```

- [ ] **Step 2: 更新新建分支的 payload 构造**

在 `save()` 方法的新建分支（`else` 块）中，`clientSecret` 改为条件传递：

```typescript
} else {
  const v = this.form.value;
  this.clientService
    .createClient({
      clientId: v.clientId!,
      clientName: v.clientName!,
      ...(v.clientSecret ? { clientSecret: v.clientSecret } : {}),
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
      next: (res) => {
        this.saving.set(false);
        // Task 3 中替换此处逻辑，当前占位保持编译通过
        this.router.navigate(['/clients']);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.errorMessage.set(err.errorId === 'error.business.conflict' ? '客户端 ID 已存在' : '创建失败，请稍后重试');
      },
    });
}
```

注意：`next` 回调参数从无名改为 `res`（Task 3 中使用），此时暂时不用 `res`，不影响编译。

- [ ] **Step 3: 在模板中为 `clientSecret` 字段添加 hint**

在 `client-form.component.html` 中，找到 `clientSecret` 的 `mat-form-field`，更新 label 和 hint：

```html
<mat-form-field appearance="outline" class="full-width">
  <mat-label>{{ isEdit() ? '新密钥（留空保持不变）' : '客户端密钥（留空则自动生成）' }}</mat-label>
  <input matInput formControlName="clientSecret" type="password" />
  @if (!isEdit()) {
    <mat-hint>留空则由系统自动生成安全密钥</mat-hint>
  }
</mat-form-field>
```

- [ ] **Step 4: 构建验证**

```bash
ng build admin-portal
```

期望：构建成功，无类型错误、无模板错误。

- [ ] **Step 5: Commit**

```bash
git add projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts \
        projects/admin-portal/src/app/features/clients/client-form/client-form.component.html
git commit -m "feat(admin-portal): make clientSecret optional in client creation form"
```

---

### Task 3: 新增 SecretRevealDialogComponent 并接入创建流程

**Files:**
- Modify: `projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts`

**Interfaces:**
- Consumes:
  - `CreateClientResponse` — `{ client: OAuthClient; plainSecret: string }`（来自 Task 1）
  - `MatDialog.open()` — 已注入（来自现有代码）
- Produces: 无（终态：创建成功 → 弹窗 → 关闭后跳转 `/clients`）

- [ ] **Step 1: 新增所需 imports**

在 `client-form.component.ts` 顶部新增以下 import：

```typescript
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
```

注意：`MatCheckboxModule` 只用于 `SecretRevealDialogComponent` 自身的 imports 数组，**不**需要加到 `ClientFormComponent` 的 imports 中。

- [ ] **Step 2: 新增 `SecretRevealDialogComponent`**

在文件内，紧接在 `DeleteClientDialogComponent` 下方插入以下 inline 组件：

```typescript
@Component({
  selector: 'admin-secret-reveal-dialog',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>密钥已生成</h2>
    <mat-dialog-content>
      <p class="warn-text">
        <mat-icon>warning</mat-icon>
        此密钥仅显示一次，关闭后将无法再次查看，请立即复制并安全保存。
      </p>
      <div class="secret-row">
        <input class="secret-input" [value]="data.plainSecret" readonly />
        <button mat-icon-button (click)="copy()" [title]="copied ? '已复制' : '复制密钥'">
          <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
        </button>
      </div>
      <mat-checkbox [(ngModel)]="confirmed">我已将密钥保存至安全位置</mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" [disabled]="!confirmed" [mat-dialog-close]="true">
        完成
      </button>
    </mat-dialog-actions>
    <style>
      .warn-text {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--mat-sys-error, #b00020);
        font-size: 14px;
        margin-bottom: 16px;
      }
      .warn-text mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      .secret-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 16px;
      }
      .secret-input {
        flex: 1;
        font-family: monospace;
        font-size: 13px;
        padding: 8px 10px;
        border: 1px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        background: #f5f5f5;
        color: #333;
        outline: none;
      }
    </style>
  `,
})
class SecretRevealDialogComponent {
  readonly data = inject<{ plainSecret: string }>(MAT_DIALOG_DATA);
  confirmed = false;
  copied = false;

  copy(): void {
    navigator.clipboard.writeText(this.data.plainSecret).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
```

注意：`[(ngModel)]` 需要 `FormsModule`，在 imports 中加入：

```typescript
import { FormsModule } from '@angular/forms';
```

并在组件 `imports` 数组加入 `FormsModule`。

- [ ] **Step 4: 修改创建成功回调，打开弹窗**

在 `save()` 方法的新建分支 `next` 回调中，替换为：

```typescript
next: (res) => {
  this.saving.set(false);
  const ref = this.dialog.open(SecretRevealDialogComponent, {
    data: { plainSecret: res.plainSecret },
    disableClose: true,
    width: '480px',
  });
  ref.afterClosed().subscribe(() => {
    this.router.navigate(['/clients']);
  });
},
```

- [ ] **Step 5: 确认完整 `client-form.component.ts`**

完整文件内容如下（以此为准，覆盖原文件）：

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
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
  selector: 'admin-secret-reveal-dialog',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>密钥已生成</h2>
    <mat-dialog-content>
      <p class="warn-text">
        <mat-icon>warning</mat-icon>
        此密钥仅显示一次，关闭后将无法再次查看，请立即复制并安全保存。
      </p>
      <div class="secret-row">
        <input class="secret-input" [value]="data.plainSecret" readonly />
        <button mat-icon-button (click)="copy()" [title]="copied ? '已复制' : '复制密钥'">
          <mat-icon>{{ copied ? 'check' : 'content_copy' }}</mat-icon>
        </button>
      </div>
      <mat-checkbox [(ngModel)]="confirmed">我已将密钥保存至安全位置</mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" [disabled]="!confirmed" [mat-dialog-close]="true">
        完成
      </button>
    </mat-dialog-actions>
    <style>
      .warn-text {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--mat-sys-error, #b00020);
        font-size: 14px;
        margin-bottom: 16px;
      }
      .warn-text mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      .secret-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 16px;
      }
      .secret-input {
        flex: 1;
        font-family: monospace;
        font-size: 13px;
        padding: 8px 10px;
        border: 1px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        background: #f5f5f5;
        color: #333;
        outline: none;
      }
    </style>
  `,
})
class SecretRevealDialogComponent {
  readonly data = inject<{ plainSecret: string }>(MAT_DIALOG_DATA);
  confirmed = false;
  copied = false;

  copy(): void {
    navigator.clipboard.writeText(this.data.plainSecret).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}

@Component({
  selector: 'admin-client-form',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
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
    clientSecret: [''],
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
          ...(v.clientSecret ? { clientSecret: v.clientSecret } : {}),
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
          next: (res) => {
            this.saving.set(false);
            const ref = this.dialog.open(SecretRevealDialogComponent, {
              data: { plainSecret: res.plainSecret },
              disableClose: true,
              width: '480px',
            });
            ref.afterClosed().subscribe(() => {
              this.router.navigate(['/clients']);
            });
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

- [ ] **Step 6: 构建验证**

```bash
ng build shared && ng build admin-portal
```

期望：两个项目均构建成功，无类型或模板错误。

- [ ] **Step 7: Commit**

```bash
git add projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts \
        projects/admin-portal/src/app/features/clients/client-form/client-form.component.html
git commit -m "feat(admin-portal): show one-time secret reveal dialog after client creation"
```

---

## 人工验收测试

所有 Task 完成后：

1. 启动开发服务器：`ng serve admin-portal`
2. 进入客户端新建表单，确认 `clientSecret` 字段 hint 文字为"留空则由系统自动生成安全密钥"
3. **场景 A（自动生成）**：留空 `clientSecret`，填写其余必填项，点击「创建」
   - 期望：弹出密钥弹窗，显示 `plainSecret` 明文
   - 「完成」按钮禁用，勾选 checkbox 后启用
   - 点击复制按钮，图标变为 ✓，2 秒后恢复
   - 点击「完成」后跳转 `/clients`
4. **场景 B（手动设置）**：填写 `clientSecret`，点击「创建」
   - 期望：弹出密钥弹窗，`plainSecret` 为后台返回值（可能与输入值不同，取决于后台实现）
5. **场景 C（编辑模式不受影响）**：编辑已有客户端，`clientSecret` 留空保存
   - 期望：保存成功，跳转 `/clients`，无弹窗
