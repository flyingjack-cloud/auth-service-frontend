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
