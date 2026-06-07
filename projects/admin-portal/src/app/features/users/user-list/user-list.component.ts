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
