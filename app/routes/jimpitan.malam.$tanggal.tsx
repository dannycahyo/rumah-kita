import { useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/jimpitan.malam.$tanggal";
import { requireRole } from "~/domain/auth";
import * as jimpitan from "~/domain/jimpitan";
import { rupiah, tambahHari, tanggalLengkap } from "~/lib/format";
import { Galat, Header, Sukses } from "~/ui/kit";

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
    <main className="pb-44">
      <Header
        eyebrow="Jimpitan malam"
        judul={tanggalLengkap(tanggal)}
        kembali="/jimpitan"
      />

      <div className="flex items-center justify-between border-b border-kertas-tua px-4 py-2.5">
        <a
          href={`/jimpitan/malam/${tambahHari(tanggal, -1)}`}
          className="text-[13px] font-semibold text-pos"
        >
          ← Malam sebelumnya
        </a>
        <a
          href={`/jimpitan/malam/${tambahHari(tanggal, 1)}`}
          className="text-[13px] font-semibold text-pos"
        >
          Malam berikutnya →
        </a>
      </div>

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {terkunci && (
        <p className="margin-rule rule-netral bg-kertas-tua px-4 py-3 text-[13px]">
          Periode bulan ini sudah <strong>terkunci</strong> dan sudah disetor ke kas
          RT. Entri tidak bisa diubah lagi.
        </p>
      )}

      {!terkunci && (
        <div className="flex items-center justify-between border-b border-kertas-tua px-4 py-2.5">
          <p className="text-[12px] text-pensil">
            Ketuk baris untuk mengisi {rupiah(standar)}
          </p>
          <button
            onClick={semua}
            type="button"
            className="text-[12px] font-semibold text-pos underline underline-offset-2"
          >
            Isi semua
          </button>
        </div>
      )}

      <Form method="post" id="malam">
        <ul>
          {rows.map(({ household }) => {
            const v = nilai[household.id];
            const aktif = v != null && v > 0;
            return (
              <li
                key={household.id}
                className={`baris margin-rule ${aktif ? "rule-lunas" : "rule-netral"} flex items-center gap-3 px-3 py-2.5`}
              >
                <input type="hidden" name={`kk_${household.id}`} value={v ?? 0} />

                <button
                  type="button"
                  onClick={() => toggle(household.id)}
                  disabled={terkunci}
                  aria-pressed={aktif}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[13px] font-bold ${
                      aktif
                        ? "border-pos-muda bg-pos-muda text-kertas"
                        : "border-kertas-tua bg-[#fffdf8] text-kertas-tua"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className="angka text-[13px] font-semibold text-pensil">
                      {household.kode}
                    </span>
                    <span className="ml-2 text-[14px]">{household.namaKk}</span>
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`angka w-[74px] text-right text-[14px] font-semibold ${
                      aktif ? "" : "text-kertas-tua"
                    }`}
                  >
                    {aktif ? rupiah(v!) : "—"}
                  </span>
                  {!terkunci && (
                    <span className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => ubah(household.id, 500)}
                        aria-label={`Tambah 500 untuk ${household.kode}`}
                        className="h-6 w-7 border border-kertas-tua bg-[#fffdf8] text-[11px] leading-none"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => ubah(household.id, -500)}
                        aria-label={`Kurangi 500 untuk ${household.kode}`}
                        className="h-6 w-7 border border-t-0 border-kertas-tua bg-[#fffdf8] text-[11px] leading-none"
                      >
                        −
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Form>

      {/* Total berjalan + satu tombol simpan, menempel di bawah. */}
      {!terkunci && (
        <div className="fixed bottom-[106px] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-kertas-tua bg-[#fffdf8] px-4 py-3 shadow-[0_-4px_16px_rgba(45,42,38,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-resmi">
                {terisi} dari {rows.length} rumah
              </p>
              <p className="angka text-[20px] font-bold leading-tight">
                {rupiah(total)}
              </p>
            </div>
            <button
              type="submit"
              form="malam"
              disabled={menyimpan}
              className="bg-pos px-6 py-3.5 text-[15px] font-semibold text-kertas disabled:opacity-40"
            >
              {menyimpan ? "Menyimpan..." : "Simpan malam ini"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
