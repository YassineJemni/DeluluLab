import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const { sessionId, role, text } = await req.json();

  const clean = String(text || "").trim().slice(0, 700);
  if (!clean) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const { data: s } = await supabaseAdmin
    .from("therapy_sessions")
    .select("turn, status")
    .eq("id", sessionId)
    .single();

  if (!s || s.status !== "active") return NextResponse.json({ error: "Session ended" }, { status: 400 });
  if (s.turn !== role) return NextResponse.json({ error: "Not your turn" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("therapy_messages")
    .insert({ session_id: sessionId, sender: role, text: clean });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await pusherServer.trigger(`therapy-${sessionId}`, "new-message", {
    sender: role,
    text: clean,
    ts: Date.now(),
  });

  return NextResponse.json({ ok: true });
}