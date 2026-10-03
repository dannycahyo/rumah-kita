import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/sampah._index";
import { requireUser } from "~/domain/auth";
import { isPengurus, isKetua } from "~/lib/peran";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { awalBulan, namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Ikon } from "~/ui/ikon";
import {
  Bagian,
  Baris,
  Galat,
  Header,
  Kemajuan,
  Kosong,
  Lencana,
  Ringkas,
  Strip,
  Sukses,
  Tombol,
  Uang,
} from "~/ui/kit";

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

type BarisTagihan = {
  id: number;
  periode: string;
  jumlah: number;
  status: string;
  jatuhTempo: string;
  dibayarPada: string | null;
};

function TagihanWarga({ t }: { t: BarisTagihan }) {
  const lunas = t.status === "lunas";
  return (
    <Baris to={`/sampah/${t.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-semibold">{namaPeriode(t.periode)}</p>
          <p className="label mt-0.5">
            {lunas && t.dibayarPada
              ? `Dibayar ${tanggal(t.dibayarPada)}`
              : `Jatuh tempo ${tanggal(t.jatuhTempo)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Uang nilai={t.jumlah} className="text-[1rem]" />
          <Lencana nada={lunas ? "hijau" : "merah"}>{lunas ? "Lunas" : "Belum"}</Lencana>
        </div>
      </div>
    </Baris>
  );
}

export default function SampahIndex({ loaderData, actionData }: Route.ComponentProps) {
  const [, setParams] = useSearchParams();

  if (loaderData.peran === "warga") {
    const { tagihan, totalTunggakan } = loaderData;
    const belumBayar = tagihan.filter((t) => t.status !== "lunas");
    const sudahLunas = tagihan.filter((t) => t.status === "lunas");
    return (
      <main className="halaman">
        <Header judul="Tagihan saya" kembali="/" />

        {totalTunggakan > 0 ? (
          <section className="border-t border-ink pt-5">
            <p className="label">Total tunggakan</p>
            <p className="angka angka-besar mt-3 text-accent">{rupiah(totalTunggakan)}</p>
            <p className="mt-3 text-[0.9375rem] text-ink-2">{belumBayar.length} bulan belum dibayar</p>
          </section>
        ) : (
          <section className="border-t border-ink pt-5">
            <p className="label">Iuran sampah</p>
            <p className="mt-2 flex items-center gap-2 font-display text-[1.5rem] font-semibold leading-tight">
              <Ikon nama="centang" ukuran={24} className="text-ok" />
              Tidak ada tagihan tertunggak
            </p>
          </section>
        )}

        <div className="mt-10">
          {tagihan.length === 0 ? (
            <Kosong pesan="Belum ada tagihan untuk rumah Anda." />
          ) : (
            <>
              {belumBayar.length > 0 && (
                <Bagian judul="Belum dibayar">
                  {belumBayar.map((t) => (
                    <TagihanWarga key={t.id} t={t} />
                  ))}
                </Bagian>
              )}
              {sudahLunas.length > 0 && (
                <Bagian judul="Sudah lunas">
                  {sudahLunas.map((t) => (
                    <TagihanWarga key={t.id} t={t} />
                  ))}
                </Bagian>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  const { periode, daftar, periodeTersedia, bisaTerbit } = loaderData;
  const r = daftar.ringkasan;
  const total = daftar.rows.length;
  const persen = total ? Math.round((r.lunas / total) * 100) : 0;

  const belumBayar = daftar.rows.filter(({ bill }) => bill && bill.status !== "lunas");
  const sudahLunas = daftar.rows.filter(({ bill }) => bill && bill.status === "lunas");
  const belumTerbit = daftar.rows.filter(({ bill }) => !bill);

  return (
    <main className="halaman">
      <Header
        judul="Iuran sampah"
        kembali="/"
        aksi={
          <select
            aria-label="Periode"
            value={periode}
            onChange={(e) => setParams({ periode: e.target.value })}
            className="input min-h-11 w-auto text-[0.9375rem]"
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

      <section className="border-t border-ink pt-5">
        <p className="label">Terkumpul {namaPeriode(periode)}</p>
        <p className="angka angka-besar mt-3">{rupiah(r.terkumpul)}</p>
        <div className="mt-4">
          <Kemajuan persen={persen} label="Tagihan lunas" />
        </div>
        <div className="mt-4">
          <Strip>
            <Ringkas label="Lunas" tone="hijau">
              {r.lunas}
            </Ringkas>
            <Ringkas label="Belum bayar" tone={r.belum > 0 ? "merah" : undefined}>
              {r.belum}
            </Ringkas>
            <Ringkas label="Belum terbit">{r.belumTerbit}</Ringkas>
          </Strip>
        </div>

        {bisaTerbit && r.belumTerbit > 0 && (
          <Form method="post" className="mt-5">
            <input type="hidden" name="periode" value={periode} />
            <Tombol type="submit" className="btn-blok sm:w-auto">
              Terbitkan tagihan {namaPeriode(periode)}
            </Tombol>
          </Form>
        )}
      </section>

      <div className="mt-10">
        {belumBayar.length > 0 && (
          <Bagian judul={`Belum dibayar (${belumBayar.length})`}>
            {belumBayar.map(({ household, bill }) => (
              <Baris key={household.id} to={`/sampah/${bill!.id}`}>
                <RumahTangga household={household}>
                  <Lencana nada="merah">Belum</Lencana>
                </RumahTangga>
              </Baris>
            ))}
          </Bagian>
        )}
        {sudahLunas.length > 0 && (
          <Bagian judul={`Sudah lunas (${sudahLunas.length})`}>
            {sudahLunas.map(({ household, bill }) => (
              <Baris key={household.id} to={`/sampah/${bill!.id}`}>
                <RumahTangga household={household}>
                  <Lencana nada="hijau">Lunas</Lencana>
                </RumahTangga>
              </Baris>
            ))}
          </Bagian>
        )}
        {belumTerbit.length > 0 && (
          <Bagian judul={`Belum ada tagihan (${belumTerbit.length})`}>
            {belumTerbit.map(({ household }) => (
              <Baris key={household.id}>
                <RumahTangga household={household}>
                  <Lencana>Belum terbit</Lencana>
                </RumahTangga>
              </Baris>
            ))}
          </Bagian>
        )}
        {total === 0 && <Kosong pesan="Belum ada rumah tangga terdaftar." />}
      </div>
    </main>
  );
}

function RumahTangga({
  household,
  children,
}: {
  household: { kode: string; namaKk: string; alamat: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[1rem] font-medium">
          <span className="angka text-ink-2">{household.kode}</span> {household.namaKk}
        </p>
        <p className="label mt-0.5 truncate">{household.alamat}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
