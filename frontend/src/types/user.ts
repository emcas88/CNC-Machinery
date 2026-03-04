export type UserRole = 'super_admin' | 'designer' | 'cnc_operator' | 'shop_floor';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>>;

export interface ListUsersParams {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}
