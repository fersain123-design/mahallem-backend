import type { TokenPayload } from '../../utils/jwtUtils';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export {};
