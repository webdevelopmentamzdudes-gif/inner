export type SavedFilter = {
  q?: string;
  icp?: string;
  stage?: string;
  bucket?: string;
  source?: string;
  mine?: string;
};

export function filterToQuery(filter: SavedFilter): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v) params.set(k, String(v));
  }
  return params.toString();
}
