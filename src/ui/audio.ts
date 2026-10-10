let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

function ctor(): AudioCtor | undefined {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Create or resume the AudioContext. Call from a user gesture (iOS needs it). */
export function unlockAudio(): void {
  try {
    const C = ctor();
    if (!C) return;
    if (!ctx) ctx = new C();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // sound is best-effort
  }
}

/** Short beep; silent if audio was never unlocked. */
export function beep(): void {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch {
    // sound is best-effort
  }
}
