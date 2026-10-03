import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/arisan._index";
import { requireUser } from "~/domain/auth";
import * as arisan from "~/domain/arisan";
import { namaPeriode, rupiah } from "~/lib/format";
import {
  Bagian,
  Baris,
  Header,
  Kemajuan,
  Kosong,
  Lencana,
  Ringkas,
  Strip,
  Tabs,
  TautanTombol,
  Uang,
} from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const siklus = await arisan.siklusAktif();
  if (!siklus) return { user, siklus: null };

  const [ringkasan, anggota, kandidat] = await Promise.all([
    arisan.ringkasan(siklus.id),
    arisan.memberStatus(siklus.id),
    arisan.eligibleForDraw(siklus.id),
  ]);

  return {
    user,
    siklus,
    ringkasan: {
      periodeBerjalan: ringkasan.periodeBerjalan,
      selesai: ringkasan.selesai,
      pot: ringkasan.pot,
      periods: ringkasan.periods.map((p) => ({
        id: p.id,
        nomor: p.nomor,
        periode: p.periode,
        status: p.status,
        pot: p.pot,
        pemenangMemberId: p.pemenangMemberId,
      })),
    },
    anggota: anggota.map((a) => ({
      memberId: a.member.id,
      kode: a.household.kode,
      nama: a.household.namaKk,
      sudahBayar: a.sudahBayar,
      menangPeriode: a.menangPeriode,
      milikSaya: a.household.id === user.householdId,
    })),
    jumlahKandidat: kandidat.length,
  };
}

export default function ArisanIndex({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "anggota" ? "anggota" : "periode";

  if (!d.siklus) {
    return (
      <main className="halaman">
        <Header judul="Arisan" />
        <Kosong pesan="Belum ada siklus arisan yang berjalan." />
      </main>
    );
  }

  const { siklus, ringkasan, anggota } = d;
  const namaPemenang = new Map(
    anggota.map((a) => [a.memberId, `${a.kode} ${a.nama}`]),
  );
  const persen = Math.round((ringkasan.selesai / siklus.totalPeriode) * 100);

  return (
    <main className="halaman">
      <Header judul="Arisan" keterangan={siklus.nama} />

      <section className="border-t border-ink pt-5">
        <p className="label">
          Periode {ringkasan.periodeBerjalan?.nomor ?? ringkasan.selesai} dari{" "}
          {siklus.totalPeriode} &middot; pot penuh
        </p>
        <p className="angka angka-besar mt-3">{rupiah(ringkasan.pot)}</p>

        <div className="mt-5">
          <Kemajuan persen={persen} label="Kemajuan siklus arisan" />
        </div>

        <div className="mt-5">
          <Strip>
            <Ringkas label="Setoran per anggota">{rupiah(siklus.iuranPerPeriode)}</Ringkas>
            <Ringkas label="Periode selesai">
              {ringkasan.selesai} dari {siklus.totalPeriode}
            </Ringkas>
          </Strip>
        </div>

        <p className="mt-4 text-[0.9375rem] text-ink-2">
          {d.jumlahKandidat} anggota belum pernah menang di siklus ini.
        </p>

        {ringkasan.periodeBerjalan && (
          <TautanTombol
            to={`/arisan/periode/${ringkasan.periodeBerjalan.id}`}
            className="btn-blok mt-5 sm:inline-flex sm:w-auto"
          >
            Buka periode {ringkasan.periodeBerjalan.nomor}
          </TautanTombol>
        )}
      </section>

      <div className="mt-10">
        <Tabs
          label="Tampilan arisan"
          nilai={tab}
          pilihan={
            [
              ["periode", "Riwayat periode"],
              ["anggota", "Per anggota"],
            ] as const
          }
          onPilih={(nilai) => setParams({ tab: nilai }, { preventScrollReset: true })}
        />

        <div className="mt-6">
          {tab === "periode" ? (
            <Bagian judul={`${ringkasan.periods.length} periode tercatat`}>
              {ringkasan.periods.map((p) => (
                <Baris
                  key={p.id}
                  tanda={p.pemenangMemberId ? "lunas" : "malam"}
                  to={`/arisan/periode/${p.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold leading-snug">
                        Periode {p.nomor} &middot; {namaPeriode(p.periode)}
                      </p>
                      <p className="mt-0.5 text-[0.875rem] text-ink-2">
                        {p.pemenangMemberId
                          ? `Pemenang: ${namaPemenang.get(p.pemenangMemberId) ?? "-"}`
                          : "Belum dikocok"}
                      </p>
                    </div>
                    {p.pemenangMemberId ? (
                      <Uang nilai={p.pot} className="shrink-0 text-[0.9375rem]" />
                    ) : (
                      <Lencana nada="kuning">Berjalan</Lencana>
                    )}
                  </div>
                </Baris>
              ))}
            </Bagian>
          ) : (
            <Bagian judul={`${anggota.length} anggota`}>
              {anggota.map((a) => (
                <Baris
                  key={a.memberId}
                  tanda={a.menangPeriode ? "lunas" : a.sudahBayar ? "netral" : "tunggak"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[1rem] font-medium leading-snug">
                        <span className="angka text-ink-2">{a.kode}</span> {a.nama}
                        {a.milikSaya && (
                          <span className="ml-1.5 text-[0.8125rem] font-semibold text-ink-2">
                            (Anda)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[0.875rem] text-ink-2">
                        {a.sudahBayar ? "Sudah setor" : "Belum setor"} &middot;{" "}
                        {a.menangPeriode
                          ? `menang periode ${a.menangPeriode}`
                          : "belum menang"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <Lencana nada={a.sudahBayar ? "hijau" : "merah"}>
                        {a.sudahBayar ? "Setor" : "Belum"}
                      </Lencana>
                      {a.menangPeriode && <Lencana nada="kuning">Menang</Lencana>}
                    </div>
                  </div>
                </Baris>
              ))}
            </Bagian>
          )}
        </div>
      </div>

      <p className="mt-10 max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">
        Uang arisan adalah uang anggota, bukan kas RT.{" "}
        <Link to="/kas" className="tautan">
          Buku kas RT
        </Link>{" "}
        mencatat iuran sampah dan jimpitan saja.
      </p>
    </main>
  );
}
