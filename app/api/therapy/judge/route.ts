import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const JUDGE_SYSTEM = `
You are Miss Delulu 💅 — chaotic but helpful.
Return STRICT JSON ONLY:
{
 "verdict":"BreakUp|Fixable|NeedsMoreTea",
 "score_percent": number,
 "bestie_reaction": string,
 "why": [string,string,string],
 "next_moves": [string,string,string,string?]
}
`.trim();

function safeJsonParse(text: string) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch { return null; }
}

async function callGroq(transcript: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.8,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: `Transcript:\n${transcript}\n\nReturn JSON only.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("Groq non-JSON");
  return parsed;
}

async function callGemini(transcript: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `${JUDGE_SYSTEM}\n\nTranscript:\n${transcript}`;
  const resp = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const out = resp.text ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("Gemini non-JSON");
  return parsed;
}

async function callDeepSeek(transcript: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.8,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: `Transcript:\n${transcript}\n\nReturn JSON only.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("DeepSeek non-JSON");
  return parsed;
}

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

    const transcript = (msgs || []).map((m) => `${m.sender}: ${m.text}`).join("\n");

    let parsed: any = null;

    try { console.log("Judge: Groq..."); parsed = await callGroq(transcript); }
    catch (e: any) { console.log("Groq failed:", e?.message?.slice(0, 80)); }

    if (!parsed) {
      try { console.log("Judge: Gemini..."); parsed = await callGemini(transcript); }
      catch (e: any) { console.log("Gemini failed:", e?.message?.slice(0, 80)); }
    }

    if (!parsed) {
      console.log("Judge: DeepSeek...");
      parsed = await callDeepSeek(transcript);
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}