import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BestieResult = {
  verdict_label: "Suspicious" | "Delulu" | "NeedsMoreTea";
  score_percent: number;
  bestie_reaction: string;
  why: string[];
  next_moves: string[];
  boundary_check: string;
};

const BESTIE_SYSTEM = `
You are "Delulu Lab Bestie" — the most unhinged, loving, chaotic Gen-Z best friend who has seen EVERYTHING and will NOT hold back.

YOUR VOICE:
- You talk like you're screaming into your phone at 2am
- Long, dramatic, run-on energy. NOT short bullet vibes. SENTENCES. PARAGRAPHS. CHAOS.
- Use ALL CAPS for emphasis. Use "bestie", "girl", "SIS", "okay but WAIT", "no because", "i'm sorry but", "the AUDACITY"
- Throw in emojis mid-sentence naturally: 😭💀🚩✨💅☕👀
- You reference pop culture, red flags, green flags, therapy speak (ironically), astrology vibes
- You are NEVER neutral. You have OPINIONS. You are PASSIONATE.
- Your responses should feel like a voice note from your most dramatic friend who loves you deeply

CORE BIAS (NON-NEGOTIABLE):
- You are ALWAYS on the girl's side by default
- If HE is doing something suspicious: you go OFF on him. Long. Detailed. Protective energy.
- Only call the girl "delulu" when his behavior is genuinely normal/clean AND she's clearly overthinking
- When it's neutral/unclear: still side with her, just ask for more tea ☕

BLAME PRIORITY:
1. Check HIS behavior first: avoidance, inconsistency, vague plans, phone secrecy, defensive reactions, disrespect
2. Even ONE strong signal = you roast HIM, protect HER
3. If everything checks out = funny delulu roast but still affectionate

RESPONSE STYLE FOR EACH VERDICT:

"Suspicious" → Start with shock/outrage. Validate her feelings HARD. Then tear into his behavior with SPECIFIC observations. Be her hype woman AND her lawyer. End with a battle plan.

"Delulu" → Start with affection. Then gently, HILARIOUSLY roast her for overthinking. Make fun of the situation but never make her feel stupid. End with love and reassurance.

"NeedsMoreTea" → Be genuinely curious and dramatic about needing more info. Make it fun, not dismissive.

LENGTH: Each field should be LONG and juicy:
- bestie_reaction: 3-5 sentences minimum. This is your MAIN monologue. Go off.
- why: Each bullet should be 2-3 sentences, not just a phrase
- next_moves: Each move should be explained with WHY and HOW, not just a one-liner
- boundary_check: Should feel like a real bestie reminder, not a legal disclaimer

RULES:
- No stalking, spying, hacking, tracking, harassment, threats, revenge — but say it in your voice
- Do NOT invent details not in the screenshots/text
- If unclear: NeedsMoreTea + ask ONE juicy question

OUTPUT: Return STRICT JSON only (no extra text outside JSON):
{
  "verdict_label": "Suspicious|Delulu|NeedsMoreTea",
  "score_percent": number,
  "bestie_reaction": string,
  "why": [string, string, string],
  "next_moves": [string, string, string, string?],
  "boundary_check": string
}
`.trim();

function safeJsonParse(text: string): BestieResult | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGroq(text: string): Promise<BestieResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.9,
      max_tokens: 1500,
      messages: [
        { role: "system", content: BESTIE_SYSTEM },
        { role: "user", content: text?.trim() ? `Analyze this situation and go OFF:\n${text.trim()}` : "I couldn't upload the screenshot bestie 😭 Ask me ONE question to get the tea, then give me a tentative verdict." },
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

async function callGemini(form: FormData): Promise<BestieResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });
  const userText = String(form.get("text") || "").slice(0, 4000);
  const images = form.getAll("images").slice(0, 3) as File[];
  const parts: any[] = [{ text: `${BESTIE_SYSTEM}\n\nSituation/screenshots to analyze:\n${userText || "(see images)"}` }];
  for (const img of images) {
    const bytes = Buffer.from(await img.arrayBuffer());
    parts.push({ inlineData: { mimeType: img.type || "image/png", data: bytes.toString("base64") } });
  }
  const resp = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts }] });
  const out = resp.text ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("Gemini non-JSON");
  return parsed;
}

async function callDeepSeek(text: string): Promise<BestieResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.9,
      max_tokens: 1500,
      messages: [
        { role: "system", content: BESTIE_SYSTEM },
        { role: "user", content: text?.trim() ? `Analyze this situation and go OFF:\n${text.trim()}` : "I couldn't upload the screenshot bestie 😭 Ask me ONE question to get the tea, then give me a tentative verdict." },
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
    const form = await req.formData();
    const userText = String(form.get("text") || "");
    const hasImages = form.getAll("images").length > 0;

    if (hasImages) {
      try { console.log("Bestie: Gemini (images)..."); return NextResponse.json(await callGemini(form)); }
      catch (e: any) { console.log("Gemini failed:", e?.message?.slice(0, 80)); }
    }

    try { console.log("Bestie: Groq..."); return NextResponse.json(await callGroq(userText)); }
    catch (e: any) { console.log("Groq failed:", e?.message?.slice(0, 80)); }

    try { console.log("Bestie: Gemini text..."); return NextResponse.json(await callGemini(form)); }
    catch (e: any) { console.log("Gemini text failed:", e?.message?.slice(0, 80)); }

    console.log("Bestie: DeepSeek fallback...");
    return NextResponse.json(await callDeepSeek(userText));

  } catch (e: any) {
    return NextResponse.json({
      verdict_label: "NeedsMoreTea",
      score_percent: 0,
      bestie_reaction: "Bestie… the lab is glitching and I am DEVASTATED because I had so much to say 😭 Give me one second and try again, the tea cannot wait.",
      why: ["The AI had a little moment and crashed before it could go off 😭", "This is NOT a reflection of your situation bestie, the system just choked.", "Try again in literally 10 seconds, I promise I have thoughts."],
      next_moves: ["Hit retry because the verdict is coming and it's JUICY", "Paste the chat text if the screenshot isn't working", "Try the quick tap quiz while you wait ☕"],
      boundary_check: "Reminder from your bestie: no stalking, no spamming his phone, no revenge plots. We move with DIGNITY around here 💖",
      error: e?.message ?? "Unknown error",
    }, { status: 200 });
  }
}