/** Session-scoped display filter overrides (UX-19). */

export type SessionFilterState = {
  ng_keywords: string[];
  excluded_author_ids: string[];
};

const EMPTY: SessionFilterState = {
  ng_keywords: [],
  excluded_author_ids: [],
};

function storageKey(videoId: string): string {
  return `livechatscope:session-filter:${videoId}`;
}

export function loadSessionFilter(videoId: string): SessionFilterState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = sessionStorage.getItem(storageKey(videoId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<SessionFilterState>;
    return {
      ng_keywords: normalizeKeywords(parsed.ng_keywords ?? []),
      excluded_author_ids: normalizeAuthorIds(parsed.excluded_author_ids ?? []),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSessionFilter(
  videoId: string,
  state: SessionFilterState,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    storageKey(videoId),
    JSON.stringify({
      ng_keywords: normalizeKeywords(state.ng_keywords),
      excluded_author_ids: normalizeAuthorIds(state.excluded_author_ids),
    }),
  );
}

export function normalizeKeyword(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return trimmed;
}

export function normalizeKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeKeyword(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function normalizeAuthorId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

export function normalizeAuthorIds(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeAuthorId(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
