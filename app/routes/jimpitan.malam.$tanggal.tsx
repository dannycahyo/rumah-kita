import { useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/jimpitan.malam.$tanggal";
import { requireRole } from "~/domain/auth";
import * as jimpitan from "~/domain/jimpitan";
import { rupiah, tambahHari, tanggalLengkap } from "~/lib/format";
import { Ikon } from "~/ui/ikon";
import { BarTempel, Galat, Header, Info, Sukses, Tombol } from "~/ui/kit";

const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, "bendahara");
  const tanggal = Tanggal.parse(params.tanggal);
  const roster = await jimpitan.rosterForNight(tanggal);
  return { ...roster, standar: jimpitan.JIMPITAN_STANDAR };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, "bendahara");
  const tanggal = Tanggal.parse(params.tanggal);
  const form = await request.formData();

  // Satu simpan untuk seluruh malam: kumpulkan semua baris sekaligus.
  const entries: jimpitan.EntriMalam[] = [];
  for (const [kunci, nilai] of form.entries()) {
    if (!kunci.startsWith("kk_")) continue;
    const householdId = Number(kunci.slice(3));
    const angka = Number(nilai);
    entries.push({
      householdId,
      jumlah: Number.isFinite(angka) && angka > 0 ? Math.round(angka) : null,
    });
  }

  try {
    const hasil = await jimpitan.saveNight(tanggal, entries, user.id);
    return {
      sukses: `${hasil.tersimpan} rumah tersimpan untuk malam ini.`,
    };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export default function MalamJimpitan({ loaderData, actionData }: Route.ComponentProps) {
  const { tanggal, rows, standar, terkunci } = loaderData;
  const nav = useNavigation();
  const menyimpan = nav.state === "submitting";

  // State lokal: seluruh malam diedit di klien, lalu dikirim satu kali.
  const [nilai, setNilai] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.household.id, r.entry?.jumlah ?? null])),
  );

  const total = useMemo(
    () => Object.values(nilai).reduce<number>((s, v) => s + (v ?? 0), 0),
    [nilai],
  );
  const terisi = useMemo(
    () => Object.values(nilai).filter((v) => v != null && v > 0).length,
    [nilai],
  );

  function toggle(id: number) {
    if (terkunci) return;
    setNilai((n) => ({ ...n, [id]: n[id] ? null : standar }));
  }

  function ubah(id: number, delta: number) {
    if (terkunci) return;
    setNilai((n) => {
      const sekarang = n[id] ?? 0;
      const baru = Math.max(0, sekarang + delta);
      return { ...n, [id]: baru === 0 ? null : baru };
    });
  }

  function semua() {
    setNilai(Object.fromEntries(rows.map((r) => [r.household.id, standar])));
  }

  return (
    <main className="halaman pb-44">
      <Header eyebrow="Jimpitan" judul={tanggalLengkap(tanggal)} kembali="/jimpitan" />

      {/* Tautan biasa (bukan Link): memuat ulang supaya state lokal malam lain bersih. */}
      <nav
        aria-label="Pindah malam"
        className="-mt-3 mb-5 flex items-center justify-between gap-3 text-[0.875rem] font-semibold"
      >
        <a
          href={`/jimpitan/malam/${tambahHari(tanggal, -1)}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-2 text-ink-2 hover:text-ink"
        >
          <Ikon nama="kembali" ukuran={16} />
          Malam sebelumnya
        </a>
        <a
          href={`/jimpitan/malam/${tambahHari(tanggal, 1)}`}
          className="-mr-1 inline-flex min-h-11 items-center gap-1 pl-2 text-ink-2 hover:text-ink"
        >
          Malam berikutnya
          <Ikon nama="panah" ukuran={16} />
        </a>
      </nav>

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {terkunci && (
        <Info>
          Periode bulan ini sudah terkunci dan sudah disetor ke kas RT. Entri tidak bisa
          diubah lagi.
        </Info>
      )}

      {!terkunci && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="label min-w-0">Ketuk baris untuk mengisi {rupiah(standar)}</p>
          <Tombol
            onClick={semua}
            type="button"
            variasi="kedua"
            className="btn-kecil min-h-11 shrink-0"
          >
            Isi semua
          </Tombol>
        </div>
      )}

      <Form method="post" id="malam">
        <ul className="daftar">
          {rows.map(({ household }) => {
            const v = nilai[household.id];
            const aktif = v != null && v > 0;
            return (
              <li key={household.id} className="baris flex items-center gap-1">
                <input type="hidden" name={`kk_${household.id}`} value={v ?? 0} />

                <button
                  type="button"
                  onClick={() => toggle(household.id)}
                  disabled={terkunci}
                  aria-pressed={aktif}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      aktif
                        ? "border-ink bg-ink text-paper"
                        : "border-rule-strong bg-sheet text-transparent"
                    }`}
                  >
                    <Ikon nama="centang" ukuran={16} tebal={2.2} />
                  </span>
                  <span className="min-w-0 truncate text-[1rem] leading-tight">
                    <span className="angka mr-2 text-ink-2">{household.kode}</span>
                    {household.namaKk}
                  </span>
                </button>

                <span
                  className={`angka w-[4.5rem] shrink-0 text-right text-[0.9375rem] ${
                    aktif ? "" : "text-ink-3"
                  }`}
                >
                  {aktif ? rupiah(v!) : terkunci ? "—" : ""}
                </span>

                {!terkunci && (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => ubah(household.id, -500)}
                      aria-label={`Kurangi 500 untuk ${household.kode}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-paper-2"
                    >
                      <Ikon nama="kurang" ukuran={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => ubah(household.id, 500)}
                      aria-label={`Tambah 500 untuk ${household.kode}`}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-paper-2"
                    >
                      <Ikon nama="tambah" ukuran={18} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Form>

      {/* Total berjalan + satu tombol simpan, menempel di bawah. */}
      {!terkunci && (
        <BarTempel>
          <div className="min-w-0">
            <p className="label">
              {terisi} dari {rows.length} rumah
            </p>
            <p className="angka text-[1.375rem] leading-tight">{rupiah(total)}</p>
          </div>
          <Tombol type="submit" form="malam" disabled={menyimpan} className="shrink-0">
            {menyimpan ? "Menyimpan..." : "Simpan malam ini"}
          </Tombol>
        </BarTempel>
      )}
    </main>
  );
}
