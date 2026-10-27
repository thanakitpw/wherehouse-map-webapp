export type FormState = { error?: string; ok?: string } | undefined;

export function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export function int(fd: FormData, key: string) {
  const n = parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : NaN;
}
