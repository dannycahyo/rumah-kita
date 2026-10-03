import { Form, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/arisan.periode.$id";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
import * as arisan from "~/domain/arisan";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah } from "~/lib/format";
import { Ikon } from "~/ui/ikon";
import { Bagian, Baris, Galat, Header, Kemajuan, Lencana, Sukses, Tombol } from "~/ui/kit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const data = await arisan.periodeById(Number(params.id));
  if (!data) throw new Response("Periode tidak ditemukan.", { status: 404 });

  const kandidat = await arisan.eligibleForDraw(data.period.cycleId);

  return {
    user,
    bisaKelola: isPengurus(user.role),
    period: data.period,
    cycle: data.cycle,
    anggota: data.anggota.map((a) => ({
      memberId: a.member.id,
      kode: a.household.kode,
      nama: a.household.namaKk,
      sudahBayar: Boolean(a.pembayaran),
      sudahMenang: a.sudahMenang,
      milikSaya: a.household.id === user.householdId,
    })),
    sudahBayar: data.sudahBayar,
    pot: data.pot,
    jumlahKandidat: kandidat.length,
    pemenang: data.period.pemenangMemberId
      ? (data.anggota.find((a) => a.member.id === data.period.pemenangMemberId) ?? null)
      : null,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!isPengurus(user.role)) {
    throw new Response("Hanya bendahara yang bisa mengubah data arisan.", {
      status: 403,
    });
  }

  const periodId = Number(params.id);
  const form = await request.formData();
  const maksud = String(form.get("maksud"));

  try {
    if (maksud === "bayar") {
      const memberId = Number(form.get("memberId"));
      const sudah = form.get("sudah") === "1";
      if (sudah) {
        await arisan.batalkanPayment(periodId, memberId);
      } else {
        const iuran = Number(form.get("iuran"));
        await arisan.recordPayment(periodId, memberId, iuran, HARI_INI);
      }
      return { sukses: null };
    }

    if (maksud === "kocok") {
      const hasil = await arisan.draw(periodId, user.id);
      return {
        sukses: `Pemenang periode ini: ${hasil.pemenang.household.kode} ${hasil.pemenang.household.namaKk}. Pot ${rupiah(hasil.pot)}. Sisa ${hasil.sisaKandidat} anggota belum menang.`,
      };
    }

    return { galat: "Aksi tidak dikenal." };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal memproses." };
  }
}

export default function PeriodeArisan({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const fetcher = useFetcher();
  const nav = useNavigation();
  const mengocok =
    nav.state === "submitting" && nav.formData?.get("maksud") === "kocok";
  const selesai = d.period.pemenangMemberId != null;
  const persen = d.anggota.length ? Math.round((d.sudahBayar / d.anggota.length) * 100) : 0;

  return (
    <main className="halaman">
      <Header
        eyebrow={`Arisan · periode ${d.period.nomor} dari ${d.cycle.totalPeriode}`}
        judul={namaPeriode(d.period.periode)}
        kembali="/arisan"
        aksi={
          <Lencana nada={selesai ? "hijau" : "kuning"}>
            {selesai ? "Selesai" : "Berjalan"}
          </Lencana>
        }
      />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {/* Pemenang atau tombol kocokan */}
      {selesai && d.pemenang ? (
        <section className="border-t border-ink pt-5">
          <p className="label">Pemenang kocokan</p>
          <p className="mt-2 font-display text-[2rem] font-semibold leading-tight">
            {d.pemenang.household.kode} {d.pemenang.household.namaKk}
          </p>
          <p className="angka mt-3 text-[1.25rem] text-ok">{rupiah(d.period.pot)}</p>
        </section>
      ) : (
        <section className="border-t border-ink pt-5">
          <p className="label">Terkumpul periode ini</p>
          <p className="angka angka-besar mt-3">{rupiah(d.pot)}</p>
          <p className="mt-3 text-[0.9375rem] text-ink-2">
            {d.sudahBayar} dari {d.anggota.length} anggota sudah setor
          </p>
          <div className="mt-3">
            <Kemajuan persen={persen} label="Anggota yang sudah setor" />
          </div>

          {d.bisaKelola && (
            <Form method="post" className="mt-5">
              <input type="hidden" name="maksud" value="kocok" />
              <Tombol
                type="submit"
                disabled={mengocok || d.jumlahKandidat === 0}
                className="btn-blok sm:inline-flex sm:w-auto"
              >
                {mengocok
                  ? "Mengocok..."
                  : `Kocok dari ${d.jumlahKandidat} anggota yang belum menang`}
              </Tombol>
              <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">
                Anggota yang sudah pernah menang di siklus ini tidak ikut dikocok.
              </p>
            </Form>
          )}
        </section>
      )}

      <div className="mt-10">
        <Bagian judul={`Setoran (${d.sudahBayar}/${d.anggota.length})`}>
          {d.anggota.map((a) => (
            <Baris key={a.memberId} tanda={a.sudahBayar ? "lunas" : "tunggak"}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1rem] font-medium leading-snug">
                    <span className="angka text-ink-2">{a.kode}</span> {a.nama}
                    {a.milikSaya && (
                      <span className="ml-1.5 text-[0.8125rem] font-semibold text-ink-2">
                        (Anda)
                      </span>
                    )}
                  </p>
                  {a.sudahMenang && (
                    <p className="mt-0.5 text-[0.875rem] text-ink-2">
                      Sudah menang - tidak ikut kocokan
                    </p>
                  )}
                </div>

                {d.bisaKelola && !selesai ? (
                  <fetcher.Form method="post" className="shrink-0">
                    <input type="hidden" name="maksud" value="bayar" />
                    <input type="hidden" name="memberId" value={a.memberId} />
                    <input type="hidden" name="sudah" value={a.sudahBayar ? "1" : "0"} />
                    <input type="hidden" name="iuran" value={d.cycle.iuranPerPeriode} />
                    <Tombol type="submit" variasi="kedua">
                      {a.sudahBayar && <Ikon nama="centang" ukuran={16} className="text-ok" />}
                      {a.sudahBayar ? "Sudah setor" : "Tandai setor"}
                    </Tombol>
                  </fetcher.Form>
                ) : (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <Lencana nada={a.sudahBayar ? "hijau" : "merah"}>
                      {a.sudahBayar ? "Setor" : "Belum"}
                    </Lencana>
                    {a.sudahMenang && <Lencana nada="kuning">Menang</Lencana>}
                  </div>
                )}
              </div>
            </Baris>
          ))}
        </Bagian>
      </div>
    </main>
  );
}
