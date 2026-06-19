import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly translate = inject(TranslateService);

  readonly currentLang = signal<'zh' | 'en'>(
    (localStorage.getItem('lang') as 'zh' | 'en') ?? 'zh',
  );

  constructor() {
    this.translate.setFallbackLang('zh').subscribe();
    this.translate.use(this.currentLang());
  }

  toggle(): void {
    const next = this.currentLang() === 'zh' ? 'en' : 'zh';
    this.currentLang.set(next);
    this.translate.use(next);
    localStorage.setItem('lang', next);
  }
}
