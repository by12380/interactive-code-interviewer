// Lightweight ambient sound generator (no audio files needed).
// Uses WebAudio; must be started from a user gesture (button click) in most browsers.

function makeWhiteNoiseBuffer(ctx, seconds = 2) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeBrownNoiseSource(ctx) {
  // Simple brown noise via integrated white noise.
  const node = ctx.createScriptProcessor(4096, 1, 1);
  let lastOut = 0;
  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      out[i] = lastOut * 3.5;
    }
  };
  return node;
}

function clamp(n, { min, max, fallback }) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function createAmbientEngine() {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) {
    return {
      supported: false,
      start: async () => false,
      stop: () => {},
      setVolume: () => {},
      setPreset: () => {}
    };
  }

  let ctx = null;
  let master = null;
  let currentPreset = "rain";
  let cleanupFns = [];

  function stopInternal() {
    for (const fn of cleanupFns) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    cleanupFns = [];
  }

  function buildRain({ volume }) {
    const noiseBuf = makeWhiteNoiseBuffer(ctx, 2.0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 650;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6500;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(master);

    src.start();

    // Droplets: short noisy bursts with random timing.
    let dropletTimer = 0;
    const scheduleDroplet = () => {
      const t = clamp(0.12 + Math.random() * 0.35, { min: 0.12, max: 0.6, fallback: 0.3 });
      dropletTimer = globalThis.setTimeout(() => {
        try {
          const dsrc = ctx.createBufferSource();
          dsrc.buffer = noiseBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 2200 + Math.random() * 1800;
          bp.Q.value = 6;
          const dg = ctx.createGain();
          const now = ctx.currentTime;
          dg.gain.setValueAtTime(0.0, now);
          dg.gain.linearRampToValueAtTime(volume * (0.12 + Math.random() * 0.25), now + 0.01);
          dg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
          dsrc.connect(bp);
          bp.connect(dg);
          dg.connect(master);
          dsrc.start();
          dsrc.stop(now + 0.14);
        } catch {
          // ignore
        } finally {
          scheduleDroplet();
        }
      }, Math.floor(t * 1000));
    };
    scheduleDroplet();

    cleanupFns.push(() => {
      try {
        src.stop();
      } catch {
        // ignore
      }
      try {
        src.disconnect();
        hp.disconnect();
        lp.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
      try {
        if (dropletTimer) clearTimeout(dropletTimer);
      } catch {
        // ignore
      }
    });
  }

  function buildCoffeeShop({ volume }) {
    // "Coffee shop"-ish: low hum + mid band murmur + sporadic chatter bursts.
    const humOsc = ctx.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 120;
    const humGain = ctx.createGain();
    humGain.gain.value = volume * 0.12;
    humOsc.connect(humGain);
    humGain.connect(master);
    humOsc.start();

    const brown = makeBrownNoiseSource(ctx);
    const murmurBp = ctx.createBiquadFilter();
    murmurBp.type = "bandpass";
    murmurBp.frequency.value = 750;
    murmurBp.Q.value = 0.8;
    const murmurGain = ctx.createGain();
    murmurGain.gain.value = volume * 0.35;
    brown.connect(murmurBp);
    murmurBp.connect(murmurGain);
    murmurGain.connect(master);

    // Chatter bursts
    const chatterBuf = makeWhiteNoiseBuffer(ctx, 1.0);
    let chatterTimer = 0;
    const scheduleChatter = () => {
      const t = 1.0 + Math.random() * 2.2;
      chatterTimer = globalThis.setTimeout(() => {
        try {
          const csrc = ctx.createBufferSource();
          csrc.buffer = chatterBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1600 + Math.random() * 1200;
          bp.Q.value = 1.3;
          const cg = ctx.createGain();
          const now = ctx.currentTime;
          const peak = volume * (0.12 + Math.random() * 0.25);
          cg.gain.setValueAtTime(0.0001, now);
          cg.gain.linearRampToValueAtTime(peak, now + 0.05);
          cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
          csrc.connect(bp);
          bp.connect(cg);
          cg.connect(master);
          csrc.start();
          csrc.stop(now + 0.5);
        } catch {
          // ignore
        } finally {
          scheduleChatter();
        }
      }, Math.floor(t * 1000));
    };
    scheduleChatter();

    cleanupFns.push(() => {
      try {
        humOsc.stop();
      } catch {
        // ignore
      }
      try {
        humOsc.disconnect();
        humGain.disconnect();
        brown.disconnect();
        murmurBp.disconnect();
        murmurGain.disconnect();
      } catch {
        // ignore
      }
      try {
        if (chatterTimer) clearTimeout(chatterTimer);
      } catch {
        // ignore
      }
    });
  }

  function rebuild({ preset, volume }) {
    stopInternal();
    currentPreset = preset;
    if (preset === "coffee_shop") buildCoffeeShop({ volume });
    else buildRain({ volume });
  }

  return {
    supported: true,
    async start({ preset = "rain", volume = 0.25 } = {}) {
      const vol = clamp(volume, { min: 0, max: 1, fallback: 0.25 });
      try {
        if (!ctx) {
          ctx = new AudioContextCtor();
          master = ctx.createGain();
          master.gain.value = 1;
          master.connect(ctx.destination);
        }
        if (ctx.state === "suspended") await ctx.resume();
        rebuild({ preset, volume: vol });
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      stopInternal();
    },
    setVolume(volume) {
      const vol = clamp(volume, { min: 0, max: 1, fallback: 0.25 });
      // Rebuild to apply levels across nodes.
      if (!ctx || !master) return;
      rebuild({ preset: currentPreset, volume: vol });
    },
    setPreset(preset) {
      if (!ctx || !master) {
        currentPreset = preset;
        return;
      }
      rebuild({ preset, volume: 0.25 });
    }
  };
}

