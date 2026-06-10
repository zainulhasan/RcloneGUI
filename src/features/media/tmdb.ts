/** Minimal TMDB search client with a localStorage cache. */

export interface TmdbMovie {
  id: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
}

const CACHE_PREFIX = "tmdb:";
const CACHE_TTL_MS = 30 * 24 * 3_600_000;
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface CacheEntry {
  at: number;
  movie: TmdbMovie | null;
}

function cacheKey(title: string, year: number | null): string {
  return `${CACHE_PREFIX}${title.toLowerCase()}|${year ?? ""}`;
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key: string, movie: TmdbMovie | null): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), movie } satisfies CacheEntry));
  } catch {
    // Cache is best-effort; quota errors are fine to ignore.
  }
}

interface TmdbSearchResponse {
  results?: {
    id: number;
    title: string;
    release_date?: string;
    poster_path?: string | null;
    overview?: string;
  }[];
}

/** Search a movie by parsed title/year. Returns null when nothing matches. */
export async function searchMovie(
  apiKey: string,
  title: string,
  year: number | null,
): Promise<TmdbMovie | null> {
  const key = cacheKey(title, year);
  const cached = readCache(key);
  if (cached) return cached.movie;

  const params = new URLSearchParams({ api_key: apiKey, query: title });
  if (year !== null) params.set("year", String(year));
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`);
  if (!res.ok) {
    throw new Error(res.status === 401 ? "TMDB rejected the API key" : `TMDB error ${res.status}`);
  }

  const body = (await res.json()) as TmdbSearchResponse;
  const first = body.results?.[0];
  const movie: TmdbMovie | null = first
    ? {
        id: first.id,
        title: first.title,
        year: first.release_date ? Number(first.release_date.slice(0, 4)) : null,
        posterUrl: first.poster_path ? `${POSTER_BASE}${first.poster_path}` : null,
        overview: first.overview ?? "",
      }
    : null;

  writeCache(key, movie);
  return movie;
}
