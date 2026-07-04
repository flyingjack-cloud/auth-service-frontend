import { TestBed } from '@angular/core/testing';
import { TwoFaStatusService } from './two-fa-status.service';

const KEY = '2fa_enabled';

describe('TwoFaStatusService', () => {
  function makeService(): TwoFaStatusService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(TwoFaStatusService);
  }

  afterEach(() => localStorage.removeItem(KEY));

  it('enabled is false when localStorage has no key', () => {
    localStorage.removeItem(KEY);
    const service = makeService();
    expect(service.enabled()).toBeFalse();
  });

  it('enabled is true when localStorage key is "true" at construction', () => {
    localStorage.setItem(KEY, 'true');
    const service = makeService();
    expect(service.enabled()).toBeTrue();
  });

  it('setEnabled(true) updates signal and sets localStorage', () => {
    const service = makeService();
    service.setEnabled(true);
    expect(service.enabled()).toBeTrue();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('setEnabled(false) updates signal and removes localStorage key', () => {
    localStorage.setItem(KEY, 'true');
    const service = makeService();
    service.setEnabled(false);
    expect(service.enabled()).toBeFalse();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('clearStatus() resets signal and removes localStorage key', () => {
    localStorage.setItem(KEY, 'true');
    const service = makeService();
    service.clearStatus();
    expect(service.enabled()).toBeFalse();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
