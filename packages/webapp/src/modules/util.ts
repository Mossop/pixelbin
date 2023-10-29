export function url(parts: string[]): string {
  return "/" + parts.map((p) => encodeURIComponent(p)).join("/");
}
