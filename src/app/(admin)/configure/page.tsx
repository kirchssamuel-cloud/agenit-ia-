"use client";

import { useState } from "react";

interface ConfigureResponse {
  success: boolean;
  webhookUrl?: string;
  webhookMethod?: string;
  sandboxNumber?: string;
  joinCode?: string;
  message?: string;
  error?: string;
  twilioCode?: number;
  moreInfo?: string;
}

export default function ConfigurePage() {
  const [status, setStatus] = useState<ConfigureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  async function configure() {
    setLoading(true);
    setStatus(null);

    try {
      const body = customUrl.trim() ? { webhookUrl: customUrl.trim() } : {};
      const res = await fetch("/api/admin/configure-twilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ConfigureResponse;
      setStatus(data);
    } catch (err) {
      setStatus({ success: false, error: (err as Error).message });
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Configuration Twilio</h1>
        <p className="text-slate-400 mb-8">
          Configure le webhook WhatsApp Sandbox en 1 clic, sans passer par la
          console Twilio.
        </p>

        <div className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Webhook URL</h2>
          <p className="text-sm text-slate-400 mb-3">
            Par défaut :{" "}
            <code className="text-[#F97316]">
              https://agenit-ia.vercel.app/api/webhooks/whatsapp
            </code>
            <br />
            Tu peux personnaliser si tu déploies ailleurs :
          </p>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://ton-domaine.com/api/webhooks/whatsapp"
            className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 mb-4 focus:border-[#F97316] focus:outline-none"
          />

          <button
            onClick={configure}
            disabled={loading}
            className="w-full bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Configuration en cours…" : "Configurer le webhook"}
          </button>
        </div>

        {status && (
          <div
            className={`rounded-[20px] p-6 border ${
              status.success
                ? "bg-green-950/40 border-green-700"
                : "bg-red-950/40 border-red-700"
            }`}
          >
            <div className="font-semibold mb-2">
              {status.success ? "✅ Configuré" : "❌ Erreur"}
            </div>
            {status.success ? (
              <ul className="text-sm space-y-1 text-slate-300">
                <li>
                  <span className="text-slate-500">Webhook :</span>{" "}
                  <code className="text-[#F97316]">{status.webhookUrl}</code>
                </li>
                <li>
                  <span className="text-slate-500">Méthode :</span>{" "}
                  {status.webhookMethod}
                </li>
                {status.sandboxNumber && (
                  <li>
                    <span className="text-slate-500">Numéro sandbox :</span>{" "}
                    {status.sandboxNumber}
                  </li>
                )}
                {status.joinCode && (
                  <li>
                    <span className="text-slate-500">Code &quot;join&quot; :</span>{" "}
                    <code>{status.joinCode}</code>
                  </li>
                )}
              </ul>
            ) : (
              <div className="text-sm text-red-300">
                <div>{status.error}</div>
                {status.twilioCode && (
                  <div className="mt-1 opacity-70">
                    Code Twilio : {status.twilioCode}
                  </div>
                )}
                {status.moreInfo && (
                  <a
                    href={status.moreInfo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#F97316] hover:underline mt-1 inline-block"
                  >
                    Voir docs Twilio
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-[#1E293B] border border-slate-700 rounded-[20px] p-6">
          <h3 className="font-semibold mb-3">Après configuration</h3>
          <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2">
            <li>
              Sur WhatsApp, envoie <code className="text-[#F97316]">join porche roulant</code> au{" "}
              <code className="text-[#F97316]">+1 415 523 8886</code> (si pas
              déjà fait).
            </li>
            <li>
              Envoie ensuite n&apos;importe quel message au sandbox.
            </li>
            <li>
              L&apos;agent doit te répondre dans les 5 secondes.
            </li>
          </ol>
          <p className="text-xs text-slate-500 mt-3">
            ⚠️ Note : le kill switch sur sendWhatsAppMessage est encore actif
            (PR #32). Pour autoriser l&apos;agent à répondre, faut le retirer
            d&apos;abord.
          </p>
        </div>
      </div>
    </div>
  );
}
