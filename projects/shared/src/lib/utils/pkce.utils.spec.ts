import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce.utils';

describe('PKCE Utils', () => {
  describe('generateCodeVerifier', () => {
    it('returns a Base64URL string with no +, /, = characters', () => {
      const v = generateCodeVerifier();
      expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('returns at least 43 characters per RFC 7636', () => {
      expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
    });

    it('returns at most 128 characters per RFC 7636', () => {
      expect(generateCodeVerifier().length).toBeLessThanOrEqual(128);
    });

    it('returns a different value on each call', () => {
      expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
    });
  });

  describe('generateCodeChallenge', () => {
    it('returns the correct SHA-256 Base64URL for a known input', async () => {
      // RFC 7636 Appendix B test vector
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });

    it('contains no +, /, or = characters', async () => {
      const c = await generateCodeChallenge('any-string');
      expect(c).not.toContain('+');
      expect(c).not.toContain('/');
      expect(c).not.toContain('=');
    });
  });

  describe('generateState', () => {
    it('returns a non-empty string', () => {
      expect(generateState().length).toBeGreaterThanOrEqual(43);
    });

    it('returns a different value on each call', () => {
      expect(generateState()).not.toBe(generateState());
    });
  });
});
