import "server-only";

/**
 * Envoi d'email avec attachment via Resend.
 *
 * Wrapper côté serveur (pas exposé à l'LLM). Utilisé par les workflows
 * qui doivent attacher des PDF, des CSV, etc.
 *
 * Resend attendant les attachments en base64 dans le champ `content`.
 */

export interface EmailAttachment {
  filename: string;
  /** Contenu binaire. Sera converti en base64 dans la requête Resend. */
  content: Buffer;
  /** Optionnel : type MIME (par défaut deviné depuis l'extension) */
  contentType?: string;
}

export interface SendEmailWithAttachmentInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailWithAttachmentResult {
  ok: boolean;
  messageId?: string;
  reason?: string;
}

export async function sendEmailWithAttachment(
  input: SendEmailWithAttachmentInput,
): Promise<SendEmailWithAttachmentResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("placeholder")) {
    console.warn(
      `[email] RESEND_API_KEY manquante — email simulé. To: ${input.to}, attachments: ${input.attachments?.length ?? 0}`,
    );
    return {
      ok: false,
      reason: "RESEND_API_KEY missing — email not sent (dev/demo mode).",
    };
  }

  const payload: Record<string, unknown> = {
    // Default = domaine pré-vérifié Resend (utilisable sans config DNS).
    // À remplacer par un vrai domaine custom (ex: noreply@kizzo.fr) une
    // fois qu'on l'aura vérifié sur resend.com/domains.
    from: input.from ?? "Agent IA <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;

  if (input.attachments && input.attachments.length > 0) {
    payload.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      // Resend détecte le type via filename par défaut ; on passe contentType
      // explicite si fourni pour les cas ambigus.
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[email] échec envoi (status ${res.status}) :`,
        body.slice(0, 300),
      );
      return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    console.log(
      `[email] envoyé to=${input.to} attachments=${input.attachments?.length ?? 0} id=${data.id}`,
    );
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
