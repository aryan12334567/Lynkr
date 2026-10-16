"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal typing for the Web Speech API, which TypeScript's DOM lib omits. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function create(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Speak an answer in Indian English; falls back to typing where unsupported. */
export function useSpeech(onText: (finalText: string) => void) {
  // The app renders client-only, so window is available on first render.
  const [supported] = useState(() => create() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);

  useEffect(() => {
    cb.current = onText;
  });

  useEffect(() => () => rec.current?.stop(), []);

  function start() {
    const r = create();
    if (!r) return;
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text.trim()) cb.current(text.trim());
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone blocked. Allow it in the browser, or type instead." : "Could not hear that. Try again or type.");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
    setListening(false);
  }

  return { supported, listening, error, start, stop };
}
