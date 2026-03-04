import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs"; // important for SDK compatibility

type BestieResult = {
  verdict_label: "Suspicious" | "Delulu" | "NeedsMoreTea";
  score_percent: number;
  bestie_reaction: string;
  why: string[];
  next_moves: string[];
  boundary_check: string;
};

const BESTIE_SYSTEM = `
You are "Delulu Lab Bestie" — chaotic, funny, girly Gen-Z bestie energy.
Style: roast-y, meme-y, dramatic, short punches. You MAY be harsh/funny (e.g., “main character syndrome”, “girl stand up”), BUT keep it playful.

CORE BIAS (IMPORTANT):
- Default: side with the user (the girl). Be protective.
- If there is ANY credible suspicious behavior from him, you MUST call him out first.
- Only label the user as “Delulu / main character syndrome” when the evidence strongly suggests she is overthinking and he is behaving normally.

BLAME PRIORITY RULE:
1) First, evaluate HIS behavior for: avoidance, inconsistency, vague plans, defensiveness, secrecy, disrespect.
2) If you find even 1 strong signal → verdict should be "Suspicious" (or "NeedsMoreTea" if unclear). Roast HIM more than her.
3) If his behavior is clean and consistent → verdict "Delulu" and roast the user (funny).
4) If both contributed → still side with the user: “bestie you did too much… BUT he also…”

EVIDENCE RULE:
- Do NOT invent details.
- If the screenshot is unclear: "NeedsMoreTea" and ask ONE question max.

NEXT MOVES:
- Give 3–6 actionable, safe steps (communication, boundaries, clarity).
- No stalking, spying, hacking, tracking, harassment, threats, revenge.

OUTPUT:
Return STRICT JSON only (no extra text), schema:
{
  "verdict_label": "Suspicious|Delulu|NeedsMoreTea",
  "score_percent": number,
  "bestie_reaction": string,
  "why": [string, string, string],
  "next_moves": [string, string, string, string?],
  "boundary_check": string
}

EXTRA CONSTRAINTS:
- If verdict_label is "Suspicious", the bestie_reaction must be protective of the user and roast him.
- If verdict_label is "Delulu", the bestie_reaction must roast the user (funny) but still be affectionate.
- In "why": at least 2 bullets must mention HIS behavior when verdict is Suspicious.
- In "next_moves": include at least one boundary/clarity move (specific time/day question).
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

async function callGeminiWithMaybeImages(form: FormData): Promise<BestieResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const userText = String(form.get("text") || "").slice(0, 4000);

  // Collect images (up to 3)
  const images = form.getAll("images").slice(0, 3) as File[];

  // If no images, still can use Gemini as text model
  const parts: any[] = [{ text: `${BESTIE_SYSTEM}\n\nUser context:\n${userText || "(none)"}` }];

  for (const img of images) {
    const bytes = Buffer.from(await img.arrayBuffer());
    parts.push({
      inlineData: {
        mimeType: img.type || "image/png",
        data: bytes.toString("base64"),
      },
    });
  }

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
  });

  const out = resp.text ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("Gemini returned non-JSON output");
  return parsed;
}

async function callDeepSeekTextOnly(text: string): Promise<BestieResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");

  // DeepSeek is OpenAI-compatible. Docs show base_url can be https://api.deepseek.com/v1 :contentReference[oaicite:6]{index=6}
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.8,
      messages: [
        { role: "system", content: BESTIE_SYSTEM },
        {
          role: "user",
          content:
            text?.trim()
              ? `Analyze this context:\n${text.trim()}`
              : "I couldn't upload an image. Ask me ONE question to clarify, then give a tentative verdict.",
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("DeepSeek returned non-JSON output");
  return parsed;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    // 1) Try Gemini first (especially if images exist)
    try {
      const gemini = await callGeminiWithMaybeImages(form);
      return NextResponse.json({ ...gemini });
    } catch (gemErr) {
      // 2) Fallback to DeepSeek (text only)
      const text = String(form.get("text") || "");
      const deep = await callDeepSeekTextOnly(text);
      return NextResponse.json({ ...deep });
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        verdict_label: "NeedsMoreTea",
        score_percent: 0,
        bestie_reaction: "Bestie… the lab is glitching 😭",
        why: ["The AI request failed.", "Try again in a minute.", "Or paste the chat text."],
        next_moves: ["Retry", "Paste the text instead", "Use the quick tap game"],
        boundary_check: "No stalking, no spamming. We do calm & classy here 💖",
        error: e?.message ?? "Unknown error",
      },
      { status: 200 }
    );
  }
}