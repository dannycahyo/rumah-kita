import { sql } from "drizzle-orm";
import { households } from "./schema";

/**
 * Urutan kode rumah secara alami: A1, A2, ... A10, bukan A1, A10, A11, A2.
 *
 * Penting untuk checklist jimpitan - kolektor berjalan dari rumah ke rumah,
 * jadi urutannya harus mengikuti nomor rumah sebenarnya.
 */
export const urutanKode = [
  sql`substring(${households.kode} from '^[A-Za-z]+')`,
  sql`(substring(${households.kode} from '[0-9]+$'))::int`,
];
