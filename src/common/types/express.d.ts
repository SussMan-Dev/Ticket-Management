import type { UserRole } from "../constants/roles.js";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: number;
      email: string;
      role: UserRole;
      sessionId: string;
    }

    interface Request {
      user?: AuthenticatedUser;
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
