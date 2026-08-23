/** Kesalahan domain yang bisa ditampilkan langsung ke pengguna (Bahasa Indonesia). */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly kode: string
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function domainError(kode: string, message: string): DomainError {
  return new DomainError(message, kode);
}
