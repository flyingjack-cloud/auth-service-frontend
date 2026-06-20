import { InjectionToken } from '@angular/core';

export interface Environment {
  apiBaseUrl: string;
  thirdPartyBaseUrl?: string;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
