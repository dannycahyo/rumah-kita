import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test prototipe RT.
 *
 * Menjalankan empat perjalanan peran pada viewport ponsel terhadap data seed.
 * Jalankan `npm run db:seed` sebelum tes ini supaya keadaan awal pasti.
 */

const AKUN = {
  budi: 'budi@rt04.id',
  sri: 'sri@rt04.id',
  agus: 'agus@rt04.id'
} as const;

async function masuk(page: Page, email: string) {
  await page.goto('/masuk');
  await page.getByRole('button', { name: new RegExp(email) }).click();
  await page.waitForURL('/');
}

/** Ambil angka rupiah pertama yang cocok dari sebuah teks. */
function keAngka(teks: string): number {
  const m = teks.match(/Rp\s?([\d.]+)/);
  if (!m) throw new Error(`Tidak ada nominal rupiah di: ${teks}`);
  return Number(m[1].replace(/\./g, ''));
}

test.describe('Warga (Budi)', () => {
  test('melihat tunggakan dan hanya tagihan rumahnya sendiri', async ({
    page
  }) => {
    await masuk(page, AKUN.budi);

    // Beranda menampilkan tunggakan dengan CTA bayar.
    const tunggakan = page.locator('section', {
      hasText: 'Tagihan belum dibayar'
    });
    await expect(tunggakan).toBeVisible();
    await expect(tunggakan.getByRole('link', { name: 'Bayar' })).toBeVisible();

    // Budi menunggak 3 bulan x Rp 60.000.
    const nominal = keAngka(
      (await tunggakan.locator('.angka').first().textContent()) ?? ''
    );
    expect(nominal).toBe(180_000);

    // Daftar sampah hanya berisi tagihan rumahnya.
    await page.goto('/sampah');
    await expect(
      page.getByRole('heading', { name: 'Tagihan saya' })
    ).toBeVisible();
    const baris = page.locator("a[href^='/sampah/']");
    expect(await baris.count()).toBeGreaterThan(0);
    expect(await baris.count()).toBeLessThanOrEqual(6); // bukan seluruh 52 KK
  });

  test('ditolak di halaman khusus pengurus', async ({ page }) => {
    await masuk(page, AKUN.budi);

    for (const path of [
      '/kas/baru',
      '/ronda/kelola',
      '/pengumuman/baru',
      '/jimpitan/rekap'
    ]) {
      const res = await page.request.get(path);
      expect(res.status(), `${path} harus menolak warga`).toBe(403);
    }
  });
});

test.describe('Bendahara (Sri)', () => {
  test('checklist jimpitan menampilkan seluruh KK dan menyimpan sekali jalan', async ({
    page
  }) => {
    await masuk(page, AKUN.sri);

    // 5 Sep 2026: di luar periode yang ditutup tes lain, jadi selalu terbuka.
    await page.goto('/jimpitan/malam/2026-09-05');

    const baris = page.locator('li.baris');
    await expect(baris).toHaveCount(52); // seluruh KK aktif, bukan hanya yang mengisi

    // Ketuk tiga rumah, lalu simpan satu kali untuk seluruh malam.
    await baris.nth(0).getByRole('button').first().click();
    await baris.nth(1).getByRole('button').first().click();
    await baris.nth(2).getByRole('button').first().click();

    const total = page.locator('text=/3 dari 52 rumah/');
    await expect(total).toBeVisible();

    await page.getByRole('button', { name: 'Simpan malam ini' }).click();
    await expect(page.getByText(/3 rumah tersimpan/)).toBeVisible();

    // Muat ulang: entri benar-benar tersimpan.
    await page.reload();
    await expect(page.locator('text=/3 dari 52 rumah/')).toBeVisible();
  });

  test('konfirmasi pembayaran menggerakkan saldo kas persis sebesar tagihan', async ({
    page
  }) => {
    await masuk(page, AKUN.sri);

    await page.goto(`/kas?nocache=${Date.now()}`);
    const saldoAwal = keAngka(
      (await page.getByTestId('saldo-kas').textContent()) ?? ''
    );

    // Ambil satu tagihan yang belum dibayar dari daftar pengurus.
    await page.goto('/sampah');
    // Pilih tagihan yang benar-benar 'Belum' (bukan 'Belum terbit', yang tak punya tautan).
    const belum = page
      .locator("a[href^='/sampah/']")
      .filter({ has: page.getByText('Belum', { exact: true }) })
      .first();
    await expect(belum).toBeVisible();
    await belum.click();
    await expect(
      page.getByRole('button', { name: 'Konfirmasi pembayaran' })
    ).toBeVisible();

    const tagihan = keAngka(
      (await page.getByTestId('nominal-tagihan').textContent()) ?? ''
    );
    await page.getByRole('button', { name: 'Konfirmasi pembayaran' }).click();
    await expect(page.getByText('Lunas').first()).toBeVisible();

    // Saldo dibaca ulang dari server; tunggu sampai nilainya berubah supaya
    // tidak membaca render lama.
    await page.goto(`/kas?nocache=${Date.now()}`);
    await page.reload();
    await expect
      .poll(
        async () =>
          keAngka((await page.getByTestId('saldo-kas').textContent()) ?? ''),
        { timeout: 10_000 }
      )
      .toBe(saldoAwal + tagihan);
  });

  test('tutup periode menyetor satu baris kas lalu mengunci', async ({
    page
  }) => {
    await masuk(page, AKUN.sri);

    // Juni sudah terkunci di seed - menutup ulang tidak boleh menyetor dua kali.
    await page.goto('/jimpitan/rekap?periode=2026-06-01');
    await expect(page.getByText('Terkunci')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Tutup periode/ })
    ).toHaveCount(0);

    // Agustus masih terbuka: tutup, lalu pastikan terkunci.
    await page.goto('/jimpitan/rekap?periode=2026-08-01');
    const tombol = page.getByRole('button', { name: /Tutup periode/ });
    await expect(tombol).toBeVisible();

    await page.goto('/kas?kategori=Jimpitan');
    const sebelum = await page
      .locator('a, div.baris')
      .filter({ hasText: 'Rekap jimpitan' })
      .count();

    await page.goto('/jimpitan/rekap?periode=2026-08-01');
    await page.getByRole('button', { name: /Tutup periode/ }).click();
    await expect(
      page.getByText(/disetor ke kas RT sebagai satu pemasukan/)
    ).toBeVisible();

    // Muat ulang dari server untuk memastikan status benar-benar tersimpan.
    await page.goto(`/jimpitan/rekap?periode=2026-08-01&nocache=${Date.now()}`);
    await expect(page.getByText('Terkunci')).toBeVisible();

    // Tepat satu baris kas baru.
    await page.goto('/kas?kategori=Jimpitan');
    const sesudah = await page
      .locator('a, div.baris')
      .filter({ hasText: 'Rekap jimpitan' })
      .count();
    expect(sesudah).toBe(sebelum + 1);

    // Malam di periode terkunci tidak bisa diubah lagi.
    await page.goto('/jimpitan/malam/2026-08-10');
    await expect(page.getByText(/sudah.*terkunci/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Simpan malam ini' })
    ).toHaveCount(0);
  });
});

test.describe('Ketua (Agus)', () => {
  test('membuat jadwal, mengganti regu, dan menerbitkan pengumuman', async ({
    page
  }) => {
    await masuk(page, AKUN.agus);

    // Buat jadwal untuk rentang yang belum terjadwal (Okt 2026).
    await page.goto('/ronda/kelola');
    await page.locator("input[name='dari']").fill('2026-10-01');
    await page.locator("input[name='sampai']").fill('2026-10-14');
    await page.getByRole('button', { name: /Buat jadwal/ }).click();
    await expect(
      page.getByText(/malam ronda dan .* giliran konsumsi dibuat/)
    ).toBeVisible();

    // Ganti regu satu malam.
    await page.goto('/ronda/kelola');
    const barisMalam = page
      .locator('form')
      .filter({ hasText: 'Simpan' })
      .first();
    await barisMalam
      .locator("select[name='reguId']")
      .selectOption({ index: 3 });
    await barisMalam.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Regu malam itu diganti.')).toBeVisible();

    // Terbitkan pengumuman, lalu muncul di Beranda.
    await page.goto('/pengumuman/baru');
    const judul = `Uji coba jadwal ronda ${Date.now()}`;
    await page.locator("input[name='judul']").fill(judul);
    await page
      .locator("textarea[name='isi']")
      .fill(
        'Pengumuman uji coba dari smoke test otomatis untuk memastikan alur terbit berjalan.'
      );
    await page.getByRole('button', { name: 'Terbitkan' }).click();

    await expect(page.getByRole('heading', { name: judul })).toBeVisible();
    await page.goto('/');
    await expect(page.getByText(judul)).toBeVisible();
  });
});

test.describe('Arisan', () => {
  test('kocokan mengecualikan pemenang sebelumnya', async ({ page }) => {
    await masuk(page, AKUN.sri);

    await page.goto('/arisan');
    await expect(
      page.getByText(/21 anggota belum pernah menang/)
    ).toBeVisible();

    // Catat siapa saja yang sudah menang sebelum kocokan.
    await page.goto('/arisan?tab=anggota');
    const sudahMenang = await page
      .locator('div.baris')
      .filter({ hasText: /menang periode \d/ })
      .allTextContents();
    expect(sudahMenang).toHaveLength(3);

    // Jalankan kocokan periode berjalan.
    await page.goto('/arisan');
    await page.getByRole('link', { name: /Buka periode/ }).click();
    const tombol = page.getByRole('button', { name: /Kocok dari 21 anggota/ });
    await expect(tombol).toBeVisible();
    await tombol.click();

    const pengumumanMenang = page.getByText(/Pemenang periode ini:/);
    await expect(pengumumanMenang).toBeVisible();
    const teks = (await pengumumanMenang.textContent()) ?? '';

    // Pemenang baru tidak boleh salah satu dari tiga pemenang lama.
    for (const lama of sudahMenang) {
      const kode = lama.match(/^([AB]\d+)/)?.[1];
      if (kode) expect(teks).not.toContain(`${kode} `);
    }

    // Sisa kandidat turun dari 21 menjadi 20.
    expect(teks).toContain('Sisa 20 anggota belum menang');
  });
});

test.describe('Tata letak', () => {
  test('tidak ada gulir horizontal di seluruh rute utama', async ({ page }) => {
    await masuk(page, AKUN.sri);

    const rute = [
      '/',
      '/kas',
      '/kas/baru',
      '/sampah',
      '/jimpitan',
      '/jimpitan/rekap',
      '/jimpitan/malam/2026-08-20',
      '/ronda',
      '/ronda/2026-08-23',
      '/konsumsi',
      '/arisan',
      '/pengumuman'
    ];

    for (const path of rute) {
      await page.goto(path);
      const meluber = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(meluber, `${path} meluber horizontal`).toBe(false);
    }
  });
});
