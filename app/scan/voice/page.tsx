"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";

type VoiceResult = {
  delulu_score: number;
  title: string;
  reaction: string;
  breakdown: {
    speed: string;
    pitch: string;
    chaos: string;
    catchphrases: string;
  };
  caught_saying: string[];
  verdict: "Delulu" | "Grounded" | "CriticallyDelulu";
  next_moves: string[];
  transcript?: string;
  error?: string;
};

const WAVEFORM_BARS = 40;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ---------- WAV ENCODER (mono) ----------
function encodeWavMono(float32: Float32Array, sampleRate: number) {
  // Convert Float32 [-1..1] to 16-bit PCM
  const buffer = new ArrayBuffer(44 + float32.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  let offset = 0;
  writeString(offset, "RIFF"); offset += 4;
  view.setUint32(offset, 36 + float32.length * 2, true); offset += 4;
  writeString(offset, "WAVE"); offset += 4;

  writeString(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;            // PCM fmt chunk size
  view.setUint16(offset, 1, true); offset += 2;             // audio format PCM = 1
  view.setUint16(offset, 1, true); offset += 2;             // channels = 1
  view.setUint32(offset, sampleRate, true); offset += 4;    // sample rate
  view.setUint32(offset, sampleRate * 2, true); offset += 4; // byte rate = sr * ch * 2
  view.setUint16(offset, 2, true); offset += 2;             // block align = ch * 2
  view.setUint16(offset, 16, true); offset += 2;            // bits per sample

  writeString(offset, "data"); offset += 4;
  view.setUint32(offset, float32.length * 2, true); offset += 4;

  // Write samples
  let dataOffset = 44;
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(dataOffset, int16, true);
    dataOffset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

export default function VoiceAnalyzerPage() {
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded" | "analyzing" | "result">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array(WAVEFORM_BARS).fill(0.1));
  const [permError, setPermError] = useState(false);

  // WebAudio refs
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recordingRef = useRef(false);

  // buffers
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(48000);

  // timers
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const secondsRef = useRef(0);

  const MAX_SECONDS = 60;
  const MIN_SECONDS = 2;

  function animateWaveform() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const idx = Math.floor((i / WAVEFORM_BARS) * data.length);
      return Math.max(0.08, data[idx] / 255);
    });
    setWaveform(bars);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  }

  function cleanupTimers() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
  }

  async function startRecording() {
    setError(null);
    setPermError(false);
    setResult(null);

    try {
      // Get mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // WebAudio
      const AudioContextCtor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioContextCtor();
      audioCtxRef.current = audioCtx;
      sampleRateRef.current = audioCtx.sampleRate;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      // ScriptProcessor (works across browsers, including Opera)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      chunksRef.current = [];
      recordingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!recordingRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        // copy buffer (must copy because input is reused)
        chunksRef.current.push(new Float32Array(input));
      };

      // Connect: source -> analyser (for viz) and source -> processor (for recording)
      source.connect(analyser);
      source.connect(processor);
      // Keep the graph alive in some browsers:
      processor.connect(audioCtx.destination);

      setSeconds(0);
      secondsRef.current = 0;
      setPhase("recording");
      setWaveform(Array(WAVEFORM_BARS).fill(0.1));

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) doStop();
      }, 1000);

      animFrameRef.current = requestAnimationFrame(animateWaveform);
    } catch (e) {
      setPermError(true);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopAudioGraph() {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}

    processorRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  function buildWavFromChunks(): Blob | null {
    const chunks = chunksRef.current;
    if (!chunks.length) return null;

    let totalLength = 0;
    for (const c of chunks) totalLength += c.length;

    if (totalLength < sampleRateRef.current * 0.5) {
      // less than ~0.5s
      return null;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    return encodeWavMono(merged, sampleRateRef.current);
  }

  function doStop() {
    cleanupTimers();
    recordingRef.current = false;
    setWaveform(Array(WAVEFORM_BARS).fill(0.1));

    // Stop audio processing first
    stopAudioGraph();
    stopStream();

    // Build WAV
    const wav = buildWavFromChunks();
    chunksRef.current = [];

    if (!wav) {
      setPhase("idle");
      setAudioBlob(null);
      setAudioUrl(null);
      setError("No voice captured 😭 Speak for at least 2 seconds and try again.");
      return;
    }

    // Duration guard
    if (secondsRef.current < MIN_SECONDS) {
      setPhase("idle");
      setAudioBlob(null);
      setAudioUrl(null);
      setError("Too short bestie 😭 Record 2–10 seconds minimum.");
      return;
    }

    const url = URL.createObjectURL(wav);
    setAudioBlob(wav);
    setAudioUrl(url);
    setPhase("recorded");
  }

  function reset() {
    cleanupTimers();
    recordingRef.current = false;
    stopAudioGraph();
    stopStream();
    chunksRef.current = [];

    setPhase("idle");
    setSeconds(0);
    secondsRef.current = 0;
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setResult(null);
    setError(null);
    setPermError(false);
    setWaveform(Array(WAVEFORM_BARS).fill(0.1));
  }

  async function analyze() {
    if (!audioBlob) return;

    setPhase("analyzing");
    setError(null);

    try {
      const form = new FormData();
      form.append("audio", audioBlob, "voice.wav");
      form.append("duration", String(secondsRef.current));
      form.append("mime", audioBlob.type || "audio/wav");

      const res = await fetch("/api/voice-analyze", { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.error || "Analysis failed");

      setResult(data);
      setPhase("result");
    } catch (e: any) {
      setError(e?.message || "Something went wrong 😭");
      setPhase("recorded");
    }
  }

  useEffect(() => {
    return () => {
      cleanupTimers();
      stopAudioGraph();
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoreColor =
    !result ? "from-pink-500 to-purple-500"
    : result.delulu_score >= 75 ? "from-rose-500 to-fuchsia-600"
    : result.delulu_score >= 45 ? "from-amber-400 to-pink-500"
    : "from-emerald-400 to-teal-500";

  const verdictLabel =
    !result ? ""
    : result.verdict === "CriticallyDelulu" ? "🚨 Critically Delulu"
    : result.verdict === "Delulu" ? "😭 Delulu Detected"
    : "💚 Surprisingly Grounded";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#fff0fa] via-[#f3ecff] to-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-pink-400/30 blur-3xl animate-pulse" />
        <div className="absolute top-10 -right-48 h-[38rem] w-[38rem] rounded-full bg-purple-500/25 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-5 pb-12 pt-6">
        <div className="flex items-center justify-between">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="/"
              className="rounded-2xl border border-white/60 bg-white/55 px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm backdrop-blur"
            >
              ← back
            </Link>
          </motion.div>
          <div className="text-right">
            <div className="text-sm font-extrabold text-gray-900">Voice Note Analyzer</div>
            <div className="text-xs text-gray-700">🎙️ bestie is listening</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 rounded-[2rem] border border-white/60 bg-white/55 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.13)] backdrop-blur-xl"
            >
              <div className="text-center">
                <div className="text-5xl mb-3">🎙️</div>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Voice Note Analyzer</h1>
                <p className="mt-3 text-gray-700 text-sm leading-relaxed max-w-sm mx-auto">
                  Record yourself explaining the situation. Miss Delulu analyzes the transcript (no made-up quotes).
                  <span className="font-extrabold text-gray-900"> Min 2s, max 60s.</span>
                </p>
              </div>

              <div className="mt-6 rounded-3xl border border-white/60 bg-gradient-to-r from-pink-100/60 to-purple-100/60 p-4 text-sm text-gray-800">
                💅 <span className="font-extrabold">tip:</span> speak close to the mic. quiet room.
              </div>

              {permError && (
                <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  😭 Mic access denied. Allow microphone in Opera settings and reload.
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  😭 {error}
                </div>
              )}

              <motion.button
                onClick={startRecording}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                className="mt-6 w-full rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-5 font-extrabold text-white text-lg shadow-xl"
              >
                🎙️ Start Recording
              </motion.button>

              <p className="mt-3 text-center text-xs text-gray-600">audio not stored. just analyzed ✨</p>
            </motion.div>
          )}

          {phase === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 rounded-[2rem] border border-white/60 bg-white/55 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.13)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="h-3 w-3 rounded-full bg-rose-500"
                  />
                  <span className="text-sm font-extrabold text-rose-600">REC</span>
                </div>
                <div className="text-sm font-extrabold text-gray-900">
                  {formatTime(seconds)} / {formatTime(MAX_SECONDS)}
                </div>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/40 border border-white/60">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500"
                  animate={{ width: `${(seconds / MAX_SECONDS) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="mt-6 flex items-center justify-center gap-[3px] h-20">
                {waveform.map((v, i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: v }}
                    transition={{ duration: 0.05 }}
                    style={{ transformOrigin: "center" }}
                    className="w-[5px] rounded-full bg-gradient-to-t from-pink-500 to-purple-400"
                    initial={{ height: "100%", scaleY: 0.1 }}
                  />
                ))}
              </div>

              <div className="mt-6 text-center">
                <div className="text-sm font-extrabold text-gray-900 mb-1">Miss Delulu is listening… 👂</div>
                <div className="text-xs text-gray-600">spill everything. no interruptions (from you) 💅</div>
              </div>

              <motion.button
                onClick={doStop}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="mt-6 w-full rounded-3xl bg-gradient-to-r from-rose-500 to-fuchsia-500 py-4 font-extrabold text-white shadow-xl"
              >
                ⏹ Stop
              </motion.button>

              <div className="mt-3 text-center text-xs text-gray-600">
                minimum: {MIN_SECONDS}s (don’t tap stop instantly 😭)
              </div>
            </motion.div>
          )}

          {phase === "recorded" && (
            <motion.div
              key="recorded"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 rounded-[2rem] border border-white/60 bg-white/55 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.13)] backdrop-blur-xl"
            >
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <h2 className="text-xl font-extrabold text-gray-900">
                  Voice note captured ({formatTime(secondsRef.current)})
                </h2>
                <p className="text-xs text-gray-600 mt-1">ready for the delulu diagnosis</p>
              </div>

              {audioUrl && (
                <div className="mt-5 rounded-3xl border border-white/60 bg-white/60 p-3">
                  <audio controls src={audioUrl} className="w-full" />
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  😭 {error}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <motion.button
                  onClick={reset}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-3xl border border-white/60 bg-white/60 py-4 font-extrabold text-gray-900 shadow-sm"
                >
                  🔄 Re-record
                </motion.button>

                <motion.button
                  onClick={analyze}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 font-extrabold text-white shadow-xl"
                >
                  🧪 Analyze it
                </motion.button>
              </div>

              <div className="mt-4 text-center text-[11px] text-gray-600">
                format: <span className="font-extrabold text-gray-900">{audioBlob?.type}</span>
              </div>
            </motion.div>
          )}

          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 rounded-[2rem] border border-white/60 bg-white/55 p-7 shadow-[0_20px_80px_rgba(124,58,237,0.13)] backdrop-blur-xl text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                className="text-5xl inline-block mb-4"
              >
                🧪
              </motion.div>
              <h2 className="text-xl font-extrabold text-gray-900">Miss Delulu is analyzing…</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                {["Transcribing your words 💬", "Measuring drama levels 🎚️", "Detecting spiral energy ⚡", "Writing verdict 💅"].map((s, i) => (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.4 }}
                    className="rounded-3xl border border-white/60 bg-white/55 px-4 py-2 font-semibold"
                  >
                    {s}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
              <div className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-[0_20px_80px_rgba(124,58,237,0.13)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex rounded-full bg-gradient-to-r ${scoreColor} px-4 py-2 text-sm font-extrabold text-white shadow`}>
                    {verdictLabel}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-gray-900">{result.delulu_score}%</div>
                    <div className="text-xs text-gray-600">delulu score</div>
                  </div>
                </div>

                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/40 border border-white/60">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${scoreColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${result.delulu_score}%` }}
                    transition={{ duration: 1, type: "spring" }}
                  />
                </div>

                <h2 className="mt-4 text-2xl font-extrabold text-gray-900">{result.title}</h2>
                <p className="mt-2 text-sm font-semibold text-gray-800">{result.reaction}</p>

                {!!result.transcript && (
                  <div className="mt-4 rounded-3xl border border-white/60 bg-white/60 p-4 text-sm text-gray-900">
                    <div className="text-xs font-extrabold text-gray-700 mb-2">📝 transcript</div>
                    <div className="whitespace-pre-wrap font-semibold">{result.transcript}</div>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-sm backdrop-blur-xl">
                <div className="text-xs font-extrabold text-gray-700 mb-3">📊 Breakdown</div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["🎚️ Pitch", result.breakdown.pitch],
                      ["⚡ Speed", result.breakdown.speed],
                      ["🌀 Chaos", result.breakdown.chaos],
                      ["💬 Catchphrases", result.breakdown.catchphrases],
                    ] as [string, string][]
                  ).map(([label, val]) => (
                    <div key={label} className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/40 p-3 shadow-sm">
                      <div className="text-xs font-extrabold text-gray-700">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.caught_saying?.length > 0 && (
                <div className="rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-sm backdrop-blur-xl">
                  <div className="text-xs font-extrabold text-gray-700 mb-3">🎤 Caught You Saying</div>
                  <div className="flex flex-wrap gap-2">
                    {result.caught_saying.map((phrase) => (
                      <span key={phrase} className="rounded-full bg-gradient-to-r from-pink-200/80 to-purple-200/80 border border-white/60 px-3 py-1 text-xs font-extrabold text-gray-900">
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-sm backdrop-blur-xl">
                <div className="text-xs font-extrabold text-gray-700 mb-3">💅 Next Moves</div>
                <ul className="space-y-2">
                  {(result.next_moves ?? []).map((m) => (
                    <li key={m} className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/80 to-white/40 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <motion.button onClick={reset} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  className="flex-1 rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 font-extrabold text-white shadow-xl">
                  🎙️ Record again
                </motion.button>
                <motion.button onClick={() => navigator.clipboard.writeText(window.location.href)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  className="rounded-3xl border border-white/60 bg-white/60 px-5 py-4 font-extrabold text-gray-900 shadow-sm">
                  📎 Share
                </motion.button>
              </div>

              <p className="text-center text-xs text-gray-600">📸 screenshot this for the group chat 😭</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}