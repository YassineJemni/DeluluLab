"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";
import { motion } from "framer-motion";

type Msg = { sender: "A" | "B" | "DELULU"; text: string; ts?: number };

export default function TherapyLivePage() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const sessionId = params.sessionId;
  const token = search.get("t") || "";

  const [role, setRole] = useState<"A" | "B" | null>(null);
  const [turn, setTurn] = useState<"A" | "B">("A");
  const [status, setStatus] = useState<"active" | "ended">("active");

  const [presence, setPresence] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });

  // timer
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const autoSwitchLock = useRef(false);

  const [messages, setMessages] = useState<Msg[]>([
    { sender: "DELULU", text: "Welcome to the session 😭💅 One at a time or I’m ending it." },
  ]);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // judge flow (2-person consent + shared result)
  const [judge, setJudge] = useState<any>(null);
  const [judging, setJudging] = useState(false);
  const [judgeRequested, setJudgeRequested] = useState(false);
  const [waitingOther, setWaitingOther] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canTalk = useMemo(() => status === "active" && !!role && role === turn, [status, role, turn]);
  const bothJoined = presence.a && presence.b;

  // join
  useEffect(() => {
    async function join() {
      const res = await fetch("/api/therapy/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, token }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages((m) => [...m, { sender: "DELULU", text: `Invalid link 😭 (${data?.error || "error"})` }]);
        return;
      }

      setRole(data.role);
      setTurn(data.turn ?? "A");
      setStatus(data.status ?? "active");
      setPresence({ a: !!data.a_joined, b: !!data.b_joined });

      if (data.turn_ends_at) setEndsAt(String(data.turn_ends_at));

      setMessages((m) => [
        ...m,
        {
          sender: "DELULU",
          text: data.role === "A" ? "You’re Player A 💅 Opened. Now share the B link 😭" : "You’re Player B 😒 Behave.",
        },
      ]);

      if (!(data.a_joined && data.b_joined)) {
        setMessages((m) => [
          ...m,
          {
            sender: "DELULU",
            text: data.role === "A" ? "Session starts when BOTH join. Send that invite link 😭" : "Waiting for the other person to join…",
          },
        ]);
      }
    }

    join();
  }, [sessionId, token]);

  // realtime subscribe
  useEffect(() => {
    const channel = pusherClient.subscribe(`therapy-${sessionId}`);

    const onMsg = (payload: any) => {
      setMessages((m) => [...m, { sender: payload.sender, text: payload.text, ts: payload.ts }]);
    };

    const onTurn = (payload: any) => {
      if (payload?.turn) setTurn(payload.turn);
      if (payload?.endsAt) setEndsAt(payload.endsAt);
    };

    const onPresence = (payload: any) => {
      setPresence({ a: !!payload.a_joined, b: !!payload.b_joined });
    };

    const onJudgeRequested = () => {
      setJudgeRequested(true);
      setWaitingOther(true);
      setJudge(null);
    };

    const onJudgeResult = (payload: any) => {
      setJudge(payload);
      setJudging(false);
      setWaitingOther(false);
      setJudgeRequested(false);
    };

    channel.bind("new-message", onMsg);
    channel.bind("turn-changed", onTurn);
    channel.bind("presence", onPresence);
    channel.bind("judge-requested", onJudgeRequested);
    channel.bind("judge-result", onJudgeResult);

    return () => {
      channel.unbind("new-message", onMsg);
      channel.unbind("turn-changed", onTurn);
      channel.unbind("presence", onPresence);
      channel.unbind("judge-requested", onJudgeRequested);
      channel.unbind("judge-result", onJudgeResult);
      pusherClient.unsubscribe(`therapy-${sessionId}`);
    };
  }, [sessionId]);

  // autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // countdown + autoswitch
  useEffect(() => {
    if (!endsAt) return;

    autoSwitchLock.current = false;

    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      const s = Math.max(0, Math.ceil(ms / 1000));
      setSecondsLeft(s);

      if (s === 0) {
        if (!autoSwitchLock.current && role && role === turn && status === "active") {
          autoSwitchLock.current = true;
          forceEndTurn();
        }
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, role, turn, status]);

  async function forceEndTurn() {
    await fetch("/api/therapy/next-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  }

  async function send() {
    if (!bothJoined) return;

    if (!canTalk) {
      setMessages((m) => [...m, { sender: "DELULU", text: "Bestie… MIC IS MUTED 😭 wait your turn 💅" }]);
      return;
    }

    const clean = text.trim();
    if (!clean) return;

    setSending(true);
    try {
      const res = await fetch("/api/therapy/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role, text: clean }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages((m) => [...m, { sender: "DELULU", text: `Nope 😭 ${data?.error || "error"}` }]);
      } else {
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  async function endTurn() {
    if (!bothJoined || !canTalk) return;
    await forceEndTurn();
  }

  async function requestJudge() {
    if (!bothJoined || !role) return;

    setJudge(null);
    setJudgeRequested(true);
    setWaitingOther(true);

    await fetch("/api/therapy/judge/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role }),
    });
  }

  async function acceptJudge() {
    if (!bothJoined || !role) return;

    setJudging(true);
    try {
      const res = await fetch("/api/therapy/judge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role }),
      });

      const data = await res.json().catch(() => null);

      if (data?.result) {
        setJudge(data.result);
        setWaitingOther(false);
        setJudgeRequested(false);
      } else {
        setWaitingOther(true);
      }
    } finally {
      setJudging(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fff0fa] via-[#f3ecff] to-white p-4 overflow-hidden">
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

      <div className="relative mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-white/50 bg-white/55 shadow-[0_20px_80px_rgba(124,58,237,0.15)] backdrop-blur-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-extrabold text-gray-900">Should We Break Up? 💀</div>
              <div className="mt-1 text-sm text-gray-700">
                {role ? `You are ${role}` : "Joining…"} • turn: <span className="font-bold">{turn}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  ☕ couples court
                </span>
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  ⏱️ 60s turns
                </span>
                <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-900 border border-white/60">
                  💅 miss delulu
                </span>
              </div>

              <div className="mt-2 text-xs text-gray-700">
                Joined:{" "}
                <span className={presence.a ? "font-extrabold text-green-700" : "text-gray-500"}>
                  A {presence.a ? "✅" : "⏳"}
                </span>{" "}
                •{" "}
                <span className={presence.b ? "font-extrabold text-green-700" : "text-gray-500"}>
                  B {presence.b ? "✅" : "⏳"}
                </span>
              </div>
            </div>

            <div
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-extrabold border border-white/60 ${
                bothJoined ? (canTalk ? "bg-green-200/80" : "bg-gray-200/80") : "bg-white/60"
              }`}
            >
              {bothJoined ? (canTalk ? `MIC ON • ${secondsLeft}s` : `MIC MUTED • ${secondsLeft}s`) : "WAITING…"}
            </div>
          </div>

          {bothJoined && canTalk && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-3xl border border-white/60 bg-gradient-to-r from-pink-200/80 to-purple-200/80 p-3 text-center font-extrabold text-gray-900 shadow-sm"
            >
              Your turn bestie 💅 60 seconds. GO 😭
            </motion.div>
          )}

          {!bothJoined && (
            <div className="mt-4 rounded-3xl border border-white/60 bg-white/55 p-3 text-center text-sm font-bold text-gray-900">
              Waiting for both players to join… <span className="text-gray-600">(share the invite link)</span>
            </div>
          )}

          <div className="mt-4 h-[55vh] overflow-y-auto rounded-3xl border border-white/60 bg-gradient-to-b from-white/55 to-white/25 p-4 shadow-inner space-y-3">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={[
                  "max-w-[85%] rounded-3xl px-4 py-3 shadow-sm border border-white/60",
                  m.sender === "DELULU"
                    ? "bg-gradient-to-r from-pink-200/90 to-purple-200/90 text-gray-900 mx-auto text-center"
                    : m.sender === role
                    ? "bg-gradient-to-r from-white/80 to-white/60 text-gray-900 ml-auto"
                    : "bg-gradient-to-r from-white/65 to-white/40 text-gray-900 mr-auto",
                ].join(" ")}
              >
                <div className="text-xs font-extrabold opacity-70">
                  {m.sender === "DELULU" ? "Miss Delulu" : `Player ${m.sender}`}
                </div>
                <div className="text-sm font-semibold whitespace-pre-wrap">{m.text}</div>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 grid gap-3">
            <div
              onClick={() => {
                if (bothJoined && !canTalk) {
                  setMessages((m) => [
                    ...m,
                    { sender: "DELULU", text: "Not you trying to interrupt 😭🚩 Sit down. Wait your turn 💅" },
                  ]);
                }
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!bothJoined || !canTalk || sending}
                rows={3}
                placeholder={
                  !bothJoined ? "Waiting for the other person to join…" : canTalk ? "Type your side bestie…" : "Mic is muted. Wait your turn 😭"
                }
                className="w-full rounded-3xl border border-white/60 bg-white/60 p-3 text-sm font-semibold text-gray-900 outline-none disabled:opacity-60 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={send}
                disabled={!bothJoined || !canTalk || sending || !text.trim()}
                className="flex-1 min-w-[150px] rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-3 font-extrabold text-white shadow-xl disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </motion.button>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={endTurn}
                disabled={!bothJoined || !canTalk}
                className="min-w-[140px] rounded-3xl bg-white/70 px-5 py-3 font-extrabold text-gray-900 shadow-sm border border-white/60 disabled:opacity-60"
              >
                End turn
              </motion.button>

              {!judgeRequested ? (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={requestJudge}
                  disabled={!bothJoined}
                  className="min-w-[160px] rounded-3xl bg-white/70 px-5 py-3 font-extrabold text-gray-900 shadow-sm border border-white/60 disabled:opacity-60"
                >
                  Request judge 💅
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptJudge}
                  disabled={!bothJoined || judging}
                  className="min-w-[160px] rounded-3xl bg-white/70 px-5 py-3 font-extrabold text-gray-900 shadow-sm border border-white/60 disabled:opacity-60"
                >
                  {judging ? "Checking…" : "Accept judge ✅"}
                </motion.button>
              )}
            </div>

            {waitingOther && (
              <div className="text-xs text-gray-700 text-center">
                Waiting for the other person to accept… 😭
              </div>
            )}

            {judge && !judge.error && (
              <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-white/70 to-white/30 p-4 shadow-lg">
                <div className="text-sm font-extrabold text-gray-900">
                  Miss Delulu Verdict: {judge.verdict} • {judge.score_percent}%
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{judge.bestie_reaction}</div>

                <div className="mt-3">
                  <div className="text-xs font-extrabold text-gray-700">Why:</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                    {(judge.why || []).map((x: string, i: number) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-extrabold text-gray-700">Next moves:</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                    {(judge.next_moves || []).map((x: string, i: number) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {judge?.error && (
              <div className="rounded-3xl border border-white/60 bg-white/60 p-4 shadow-sm text-sm font-bold text-gray-900">
                Judge failed 😭 {judge.error}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-700 text-center">
            Miss Delulu rules: no stalking, no insults, one person talks at a time 💅
          </div>
        </div>
      </div>
    </main>
  );
}