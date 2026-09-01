import { useCallback, useEffect, useRef, useState } from 'react';

// Read-aloud over the browser's built-in speech synthesis. Chrome cuts off a
// long utterance part-way through, so the text is split into sentence-sized
// chunks and queued one at a time.
const CHUNK_LIMIT = 220;

function chunk(text) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*\s*/g) || [];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > CHUNK_LIMIT && buf) { out.push(buf.trim()); buf = ''; }
    buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [rate,     setRate]     = useState(1);
  const queue = useRef([]);
  const rateRef = useRef(1);

  const stop = useCallback(() => {
    if (!supported) return;
    queue.current = [];
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  // Never leave a voice talking after the page is gone.
  useEffect(() => stop, [stop]);

  // Each chunk queues the next one when it ends, so the callback has to reach
  // itself through a ref rather than referring to its own binding.
  const speakNextRef = useRef(() => {});
  const speakNext = useCallback(() => {
    if (!queue.current.length) { setSpeaking(false); setPaused(false); return; }
    const u = new SpeechSynthesisUtterance(queue.current.shift());
    u.rate = rateRef.current;
    u.onend = () => speakNextRef.current();
    u.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  }, []);
  useEffect(() => { speakNextRef.current = speakNext; }, [speakNext]);

  const start = useCallback((text) => {
    if (!supported || !text?.trim()) return;
    window.speechSynthesis.cancel();
    queue.current = chunk(text);
    setSpeaking(true);
    setPaused(false);
    speakNext();
  }, [supported, speakNext]);

  const togglePause = useCallback(() => {
    if (!supported) return;
    if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  }, [supported]);

  // Rate only applies to utterances not yet spoken, so restarting the current
  // chunk is the only way to make a speed change audible straight away.
  const changeRate = useCallback((next) => {
    rateRef.current = next;
    setRate(next);
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
      speakNext();
    }
  }, [speakNext]);

  return { supported, speaking, paused, rate, start, stop, togglePause, changeRate };
}
