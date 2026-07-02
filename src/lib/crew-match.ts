import type { Crew } from "./types";

const STOP_TOKENS = new Set([
  "the",
  "and",
  "club",
  "boat",
  "rowing",
  "school",
  "college",
  "university",
  "student",
  "studenten",
  "roeivereniging",
  "roeivereeniging",
  "netherlands",
  "germany",
  "usa",
  "australia",
  "canada",
  "zealand",
  "preparatory",
  "institute",
  "technology",
  "academy",
  "grammar",
  "high",
  "royal",
  "amateur",
  "challenge",
  "crew",
]);

const SQUAD_SUFFIX_RE = /^['']?([a-d])['']?$/i;

export interface CrewMatchOptions {
  numberA?: number | null;
  numberB?: number | null;
}

/** Decode HTML entities from HRR API / timetable strings before matching. */
export function decodeHtmlEntities(raw: string): string {
  let s = raw;
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  s = s.replace(/&#(\d+);/g, (_, dec: string) =>
    String.fromCharCode(parseInt(dec, 10)),
  );
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&apos;/gi, "'");
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&lt;/gi, "<");
  s = s.replace(/&gt;/gi, ">");
  s = s.replace(/&amp;/gi, "&");
  return s;
}

export function normalizeCrewName(name: string): string {
  let s = decodeHtmlEntities(name)
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\buniv\b/g, "university")
    .replace(/\bcoll\b/g, "college")
    .replace(/\bsch\b/g, "school")
    .replace(/\binst\b/g, "institute")
    .replace(/\btech\b/g, "technology")
    .replace(/\bk\.?s\.?r\.?v\.?\b/gi, "koninklijke studenten roeivereeniging")
    .replace(/\ba\.?l\.?s\.?r\.?v\.?\b/gi, "algemene leidse studenten roeivereeniging")
    .replace(/\bd\.?s\.?r\.?v\.?\b/gi, "delftsche studenten roeivereeniging")
    .replace(/\bg\.?s\.?r\.?\b/gi, "groninger studenten roeivereniging")
    .replace(/\ba\.?u\.?s\.?r\.?\b/gi, "amsterdamsche universiteits studenten roeivereniging")
    .replace(/\bk\.?a\.?r\.?z\.?v\.?\b/gi, "koninklijke amsterdamsche roei en zeilvereeniging")
    .replace(/\br\.?v\.?\b/g, "ruderverein")
    .replace(/\bb\.?c\.?\b/g, "boat club")
    .replace(/\ba\.?r\.?c\.?\b/g, "amateur rowing club")
    .replace(/\br\.?c\.?\b/g, "rowing club")
    .replace(/,\s*(aus|usa|ned|ger|irl|nzl|nz|esp|fra|ita|por|bel|den|can|germany|spain|australia|u\.s\.a\.?)\b/gi, "")
    .replace(/,\s*u\.s\.a\.?/gi, "")
    .replace(/,\s*australia/gi, "")
    .replace(/,\s*france/gi, "");

  s = s.replace(/\./g, " ");
  s = repairSpacedTokens(s);
  s = s.replace(/\s+(rowing club|boat club|school|college)\.?$/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function repairSpacedTokens(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  if (tokens.length === 0) return name;

  const repaired: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.length === 1 && i + 1 < tokens.length && tokens[i + 1].length > 1) {
      tokens[i + 1] = token + tokens[i + 1];
      i += 1;
      continue;
    }
    if (
      (token === "a" || token === "r" || token === "c" || token === "b" || token === "k") &&
      i + 2 < tokens.length &&
      (tokens[i + 1] === "r" ||
        tokens[i + 1] === "c" ||
        tokens[i + 1] === "s" ||
        tokens[i + 1] === "a")
    ) {
      repaired.push(tokens.slice(i, i + 3).join(""));
      i += 3;
      continue;
    }
    repaired.push(token);
    i += 1;
  }
  return repaired.join(" ");
}

export function compactCrewName(name: string): string {
  return normalizeCrewName(name).replace(/[^a-z0-9]/g, "");
}

function splitCompositeParts(name: string): string[] {
  return name.split(/\s+and\s+/).map((part) => part.trim()).filter(Boolean);
}

function parseSquadSuffix(name: string): { base: string; squad: string } | null {
  const patterns = [
    /^(.*)\s+(['']?[a-d]['']?)$/i,
    /^(.*)\s+(['']?[a-d]['']?)\s*,/i,
    /^(.*)\s+(['']?[a-d]['']?)\s+(?:netherlands|germany|australia|usa|zealand|ireland|canada|austria|belgium|denmark|spain|sweden|norway|france|italy)$/i,
  ];
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (!match || !SQUAD_SUFFIX_RE.test(match[2]!)) continue;
    const squad = match[2]!.replace(/['']/g, "").toLowerCase();
    return { base: match[1]!.trim(), squad };
  }
  return null;
}

/** Names that share a prefix but denote different draw entries (e.g. Leander Club vs Leander Club & Leeds). */
function isDistinctCrewVariant(a: string, b: string): boolean {
  if (a === b) return false;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  if (longer.startsWith(shorter)) {
    const suffix = longer.slice(shorter.length).trim();
    if (!suffix) return false;
    if (suffix.startsWith("and ")) return true;
    if (SQUAD_SUFFIX_RE.test(suffix)) return true;
  }

  const squadA = parseSquadSuffix(a);
  const squadB = parseSquadSuffix(b);
  if (squadA && squadB && squadA.base === squadB.base && squadA.squad !== squadB.squad) {
    return true;
  }
  if (squadA && !squadB && squadA.base === b) return true;
  if (squadB && !squadA && squadB.base === a) return true;

  if (longer.includes(" and ") && !shorter.includes(" and ")) {
    const parts = splitCompositeParts(longer);
    if (parts.some((part) => part === shorter)) return true;
  }

  return false;
}

function safePrefixIncludes(shorter: string, longer: string): boolean {
  if (shorter === longer) return true;
  if (!longer.startsWith(shorter)) return false;
  const suffix = longer.slice(shorter.length).trim();
  if (!suffix) return true;
  if (suffix.startsWith("and ")) return false;
  if (SQUAD_SUFFIX_RE.test(suffix)) return false;
  return true;
}

function distinctiveTokens(name: string): string[] {
  return normalizeCrewName(name)
    .split(" ")
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
}

const GENERIC_CLUB_TOKENS = new Set([
  "city",
  "london",
  "college",
  "university",
  "imperial",
  "royal",
  "greater",
  "northern",
  "southern",
  "eastern",
  "western",
]);

/** Reject club matches that only overlap on vague tokens (e.g. York City vs City of Bristol). */
function onlySharesGenericTokens(a: string, b: string): boolean {
  const na = normalizeCrewName(a);
  const nb = normalizeCrewName(b);
  if (na === nb) return false;
  if (safePrefixIncludes(na, nb) || safePrefixIncludes(nb, na)) return false;

  const tokensA = distinctiveTokens(a);
  const tokensB = distinctiveTokens(b);
  const shared = tokensA.filter((token) => tokensB.includes(token));
  if (shared.length === 0) return false;
  return shared.every((token) => GENERIC_CLUB_TOKENS.has(token));
}

function sharesDistinctiveToken(a: string, b: string): boolean {
  if (isDistinctCrewVariant(normalizeCrewName(a), normalizeCrewName(b))) {
    return false;
  }

  const tokensA = distinctiveTokens(a);
  const tokensB = distinctiveTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  for (const token of tokensA) {
    if (tokensB.includes(token)) return true;
  }
  return false;
}

function isScullerOrPairName(name: string): boolean {
  const decoded = decodeHtmlEntities(name);
  if (/\s&\s|\s+and\s+/i.test(decoded)) return true;
  if (/[A-Z]\.[A-Z]?\.?\s/.test(decoded)) return true;
  if (/\([A-Z][a-z]/.test(decoded)) return true;
  return false;
}

/** Surnames / pair keys for sculling events where the API uses athlete names. */
export function extractScullerKeys(name: string): string[] {
  if (!isScullerOrPairName(name)) return [];

  const decoded = decodeHtmlEntities(name);
  const beforeClub = decoded.split("(")[0]?.split(",")[0]?.trim() ?? decoded;
  const keys = new Set<string>();

  const pairParts = beforeClub.split(/\s*(?:&| and )\s*/i);
  for (const part of pairParts) {
    const tokens = part
      .replace(/['']/g, "")
      .replace(/\./g, " ")
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));

    if (tokens.length === 0) continue;

    const last = tokens[tokens.length - 1]!;
    keys.add(last);
    if (tokens.length >= 2) {
      keys.add(`${tokens[tokens.length - 2]}-${last}`);
    }
  }

  return [...keys];
}

function nameVariants(crew: Pick<Crew, "name" | "shortName">): string[] {
  const names = [crew.name];
  if (crew.shortName && crew.shortName !== crew.name) {
    names.push(crew.shortName);
  }
  return names.map(decodeHtmlEntities);
}

function squadLettersInName(name: string): string[] {
  return [
    ...name.matchAll(/['']([a-d])['']/gi),
    ...name.matchAll(/\s([a-d])\s*,/gi),
  ].map((match) => match[1]!.toLowerCase());
}

function hasConflictingSquadLetters(a: string, b: string): boolean {
  const lettersA = squadLettersInName(a);
  const lettersB = squadLettersInName(b);
  if (!lettersA.length || !lettersB.length) return false;
  return !lettersA.some((letter) => lettersB.includes(letter));
}

export function crewsMatch(
  a: string,
  b: string,
  options?: CrewMatchOptions,
): boolean {
  const numberA = options?.numberA;
  const numberB = options?.numberB;
  if (numberA != null && numberB != null) {
    return numberA === numberB;
  }

  const na = normalizeCrewName(a);
  const nb = normalizeCrewName(b);
  if (!na || !nb) return false;
  if (hasConflictingSquadLetters(a, b) || hasConflictingSquadLetters(na, nb)) {
    return false;
  }
  if (na === nb) return true;
  if (isDistinctCrewVariant(na, nb)) return false;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (safePrefixIncludes(shorter, longer)) return true;

  const ca = compactCrewName(a);
  const cb = compactCrewName(b);
  if (ca && cb) {
    const compactShorter = ca.length <= cb.length ? ca : cb;
    const compactLonger = ca.length <= cb.length ? cb : ca;
    if (compactShorter === compactLonger) return true;
    if (
      compactLonger.startsWith(compactShorter) &&
      !isDistinctCrewVariant(na, nb)
    ) {
      return true;
    }
  }

  const core = (s: string) =>
    s
      .replace(/^(the|st|st\.)\s+/i, "")
      .replace(/\s+(sch|school|coll|college|bc|rc|b\.c|r\.c)\.?$/i, "")
      .trim();

  const coreA = core(na);
  const coreB = core(nb);
  if (coreA === coreB) return true;
  if (safePrefixIncludes(coreA, coreB) || safePrefixIncludes(coreB, coreA)) {
    return true;
  }

  return sharesDistinctiveToken(a, b);
}

/** Match an HRR result crew to a specific draw slot (berks/bucks). */
export function crewResultMatchesDraw(
  drawCrew: Crew,
  resultCrew: Crew,
): boolean {
  if (drawCrew.number != null && resultCrew.number != null) {
    return drawCrew.number === resultCrew.number;
  }

  for (const drawName of nameVariants(drawCrew)) {
    for (const resultName of nameVariants(resultCrew)) {
      if (onlySharesGenericTokens(drawName, resultName)) continue;
      if (
        crewsMatch(drawName, resultName, {
          numberA: drawCrew.number,
          numberB: resultCrew.number,
        })
      ) {
        return true;
      }
    }
  }

  const drawKeys = extractScullerKeys(drawCrew.name);
  const resultKeys = extractScullerKeys(resultCrew.name);
  if (drawKeys.length > 0 && resultKeys.length > 0) {
    for (const drawKey of drawKeys) {
      for (const resultKey of resultKeys) {
        if (drawKey === resultKey) {
          return true;
        }
      }
    }
  }

  return false;
}
