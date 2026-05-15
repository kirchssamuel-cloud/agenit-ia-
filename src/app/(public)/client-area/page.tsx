import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageCircle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Settings,
  Beaker,
} from "lucide-react";
import { ensureLoaded, getClient, listClientModules } from "@/lib/db/store";
import { getNumberForClient } from "@/lib/db/whatsapp";
import { getOAuthToken } from "@/lib/db/oauth";
import { getModuleById } from "@/modules/registry";

export const dynamic = "force-dynamic";

/**
 * /client-area?clientId=<UUID> — espace client public (sans auth admin).
 *
 * Accessible via le lien magique envoyé par email après le checkout.
 * Affiche : numéro WhatsApp attribué, modules actifs, liens utiles.
 *
 * Sécurité MVP : non signé. Pour la prod, signer le lien (JWT court).
 */
export default async function ClientAreaPage({
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
          <h1 className="text-2xl font-semibold mb-3">Espace introuvable</h1>
          <p className="text-slate-300 mb-6">
            Le lien d&apos;accès est invalide ou expiré.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-[#F97316] hover:underline"
          >
            S&apos;inscrire
          </Link>
        </div>
      </main>
    );
  }

  const agentNumber = await getNumberForClient(clientId);
  const googleToken = await getOAuthToken(clientId, "google");
  const googleConnected = Boolean(googleToken?.accessToken);
  const clientModules = listClientModules(clientId).filter((cm) => cm.enabled);
  const activeModules = clientModules
    .map((cm) => getModuleById(cm.moduleId))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#F97316]/10 text-[#F97316] px-3 py-1 rounded-full text-xs font-semibold mb-4">
            <Sparkles size={14} />
            COMPTE ACTIF
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Bienvenue {client.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-300 text-lg">
            Ton agent IA est prêt à bosser pour toi.
          </p>
        </div>

        {/* Carte principale : ton numéro WhatsApp */}
        {agentNumber ? (
          <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-2 border-[#F97316] rounded-[20px] p-6 sm:p-8 mb-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#F97316] p-2 rounded-lg">
                <MessageCircle className="text-white" size={24} />
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">
                  Ton numéro WhatsApp d&apos;agent
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-bold mt-1">
                  {agentNumber.phoneNumber}
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-4 text-sm text-slate-300 space-y-2">
              <p>
                <strong className="text-white">Pour commencer :</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>
                  Ajoute <code className="text-[#F97316]">{agentNumber.phoneNumber}</code> dans tes contacts WhatsApp
                </li>
                <li>
                  Tape <code className="text-[#F97316]">join porche roulant</code> à ce numéro (sandbox temporaire)
                </li>
                <li>
                  Écris &quot;Salut&quot; — ton agent te répond
                </li>
              </ol>
            </div>

            <p className="text-xs text-slate-500 italic mt-4">
              ⏳ Numéro sandbox temporaire. Ton numéro dédié arrive dès que ton compte WhatsApp Business sera validé par Meta (1-3 semaines).
            </p>
          </div>
        ) : (
          <div className="bg-amber-950/40 border border-amber-700 rounded-[20px] p-6 mb-6">
            <div className="font-semibold mb-2 text-amber-300">
              ⏳ Provisionnement en cours
            </div>
            <p className="text-sm text-slate-300">
              Ton numéro WhatsApp sera attribué dans les prochaines minutes.
              Recharge cette page bientôt.
            </p>
          </div>
        )}

        {/* Modules actifs */}
        <div className="bg-[#1E293B] rounded-[20px] p-6 sm:p-8 mb-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-[#F97316]" size={20} />
            Modules actifs ({activeModules.length})
          </h2>
          {activeModules.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun module activé pour l&apos;instant.</p>
          ) : (
            <div className="space-y-3">
              {activeModules.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 bg-[#0F172A] rounded-lg p-3 border border-slate-700"
                >
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {m.shortDescription}
                    </div>
                  </div>
                  {m.pricing?.monthlyEUR ? (
                    <div className="text-sm font-semibold text-[#F97316] whitespace-nowrap">
                      {m.pricing.monthlyEUR}€/mois
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action vedette : tester l'agent depuis le web */}
        <Link
          href={`/client-area/test-agent?clientId=${clientId}`}
          className="block bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-90 transition rounded-[20px] p-5 mb-4 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl flex-shrink-0">
              <Beaker className="text-white" size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg text-white">
                Tester mon agent maintenant
              </div>
              <div className="text-sm text-white/80">
                Parle-lui depuis le navigateur — sans Twilio, sans WhatsApp.
                Le moyen le plus rapide de voir s&apos;il marche.
              </div>
            </div>
            <ExternalLink className="text-white flex-shrink-0" size={20} />
          </div>
        </Link>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Link
            href={`/client-area/connections?clientId=${clientId}`}
            className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-5 hover:border-[#F97316] transition-colors group"
          >
            <div className="flex items-start gap-3">
              <Settings className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold mb-1">
                  Mes connexions{" "}
                  {googleConnected ? (
                    <span className="text-xs text-emerald-400 ml-1">
                      ✓ Google
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 ml-1">
                      ⚠ Google à connecter
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Gère Gmail / Calendar / Drive / Contacts en 1 clic
                </div>
              </div>
              <ExternalLink
                className="text-slate-500 group-hover:text-[#F97316] flex-shrink-0 ml-auto"
                size={16}
              />
            </div>
          </Link>

          <a
            href={`https://wa.me/${agentNumber?.phoneNumber?.replace(/\+/g, "") ?? ""}`}
            target="_blank"
            rel="noreferrer"
            className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-5 hover:border-[#F97316] transition-colors group"
          >
            <div className="flex items-start gap-3">
              <MessageCircle className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold mb-1">Parler à mon agent</div>
                <div className="text-xs text-slate-400">
                  Ouvre WhatsApp avec ton agent pré-rempli
                </div>
              </div>
              <ExternalLink
                className="text-slate-500 group-hover:text-[#F97316] flex-shrink-0 ml-auto"
                size={16}
              />
            </div>
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500">
          <p>
            Une question ? Réponds à l&apos;email de bienvenue qu&apos;on
            vient de t&apos;envoyer à <strong className="text-slate-300">{client.contactEmail}</strong>.
          </p>
          <p className="mt-2 text-xs">
            Sauvegarde ce lien — c&apos;est ton espace client personnel.
          </p>
        </div>
      </div>
    </main>
  );
}
