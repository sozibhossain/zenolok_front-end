import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function IndexPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) || {};

  // If Google redirected here with an OAuth code (because GOOGLE_REDIRECT_URI is
  // configured as the site root), forward the params to the dedicated callback page
  // so it can run the token exchange.
  const code = firstParam(params.code);
  const state = firstParam(params.state);
  const oauthError = firstParam(params.error);
  const scope = firstParam(params.scope);

  if (code || oauthError) {
    const forward = new URLSearchParams();
    if (code) forward.set("code", code);
    if (state) forward.set("state", state);
    if (scope) forward.set("scope", scope);
    if (oauthError) forward.set("error", oauthError);
    redirect(`/oauth/google-calendar/callback?${forward.toString()}`);
  }

  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/home");
  }

  redirect("/auth/login");
}
