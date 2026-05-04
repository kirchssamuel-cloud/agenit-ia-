import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readGmailInboxTool } from "@/agent/tools/read-gmail-inbox";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }

  const query =
    request.nextUrl.searchParams.get("q") ?? "newer_than:7d";
  const maxResults = Number(
    request.nextUrl.searchParams.get("max") ?? "5",
  );

  const logs: { level: string; message: string; data?: unknown }[] = [];
  try {
    const out = await readGmailInboxTool.execute(
      { query, maxResults, includeAttachments: false },
      {
        clientId,
        runId: randomUUID(),
        log: (level, message, data) => logs.push({ level, message, data }),
      },
    );
    return NextResponse.json({
      ok: true,
      account: out.account,
      messageCount: out.messages.length,
      messages: out.messages.map((m) => ({
        from: m.from,
        subject: m.subject,
        date: m.date,
        snippet: m.snippet,
        attachments: m.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
        })),
      })),
      logs,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, logs },
      { status: 500 },
    );
  }
}
