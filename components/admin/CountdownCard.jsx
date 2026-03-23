"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CountdownCard({ countdownSeconds = 0, nextGenerationLocalIso = "", timezone = "Asia/Singapore", actions = null }) {
  const [secondsLeft, setSecondsLeft] = useState(Number(countdownSeconds || 0));

  useEffect(() => {
    setSecondsLeft(Number(countdownSeconds || 0));
  }, [countdownSeconds]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const localText = useMemo(() => {
    if (!nextGenerationLocalIso) return "-";
    return new Date(nextGenerationLocalIso).toLocaleString("en-SG", {
      hour12: true,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }, [nextGenerationLocalIso]);

  return (
    <div className="rounded-3xl border border-orange-400/20 bg-gradient-to-br from-orange-500/10 to-zinc-900/80 p-6 backdrop-blur">
      <div className="text-sm text-zinc-400">Next Daily Generation</div>
      <div className="mt-3 text-4xl font-semibold tracking-tight text-white">{formatDuration(secondsLeft)}</div>
      <div className="mt-3 text-sm text-zinc-300">{localText}</div>
      <div className="mt-1 text-xs text-zinc-500">Timezone: {timezone}</div>
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}