import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  User, TwoFaVerifyRequest, TwoFaSetupResponse, TwoFaDisableRequest,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class TwoFaService {
  private readonly http = inject(HttpClient);

  verify(req: TwoFaVerifyRequest) {
    return this.http.post<User>('/account/2fa/verify', req);
  }

  setup() {
    return this.http.post<TwoFaSetupResponse>('/account/2fa/setup', {});
  }

  confirm(req: { code: string }) {
    return this.http.post<null>('/account/2fa/confirm', req);
  }

  disable(req: TwoFaDisableRequest) {
    return this.http.delete<null>('/account/2fa', { body: req });
  }
}
