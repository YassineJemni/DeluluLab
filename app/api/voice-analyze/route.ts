import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeJsonParse(text: string) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const ANALYZE_SYSTEM = `
You are "Miss Delulu" 💅 — chaotic, funny, Gen-Z bestie energy analyzing a VOICE NOTE.
Tone: roast-y but affectionate, dramatic, meme-y, short punchy lines.
You are NOT a therapist. This is for fun. Still: be safe and respectful.

TASK:
Listen to the audio and estimate the speaker’s “delulu energy” based on:
1) Speaking speed (fast = spiraling, slow = unbothered)
2) Pitch variation (dramatic highs/lows = delulu energy)
3) Chaos level (jumping topics, contradictions, rant loops)
4) Catchphrases / filler words (“like”, “literally”, “okay but”, “and I was like”, etc.)

SCORING:
- 0–30%: Surprisingly Grounded (verdict: "Grounded")
- 31–74%: Delulu Detected (verdict: "Delulu")
- 75–100%: Critically Delulu (verdict: "CriticallyDelulu")

STYLE RULES:
- Reaction should feel like a viral TikTok caption + bestie roast.
- Use slang naturally: "bestie", "girl", "be so real", "the math is not mathing", "stand up", "slay", "it’s giving", "vibes", "delulu".
- Use emojis but not spam:
  - reaction: 2–5 emojis
  - include 😭 or 🤡 when verdict is Delulu/CriticallyDelulu
  - include 🚨 when verdict is CriticallyDelulu
- Titles must be meme headlines (4–7 words). Example vibe:
  “Girl The Math Is Not Mathing”
  “This Is Peak Delulu Energy”
  “The Spiral Is Spiraling”

IMPORTANT ACCURACY RULE (NO HALLUCINATIONS):
- Do NOT claim exact phrases unless you are confident you heard them.
- If you are not confident about exact wording, do NOT fake quotes.
- Instead, either:
  (A) return caught_saying as [] and say in breakdown.catchphrases: "Couldn’t catch exact phrases clearly"
  OR
  (B) include vibe phrases but clearly label them as "vibe phrases" (NOT quotes).

NEXT MOVES STYLE:
- Provide exactly 3 next_moves.
- Each move must be 2–3 sentences (not one sentence).
- Each move must include:
  • one funny/chaotic bestie line
  • one practical suggestion
- No stalking, spying, hacking, tracking, harassment, threats, revenge.

OUTPUT:
Return STRICT JSON only. No extra text. Use this exact schema:

{
  "delulu_score": number,
  "verdict": "Grounded|Delulu|CriticallyDelulu",
  "title": string,
  "reaction": string,
  "tiktok_caption": string,
  "archetype": "Detective Era|Hopeless Romantic|Spiral Queen|Unbothered Icon|Anxious Analyst",
  "bestie_meter": [string, string, string],
  "breakdown": {
    "speed": string,
    "pitch": string,
    "chaos": string,
    "catchphrases": string
  },
  "caught_saying": [string],
  "next_moves": [string, string, string]
}
`.trim();

// ── Transcribe with Groq Whisper ──────────────────────────────────────────────
async function transcribeWithGroq(audioFile: File): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const form = new FormData();
  form.append("file", audioFile, audioFile.name || "voice.wav");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("language", "en");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq transcription error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return String(json?.text || "").trim();
}

// ── Analyze with Groq Chat (llama) ────────────────────────────────────────────
async function analyzeWithGroq(transcript: string): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.8,
      messages: [
        { role: "system", content: ANALYZE_SYSTEM },
        { role: "user", content: `TRANSCRIPT:\n${transcript}\n\nReturn JSON only.` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq chat error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("Groq returned non-JSON: " + out.slice(0, 200));
  return parsed;
}

// ── Analyze with DeepSeek (fallback) ─────────────────────────────────────────
async function analyzeWithDeepSeek(transcript: string): Promise<any> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");

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
        { role: "system", content: ANALYZE_SYSTEM },
        { role: "user", content: `TRANSCRIPT:\n${transcript}\n\nReturn JSON only.` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const out = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(out);
  if (!parsed) throw new Error("DeepSeek returned non-JSON: " + out.slice(0, 200));
  return parsed;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audioFile = form.get("audio") as File | null;
    const duration = String(form.get("duration") || "0");

    console.log("=== VOICE ANALYZE (Groq + DeepSeek fallback) ===");
    console.log("Size:", audioFile?.size, "| Type:", audioFile?.type, "| Duration:", duration + "s");

    if (!audioFile) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }
    if (audioFile.size < 1500) {
      return NextResponse.json(
        { error: "Audio too short — speak for at least 2 seconds 😭" },
        { status: 400 }
      );
    }

    // ── STEP 1: Transcribe with Groq Whisper ──────────────────────────────────
    let transcript = "";
    try {
      console.log("Transcribing with Groq Whisper...");
      transcript = await transcribeWithGroq(audioFile);
      console.log("Transcript:", transcript.slice(0, 200));
    } catch (e: any) {
      console.log("Groq transcription failed:", e?.message?.slice(0, 200));
      return NextResponse.json({
        delulu_score: 50,
        verdict: "Delulu",
        title: "Mic Check Failed 😭",
        reaction: "Bestie the transcription failed. Check your GROQ_API_KEY and try again 💅",
        breakdown: {
          speed: "Could not transcribe",
          pitch: "Could not transcribe",
          chaos: "Could not transcribe",
          catchphrases: "Could not transcribe",
        },
        caught_saying: [],
        next_moves: [
          "Check GROQ_API_KEY in .env.local",
          "Make sure mic recorded properly",
          "Try recording again",
        ],
        transcript: "",
        error: e?.message,
      });
    }

    if (!transcript || transcript.length < 3) {
      return NextResponse.json({
        delulu_score: 50,
        verdict: "Delulu",
        title: "Couldn't Hear You Bestie 😭",
        reaction: "The mic picked up nothing. Speak closer, louder, and try again 💅",
        breakdown: {
          speed: "No audio detected",
          pitch: "No audio detected",
          chaos: "No audio detected",
          catchphrases: "No audio detected",
        },
        caught_saying: [],
        next_moves: [
          "Speak closer to the mic",
          "Make sure mic permission is allowed",
          "Try a quieter room",
        ],
        transcript: "",
      });
    }

    // ── STEP 2: Analyze — Groq first, DeepSeek fallback ───────────────────────
    let parsed: any = null;

    // Try Groq chat first
    try {
      console.log("Analyzing with Groq (llama-3.3-70b)...");
      parsed = await analyzeWithGroq(transcript);
      console.log("✅ Groq verdict:", parsed?.verdict, parsed?.delulu_score + "%");
    } catch (e: any) {
      console.log("Groq analyze failed, trying DeepSeek:", e?.message?.slice(0, 100));
    }

    // Fallback to DeepSeek
    if (!parsed) {
      try {
        console.log("Analyzing with DeepSeek fallback...");
        parsed = await analyzeWithDeepSeek(transcript);
        console.log("✅ DeepSeek verdict:", parsed?.verdict, parsed?.delulu_score + "%");
      } catch (e: any) {
        console.log("DeepSeek also failed:", e?.message?.slice(0, 100));
        throw new Error("Both Groq and DeepSeek failed to analyze");
      }
    }

    // Attach real transcript
    parsed.transcript = transcript;

    // Safety: only keep caught_saying phrases that actually appear in transcript
    if (Array.isArray(parsed.caught_saying)) {
      parsed.caught_saying = parsed.caught_saying
        .map((s: any) => String(s))
        .filter((s: string) => {
          const needle = s.replace(/["']/g, "").trim().toLowerCase();
          return needle.length >= 2 && transcript.toLowerCase().includes(needle);
        })
        .slice(0, 6);
    } else {
      parsed.caught_saying = [];
    }

    return NextResponse.json(parsed);

  } catch (e: any) {
    console.log("=== ROUTE CRASHED ===", e?.message);
    return NextResponse.json(
      {
        delulu_score: 50,
        verdict: "Delulu",
        title: "The Lab Is Glitching 😭",
        reaction: "Bestie the AI had a moment. Try again — the delulu check must go on.",
        breakdown: {
          speed: "Could not analyze",
          pitch: "Could not analyze",
          chaos: "Could not analyze",
          catchphrases: "Could not analyze",
        },
        caught_saying: [],
        next_moves: [
          "Try recording again",
          "Make sure mic is working",
          "Spill the tea one more time",
        ],
        transcript: "",
        error: e?.message ?? "Unknown error",
      },
      { status: 200 }
    );
  }
}