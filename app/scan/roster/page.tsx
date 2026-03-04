"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";

type Option = { label: string; score: number };
type Question = { id: string; title: string; options: Option[] };

const QUESTIONS: Question[] = [
  {
    id: "weekends",
    title: "Bestie… weekends?",
    options: [
      { label: "🌙 disappears", score: 3 },
      { label: "📸 posts stories but “busy”", score: 3 },
      { label: "💬 consistent replies", score: 0 },
    ],
  },
  {
    id: "texts",
    title: "How are his replies?",
    options: [
      { label: "⌛ hours later", score: 2 },
      { label: "😐 dry replies (k/ok)", score: 2 },
      { label: "✨ normal & present", score: 0 },
    ],
  },
  {
    id: "plans",
    title: "When you ask to meet…",
    options: [
      { label: "🌀 avoids planning", score: 3 },
      { label: "🗓️ “we’ll see” forever", score: 2 },
      { label: "✅ makes real plans", score: 0 },
    ],
  },
  {
    id: "privacy",
    title: "Phone behavior?",
    options: [
      { label: "📵 always face down", score: 2 },
      { label: "🔒 never lets it near you", score: 3 },
      { label: "😌 normal human", score: 0 },
    ],
  },
  {
    id: "girlbestie",
    title: "Girl best friend situation?",
    options: [
      { label: "🚩 “she’s just a friend” (but weird)", score: 2 },
      { label: "🤫 secret vibes", score: 3 },
      { label: "🙂 not a thing / normal", score: 0 },
    ],
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getResult(score: number, maxScore: number) {
  const pct = Math.round((score / maxScore) * 100);

  if (pct >= 75) {
    return {
      title: "📱📱📱 Roster Energy Detected",
      subtitle: "Bestie… the math is NOT mathing. It’s giving… options.",
      bullets: [
        "He moves like he has “spares.” 🚩",
        "Consistency is missing in action.",
        "Proceed with caution (and dignity).",
      ],
      pct,
      vibe: "high",
      tag: "HOT 🚩",
    } as const;
  }

  if (pct >= 45) {
    return {
      title: "👀 Suspicious Activity",
      subtitle: "Not proof… but the behavior is speaking LOUD.",
      bullets: [
        "Some signs are giving “multitasking.”",
        "You deserve clarity, not confusion.",
        "Ask for consistency and watch the reaction.",
      ],
      pct,
      vibe: "mid",
      tag: "SIDE EYE 👀",
    } as const;
  }

  return {
    title: "💚 Probably Not a Roster",
    subtitle: "Okayyy bestie… this one seems decent (for now).",
    bullets: [
      "Behavior looks normal-ish.",
      "Still: trust actions over words.",
      "Don’t ignore new red flags if they appear.",
    ],
    pct,
    vibe: "low",
    tag: "GREEN(ish) ✅",
  } as const;
}

function vibeClasses(v: "high" | "mid" | "low") {
  if (v === "high") {
    return {
      chip: "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white",
      ring: "ring-2 ring-rose-400/60",
      glow: "shadow-[0_0_0_6px_rgba(244,63,94,0.10)]",
    };
  }
  if (v === "mid") {
    return {
      chip: "bg-gradient-to-r from-amber-400 to-pink-500 text-white",
      ring: "ring-2 ring-amber-300/60",
      glow: "shadow-[0_0_0_6px_rgba(245,158,11,0.10)]",
    };
  }
  return {
    chip: "bg-gradient-to-r from-emerald-400 to-teal-500 text-white",
    ring: "ring-2 ring-emerald-300/60",
    glow: "shadow-[0_0_0_6px_rgba(16,185,129,0.10)]",
  };
}

export default function RosterScanPage() {
  // quiz state
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>(Array(QUESTIONS.length).fill(0));
  const [done, setDone] = useState(false);

  // mode state (tabs)
  const [mode, setMode] = useState<"quiz" | "upload">("quiz");

  // upload + AI state
  const [files, setFiles] = useState<File[]>([]);
  const [userText, setUserText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // fun micro-UX
  const [copied, setCopied] = useState(false);

  const maxScore = useMemo(
    () =>
      QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.score)), 0),
    []
  );

  const total = scores.reduce((a, b) => a + b, 0);
  const result = getResult(total, maxScore);
  const vibe = vibeClasses(result.vibe);

  const progress = clamp((step / QUESTIONS.length) * 100, 0, 100);

  function pick(score: number) {
    const nextScores = [...scores];
    nextScores[step] = score;
    setScores(nextScores);

    if (step === QUESTIONS.length - 1) {
      setTimeout(() => setDone(true), 140);
    } else {
      setTimeout(() => setStep((s) => s + 1), 140);
    }
  }

  function restartQuiz() {
    setScores(Array(QUESTIONS.length).fill(0));
    setStep(0);
    setDone(false);
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles(picked.slice(0, 3));
    setAiResult(null);
    setAiError(null);
  }

  async function runBestieCheck() {
    if (files.length === 0 && userText.trim().length === 0) {
      setAiError("Upload a screenshot or paste text, bestie ☕");
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const form = new FormData();
      form.append("text", userText);
      files.forEach((f) => form.append("images", f));

      const res = await fetch("/api/bestie-analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setAiResult(data);
    } catch (err: any) {
      setAiError(err?.message || "Something went wrong 😭");
    } finally {
      setAiLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#fff0fa] via-[#f3ecff] to-white">
      {/* dreamy blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-pink-400/30 blur-3xl animate-pulse" />
        <div className="absolute top-10 -right-48 h-[38rem] w-[38rem] rounded-full bg-purple-500/25 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl animate-pulse" />
      </div>

      {/* subtle grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22300%22 height=%22300%22 filter=%22url(%23n)%22 opacity=%220.4%22/%3E%3C/svg%3E')",
        }}
      />

      {/* floating Miss Delulu helper */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:block pointer-events-none absolute right-6 top-6 z-20"
      >
        <div className="rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl px-4 py-3 shadow-lg">
          <div className="text-xs font-extrabold text-gray-900">Miss Delulu</div>
          <div className="text-[11px] text-gray-700">“answer fast. don’t overthink.” 💅</div>
        </div>
      </motion.div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-10 pt-6">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <motion.div whileTap={{ scale: 0.98 }}>
            <Link
              href="/"
              className="rounded-2xl border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur"
            >
              ← back
            </Link>
          </motion.div>

          <div className="text-right">
            <div className="text-sm font-extrabold text-gray-900">Roster Scan</div>
            <div className="text-xs text-gray-700">bestie mode ☕</div>
          </div>
        </div>

        {/* progress */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/40 border border-white/60">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${done ? 100 : progress}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
          />
        </div>

        {/* mode toggle */}
        <div className="mt-5 inline-flex rounded-3xl bg-white/45 p-1 backdrop-blur border border-white/60 shadow-sm">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode("quiz")}
            className={[
              "px-4 py-2 rounded-2xl text-sm font-extrabold transition",
              mode === "quiz"
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow"
                : "text-gray-800",
            ].join(" ")}
          >
            ☕ quick tap game
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode("upload")}
            className={[
              "px-4 py-2 rounded-2xl text-sm font-extrabold transition",
              mode === "upload"
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow"
                : "text-gray-800",
            ].join(" ")}
          >
            📷 screenshot check (beta)
          </motion.button>
        </div>

        {/* content */}
        <div className="mt-6">
          {mode === "quiz" ? (
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div
                  key={QUESTIONS[step].id}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                  className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-[0_20px_80px_rgba(124,58,237,0.12)] backdrop-blur-xl"
                >
                  {/* header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-gray-700">
                        question {step + 1} / {QUESTIONS.length}
                      </div>
                      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                        {QUESTIONS[step].title}
                      </h1>
                    </div>

                    <div className="shrink-0 rounded-3xl border border-white/60 bg-gradient-to-br from-pink-200/70 to-purple-200/70 px-3 py-2 shadow-sm">
                      <div className="text-[11px] font-extrabold text-gray-900">tap fast</div>
                      <div className="text-[10px] text-gray-700">first instinct</div>
                    </div>
                  </div>

                  {/* options */}
                  <div className="mt-5 grid gap-3">
                    {QUESTIONS[step].options.map((opt) => (
                      <motion.button
                        key={opt.label}
                        onClick={() => pick(opt.score)}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 450, damping: 28 }}
                        className="group w-full rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/55 px-5 py-4 text-left font-extrabold text-gray-900 shadow-md backdrop-blur"
                      >
                        <div className="flex items-center justify-between">
                          <div>{opt.label}</div>
                          <div className="text-xs font-extrabold text-gray-700 opacity-70 group-hover:opacity-100">
                            {opt.score === 0 ? "clean ✅" : opt.score === 2 ? "hmm 👀" : "🚩"}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="mt-5 text-xs text-gray-700">
                    tip: answer fast. your first instinct is the truth 👀
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={[
                    "rounded-[2rem] border border-white/60 bg-white/55 p-6 backdrop-blur-xl",
                    vibe.glow,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={[ "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold shadow-sm", vibe.chip ].join(" ")}>
                      {result.tag} • {result.pct}% suspicious
                    </div>

                    {/* confetti-ish sparkle */}
                    <motion.div
                      initial={{ rotate: -8, scale: 0.95, opacity: 0 }}
                      animate={{ rotate: 6, scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 16 }}
                      className="rounded-3xl border border-white/60 bg-white/60 px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm"
                    >
                      ✨ verdict drop
                    </motion.div>
                  </div>

                  <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
                    {result.title}
                  </h2>
                  <p className="mt-2 text-gray-800">{result.subtitle}</p>

                  <ul className="mt-4 space-y-2 text-sm text-gray-900">
                    {result.bullets.map((b) => (
                      <li
                        key={b}
                        className={[
                          "rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/55 px-4 py-3 shadow-sm",
                          vibe.ring,
                        ].join(" ")}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <motion.button
                      onClick={copyLink}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-3xl border border-white/60 bg-white/70 px-5 py-4 font-extrabold text-gray-900 shadow-md"
                    >
                      {copied ? "copied ✅" : "📎 copy link"}
                    </motion.button>

                    <motion.button
                      onClick={restartQuiz}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-5 py-4 font-extrabold text-white shadow-xl"
                    >
                      run it again ☕
                    </motion.button>
                  </div>

                  <div className="mt-4 text-xs text-gray-700">
                    📸 screenshot this and send it to the group chat.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-[0_20px_80px_rgba(124,58,237,0.12)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900">📷 screenshot check</h2>
                  <p className="mt-2 text-sm text-gray-800">
                    bestie tip: blur names/phone numbers before uploading ✨ (we don’t store images)
                  </p>
                </div>

                <div className="shrink-0 rounded-3xl border border-white/60 bg-gradient-to-br from-pink-200/70 to-purple-200/70 px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm">
                  beta
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                {/* upload card */}
                <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/55 p-4 shadow-sm">
                  <div className="text-xs font-extrabold text-gray-700">Upload 1–3 screenshots</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onPickFiles}
                    className="mt-2 block w-full text-sm"
                  />
                  <div className="mt-2 text-xs text-gray-700">selected: {files.length} image(s)</div>
                </div>

                {/* text card */}
                <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/55 p-4 shadow-sm">
                  <div className="text-xs font-extrabold text-gray-700">
                    Optional: paste chat text (if screenshots are unclear)
                  </div>
                  <textarea
                    value={userText}
                    onChange={(e) => setUserText(e.target.value)}
                    placeholder="paste chat here…"
                    className="mt-2 w-full rounded-3xl border border-white/60 bg-white/70 p-3 text-sm font-semibold text-gray-900 shadow-sm outline-none"
                    rows={4}
                  />
                </div>

                <motion.button
                  onClick={runBestieCheck}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={aiLoading || (files.length === 0 && userText.trim().length === 0)}
                  className="w-full rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 font-extrabold text-white shadow-xl disabled:opacity-60"
                >
                  {aiLoading ? "analyzing… 🧪" : "run bestie check ☕"}
                </motion.button>

                {aiError && (
                  <div className="rounded-3xl border border-white/60 bg-white/70 p-4 text-sm font-extrabold text-gray-900 shadow-sm">
                    😭 {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="space-y-4">
                    {/* verdict */}
                    <div className="rounded-3xl border border-white/60 bg-gradient-to-r from-pink-200/90 to-purple-200/90 p-4 shadow-sm">
                      <div className="text-xs font-extrabold text-gray-900">Miss Delulu verdict</div>
                      <div className="mt-1 text-lg font-extrabold text-gray-900">
                        {aiResult.verdict_label} • {aiResult.score_percent}%
                      </div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">
                        {aiResult.bestie_reaction}
                      </div>
                    </div>

                    {/* why */}
                    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm">
                      <div className="text-xs font-extrabold text-gray-700">why</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-gray-900">
                        {aiResult.why?.map((w: string) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>

                    {/* next moves */}
                    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm">
                      <div className="text-xs font-extrabold text-gray-700">next moves</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-gray-900">
                        {aiResult.next_moves?.map((m: string) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                      <div className="mt-3 text-xs text-gray-700">{aiResult.boundary_check}</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}