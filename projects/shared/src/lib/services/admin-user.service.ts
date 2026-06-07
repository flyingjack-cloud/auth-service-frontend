import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User, UserStatusUpdate, UserRolesUpdate, PageResult } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);

  getUsers(page = 0, size = 20, search?: string) {
    const params: Record<string, string | number> = { page, size };
    if (search) params['search'] = search;
    return this.http.get<PageResult<User>>('/admin/users', { params });
  }

  getUser(id: string) {
    return this.http.get<User>(`/admin/users/${id}`);
  }

  updateStatus(id: string, payload: UserStatusUpdate) {
    return this.http.put<null>(`/admin/users/${id}/status`, payload);
  }

  updateRoles(id: string, payload: UserRolesUpdate) {
    return this.http.put<null>(`/admin/users/${id}/roles`, payload);
  }

  deleteUser(id: string) {
    return this.http.delete<null>(`/admin/users/${id}`);
  }
}
