import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Folder,
  Users,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

/**
 * /client-area/connections?clientId=<UUID>
 *
 * Page de gestion des intégrations du client (server-rendered).
 *
 * Affiche pour chaque service connecté :
 *  - statut (✅ connecté avec quel compte / ❌ pas connecté)
 *  - liste des permissions accordées
 *  - bouton Connecter (redirige vers OAuth) ou Déconnecter (POST /api/integrations/disconnect)
 *
 * Charte Kizzo : navy #0F172A + orange #F97316.
 */
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    status?: string;
    provider?: string;
    google?: string;
    oauth_error?: string;
  }>;
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
          <h1 className="text-2xl font-semibold mb-3">Lien invalide</h1>
          <p className="text-slate-300 mb-6">
            Cette URL est incomplète. Vérifie ton lien d&apos;espace client.
          </p>
          <Link href="/signup" className="text-[#F97316] hover:underline">
            S&apos;inscrire
          </Link>
        </div>
      </main>
    );
  }

  // Charge le token Google (1 seul token couvre Gmail + Calendar + Drive + Contacts
  // car FULL_GOOGLE_SCOPES est demandé en bloc à l'OAuth).
  const googleToken = await getOAuthToken(clientId, "google");
  const googleConnected = Boolean(googleToken?.accessToken);

  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <Link
          href={`/client-area?clientId=${clientId}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"
        >
          <ArrowLeft size={16} /> Retour à mon espace
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Mes connexions
          </h1>
          <p className="text-slate-400">
            Gère les services auxquels ton agent IA a accès.
          </p>
        </div>

        {/* Feedback bandeau après action */}
        {params.google === "connected" && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-emerald-300">
                Google connecté ✨
              </div>
              <p className="text-sm text-slate-400">
                Ton agent a maintenant accès à Gmail, Calendar, Drive et Contacts.
              </p>
            </div>
          </div>
        )}
        {params.status === "disconnected" && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-emerald-300">
                {params.provider === "google" ? "Google" : params.provider}{" "}
                déconnecté
              </div>
              <p className="text-sm text-slate-400">
                Ton agent n&apos;a plus accès à ce service. Tu peux te
                reconnecter à tout moment.
              </p>
            </div>
          </div>
        )}
        {(params.status === "error" || params.oauth_error) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-300">
                Une erreur est survenue
              </div>
              <p className="text-sm text-slate-400">
                {params.oauth_error
                  ? decodeURIComponent(params.oauth_error).slice(0, 200)
                  : "Réessaie ou contacte ton agence si le problème persiste."}
              </p>
            </div>
          </div>
        )}

        {/* Carte Google */}
        <div className="bg-[#1E293B] rounded-[20px] p-6 sm:p-8 mb-6 border border-slate-700">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">📧</div>
              <div>
                <h2 className="text-xl font-bold">Google</h2>
                <p className="text-sm text-slate-400">
                  {googleConnected ? (
                    <>
                      <span className="text-emerald-400">✅ Connecté</span>
                      {googleToken?.accountEmail && (
                        <>
                          {" "}
                          —{" "}
                          <span className="text-slate-300">
                            {googleToken.accountEmail}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500">☐ Non connecté</span>
                  )}
                </p>
              </div>
            </div>
            {googleConnected ? (
              <DisconnectButton clientId={clientId} provider="google" />
            ) : (
              <Link
                href={`/api/oauth/google/start-public?clientId=${clientId}&returnTo=/client-area/connections`}
                className="px-5 py-2 bg-[#4285F4] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Connecter
              </Link>
            )}
          </div>

          {googleConnected && (
            <div className="bg-[#0F172A] rounded-xl p-4 border border-slate-800">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                Accès autorisé
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <PermissionRow
                  icon={<Mail size={16} />}
                  label="Gmail"
                  detail="lecture + envoi + archivage"
                />
                <PermissionRow
                  icon={<Calendar size={16} />}
                  label="Calendar"
                  detail="lecture + création RDV"
                />
                <PermissionRow
                  icon={<Folder size={16} />}
                  label="Drive"
                  detail="lecture + recherche"
                />
                <PermissionRow
                  icon={<Users size={16} />}
                  label="Contacts"
                  detail="lecture + création"
                />
              </div>
            </div>
          )}

          {!googleConnected && (
            <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4 text-sm text-amber-200/90">
              <strong>Sans Google connecté</strong>, ton agent ne pourra ni lire
              tes emails, ni gérer ton calendrier, ni accéder à tes contacts ou
              fichiers Drive. Tu peux toujours lui parler — il te demandera de
              connecter au moment où il en aura besoin.
            </div>
          )}
        </div>

        {/* Sécurité */}
        <div className="bg-[#1E293B]/50 rounded-[20px] p-5 border border-slate-700/50 flex items-start gap-3">
          <ShieldCheck className="text-[#F97316] flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-slate-400">
            <strong className="text-slate-200">Sécurité.</strong> Tes tokens
            OAuth sont stockés chiffrés. Tu peux révoquer un accès à tout moment
            ici, ou directement depuis{" "}
            <Link
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-[#F97316] hover:underline"
            >
              myaccount.google.com/permissions
            </Link>
            .
          </div>
        </div>
      </div>
    </main>
  );
}

function PermissionRow({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#F97316]">{icon}</span>
      <span className="text-slate-200">
        <strong>{label}</strong>{" "}
        <span className="text-slate-500">— {detail}</span>
      </span>
    </div>
  );
}
