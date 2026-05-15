import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { ChatUI } from "./chat-ui";

export const dynamic = "force-dynamic";

/**
 * /client-area/test-agent?clientId=<UUID>
 *
 * Page de test web pour parler à son agent sans passer par WhatsApp.
 * Utile pour valider end-to-end (Anthropic + tools Google) avant que
 * Twilio soit configuré, ou simplement pour debug.
 */
export default async function TestAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  const clientId = params.clientId;
  if (!clientId) redirect("/signup");

  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white px-4">
        <div className="max-w-md w-full bg-[#1E293B] rounded-[20px] p-8 text-center shadow-xl border border-slate-700">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold mb-3">Client introuvable</h1>
          <p className="text-slate-300 mb-6">
            Vérifie ton lien ou crée un compte.
          </p>
          <Link href="/signup" className="text-[#F97316] hover:underline">
            S&apos;inscrire
          </Link>
        </div>
      </main>
    );
  }

  const googleToken = await getOAuthToken(clientId, "google");
  const googleConnected = Boolean(googleToken?.accessToken);

  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href={`/client-area?clientId=${clientId}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4"
        >
          <ArrowLeft size={16} /> Retour à mon espace
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-2">
            <Sparkles className="text-[#F97316]" size={24} /> Tester mon agent
          </h1>
          <p className="text-sm text-slate-400">
            Discute avec ton agent depuis le navigateur — sans passer par
            WhatsApp. Pratique pour valider que tout marche avant tes
            premiers messages réels.
          </p>
        </div>

        {/* Statut connexions */}
        <div className="bg-[#1E293B] rounded-xl p-4 mb-4 border border-slate-700">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="text-slate-400">Statut :</span>
            <span
              className={
                googleConnected
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            >
              {googleConnected
                ? "✅ Google connecté"
                : "⚠ Google non connecté"}
            </span>
            {!googleConnected && (
              <Link
                href={`/api/oauth/google/start-public?clientId=${clientId}&returnTo=/client-area/connections`}
                className="ml-auto text-xs px-3 py-1 bg-[#4285F4] rounded hover:opacity-90"
              >
                Connecter
              </Link>
            )}
          </div>
        </div>

        <ChatUI clientId={clientId} clientName={client.name} />

        <div className="mt-6 text-xs text-slate-500 leading-relaxed">
          <strong>Astuce :</strong> les vrais tools Google ne fonctionnent que si
          tu as connecté ton compte Google ET que les credentials OAuth sont
          configurés en prod (env vars Vercel). Sinon l&apos;agent te répond
          mais ne peut pas vraiment lire tes emails / créer des RDV / etc.
        </div>
      </div>
    </main>
  );
}
