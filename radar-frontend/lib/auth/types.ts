export type UserRole = 'ADMIN' | 'COMERCIAL' | 'AUXILIAR';
export type AccessState = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessState: AccessState;
}
