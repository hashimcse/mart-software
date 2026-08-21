export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
