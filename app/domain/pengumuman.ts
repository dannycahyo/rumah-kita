import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '~/db';
import { pengumuman, users } from '~/db/schema';

import { LABEL_KATEGORI, type Kategori } from '~/lib/kategori';

export { LABEL_KATEGORI, type Kategori };

export async function list(opts: { kategori?: Kategori; cari?: string } = {}) {
  const conds: SQL[] = [];
  if (opts.kategori) conds.push(eq(pengumuman.kategori, opts.kategori));
  if (opts.cari?.trim()) {
    const q = `%${opts.cari.trim()}%`;
    const m = or(ilike(pengumuman.judul, q), ilike(pengumuman.isi, q));
    if (m) conds.push(m);
  }

  return db
    .select({ post: pengumuman, author: users })
    .from(pengumuman)
    .innerJoin(users, eq(pengumuman.authorId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(pengumuman.dibuatPada));
}

export async function byId(id: number) {
  const [row] = await db
    .select({ post: pengumuman, author: users })
    .from(pengumuman)
    .innerJoin(users, eq(pengumuman.authorId, users.id))
    .where(eq(pengumuman.id, id));
  return row ?? null;
}

export async function terbaru() {
  const [row] = await db
    .select({ post: pengumuman, author: users })
    .from(pengumuman)
    .innerJoin(users, eq(pengumuman.authorId, users.id))
    .orderBy(desc(pengumuman.dibuatPada))
    .limit(1);
  return row ?? null;
}

export async function create(input: {
  kategori: Kategori;
  judul: string;
  isi: string;
  authorId: number;
}) {
  const [row] = await db.insert(pengumuman).values(input).returning();
  return row;
}
