import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    const { data: msgs, error } = await supabaseAdmin
      .from("therapy_messages")
      .select("sender,text,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(120);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const transcript = (msgs || [])
      .map((m) => `${m.sender}: ${m.text}`)
      .join("\n");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are Miss Delulu 💅 — funny but helpful.
Decide: "BreakUp" | "Fixable" | "NeedsMoreTea"
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

    const out = resp.text ?? "";
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Non-JSON output");

    const parsed = JSON.parse(out.slice(start, end + 1));
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}