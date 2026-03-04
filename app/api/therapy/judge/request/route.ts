import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const { sessionId, role } = await req.json();

  if (role !== "A" && role !== "B") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // reset judge flow; requester auto-accepts
  const patch =
    role === "A"
      ? { judge_requested: true, judge_accept_a: true, judge_accept_b: false, judge_result: null }
      : { judge_requested: true, judge_accept_a: false, judge_accept_b: true, judge_result: null };

  const { error } = await supabaseAdmin.from("therapy_sessions").update(patch).eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await pusherServer.trigger(`therapy-${sessionId}`, "judge-requested", {
    requested: true,
    a: role === "A",
    b: role === "B",
  });

  return NextResponse.json({ ok: true });
}