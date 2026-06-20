import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ImageCaptchaData {
  uuid: string;
  base64Image: string;
}

@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly http = inject(HttpClient);

  getImageCaptcha() {
    return this.http.get<ImageCaptchaData>('/captcha/generate/image');
  }

  sendSmsCaptcha(phone: string) {
    return this.http.get<boolean>('/captcha/generate/sms', { params: { phone } });
  }

  sendEmailCaptcha(email: string) {
    return this.http.get<boolean>('/captcha/generate/mail', { params: { email } });
  }
}
