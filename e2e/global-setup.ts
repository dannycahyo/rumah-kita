import { execSync } from "node:child_process";

/**
 * Seed ulang sebelum seluruh berkas tes dijalankan.
 *
 * Tes menulis ke database yang sama (menutup periode, mengocok arisan,
 * melunasi tagihan), jadi tanpa ini jalannya tes kedua akan memulai dari
 * keadaan yang sudah berubah.
 */
export default function globalSetup() {
  execSync("./node_modules/.bin/tsx app/db/seed.ts", {
    stdio: "inherit",
    env: process.env,
  });
}
