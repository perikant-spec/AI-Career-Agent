export interface AdzunaResult {
  title: string;
  company: string;
  location: string;
  description: string;
  redirectUrl: string;
}

export function isAdzunaConfigured(): boolean {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

/**
 * Licensed job-search API (developer.adzuna.com, free self-serve signup) — the one provider
 * behind the job-source-adapter interface that isn't manual paste. Inert until the user
 * supplies their own ADZUNA_APP_ID/ADZUNA_APP_KEY; never called speculatively.
 */
export async function searchAdzuna(params: {
  what?: string;
  where?: string;
  country?: string;
}): Promise<AdzunaResult[]> {
  if (!isAdzunaConfigured()) {
    throw new Error("Adzuna is not configured — set ADZUNA_APP_ID and ADZUNA_APP_KEY.");
  }

  const country = params.country ?? "us";
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!);
  url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!);
  url.searchParams.set("results_per_page", "10");
  if (params.what) url.searchParams.set("what", params.what);
  if (params.where) url.searchParams.set("where", params.where);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Adzuna request failed (${res.status}).`);
  }
  const body = await res.json();

  return (body.results ?? []).map((r: Record<string, unknown>) => ({
    title: String(r.title ?? ""),
    company: String((r.company as { display_name?: string } | undefined)?.display_name ?? ""),
    location: String((r.location as { display_name?: string } | undefined)?.display_name ?? ""),
    description: String(r.description ?? ""),
    redirectUrl: String(r.redirect_url ?? ""),
  }));
}
