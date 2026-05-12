import { CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { getNumberForClient } from "@/lib/db/whatsapp";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    clientId?: string;
  }>;
}

export default async function OnboardingDonePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const clientId = sp.clientId;

  await ensureLoaded();
  const client = clientId ? getClient(clientId) : null;
  const agentNumber = clientId ? await getNumberForClient(clientId) : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white px-4">
      <div className="max-w-md w-full bg-[#1E293B] rounded-[20px] p-8 text-center shadow-xl border border-slate-700">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="text-green-400" size={64} />
        </div>
        <h1 className="text-3xl font-bold mb-3">C&apos;est branché ✅</h1>
        <p className="text-slate-300 mb-6">
          {client?.name ? `${client.name}, t` : "T"}on agent IA est prêt.
          Demain matin à 7h00, tu recevras ton premier rapport sur WhatsApp.
        </p>

        {agentNumber && (
          <div className="bg-[#0F172A] rounded-[20px] p-4 mb-6 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">
              Ton numéro WhatsApp d&apos;agent
            </div>
            <div className="flex items-center justify-center gap-2 text-lg font-mono">
              <MessageCircle className="text-[#F97316]" size={20} />
              {agentNumber.phoneNumber}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Sauvegarde-le dans tes contacts. Tu peux lui parler à tout
              moment pour des devis, des recherches, ou pousser un lead.
            </div>
          </div>
        )}

        <div className="text-left bg-[#0F172A] rounded-[20px] p-4 border border-slate-700">
          <div className="font-semibold mb-2">Prochaines étapes</div>
          <ol className="text-sm text-slate-400 space-y-2">
            <li className="flex gap-2">
              <span className="text-[#F97316] font-bold">1.</span>
              <span>
                Sauvegarde le numéro de l&apos;agent dans tes contacts WhatsApp.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#F97316] font-bold">2.</span>
              <span>
                Envoie-lui un message pour briser la glace : &quot;Salut, c&apos;est qui toi ?&quot;
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#F97316] font-bold">3.</span>
              <span>
                Demain 7h, premier rapport matin auto. Le soir, brief des RDV
                du lendemain.
              </span>
            </li>
          </ol>
        </div>

        <Link
          href="https://kizzo.fr"
          className="inline-block mt-6 text-sm text-slate-500 hover:text-[#F97316] transition-colors"
        >
          ← Fermer cette page
        </Link>
      </div>
    </main>
  );
}
