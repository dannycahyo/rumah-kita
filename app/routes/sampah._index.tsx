import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/sampah._index";
import { isPengurus, isKetua, requireUser } from "~/domain/auth";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { awalBulan, namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Bagian, Baris, Galat, Header, Kosong, Lencana, Sukses, Tombol, Uang } from "~/ui/kit";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const periode = url.searchParams.get("periode") ?? awalBulan(HARI_INI);

  // Loader bercabang menurut peran - bukan komponennya.
  if (!isPengurus(user.role)) {
    const [tagihan, tunggakan] = await Promise.all([
      sampah.forHousehold(user.householdId),
      sampah.arrears(user.householdId),
    ]);
    return {
      peran: "warga" as const,
      user,
      tagihan,
      totalTunggakan: tunggakan.reduce((s, t) => s + t.bill.jumlah, 0),
    };
  }

  const [daftar, periodeTersedia] = await Promise.all([
    sampah.roster(periode),
    sampah.periodeTersedia(),
  ]);
  return {
    peran: "pengurus" as const,
    user,
    periode,
    daftar,
    periodeTersedia,
    bisaTerbit: isKetua(user.role),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!isKetua(user.role)) {
    throw new Response("Hanya ketua atau sekretaris yang bisa menerbitkan tagihan.", {
      status: 403,
    });
  }
  const form = await request.formData();
  const periode = String(form.get("periode") ?? awalBulan(HARI_INI));

  try {
    const hasil = await sampah.generateBills(periode, user.id);
    return {
      sukses: `${hasil.dibuat} tagihan diterbitkan untuk ${namaPeriode(hasil.periode)}${
        hasil.dilewati ? `, ${hasil.dilewati} sudah ada sebelumnya` : ""
      }.`,
    };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal menerbitkan tagihan." };
  }
}

export default function SampahIndex({ loaderData, actionData }: Route.ComponentProps) {
  const [, setParams] = useSearchParams();

  if (loaderData.peran === "warga") {
    const { tagihan, totalTunggakan } = loaderData;
    return (
      <main>
        <Header eyebrow="Iuran sampah" judul="Tagihan saya" kembali="/" />
        {totalTunggakan > 0 && (
          <div className="margin-rule rule-tunggak border-b border-kertas-tua bg-garis-pucat/50 px-4 py-4">
            <p className="label-resmi text-garis">Total tunggakan</p>
            <p className="angka mt-1 text-[24px] font-bold text-garis">
              {rupiah(totalTunggakan)}
            </p>
          </div>
        )}
        <Bagian judul="Riwayat tagihan">
          {tagihan.length === 0 ? (
            <Kosong pesan="Belum ada tagihan untuk rumah Anda." />
          ) : (
            tagihan.map((t) => (
              <Baris
                key={t.id}
                tanda={t.status === "lunas" ? "lunas" : "tunggak"}
                to={`/sampah/${t.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold">{namaPeriode(t.periode)}</p>
                    <p className="mt-0.5 text-[12px] text-pensil">
                      {t.status === "lunas" && t.dibayarPada
                        ? `Dibayar ${tanggal(t.dibayarPada)}`
                        : `Jatuh tempo ${tanggal(t.jatuhTempo)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Uang nilai={t.jumlah} className="text-[15px] font-semibold" />
                    <p className="mt-1">
                      <Lencana nada={t.status === "lunas" ? "hijau" : "merah"}>
                        {t.status === "lunas" ? "Lunas" : "Belum bayar"}
                      </Lencana>
                    </p>
                  </div>
                </div>
              </Baris>
            ))
          )}
        </Bagian>
      </main>
    );
  }

  const { periode, daftar, periodeTersedia, bisaTerbit } = loaderData;
  const r = daftar.ringkasan;
  const total = daftar.rows.length;
  const persen = total ? Math.round((r.lunas / total) * 100) : 0;

  return (
    <main>
      <Header
        eyebrow="Iuran sampah"
        judul={namaPeriode(periode)}
        kembali="/"
        aksi={
          <select
            value={periode}
            onChange={(e) => setParams({ periode: e.target.value })}
            className="shrink-0 border border-pos-muda bg-pos px-2 py-1.5 text-[12px] text-kertas"
          >
            {(periodeTersedia.includes(periode)
              ? periodeTersedia
              : [periode, ...periodeTersedia]
            ).map((p) => (
              <option key={p} value={p}>
                {namaPeriode(p)}
              </option>
            ))}
          </select>
        }
      />

      <Sukses pesan={actionData && "sukses" in actionData ? actionData.sukses : null} />
      <Galat pesan={actionData && "galat" in actionData ? actionData.galat : null} />

      {/* Rekap lunas / belum */}
      <div className="border-b border-kertas-tua px-4 py-4">
        <div className="flex items-baseline justify-between">
          <p className="label-resmi">Terkumpul</p>
          <Uang nilai={r.terkumpul} className="text-[17px] font-bold" />
        </div>
        <div className="mt-2 flex h-2 overflow-hidden bg-kertas-tua">
          <div className="bg-pos-muda" style={{ width: `${persen}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-pensil">
          {r.lunas} lunas &middot; {r.belum} belum bayar
          {r.belumTerbit > 0 && ` · ${r.belumTerbit} belum terbit`}
        </p>

        {bisaTerbit && r.belumTerbit > 0 && (
          <Form method="post" className="mt-3">
            <input type="hidden" name="periode" value={periode} />
            <Tombol type="submit" className="w-full">
              Terbitkan tagihan {namaPeriode(periode)}
            </Tombol>
          </Form>
        )}
      </div>

      <Bagian judul={`${total} rumah tangga`}>
        {daftar.rows.map(({ household, bill }) => (
          <Baris
            key={household.id}
            tanda={!bill ? "netral" : bill.status === "lunas" ? "lunas" : "tunggak"}
            to={bill ? `/sampah/${bill.id}` : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  <span className="angka text-pensil">{household.kode}</span>{" "}
                  {household.namaKk}
                </p>
                <p className="mt-0.5 text-[12px] text-pensil">{household.alamat}</p>
              </div>
              {bill ? (
                <Lencana nada={bill.status === "lunas" ? "hijau" : "merah"}>
                  {bill.status === "lunas" ? "Lunas" : "Belum"}
                </Lencana>
              ) : (
                <Lencana>Belum terbit</Lencana>
              )}
            </div>
          </Baris>
        ))}
      </Bagian>
    </main>
  );
}
