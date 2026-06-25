// projects/shared/src/lib/models/user.model.ts
export interface User {
  id: string;
  username: string;
  phone: string | null;
  email: string | null;
  createdAt?: string;
  enabled?: boolean;
  accountNonLocked?: boolean;
  accountNonExpired?: boolean;
  credentialsNonExpired?: boolean;
  roles?: string[];
}

export interface LoginRequest {
  loginType: 'username' | 'phone' | 'email';
  principal: string;
  password: string;
  clientId?: string;
}

export interface CaptchaCredentials {
  id: string;
  token: string;
}

export interface RegisterRequest {
  registerType: 'phone' | 'email';
  principal: string;
  password: string;
  code: string;
}

export interface ResetPasswordRequest {
  registerType: 'phone' | 'email';
  principal: string;
  password: string;
  code: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  username: string;
}

export interface UpdateContactRequest {
  newContact: string;
  code: string;
  currentPassword: string;
}

export interface UserStatusUpdate {
  enabled?: boolean | null;
  accountNonLocked?: boolean | null;
}

export interface UserRolesUpdate {
  roleIds: number[];
}

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
