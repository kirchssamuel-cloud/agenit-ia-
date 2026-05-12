import { Mail, Calendar, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ensureLoaded, getClient } from "@/lib/db/store";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
    oauth_error?: string;
  }>;
}

/**
 * /onboarding?clientId=<UUID> — page publique de connexion Gmail/Calendar.
 *
 * Lien magique envoyé au commercial après attribution de son numéro WhatsApp.
 * Il clique le bouton → flow OAuth Google → tokens stockés → /onboarding/done.
 *
 * Charte Kizzo : navy #0F172A + orange #F97316.
 */
export default async function OnboardingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const clientId = sp.clientId;
  const oauthError = sp.oauth_error;

  await ensureLoaded();
  const client = clientId ? getClient(clientId) : null;

  if (!clientId || !client) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white px-4">
        <div className="max-w-md w-full bg-[#1E293B] rounded-[20px] p-8 text-center shadow-xl">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold mb-3">Lien invalide</h1>
          <p className="text-slate-300 mb-6">
            Ce lien d&apos;onboarding est incomplet ou expiré.
            Demande un nouveau lien à ton agence.
          </p>
          <Link
            href="https://kizzo.fr"
            className="inline-flex items-center gap-2 text-[#F97316] hover:underline"
          >
            Retour à l&apos;accueil <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Bienvenue {client.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-300 text-lg">
            Plus qu&apos;une étape avant que ton agent IA prenne le relais.
          </p>
        </div>

        {/* Carte principale */}
        <div className="bg-[#1E293B] rounded-[20px] p-6 sm:p-8 mb-6 shadow-xl border border-slate-700">
          <h2 className="text-xl font-semibold mb-2">
            Connecte ton compte Google
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Ton agent a besoin d&apos;accéder à ton Gmail et à ton calendrier
            pour faire son travail.
          </p>

          {/* Permissions demandées */}
          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <Mail className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-medium">Gmail</div>
                <div className="text-sm text-slate-400">
                  Lire tes emails entrants, archiver les non pertinents,
                  pousser les leads dans ton CRM
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-medium">Google Calendar</div>
                <div className="text-sm text-slate-400">
                  Lire tes RDV du lendemain pour préparer ton brief du soir
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-medium">Sécurité</div>
                <div className="text-sm text-slate-400">
                  Tu peux révoquer l&apos;accès à tout moment depuis ton
                  compte Google. On ne lit ni ne stocke tes mots de passe.
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <a
            href={`/api/oauth/google/start-public?clientId=${clientId}`}
            className="block w-full text-center bg-[#F97316] hover:bg-orange-600 text-white font-semibold py-4 rounded-[20px] transition-colors text-lg"
          >
            Connecter mon compte Google
          </a>

          {oauthError && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              ❌ Erreur OAuth : {oauthError}
            </div>
          )}
        </div>

        {/* Workflow preview */}
        <div className="bg-[#1E293B] rounded-[20px] p-6 sm:p-8 shadow-xl border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">
            Ce que ton agent fera pour toi
          </h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="text-2xl">🌅</div>
              <div>
                <div className="font-medium">Chaque matin à 7h00</div>
                <div className="text-sm text-slate-400">
                  Trie tes nouveaux emails, archive le spam, pousse les leads
                  dans ton CRM, t&apos;envoie un résumé WhatsApp avec les
                  priorités du jour.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">🌆</div>
              <div>
                <div className="font-medium">Chaque soir à 18h00</div>
                <div className="text-sm text-slate-400">
                  Lit ton calendrier, prépare le brief de tes RDV du lendemain
                  (historique, météo, infos prospect) — direct sur WhatsApp.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-2xl">💬</div>
              <div>
                <div className="font-medium">Toute la journée</div>
                <div className="text-sm text-slate-400">
                  Disponible sur WhatsApp pour répondre à tes questions, faire
                  des devis, chercher des infos, ou pousser un lead dans ton
                  CRM à la volée.
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          Une question ? Réponds à l&apos;email d&apos;onboarding ou écris
          directement à ton agence.
        </p>
      </div>
    </main>
  );
}
