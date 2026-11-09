import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthSsoService } from '../services/auth-sso.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthSsoService);
  const token = authService.token();

  let modifiedReq = req;
  if (token) {
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  }

  return next(modifiedReq);
};

