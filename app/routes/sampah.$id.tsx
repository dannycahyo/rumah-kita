import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/sampah.$id";
import { requireUser } from "~/domain/auth";
import { isPengurus } from "~/lib/peran";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Cap, Galat, Header, Info, Lencana, Tombol } from "~/ui/kit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const row = await sampah.byId(Number(params.id));
  if (!row) throw new Response("Tagihan tidak ditemukan.", { status: 404 });

  // Warga hanya boleh melihat tagihan rumahnya sendiri.
  if (!isPengurus(user.role) && row.household.id !== user.householdId) {
    throw new Response("Anda hanya bisa melihat tagihan rumah sendiri.", { status: 403 });
  }

  return { user, ...row, bisaKonfirmasi: isPengurus(user.role) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  if (!isPengurus(user.role)) {
    throw new Response("Hanya bendahara yang bisa mengonfirmasi pembayaran.", {
      status: 403,
    });
  }

  try {
    // SEAM PEMBAYARAN: callback payment gateway sungguhan akan mendarat di sini
    // menggantikan tombol konfirmasi manual.
    await sampah.markPaid(Number(params.id), user.id, HARI_INI);
    return { sukses: true };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Gagal mencatat pembayaran." };
  }
}

export default function SampahDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { bill, household, bisaKonfirmasi } = loaderData;
  const nav = useNavigation();
  const mengirim = nav.state === "submitting";
  const lunas = bill.status === "lunas";

  const rincian: [string, string][] = [
    ["Rumah tangga", `${household.kode} · ${household.namaKk}`],
    ["Alamat", household.alamat],
    ["Periode", namaPeriode(bill.periode)],
    ["Jatuh tempo", tanggal(bill.jatuhTempo)],
    ...(bill.dibayarPada ? ([["Dibayar pada", tanggal(bill.dibayarPada)]] as [string, string][]) : []),
  ];

  return (
    <main className="halaman">
      <Header
        eyebrow={`Iuran sampah ${namaPeriode(bill.periode)}`}
        judul={household.namaKk}
        kembali="/sampah"
      />

      <section className="border-t border-ink pt-5">
        <div className="flex items-start justify-between gap-4">
          <p className="label">Nominal tagihan</p>
          {lunas ? <Cap>Lunas</Cap> : <Lencana nada="merah">Belum bayar</Lencana>}
        </div>
        <p
          data-testid="nominal-tagihan"
          className={`angka angka-besar mt-3 ${lunas ? "text-ok" : ""}`}
        >
          {rupiah(bill.jumlah)}
        </p>
      </section>

      <dl className="daftar mt-8">
        {rincian.map(([k, v]) => (
          <div key={k} className="baris flex justify-between gap-6 py-3.5">
            <dt className="text-[0.875rem] text-ink-2">{k}</dt>
            <dd className="text-right text-[1rem] font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        {actionData && "galat" in actionData && <Galat pesan={actionData.galat} />}

        {!lunas && bisaKonfirmasi && (
          <>
            <Form method="post">
              <Tombol type="submit" disabled={mengirim} className="btn-blok sm:w-auto">
                {mengirim ? "Mencatat..." : "Konfirmasi pembayaran"}
              </Tombol>
            </Form>
            <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">
              Prototipe: pembayaran dikonfirmasi manual oleh bendahara. Saat lunas,
              nominalnya otomatis masuk ke buku kas RT sebagai pemasukan.
            </p>
          </>
        )}

        {!lunas && !bisaKonfirmasi && (
          <Info>
            <p className="font-semibold">Cara membayar</p>
            <p className="mt-1 text-[0.875rem] leading-relaxed">
              Serahkan tunai kepada bendahara RT, lalu bendahara akan menandai
              tagihan ini lunas. Status di sini akan ikut berubah.
            </p>
          </Info>
        )}

        {lunas && (
          <p className="max-w-[52ch] text-[0.875rem] leading-relaxed text-ink-2">
            Pembayaran ini sudah tercatat di buku kas RT.
          </p>
        )}
      </div>
    </main>
  );
}
