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
