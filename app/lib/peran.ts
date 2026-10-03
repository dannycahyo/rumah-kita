/**
 * Hierarki peran, aman dipakai di klien (tanpa database).
 * Ketua dan sekretaris setara: keduanya pengurus penuh.
 * Cek izin di server tetap lewat requireRole() di app/domain/auth.ts.
 */
export type Role = 'warga' | 'bendahara' | 'sekretaris' | 'ketua';

export const TINGKAT: Record<Role, number> = {
  warga: 0,
  bendahara: 1,
  sekretaris: 2,
  ketua: 2
};

export function minimal(role: Role, minimum: Role): boolean {
  return TINGKAT[role] >= TINGKAT[minimum];
}

export const isPengurus = (role: Role) => minimal(role, 'bendahara');
export const isKetua = (role: Role) => minimal(role, 'sekretaris');
