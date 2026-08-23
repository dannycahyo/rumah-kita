import { createCookieSessionStorage, redirect } from 'react-router';
import { asc, eq } from 'drizzle-orm';
import { db } from '~/db';
import { households, users } from '~/db/schema';

export type Role = 'warga' | 'bendahara' | 'sekretaris' | 'ketua';

/**
 * Hierarki peran. Ketua dan sekretaris setara: keduanya pengurus penuh.
 * Cek izin selalu lewat requireRole() - tidak pernah membandingkan string peran
 * secara langsung di route.
 */
const TINGKAT: Record<Role, number> = {
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

// PROTOTIPE: cookie session tanpa verifikasi kata sandi sama sekali.
// Seam autentikasi nyata: ganti isi getUser()/login() di file ini.
const storage = createCookieSessionStorage({
  cookie: {
    name: 'rk_session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET ?? 'prototype-only'],
    maxAge: 60 * 60 * 24 * 30
  }
});

export async function getSession(request: Request) {
  return storage.getSession(request.headers.get('Cookie'));
}

export async function getUserId(request: Request): Promise<number | null> {
  const session = await getSession(request);
  const id = session.get('userId');
  return typeof id === 'number' ? id : null;
}

export type SessionUser = {
  id: number;
  nama: string;
  email: string;
  role: Role;
  householdId: number;
  householdKode: string;
  householdNama: string;
};

export async function getUser(request: Request): Promise<SessionUser | null> {
  const id = await getUserId(request);
  if (!id) return null;

  const [row] = await db
    .select({ user: users, household: households })
    .from(users)
    .innerJoin(households, eq(users.householdId, households.id))
    .where(eq(users.id, id));
  if (!row) return null;

  return {
    id: row.user.id,
    nama: row.user.nama,
    email: row.user.email,
    role: row.user.role as Role,
    householdId: row.household.id,
    householdKode: row.household.kode,
    householdNama: row.household.namaKk
  };
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) throw redirect('/masuk');
  return user;
}

/** Lempar 403 kalau peran pengguna di bawah minimum. */
export async function requireRole(
  request: Request,
  minimum: Role
): Promise<SessionUser> {
  const user = await requireUser(request);
  if (!minimal(user.role, minimum)) {
    throw new Response('Anda tidak punya akses ke halaman ini.', {
      status: 403,
      statusText: 'Akses ditolak'
    });
  }
  return user;
}

export async function login(userId: number, redirectTo = '/') {
  const session = await storage.getSession();
  session.set('userId', userId);
  return redirect(redirectTo, {
    headers: { 'Set-Cookie': await storage.commitSession(session) }
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect('/masuk', {
    headers: { 'Set-Cookie': await storage.destroySession(session) }
  });
}

/** Akun demo untuk layar masuk dan pengalih peran. */
export async function akunDemo() {
  return db
    .select({ user: users, household: households })
    .from(users)
    .innerJoin(households, eq(users.householdId, households.id))
    .orderBy(asc(users.id));
}

export const LABEL_ROLE: Record<Role, string> = {
  warga: 'Warga',
  bendahara: 'Bendahara',
  sekretaris: 'Sekretaris',
  ketua: 'Ketua RT'
};
