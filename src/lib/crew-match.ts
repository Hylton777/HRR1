export function normalizeCrewName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\./g, "")
    .replace(/,\s*u\.s\.a\.?/gi, "")
    .replace(/,\s*australia/gi, "")
    .replace(/,\s*france/gi, "")
    .replace(/\s+(rowing club|boat club|school|college)\.?$/gi, "")
    .replace(/\s+(r\.c|b\.c|sch|coll)\.?$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function crewsMatch(a: string, b: string): boolean {
  const na = normalizeCrewName(a);
  const nb = normalizeCrewName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const core = (s: string) =>
    s
      .replace(/^(the|st|st\.)\s+/i, "")
      .replace(/\s+(sch|school|coll|college|bc|rc|b\.c|r\.c)\.?$/i, "")
      .trim();

  const ca = core(na);
  const cb = core(nb);
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}
