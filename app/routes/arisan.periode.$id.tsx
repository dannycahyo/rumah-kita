import { Form, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/arisan.periode.$id";
import { isPengurus, requireUser } from "~/domain/auth";
import * as arisan from "~/domain/arisan";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Lencana, Sukses, Tombol, Uang } from "~/ui/kit";

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

  return (
    <main>
      <Header
        eyebrow={`Periode ${d.period.nomor} dari ${d.cycle.totalPeriode}`}
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
        <div className="margin-rule rule-lunas border-b border-kertas-tua bg-pos-pucat/50 px-4 py-5">
          <p className="label-resmi">Pemenang kocokan</p>
          <p className="mt-1 text-[22px] font-bold">
            {d.pemenang.household.kode} {d.pemenang.household.namaKk}
          </p>
          <p className="angka mt-1 text-[15px] font-semibold text-pos">
            {rupiah(d.period.pot)}
          </p>
        </div>
      ) : (
        <div className="margin-rule rule-malam border-b border-kertas-tua bg-lampu-pucat/50 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-resmi">Terkumpul periode ini</p>
              <p className="angka mt-1 text-[26px] font-bold leading-none">
                {rupiah(d.pot)}
              </p>
              <p className="mt-1.5 text-[12px] text-pensil">
                {d.sudahBayar} dari {d.anggota.length} anggota sudah setor
              </p>
            </div>
          </div>

          {d.bisaKelola && (
            <Form method="post" className="mt-4">
              <input type="hidden" name="maksud" value="kocok" />
              <Tombol
                type="submit"
                disabled={mengocok || d.jumlahKandidat === 0}
                className="w-full"
              >
                {mengocok
                  ? "Mengocok..."
                  : `Kocok dari ${d.jumlahKandidat} anggota yang belum menang`}
              </Tombol>
              <p className="mt-2 text-[12px] leading-relaxed text-pensil">
                Anggota yang sudah pernah menang di siklus ini tidak ikut dikocok.
              </p>
            </Form>
          )}
        </div>
      )}

      <Bagian judul={`Setoran (${d.sudahBayar}/${d.anggota.length})`}>
        {d.anggota.map((a) => (
          <Baris
            key={a.memberId}
            tanda={a.sudahBayar ? "lunas" : "tunggak"}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  <span className="angka text-pensil">{a.kode}</span> {a.nama}
                  {a.milikSaya && (
                    <span className="ml-1.5 text-[11px] font-semibold text-pos">
                      (Anda)
                    </span>
                  )}
                </p>
                {a.sudahMenang && (
                  <p className="mt-0.5 text-[12px] text-pensil">
                    Sudah menang - tidak ikut kocokan
                  </p>
                )}
              </div>

              {d.bisaKelola && !selesai ? (
                <fetcher.Form method="post" className="shrink-0">
                  <input type="hidden" name="maksud" value="bayar" />
                  <input type="hidden" name="memberId" value={a.memberId} />
                  <input type="hidden" name="sudah" value={a.sudahBayar ? "1" : "0"} />
                  <input
                    type="hidden"
                    name="iuran"
                    value={d.cycle.iuranPerPeriode}
                  />
                  <button
                    className={`border px-3 py-1.5 text-[12px] font-semibold ${
                      a.sudahBayar
                        ? "border-pos-muda bg-pos-pucat text-pos"
                        : "border-kertas-tua bg-[#fffdf8] text-pensil"
                    }`}
                  >
                    {a.sudahBayar ? "Sudah setor" : "Tandai setor"}
                  </button>
                </fetcher.Form>
              ) : (
                <div className="flex shrink-0 gap-1">
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
    </main>
  );
}
