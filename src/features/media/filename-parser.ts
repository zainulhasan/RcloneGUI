/** Title/year extraction from release-style media file names. */

export interface ParsedFilename {
  title: string;
  year: number | null;
}

const VIDEO_EXTENSIONS = new Set([
  "mkv",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "m4v",
  "webm",
  "ts",
  "flv",
  "mpg",
  "mpeg",
]);

/** Tokens that mark the start of release metadata (quality, source, codec). */
const NOISE = new RegExp(
  [
    "^\\d{3,4}p$",
    "^4k$",
    "^2160p?$",
    "^(blu-?ray|bdrip|brrip|web-?dl|webrip|hdtv|dvdrip|hdrip|remux|cam)$",
    "^([hx]\\.?26[45]|hevc|avc|av1|xvid|divx)$",
    "^(aac|ac3|eac3|dts(-?hd)?|truehd|atmos|flac|mp3|opus)(\\d\\.\\d)?$",
    "^(hdr10?\\+?|dv|dolby|vision|sdr|10bit|8bit)$",
    "^(proper|repack|extended|unrated|remastered|imax|complete|limited)$",
    "^(multi|dual|vostfr|subbed|dubbed)$",
  ].join("|"),
  "i",
);

export function isVideoFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

function titleCaseFrom(tokens: string[]): string {
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Parse "Movie.Name.2019.1080p.BluRay.x264.mkv" → { title: "Movie Name",
 * year: 2019 }. Also handles "Movie Name (2019).mkv" and plain names.
 */
export function parseFilename(filename: string): ParsedFilename {
  let base = filename.replace(/\.[A-Za-z0-9]{2,4}$/, "");

  // "(2019)" style year
  const parenYear = base.match(/\((19\d{2}|20\d{2})\)/);
  if (parenYear) {
    return {
      title: titleCaseFrom(base.slice(0, parenYear.index).replace(/[._]/g, " ").split(/\s+/)),
      year: Number(parenYear[1]),
    };
  }

  base = base.replace(/[._]/g, " ");
  const tokens = base.split(/\s+/).filter(Boolean);

  // Find a year token (not the very first token, so "2012.mkv" stays a title).
  let yearIndex = -1;
  for (let i = tokens.length - 1; i > 0; i--) {
    if (/^(19\d{2}|20\d{2})$/.test(tokens[i])) {
      yearIndex = i;
      break;
    }
  }

  if (yearIndex > 0) {
    return { title: titleCaseFrom(tokens.slice(0, yearIndex)), year: Number(tokens[yearIndex]) };
  }

  // No year: cut at the first noise token.
  const noiseIndex = tokens.findIndex((t) => NOISE.test(t));
  const titleTokens = noiseIndex > 0 ? tokens.slice(0, noiseIndex) : tokens;
  return { title: titleCaseFrom(titleTokens), year: null };
}
