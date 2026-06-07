// projects/shared/src/lib/tokens/environment.token.ts
import { InjectionToken } from '@angular/core';

export interface Environment {
  apiBaseUrl: string;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
