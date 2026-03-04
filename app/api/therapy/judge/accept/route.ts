import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { pusherServer } from "@/lib/pusher-server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

function safeSliceJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Non-JSON output");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  const { sessionId, role } = await req.json();

  const patch = role === "A" ? { judge_accept_a: true } : { judge_accept_b: true };

  const { data: s, error } = await supabaseAdmin
    .from("therapy_sessions")
    .update(patch)
    .eq("id", sessionId)
    .select("judge_accept_a, judge_accept_b, judge_result")
    .single();

  if (error || !s) return NextResponse.json({ error: error?.message || "Not found" }, { status: 500 });

  // If already computed, just return
  if (s.judge_result) return NextResponse.json({ ok: true, result: s.judge_result });

  // If both accepted, compute ONCE
  if (s.judge_accept_a && s.judge_accept_b) {
    const { data: msgs, error: msgErr } = await supabaseAdmin
      .from("therapy_messages")
      .select("sender,text,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(120);

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    const transcript = (msgs || []).map((m) => `${m.sender}: ${m.text}`).join("\n");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are Miss Delulu 💅 — chaotic but helpful.
Return STRICT JSON ONLY:
{
 "verdict":"BreakUp|Fixable|NeedsMoreTea",
 "score_percent": number,
 "bestie_reaction": string,
 "why": [string,string,string],
 "next_moves": [string,string,string,string?]
}
Transcript:
${transcript}
`.trim();

    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const parsed = safeSliceJson(resp.text ?? "");

    // store result in session so BOTH see same output
    await supabaseAdmin.from("therapy_sessions").update({ judge_result: parsed }).eq("id", sessionId);

    // broadcast to both clients
    await pusherServer.trigger(`therapy-${sessionId}`, "judge-result", parsed);

    return NextResponse.json({ ok: true, result: parsed });
  }

  // not both accepted yet
  return NextResponse.json({ ok: true, waiting: true });
}