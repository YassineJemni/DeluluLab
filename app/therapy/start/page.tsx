"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function TherapyStartPage() {
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<null | { aLink: string; bLink: string }>(null);

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  async function createSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/therapy/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setLinks({ aLink: data.aLink, bLink: data.bLink });
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fff0fa] via-[#f3ecff] to-white p-6 overflow-hidden">
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

      <div className="relative mx-auto max-w-xl">
        <div className="rounded-[2rem] border border-white/50 bg-white/55 shadow-[0_20px_80px_rgba(124,58,237,0.15)] backdrop-blur-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-extrabold text-gray-900">Should We Break Up? 💀</div>
              <div className="mt-2 text-sm text-gray-700">
                Miss Delulu moderates. One at a time. Mic gets MUTED. No chaos (unless funny) 😭💅
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  ☕ couples court
                </span>
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  ⏱️ 60s turns
                </span>
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  💅 delulu moderator
                </span>
              </div>
            </div>

            <div className="hidden sm:block rounded-3xl border border-white/60 bg-gradient-to-br from-pink-200/70 to-purple-200/70 p-3 shadow-sm">
              <div className="text-xs font-extrabold text-gray-900">miss delulu</div>
              <div className="text-[11px] text-gray-700">“be so real.”</div>
            </div>
          </div>

          {!links ? (
            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={createSession}
              disabled={loading}
              className="mt-6 w-full rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 font-extrabold text-white shadow-xl disabled:opacity-60"
            >
              {loading ? "Creating…" : "Start a session"}
            </motion.button>
          ) : (
            <div className="mt-6 space-y-4">
              {/* Player A card */}
              <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/70 to-white/30 p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-gray-900">1) Your link (Player A) 💅</div>
                  <span className="rounded-full bg-pink-200/70 px-3 py-1 text-[11px] font-extrabold text-gray-900 border border-white/60">
                    host
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className="w-full rounded-2xl bg-black/5 p-3 text-xs font-semibold text-gray-900 border border-white/60"
                    readOnly
                    value={links.aLink}
                  />
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => copy(origin + links.aLink)}
                    className="rounded-2xl bg-white/80 px-4 font-extrabold text-gray-900 border border-white/60 shadow-sm"
                  >
                    Copy
                  </motion.button>
                </div>

                <a
                  className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-purple-700"
                  href={links.aLink}
                >
                  Open session →
                </a>

                <div className="mt-2 text-xs text-gray-600">
                  Open yours first, then send the invite link below 😭
                </div>
              </div>

              {/* Player B card */}
              <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/70 to-white/30 p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-gray-900">
                    2) Invite link for your partner (Player B) 😒
                  </div>
                  <span className="rounded-full bg-purple-200/70 px-3 py-1 text-[11px] font-extrabold text-gray-900 border border-white/60">
                    invite
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className="w-full rounded-2xl bg-black/5 p-3 text-xs font-semibold text-gray-900 border border-white/60"
                    readOnly
                    value={links.bLink}
                  />
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => copy(origin + links.bLink)}
                    className="rounded-2xl bg-white/80 px-4 font-extrabold text-gray-900 border border-white/60 shadow-sm"
                  >
                    Copy
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => copy(origin + links.bLink)}
                  className="mt-3 w-full rounded-3xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-3 font-extrabold text-white shadow-xl"
                >
                  Copy invite link 🔗💀
                </motion.button>

                <div className="mt-2 text-xs text-gray-600">
                  Session starts automatically when they join 😭
                </div>
              </div>

              <div className="text-center text-xs text-gray-700">
                Tip: open Player A in normal tab, Player B in incognito 😭
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-gray-700 text-center">
            for fun, not therapy ✨
          </div>
        </div>
      </div>
    </main>
  );
}