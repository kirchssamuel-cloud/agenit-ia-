import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { getIntegrationDef } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

/**
 * /connect/[provider]?clientId=<UUID>
 *
 * Page magic-link générique pour connecter une intégration (Gmail, Calendar,
 * Telegram, CRM API key, etc.) en 1 clic.
 *
 * - Pour intégrations OAuth (kind="oauth") : gros bouton qui redirige vers
 *   l'URL d'auth du provider (déjà gérée ailleurs, ex: /api/oauth/google/start-public).
 * - Pour intégrations API key (kind="api_key") : input simple pour coller
 *   la clé + bouton "Connecter".
 * - Pour intégrations bot token (kind="bot_token") : idem mais format différent.
 *
 * Cette page est appelée par les liens magiques que l'agent envoie dans
 * WhatsApp quand il a besoin d'un accès non-connecté.
 */

interface PageProps {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ clientId?: string }>;
}

export default async function ConnectPage({ params, searchParams }: PageProps) {
  const { provider } = await params;
  const { clientId } = await searchParams;

  if (!clientId) {
    redirect("/signup");
  }

  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) {
    return <NotFoundCard message="Lien invalide ou expiré." />;
  }

  const integration = getIntegrationDef(provider);
  if (!integration) {
    return (
      <NotFoundCard
        message={`Service "${provider}" inconnu. Demande un nouveau lien à ton agent.`}
      />
    );
  }

  // Si déjà connecté → page "déjà OK"
  const alreadyConnected = await integration.isConnected(clientId);
  if (alreadyConnected) {
    return <AlreadyConnectedCard integration={integration} clientId={clientId} />;
  }

  // OAuth : bouton qui redirige vers l'URL d'auth + clientId
  if (integration.kind === "oauth") {
    const startUrl = `${integration.startUrl}?clientId=${clientId}`;
    return (
      <main className="min-h-screen bg-[#0F172A] text-white">
        <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
          <div className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-6 sm:p-8 shadow-xl">
            <div className="text-5xl mb-4 text-center">{integration.icon}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
              Connecter {integration.displayName}
            </h1>
            <p className="text-slate-400 text-center mb-6">
              {integration.shortPurpose}
            </p>

            <div className="bg-[#0F172A] border border-slate-700 rounded-lg p-4 mb-6 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="text-[#F97316] flex-shrink-0 mt-0.5"
                  size={18}
                />
                <div>
                  <div className="font-medium text-white mb-1">
                    Tu gardes le contrôle
                  </div>
                  <div className="text-xs text-slate-400">
                    Tu peux retirer l&apos;accès à tout moment depuis ton compte{" "}
                    {integration.category === "google" ? "Google" : integration.displayName}.
                    On ne stocke ni mots de passe ni données privées.
                  </div>
                </div>
              </div>
            </div>

            <a
              href={startUrl}
              className="block w-full text-center font-semibold py-4 rounded-[20px] transition-colors text-lg text-white"
              style={{ backgroundColor: integration.brandColor }}
            >
              Autoriser {integration.displayName} →
            </a>

            <p className="text-xs text-slate-500 text-center mt-4">
              Tu seras redirigé(e) vers le site officiel pour valider.
            </p>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Connecté à : <strong className="text-slate-400">{client.name}</strong>
          </p>
        </div>
      </main>
    );
  }

  // api_key / bot_token : pour le MVP on affiche une page d'instructions
  // (on n'a pas encore d'UI input + endpoint qui stocke la clé en DB).
  // Sprint suivant : ajouter un form qui stocke la clé via une nouvelle DAO.
  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <div className="mx-auto max-w-md px-6 py-16 sm:py-24">
        <div className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-6 sm:p-8 shadow-xl">
          <div className="text-5xl mb-4 text-center">{integration.icon}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
            Connecter {integration.displayName}
          </h1>
          <p className="text-slate-400 text-center mb-6">
            {integration.shortPurpose}
          </p>

          <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4 mb-6 text-sm text-amber-200">
            <div className="font-semibold mb-2">⏳ Bientôt disponible en self-service</div>
            <div className="text-xs">
              Pour l&apos;instant, contacte l&apos;équipe Agenit IA et on te
              branche {integration.displayName} en 24h max. Réponds à
              l&apos;email de bienvenue.
            </div>
          </div>

          <Link
            href={`/client-area?clientId=${clientId}`}
            className="block w-full text-center bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Retour à mon espace
          </Link>
        </div>
      </div>
    </main>
  );
}

function NotFoundCard({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white px-4">
      <div className="max-w-md w-full bg-[#1E293B] rounded-[20px] p-8 text-center shadow-xl border border-slate-700">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-semibold mb-3">Oups</h1>
        <p className="text-slate-300 mb-6">{message}</p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 text-[#F97316] hover:underline"
        >
          Retour à l&apos;accueil <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}

function AlreadyConnectedCard({
  integration,
  clientId,
}: {
  integration: ReturnType<typeof getIntegrationDef>;
  clientId: string;
}) {
  if (!integration) return null;
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white px-4">
      <div className="max-w-md w-full bg-[#1E293B] rounded-[20px] p-8 text-center shadow-xl border border-slate-700">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-semibold mb-3">
          {integration.displayName} est déjà branché
        </h1>
        <p className="text-slate-300 mb-6">
          Ton agent a déjà accès. Tu peux fermer cette page et continuer sur
          WhatsApp.
        </p>
        <Link
          href={`/client-area?clientId=${clientId}`}
          className="inline-flex items-center gap-2 text-[#F97316] hover:underline"
        >
          <Sparkles size={16} /> Voir mon espace client
        </Link>
      </div>
    </main>
  );
}
