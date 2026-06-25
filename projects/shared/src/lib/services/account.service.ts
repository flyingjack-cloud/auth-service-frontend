import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  User, RegisterRequest, ResetPasswordRequest,
  ChangePasswordRequest, UpdateProfileRequest, UpdateContactRequest,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  checkUsername(username: string) {
    return this.http.get<boolean>('/account/check/username', { params: { username } });
  }

  checkEmail(email: string) {
    return this.http.get<boolean>('/account/check/email', { params: { email } });
  }

  checkPhone(phone: string) {
    return this.http.get<boolean>('/account/check/phone', { params: { phone } });
  }

  register(payload: RegisterRequest) {
    return this.http.post<User>('/account/register', payload);
  }

  resetPassword(payload: ResetPasswordRequest) {
    return this.http.post<null>('/account/reset-password', payload);
  }

  getProfile() {
    return this.http.get<User>('/account/profile');
  }

  updateProfile(payload: UpdateProfileRequest) {
    return this.http.put<User>('/account/profile', payload);
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.http.post<null>('/account/change-password', payload);
  }

  updateEmail(payload: UpdateContactRequest) {
    return this.http.put<User>('/account/email', payload);
  }

  updatePhone(payload: UpdateContactRequest) {
    return this.http.put<User>('/account/phone', payload);
  }

}
