import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/sampah.$id";
import { isPengurus, requireUser } from "~/domain/auth";
import * as sampah from "~/domain/sampah";
import { HARI_INI } from "~/lib/waktu";
import { namaPeriode, rupiah, tanggal } from "~/lib/format";
import { Galat, Header, Lencana, Tombol } from "~/ui/kit";

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

  return (
    <main>
      <Header
        eyebrow={`Iuran sampah ${namaPeriode(bill.periode)}`}
        judul={household.namaKk}
        kembali="/sampah"
      />

      <div
        className={`margin-rule ${lunas ? "rule-lunas" : "rule-tunggak"} border-b border-kertas-tua px-4 py-5 ${
          lunas ? "bg-pos-pucat/40" : "bg-garis-pucat/40"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="label-resmi">Nominal tagihan</p>
            <p
              data-testid="nominal-tagihan"
              className="angka mt-1 text-[30px] font-bold leading-none"
            >
              {rupiah(bill.jumlah)}
            </p>
          </div>
          <Lencana nada={lunas ? "hijau" : "merah"}>
            {lunas ? "Lunas" : "Belum bayar"}
          </Lencana>
        </div>
      </div>

      <dl className="border-b border-kertas-tua">
        {[
          ["Rumah tangga", `${household.kode} · ${household.namaKk}`],
          ["Alamat", household.alamat],
          ["Periode", namaPeriode(bill.periode)],
          ["Jatuh tempo", tanggal(bill.jatuhTempo)],
          ...(bill.dibayarPada ? [["Dibayar pada", tanggal(bill.dibayarPada)]] : []),
        ].map(([k, v]) => (
          <div key={k} className="baris flex justify-between gap-4 px-4 py-3">
            <dt className="text-[13px] text-pensil">{k}</dt>
            <dd className="text-right text-[14px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {actionData && "galat" in actionData && <Galat pesan={actionData.galat} />}

      {!lunas && bisaKonfirmasi && (
        <div className="px-5 py-6">
          <Form method="post">
            <Tombol type="submit" disabled={mengirim} className="w-full">
              {mengirim ? "Mencatat..." : "Konfirmasi pembayaran"}
            </Tombol>
          </Form>
          <p className="mt-3 text-[12px] leading-relaxed text-pensil">
            Prototipe: pembayaran dikonfirmasi manual oleh bendahara. Saat lunas,
            nominalnya otomatis masuk ke buku kas RT sebagai pemasukan.
          </p>
        </div>
      )}

      {!lunas && !bisaKonfirmasi && (
        <div className="px-5 py-6">
          <div className="kartu px-4 py-4">
            <p className="text-[14px] font-semibold">Cara membayar</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-pensil">
              Serahkan tunai kepada bendahara RT, lalu bendahara akan menandai
              tagihan ini lunas. Status di sini akan ikut berubah.
            </p>
          </div>
        </div>
      )}

      {lunas && (
        <div className="px-5 py-6">
          <p className="text-[13px] leading-relaxed text-pensil">
            Pembayaran ini sudah tercatat di buku kas RT.
          </p>
        </div>
      )}
    </main>
  );
}
