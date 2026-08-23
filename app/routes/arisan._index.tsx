import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/arisan._index";
import { requireUser } from "~/domain/auth";
import * as arisan from "~/domain/arisan";
import { namaPeriode, rupiah } from "~/lib/format";
import { Bagian, Baris, Kosong, Lencana, TautanTombol, Uang } from "~/ui/kit";

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
      <main>
        <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
          <h1 className="text-[26px] font-bold">Arisan</h1>
        </header>
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
    <main>
      <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
        <p className="label-resmi text-pos-pucat/70">{siklus.nama}</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">
          Periode {ringkasan.periodeBerjalan?.nomor ?? ringkasan.selesai} dari{" "}
          {siklus.totalPeriode}
        </h1>

        <div className="mt-3 flex h-1.5 overflow-hidden bg-pos-muda">
          <div className="bg-lampu" style={{ width: `${persen}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px border border-pos-muda bg-pos-muda">
          <div className="bg-pos px-3 py-3">
            <p className="label-resmi text-pos-pucat/70">Setoran</p>
            <p className="angka mt-0.5 text-[17px] font-bold">
              {rupiah(siklus.iuranPerPeriode)}
            </p>
          </div>
          <div className="bg-pos px-3 py-3">
            <p className="label-resmi text-pos-pucat/70">Pot penuh</p>
            <p className="angka mt-0.5 text-[17px] font-bold">{rupiah(ringkasan.pot)}</p>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-pos-pucat/80">
          {d.jumlahKandidat} anggota belum pernah menang di siklus ini.
        </p>

        {ringkasan.periodeBerjalan && (
          <TautanTombol
            to={`/arisan/periode/${ringkasan.periodeBerjalan.id}`}
            variasi="kedua"
            className="mt-4 block w-full bg-kertas text-pos"
          >
            Buka periode {ringkasan.periodeBerjalan.nomor}
          </TautanTombol>
        )}
      </header>

      <div className="grid grid-cols-2 gap-px border-b border-kertas-tua bg-kertas-tua">
        {(
          [
            ["periode", "Riwayat periode"],
            ["anggota", "Per anggota"],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => setParams({ tab: nilai }, { preventScrollReset: true })}
            className={`py-3 text-[13px] font-semibold ${
              tab === nilai ? "bg-[#fffdf8] text-pos" : "bg-kertas text-pensil"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "periode" ? (
        <Bagian judul={`${ringkasan.periods.length} periode tercatat`}>
          {ringkasan.periods.map((p) => (
            <Baris
              key={p.id}
              tanda={p.pemenangMemberId ? "lunas" : "malam"}
              to={`/arisan/periode/${p.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    Periode {p.nomor} &middot; {namaPeriode(p.periode)}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-pensil">
                    {p.pemenangMemberId
                      ? `Pemenang: ${namaPemenang.get(p.pemenangMemberId) ?? "-"}`
                      : "Belum dikocok"}
                  </p>
                </div>
                {p.pemenangMemberId ? (
                  <Uang nilai={p.pot} className="shrink-0 text-[14px] font-semibold" />
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
                  <p className="mt-0.5 text-[12px] text-pensil">
                    {a.sudahBayar ? "Sudah setor" : "Belum setor"} &middot;{" "}
                    {a.menangPeriode
                      ? `menang periode ${a.menangPeriode}`
                      : "belum menang"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
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

      <p className="px-5 py-6 text-center text-[12px] leading-relaxed text-pensil">
        Uang arisan adalah uang anggota, bukan kas RT.
        <br />
        <Link to="/kas" className="underline underline-offset-2">
          Buku kas RT
        </Link>{" "}
        mencatat iuran sampah dan jimpitan saja.
      </p>
    </main>
  );
}
