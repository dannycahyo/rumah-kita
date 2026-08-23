import { Link } from "react-router";
import type { Route } from "./+types/beranda";
import { requireUser, isPengurus, LABEL_ROLE } from "~/domain/auth";
import * as arisan from "~/domain/arisan";
import * as jimpitan from "~/domain/jimpitan";
import * as kas from "~/domain/kas";
import * as konsumsi from "~/domain/konsumsi";
import * as pengumumanSvc from "~/domain/pengumuman";
import * as ronda from "~/domain/ronda";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { Bagian, Baris, Lencana, TautanTombol, Uang } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const hariIni = HARI_INI;
  const seminggu = tambahHari(hariIni, 7);

  const [tunggakan, tugasRonda, giliranKonsumsi, statusArisan, terbaru, saldo, jimpitanBulanIni] =
    await Promise.all([
      sampah.arrears(user.householdId),
      ronda.dutyFor(user.householdId, hariIni, seminggu),
      konsumsi.turnFor(user.householdId, hariIni, seminggu),
      arisan.statusRumah(user.householdId),
      pengumumanSvc.terbaru(),
      isPengurus(user.role) ? kas.balance() : Promise.resolve(null),
      jimpitan.totalUntukRumah(user.householdId, `${hariIni.slice(0, 7)}-01`, hariIni),
    ]);

  return {
    user,
    hariIni,
    tunggakan: tunggakan.map((t) => ({
      id: t.bill.id,
      periode: t.bill.periode,
      jumlah: t.bill.jumlah,
    })),
    totalTunggakan: tunggakan.reduce((s, t) => s + t.bill.jumlah, 0),
    rondaMalamIni: tugasRonda.find((t) => t.night.tanggal === hariIni) ?? null,
    rondaBerikutnya: tugasRonda.find((t) => t.night.tanggal > hariIni) ?? null,
    konsumsiMalamIni: giliranKonsumsi.find((k) => k.tanggal === hariIni) ?? null,
    konsumsiBerikutnya: giliranKonsumsi.find((k) => k.tanggal > hariIni) ?? null,
    statusArisan,
    terbaru,
    saldo,
    jimpitanBulanIni,
  };
}

const MENU = [
  { to: "/kas", label: "Kas RT", ket: "Buku kas" },
  { to: "/sampah", label: "Iuran Sampah", ket: "Per bulan" },
  { to: "/jimpitan", label: "Jimpitan", ket: "Per malam" },
  { to: "/ronda", label: "Ronda", ket: "Jadwal malam" },
  { to: "/konsumsi", label: "Konsumsi", ket: "Giliran masak" },
  { to: "/arisan", label: "Arisan", ket: "Kocokan" },
];

function salam(): string {
  return "Selamat malam";
}

export default function Beranda({ loaderData }: Route.ComponentProps) {
  const d = loaderData;

  return (
    <main>
      <header className="bg-pos px-5 pb-6 pt-7 text-kertas">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-resmi text-pos-pucat/70">
              {tanggalLengkap(d.hariIni)}
            </p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight">
              {salam()}, {d.user.nama.split(" ")[0]}
            </h1>
            <p className="mt-1 text-[13px] text-pos-pucat">
              {d.user.householdKode} &middot; {LABEL_ROLE[d.user.role]}
            </p>
          </div>
          <Link
            to="/keluar"
            className="mt-1 shrink-0 border border-pos-muda px-2.5 py-1 text-[11px] font-semibold text-pos-pucat"
          >
            Keluar
          </Link>
        </div>

        {d.saldo !== null && (
          <div className="mt-5 border border-pos-muda bg-pos-muda/30 px-4 py-3">
            <p className="label-resmi text-pos-pucat/70">Saldo kas RT</p>
            <p className="angka mt-0.5 text-[24px] font-bold">{rupiah(d.saldo)}</p>
          </div>
        )}
      </header>

      {/* Tunggakan - paling atas kalau ada, dengan CTA bayar. */}
      {d.totalTunggakan > 0 && (
        <section className="margin-rule rule-tunggak border-b border-kertas-tua bg-garis-pucat/50 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-resmi text-garis">Tagihan belum dibayar</p>
              <p className="angka mt-1 text-[22px] font-bold text-garis">
                {rupiah(d.totalTunggakan)}
              </p>
              <p className="mt-1 text-[13px] text-tinta/70">
                {d.tunggakan.length} bulan &middot; sejak{" "}
                {namaPeriode(d.tunggakan[0].periode)}
              </p>
            </div>
            <TautanTombol to={`/sampah/${d.tunggakan[0].id}`} className="shrink-0">
              Bayar
            </TautanTombol>
          </div>
        </section>
      )}

      {/* Tugas malam ini - menjawab "saya ronda malam ini?" tanpa navigasi. */}
      {d.rondaMalamIni && (
        <section className="margin-rule rule-malam border-b border-kertas-tua bg-lampu-pucat/60 px-4 py-4">
          <p className="label-resmi text-[#8a6a00]">Ronda malam ini</p>
          <p className="mt-1 text-[17px] font-semibold">
            {d.rondaMalamIni.regu.nama} &middot; {d.rondaMalamIni.regu.pos}
          </p>
          <p className="mt-0.5 text-[13px] text-tinta/70">
            Mulai pukul 22.00 WIB
          </p>
          <Link
            to={`/ronda/${d.rondaMalamIni.night.tanggal}`}
            className="mt-2 inline-block text-[13px] font-semibold text-pos underline underline-offset-2"
          >
            Lihat anggota regu
          </Link>
        </section>
      )}

      {d.konsumsiMalamIni && (
        <section className="margin-rule rule-malam border-b border-kertas-tua bg-lampu-pucat/60 px-4 py-4">
          <p className="label-resmi text-[#8a6a00]">Giliran konsumsi malam ini</p>
          <p className="mt-1 text-[17px] font-semibold">
            Rumah Anda menyiapkan konsumsi pos
          </p>
          <p className="mt-0.5 text-[13px] text-tinta/70">
            Antar ke pos sebelum pukul 22.00 WIB
          </p>
        </section>
      )}

      {/* Kalau tidak ada tugas malam ini, tampilkan yang terdekat. */}
      {!d.rondaMalamIni && d.rondaBerikutnya && (
        <Baris tanda="netral">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-resmi">Ronda berikutnya</p>
              <p className="mt-0.5 text-[15px] font-semibold">
                {tanggal(d.rondaBerikutnya.night.tanggal)}
              </p>
            </div>
            <span className="text-[13px] text-pensil">
              {d.rondaBerikutnya.regu.nama}
            </span>
          </div>
        </Baris>
      )}

      {!d.konsumsiMalamIni && d.konsumsiBerikutnya && (
        <Baris tanda="netral">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-resmi">Giliran konsumsi</p>
              <p className="mt-0.5 text-[15px] font-semibold">
                {tanggal(d.konsumsiBerikutnya.tanggal)}
              </p>
            </div>
            <Lencana>Menunggu</Lencana>
          </div>
        </Baris>
      )}

      {/* Arisan */}
      {d.statusArisan && (
        <Bagian judul="Arisan">
          <Baris tanda={d.statusArisan.sudahBayar ? "lunas" : "tunggak"} to="/arisan">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">
                  Periode {d.statusArisan.nomorPeriode} dari{" "}
                  {d.statusArisan.cycle.totalPeriode}
                </p>
                <p className="mt-0.5 text-[13px] text-pensil">
                  {d.statusArisan.sudahBayar ? "Setoran sudah masuk" : "Setoran belum masuk"}
                  {" · "}
                  {d.statusArisan.menangPeriode
                    ? `Menang periode ${d.statusArisan.menangPeriode}`
                    : "Belum pernah menang"}
                </p>
              </div>
              <Uang nilai={d.statusArisan.cycle.iuranPerPeriode} className="text-[13px]" />
            </div>
          </Baris>
        </Bagian>
      )}

      {/* Jimpitan rumah ini bulan berjalan */}
      <Bagian judul={`Jimpitan ${namaPeriode(d.hariIni)}`}>
        <Baris tanda="netral" to="/jimpitan">
          <div className="flex items-center justify-between">
            <p className="text-[15px]">Terkumpul dari rumah Anda</p>
            <Uang nilai={d.jimpitanBulanIni} className="font-semibold" />
          </div>
        </Baris>
      </Bagian>

      {/* Pengumuman terbaru */}
      {d.terbaru && (
        <Bagian
          judul="Pengumuman terbaru"
          kanan={
            <Link to="/pengumuman" className="text-[12px] font-semibold text-pos">
              Semua
            </Link>
          }
        >
          <Baris tanda="netral" to={`/pengumuman/${d.terbaru.post.id}`}>
            <Lencana
              nada={
                d.terbaru.post.kategori === "berita"
                  ? "hijau"
                  : d.terbaru.post.kategori === "info"
                    ? "kuning"
                    : "netral"
              }
            >
              {pengumumanSvc.LABEL_KATEGORI[d.terbaru.post.kategori]}
            </Lencana>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug">
              {d.terbaru.post.judul}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-pensil">
              {d.terbaru.post.isi}
            </p>
          </Baris>
        </Bagian>
      )}

      {/* Menu */}
      <Bagian judul="Menu">
        <div className="grid grid-cols-2 gap-px bg-kertas-tua">
          {MENU.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="bg-[#fffdf8] px-4 py-5 active:bg-kertas-tua/60"
            >
              <p className="text-[15px] font-semibold">{m.label}</p>
              <p className="mt-0.5 text-[12px] text-pensil">{m.ket}</p>
            </Link>
          ))}
        </div>
      </Bagian>
    </main>
  );
}
