export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_verified: boolean;
  membership_date: string | null;
  password: string;
  remember_me_token: string | null;
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  user_agent: string | null;
  expires_at: number | null;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface Asset {
  id: string;
  name: string | null;
  type: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  s3_key: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  created_at: number;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: number;
}
