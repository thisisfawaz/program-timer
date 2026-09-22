import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { programId?: string; kind?: string };
    const programId = body.programId;
    const kind = body.kind === "live" ? "live" : "control";
    if (!programId) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createClient();
    await supabase.from("presence").upsert(
      { program_id: programId, kind, last_seen: new Date().toISOString(), open: false },
      { onConflict: "program_id,kind" },
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
