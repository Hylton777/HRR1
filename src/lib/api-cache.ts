/** CDN + browser caching for bracket API responses (matches SWR refresh interval). */
export const BRACKET_API_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=120";
