import { Link } from "react-router";
import type { Route } from "./+types/beranda";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
import * as arisan from "~/domain/arisan";
import * as jimpitan from "~/domain/jimpitan";
import * as kas from "~/domain/kas";
import * as konsumsi from "~/domain/konsumsi";
import * as pengumumanSvc from "~/domain/pengumuman";
import * as ronda from "~/domain/ronda";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tambahHari, tanggal, tanggalLengkap } from "~/lib/format";
import { LABEL_KATEGORI } from "~/lib/kategori";
import { Ikon, type NamaIkon } from "~/ui/ikon";
import { LABEL_PERAN } from "~/ui/RoleSwitcher";
import { Bagian, Baris, Kosong, Lencana, TautanTombol, Uang } from "~/ui/kit";

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

const LAYANAN: { to: string; label: string; ket: string; ikon: NamaIkon }[] = [
  { to: "/kas", label: "Kas RT", ket: "Buku kas dan saldo", ikon: "kas" },
  { to: "/sampah", label: "Iuran sampah", ket: "Tagihan per bulan", ikon: "sampah" },
  { to: "/jimpitan", label: "Jimpitan", ket: "Catatan per malam", ikon: "jimpitan" },
  { to: "/ronda", label: "Ronda", ket: "Jadwal malam", ikon: "ronda" },
  { to: "/konsumsi", label: "Konsumsi", ket: "Giliran menyiapkan", ikon: "konsumsi" },
  { to: "/arisan", label: "Arisan", ket: "Setoran dan kocokan", ikon: "arisan" },
];

/** Indeks urutan masuk: satu entrance berurutan di Beranda, tidak di tempat lain. */
const urut = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function Beranda({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const rondaTampil = d.rondaMalamIni ?? d.rondaBerikutnya;
  const konsumsiTampil = d.konsumsiMalamIni ? { tanggal: d.hariIni } : d.konsumsiBerikutnya;
  const adaTugasMalam = Boolean(d.rondaMalamIni || d.konsumsiMalamIni);

  return (
    <main className="halaman halaman-lebar">
      <header className="reveal" style={urut(0)}>
        <p className="label">{tanggalLengkap(d.hariIni)}</p>
        <h1 className="mt-1 text-[2.25rem] lg:text-[3rem]">
          Halo, {d.user.nama.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-2">
          {d.user.householdKode} &middot; {LABEL_PERAN[d.user.role]}
        </p>
      </header>

      <div className="mt-10 grid gap-y-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-x-16">
        <div className="flex min-w-0 flex-col gap-10">
          {/* Tunggakan: angka terbesar di halaman, dengan satu CTA bayar. */}
          {d.totalTunggakan > 0 ? (
            <section className="reveal border-t border-ink pt-5" style={urut(1)}>
              <p className="label">Tagihan belum dibayar</p>
              <p className="angka angka-besar mt-3 text-accent">
                {rupiah(d.totalTunggakan)}
              </p>
              <p className="mt-3 text-[0.9375rem] text-ink-2">
                {d.tunggakan.length} bulan &middot; sejak{" "}
                {namaPeriode(d.tunggakan[0].periode)}
              </p>
              <TautanTombol to={`/sampah/${d.tunggakan[0].id}`} className="mt-5">
                Bayar
              </TautanTombol>
            </section>
          ) : (
            <div className="reveal border-t border-ink pt-5" style={urut(1)}>
              <p className="label">Iuran sampah</p>
              <p className="mt-2 flex items-center gap-2 font-display text-[1.5rem] font-semibold leading-tight">
                <Ikon nama="centang" ukuran={24} className="text-ok" />
                Tidak ada tagihan tertunggak
              </p>
            </div>
          )}

          {/* Tugas malam ini menjawab "saya ronda malam ini?" tanpa navigasi. */}
          <div className="reveal" style={urut(2)}>
            <Bagian judul={adaTugasMalam ? "Tugas malam ini" : "Giliran berikutnya"}>
              {!rondaTampil && !konsumsiTampil && (
                <Kosong pesan="Belum ada giliran dalam seminggu ke depan." />
              )}

              {rondaTampil && (
                <Baris tanda={d.rondaMalamIni ? "malam" : "netral"}>
                  <p className="label">
                    {d.rondaMalamIni
                      ? "Ronda malam ini"
                      : `Ronda ${tanggal(rondaTampil.night.tanggal)}`}
                  </p>
                  <p className="mt-0.5 text-[1.0625rem] font-semibold leading-snug">
                    {rondaTampil.regu.nama} &middot; {rondaTampil.regu.pos}
                  </p>
                  {d.rondaMalamIni && (
                    <p className="mt-0.5 text-[0.875rem] text-ink-2">
                      Mulai pukul 22.00 WIB
                    </p>
                  )}
                  {d.rondaMalamIni && (
                    <Link
                      to={`/ronda/${d.rondaMalamIni.night.tanggal}`}
                      className="tautan mt-2 inline-block text-[0.9375rem]"
                    >
                      Lihat anggota regu
                    </Link>
                  )}
                </Baris>
              )}

              {konsumsiTampil && (
                <Baris tanda={d.konsumsiMalamIni ? "malam" : "netral"}>
                  <p className="label">
                    {d.konsumsiMalamIni
                      ? "Giliran konsumsi malam ini"
                      : `Giliran konsumsi ${tanggal(konsumsiTampil.tanggal)}`}
                  </p>
                  {d.konsumsiMalamIni ? (
                    <>
                      <p className="mt-0.5 text-[1.0625rem] font-semibold leading-snug">
                        Rumah Anda menyiapkan konsumsi pos
                      </p>
                      <p className="mt-0.5 text-[0.875rem] text-ink-2">
                        Antar ke pos sebelum pukul 22.00 WIB
                      </p>
                    </>
                  ) : (
                    <p className="mt-1">
                      <Lencana>Menunggu</Lencana>
                    </p>
                  )}
                </Baris>
              )}
            </Bagian>
          </div>

          {/* Indeks layanan: satu-satunya jalan ke Sampah, Jimpitan, Konsumsi di ponsel. */}
          <div className="reveal lg:hidden" style={urut(3)}>
            <Bagian judul="Semua layanan">
              {LAYANAN.map((m) => (
                <Baris key={m.to} to={m.to}>
                  <div className="flex items-center gap-3">
                    <Ikon nama={m.ikon} ukuran={20} className="text-ink-2" />
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold leading-tight">{m.label}</p>
                      <p className="label mt-0.5">{m.ket}</p>
                    </div>
                  </div>
                </Baris>
              ))}
            </Bagian>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          {d.saldo !== null && (
            <Link
              to="/kas"
              className="reveal block border-t border-ink pt-5"
              style={urut(3)}
            >
              <p className="label">Saldo kas RT</p>
              <p className="angka angka-besar mt-3">{rupiah(d.saldo)}</p>
              <p className="tautan mt-3 inline-block text-[0.9375rem]">Buka buku kas</p>
            </Link>
          )}

          {d.statusArisan && (
            <div className="reveal" style={urut(4)}>
              <Bagian judul="Arisan">
                <Baris tanda={d.statusArisan.sudahBayar ? "lunas" : "tunggak"} to="/arisan">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold leading-snug">
                        Periode {d.statusArisan.nomorPeriode} dari{" "}
                        {d.statusArisan.cycle.totalPeriode}
                      </p>
                      <p className="mt-0.5 text-[0.875rem] text-ink-2">
                        {d.statusArisan.sudahBayar ? "Setoran sudah masuk" : "Setoran belum masuk"}
                        {" · "}
                        {d.statusArisan.menangPeriode
                          ? `Menang periode ${d.statusArisan.menangPeriode}`
                          : "Belum pernah menang"}
                      </p>
                    </div>
                    <Uang
                      nilai={d.statusArisan.cycle.iuranPerPeriode}
                      className="shrink-0 text-[0.9375rem]"
                    />
                  </div>
                </Baris>
              </Bagian>
            </div>
          )}

          <div className="reveal" style={urut(4)}>
            <Bagian judul={`Jimpitan ${namaPeriode(d.hariIni)}`}>
              <Baris to="/jimpitan">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[1rem]">Terkumpul dari rumah Anda</p>
                  <Uang nilai={d.jimpitanBulanIni} className="shrink-0" />
                </div>
              </Baris>
            </Bagian>
          </div>

          {d.terbaru && (
            <div className="reveal" style={urut(4)}>
              <Bagian
                judul="Pengumuman terbaru"
                kanan={
                  <Link to="/pengumuman" className="tautan">
                    Semua
                  </Link>
                }
              >
                <Baris to={`/pengumuman/${d.terbaru.post.id}`}>
                  <Lencana
                    nada={
                      d.terbaru.post.kategori === "berita"
                        ? "hijau"
                        : d.terbaru.post.kategori === "info"
                          ? "kuning"
                          : "netral"
                    }
                  >
                    {LABEL_KATEGORI[d.terbaru.post.kategori]}
                  </Lencana>
                  <p className="mt-2 font-display text-[1.25rem] font-semibold leading-snug">
                    {d.terbaru.post.judul}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink-2">
                    {d.terbaru.post.isi}
                  </p>
                </Baris>
              </Bagian>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
