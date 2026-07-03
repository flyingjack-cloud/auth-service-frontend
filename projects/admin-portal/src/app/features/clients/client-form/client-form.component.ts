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
import { MatSelectModule } from '@angular/material/select';
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
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
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
  /** 认证方式为 none（公共客户端，SPA/PKCE）时为 true：隐藏密钥、强制 PKCE */
  readonly isPublicClient = signal(false);

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
    requireAuthorizationConsent: [false],
    accessTokenTtlHours: [2, [Validators.required, Validators.min(1)]],
    accessTokenTtlMinutes: [null as number | null, [Validators.min(1)]],
    refreshTokenTtlDays: [7, [Validators.required, Validators.min(1)]],
    reuseRefreshTokens: [true],
  });

  /** 认证方式切换：公共客户端隐藏密钥、强制并锁定 PKCE */
  private applyClientType(method: string | null | undefined): void {
    const isPublic = method === 'none';
    this.isPublicClient.set(isPublic);
    const secret = this.form.get('clientSecret')!;
    const proofKey = this.form.get('requireProofKey')!;
    if (isPublic) {
      secret.setValue('');
      secret.disable({ emitEvent: false });
      proofKey.setValue(true, { emitEvent: false });
      proofKey.disable({ emitEvent: false });
    } else if (!this.isEdit()) {
      secret.enable({ emitEvent: false });
      proofKey.enable({ emitEvent: false });
    }
  }

  ngOnInit(): void {
    this.form.get('clientAuthenticationMethods')!.valueChanges.subscribe(m => this.applyClientType(m));
    this.applyClientType(this.form.get('clientAuthenticationMethods')!.value);

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
      const v = this.form.getRawValue();
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
          requireAuthorizationConsent: v.requireAuthorizationConsent ?? false,
          accessTokenTtlHours: v.accessTokenTtlHours!,
          ...(v.accessTokenTtlMinutes ? { accessTokenTtlMinutes: v.accessTokenTtlMinutes } : {}),
          refreshTokenTtlDays: v.refreshTokenTtlDays!,
          reuseRefreshTokens: v.reuseRefreshTokens ?? true,
        })
        .subscribe({
          next: (res) => {
            this.saving.set(false);
            // 公共客户端无密钥：后端返回 plainSecret 为空，跳过密钥弹窗
            if (!res.plainSecret) {
              this.router.navigate(['/clients']);
              return;
            }
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
