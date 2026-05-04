import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OAuthProvider = "google" | "microsoft";

export interface OAuthToken {
  clientId: string;
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
  expiresAt?: string;
  accountEmail?: string;
  updatedAt: string;
}

interface OAuthTokenRow {
  client_id: string;
  provider: OAuthProvider;
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expires_at: string | null;
  account_email: string | null;
  updated_at: string;
}

function rowToToken(r: OAuthTokenRow): OAuthToken {
  return {
    clientId: r.client_id,
    provider: r.provider,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? undefined,
    scope: r.scope ?? undefined,
    tokenType: r.token_type ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    accountEmail: r.account_email ?? undefined,
    updatedAt: r.updated_at,
  };
}

export async function getOAuthToken(
  clientId: string,
  provider: OAuthProvider,
): Promise<OAuthToken | null> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_oauth_tokens")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(`getOAuthToken: ${error.message}`);
  return data ? rowToToken(data as OAuthTokenRow) : null;
}

export async function upsertOAuthToken(input: {
  clientId: string;
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
  expiresAt?: Date | string;
  accountEmail?: string;
}): Promise<void> {
  const sb = createSupabaseAdminClient();
  const expires =
    input.expiresAt instanceof Date
      ? input.expiresAt.toISOString()
      : input.expiresAt ?? null;

  const { error } = await sb.from("client_oauth_tokens").upsert(
    {
      client_id: input.clientId,
      provider: input.provider,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      scope: input.scope ?? null,
      token_type: input.tokenType ?? null,
      expires_at: expires,
      account_email: input.accountEmail ?? null,
    },
    { onConflict: "client_id,provider" },
  );
  if (error) throw new Error(`upsertOAuthToken: ${error.message}`);
}

export async function deleteOAuthToken(
  clientId: string,
  provider: OAuthProvider,
): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("client_oauth_tokens")
    .delete()
    .eq("client_id", clientId)
    .eq("provider", provider);
  if (error) throw new Error(`deleteOAuthToken: ${error.message}`);
}
