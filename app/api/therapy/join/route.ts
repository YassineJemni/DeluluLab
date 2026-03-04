import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const { sessionId, token } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("therapy_sessions")
    .select("id, a_token, b_token, turn, phase, status, a_joined, b_joined, turn_ends_at")
    .eq("id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const role =
    token === data.a_token ? "A" :
    token === data.b_token ? "B" :
    null;

  if (!role) return NextResponse.json({ error: "Invalid link" }, { status: 401 });

  // mark joined
  const patch: any = {};
  if (role === "A" && !data.a_joined) patch.a_joined = true;
  if (role === "B" && !data.b_joined) patch.b_joined = true;

  let aJoined = data.a_joined;
  let bJoined = data.b_joined;

  if (Object.keys(patch).length) {
    const { data: updated } = await supabaseAdmin
      .from("therapy_sessions")
      .update(patch)
      .eq("id", sessionId)
      .select("a_joined, b_joined, turn, status, phase, turn_ends_at")
      .single();

    if (updated) {
      aJoined = updated.a_joined;
      bJoined = updated.b_joined;
    }
  }

  // announce join
  await pusherServer.trigger(`therapy-${sessionId}`, "presence", {
    a_joined: aJoined,
    b_joined: bJoined,
  });

  // if both joined and session active and no timer yet -> START
  if (data.status === "active" && aJoined && bJoined && !data.turn_ends_at) {
    const endsAt = new Date(Date.now() + 60_000).toISOString();

    await supabaseAdmin
      .from("therapy_sessions")
      .update({ turn: "A", phase: "round", turn_ends_at: endsAt })
      .eq("id", sessionId);

    const startLine = "Both of you are here 😭 Rules: one talks, one is muted. Player A first 💅";

    await supabaseAdmin.from("therapy_messages").insert({
      session_id: sessionId,
      sender: "DELULU",
      text: startLine,
    });

    await pusherServer.trigger(`therapy-${sessionId}`, "turn-changed", { turn: "A", endsAt });
    await pusherServer.trigger(`therapy-${sessionId}`, "new-message", {
      sender: "DELULU",
      text: startLine,
      ts: Date.now(),
    });
  }

  return NextResponse.json({
    role,
    turn: data.turn,
    phase: data.phase,
    status: data.status,
    a_joined: aJoined,
    b_joined: bJoined,
    turn_ends_at: data.turn_ends_at,
  });
}