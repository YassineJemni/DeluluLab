import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  const { data: s, error } = await supabaseAdmin
    .from("therapy_sessions")
    .select("turn, status")
    .eq("id", sessionId)
    .single();

  if (error || !s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (s.status !== "active") return NextResponse.json({ error: "Session ended" }, { status: 400 });

  const next = s.turn === "A" ? "B" : "A";
  const endsAt = new Date(Date.now() + 60_000).toISOString();

  const { error: upErr } = await supabaseAdmin
    .from("therapy_sessions")
    .update({ turn: next, phase: "round", turn_ends_at: endsAt })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const deluluLine =
    next === "A"
      ? "Okayyy bestie 💅 your turn. 60 seconds. GO 😭"
      : "Alright sir 😒 your turn. 60 seconds. Don’t lie.";

  await supabaseAdmin.from("therapy_messages").insert({
    session_id: sessionId,
    sender: "DELULU",
    text: deluluLine,
  });

  await pusherServer.trigger(`therapy-${sessionId}`, "turn-changed", { turn: next, endsAt });
  await pusherServer.trigger(`therapy-${sessionId}`, "new-message", {
    sender: "DELULU",
    text: deluluLine,
    ts: Date.now(),
  });

  return NextResponse.json({ ok: true, turn: next, endsAt });
}