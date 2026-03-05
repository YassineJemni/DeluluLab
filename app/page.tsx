"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

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

      {/* Top Nav */}
      <header className="relative z-10 w-full">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            {/* LOGO TILE */}
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500">
              <Image src="/delululab.png" alt="Delulu Lab logo" fill className="object-contain scale-[1.40]" />
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
                delulu lab
              </h1>
              <p className="text-xs text-gray-700">
                🧪 scientifically proving he’s suspicious
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur"
            >
              💖 bestie mode
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <section className="relative z-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-7 px-6 pb-14 pt-4 lg:grid-cols-2 lg:gap-10 lg:pt-10">
          {/* Left: hero */}
          <div className="flex flex-col justify-center">
            {/* sticker chips */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur">
                ☕ gossip scanner
              </span>
              <span className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur">
                🎀 cute
              </span>
              <span className="rounded-full border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur">
                ⚡ fast
              </span>
            </div>

            <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Spill the tea.
              <span className="block bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                We’ll run the numbers.
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-800 sm:text-lg">
              Tap your way through a 30-second scan. Get a dramatic, screenshot-worthy
              result. No sign up. Just vibes.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <motion.button
                onClick={() => router.push("/scan/roster")}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-6 py-4 text-base font-extrabold text-white shadow-xl"
              >
                <span className="relative z-10">Spill the tea ☕</span>
                <span className="pointer-events-none absolute inset-0 opacity-25 blur-xl bg-white" />
              </motion.button>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/therapy/start")}
                className="rounded-3xl border border-white/60 bg-white/55 px-6 py-4 text-base font-extrabold text-gray-900 shadow-md backdrop-blur"
              >
                Couples court 💀
              </motion.button>
            </div>

            <p className="mt-3 text-xs text-gray-700">for fun, not therapy ✨</p>

            {/* mini social proof */}
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
              <MiniStat title="30s" desc="quick scan" />
              <MiniStat title="0" desc="signup" />
              <MiniStat title="∞" desc="drama" />
            </div>
          </div>

          {/* Right: App-like panel */}
          <div className="rounded-[2rem] border border-white/50 bg-white/55 p-5 shadow-[0_20px_80px_rgba(124,58,237,0.15)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold tracking-wide text-gray-900">
                pick a scan ✨
              </h3>
              <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11px] font-extrabold text-gray-800">
                v1
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ToolCard
                title="Roster Scan"
                emoji="📱"
                desc="is he texting 5 girls?"
                tag="hot"
                onClick={() => router.push("/scan/roster")}
              />
              <ToolCard
                title="Voice Note Check"
                emoji="🎙️"
                desc="how delulu do you sound?"
                tag="hot"
                onClick={() => router.push("/scan/voice")}
              />
              <ToolCard
                title="Break Up?"
                emoji="💀"
                desc="live turn-based court"
                tag="hot"
                onClick={() => router.push("/therapy/start")}
              />
              <ToolCard title="Delusion Check" emoji="🧠" desc="am i delulu?" tag="soon" locked />
            </div>

            <div className="mt-5 rounded-3xl border border-white/60 bg-gradient-to-r from-pink-200/40 to-purple-200/40 p-4">
              <p className="text-sm text-gray-900">
                💬 <span className="font-extrabold">bestie tip:</span> keep it short.
                5 taps. then screenshot the damage.
              </p>
            </div>

            {/* bottom CTA */}
            <div className="mt-4 flex items-center justify-between rounded-3xl border border-white/60 bg-white/45 px-4 py-3">
              <div className="text-xs font-extrabold text-gray-900">new drops weekly</div>
              <div className="text-xs text-gray-700">more tools soon ✨</div>
            </div>
          </div>
        </div>

        {/* footer strip */}
        <div className="mx-auto max-w-6xl px-6 pb-10">
          <div className="rounded-[2rem] border border-white/60 bg-white/45 p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Delulu Lab</div>
                <div className="text-xs text-gray-700">
                  made for memes, not medical advice 😭
                </div>
              </div>
              <div className="flex gap-2">
                <Badge>🧪 playful</Badge>
                <Badge>🔒 no login</Badge>
                <Badge>📸 screenshotable</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniStat({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/45 p-4 shadow-sm backdrop-blur">
      <div className="text-lg font-extrabold text-gray-900">{title}</div>
      <div className="text-xs font-semibold text-gray-700">{desc}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-[11px] font-extrabold text-gray-900">
      {children}
    </span>
  );
}

function ToolCard({
  title,
  emoji,
  desc,
  tag,
  locked,
  onClick,
}: {
  title: string;
  emoji: string;
  desc: string;
  tag: "hot" | "soon";
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={locked ? undefined : { y: -2, scale: 1.01 }}
      whileTap={locked ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 450, damping: 28 }}
      className={[
        "group relative overflow-hidden rounded-3xl border p-4 text-left",
        "shadow-[0_14px_40px_rgba(124,58,237,0.10)] backdrop-blur",
        locked
          ? "opacity-60 cursor-not-allowed border-white/40 bg-white/35"
          : "border-white/60 bg-gradient-to-br from-white/70 to-white/35",
      ].join(" ")}
      disabled={locked}
    >
      {/* fun glow */}
      <div className="pointer-events-none absolute -inset-10 opacity-70 blur-2xl transition group-hover:opacity-100">
        <div className="absolute left-0 top-0 h-32 w-32 rounded-full bg-pink-400/40" />
        <div className="absolute right-0 top-6 h-36 w-36 rounded-full bg-purple-400/40" />
        <div className="absolute left-10 bottom-0 h-36 w-36 rounded-full bg-fuchsia-300/40" />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="text-3xl drop-shadow-sm">{emoji}</div>
        <span
          className={[
            "rounded-full px-2 py-1 text-[10px] font-extrabold border border-white/60",
            tag === "hot"
              ? "bg-pink-200/80 text-pink-800"
              : "bg-gray-900/10 text-gray-700",
          ].join(" ")}
        >
          {tag}
        </span>
      </div>

      <div className="relative mt-3">
        <div className="text-sm font-extrabold text-gray-900">{title}</div>
        <div className="mt-1 text-xs font-semibold text-gray-700">{desc}</div>
      </div>

      {!locked && (
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-transparent transition group-hover:ring-pink-300/40" />
      )}
    </motion.button>
  );
}