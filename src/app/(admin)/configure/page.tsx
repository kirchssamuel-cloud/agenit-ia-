"use client";

import { useState } from "react";

interface ConfigureResponse {
  success: boolean;
  webhookUrl?: string;
  message?: string;
  error?: string;
  attempts?: Array<{
    endpoint: string;
    status: number;
    ok: boolean;
    error?: string;
  }>;
  manualInstructions?: {
    step1?: string;
    step2?: string;
    step3?: string;
    step4?: string;
    step5?: string;
    step6?: string;
    alternativeUrl1?: string;
    alternativeUrl2?: string;
  };
  webhookToConfigure?: string;
}

export default function ConfigurePage() {
  const [status, setStatus] = useState<ConfigureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [copied, setCopied] = useState(false);

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

  function copyUrl() {
    const url =
      status?.webhookToConfigure ??
      "https://agenit-ia.vercel.app/api/webhooks/whatsapp";
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Configuration Twilio</h1>
        <p className="text-slate-400 mb-8">
          Configure le webhook WhatsApp Sandbox.
        </p>

        <div className="bg-[#1E293B] border border-slate-700 rounded-[20px] p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Webhook URL</h2>
          <p className="text-sm text-slate-400 mb-3">
            Par défaut :{" "}
            <code className="text-[#F97316]">
              https://agenit-ia.vercel.app/api/webhooks/whatsapp
            </code>
          </p>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="(laisser vide pour utiliser le défaut)"
            className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 mb-4 focus:border-[#F97316] focus:outline-none"
          />
          <button
            onClick={configure}
            disabled={loading}
            className="w-full bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Essai en cours…" : "Tenter la configuration"}
          </button>
        </div>

        {/* Succès */}
        {status?.success && (
          <div className="bg-green-950/40 border border-green-700 rounded-[20px] p-6">
            <div className="font-semibold mb-2">✅ Configuré via API</div>
            <div className="text-sm text-slate-300">
              Webhook configuré : <code>{status.webhookUrl}</code>
            </div>
          </div>
        )}

        {/* Échec API → instructions manuelles */}
        {status && !status.success && status.manualInstructions && (
          <div className="bg-amber-950/40 border border-amber-700 rounded-[20px] p-6">
            <div className="font-semibold mb-2 text-amber-300">
              ⚠️ API Twilio non disponible — à faire manuellement (1 fois)
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Twilio a déprécié l&apos;endpoint REST en 2026. À faire en
              console UI (3 min, une seule fois).
            </p>

            {/* URL à copier */}
            <div className="bg-[#0F172A] border border-slate-700 rounded-lg p-3 mb-4 flex items-center justify-between">
              <code className="text-sm text-[#F97316] break-all">
                {status.webhookToConfigure}
              </code>
              <button
                onClick={copyUrl}
                className="ml-2 text-xs bg-[#F97316] hover:bg-orange-600 text-white px-3 py-1 rounded shrink-0"
              >
                {copied ? "Copié ✅" : "Copier"}
              </button>
            </div>

            {/* Steps */}
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>
                Va sur{" "}
                <a
                  href={status.manualInstructions.step1?.replace(
                    "Va sur ",
                    "",
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#F97316] hover:underline"
                >
                  la page WhatsApp Sandbox Twilio
                </a>
              </li>
              <li>
                {status.manualInstructions.step2}
              </li>
              <li>{status.manualInstructions.step3}</li>
              <li>
                Champ{" "}
                <strong>&quot;When a message comes in&quot;</strong>
                {" → "}
                colle l&apos;URL ci-dessus (bouton Copier)
              </li>
              <li>Method : <strong>POST</strong></li>
              <li>Clique <strong>Save</strong></li>
            </ol>

            <details className="mt-4">
              <summary className="text-xs text-slate-500 cursor-pointer">
                Debug : tentatives API
              </summary>
              <pre className="text-xs mt-2 bg-black/40 p-2 rounded overflow-auto">
                {JSON.stringify(status.attempts, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Échec sans fallback */}
        {status && !status.success && !status.manualInstructions && (
          <div className="bg-red-950/40 border border-red-700 rounded-[20px] p-6">
            <div className="font-semibold mb-2">❌ Erreur</div>
            <div className="text-sm text-red-300">{status.error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
