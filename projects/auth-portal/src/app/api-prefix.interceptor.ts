import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../environments/environment';

// Business API paths that require the /api prefix in production.
// OAuth2 (/oauth2/) and OIDC (/.well-known/) paths are routed directly
// by the gateway without a prefix, so they are intentionally excluded.
const PREFIXED_PATHS = ['/account', '/clients', '/admin'];

export const apiPrefixInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.apiPrefix) return next(req);
  if (PREFIXED_PATHS.some(p => req.url.startsWith(p))) {
    return next(req.clone({ url: `${environment.apiPrefix}${req.url}` }));
  }
  return next(req);
};
