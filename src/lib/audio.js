/**
 * Audio engine: one HTMLAudioElement routed through a Web Audio graph
 * (pre-amp → 10-band EQ → master gain → analyser → speakers).
 *
 * Kept outside React so playback survives re-renders; components subscribe
 * to it through the store.
 */

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  'שטוח': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'בס מוגבר': [7, 6, 5, 2, 0, 0, -1, 0, 0, 0],
  'ווקאל': [-2, -2, 0, 2, 4, 4, 3, 1, 0, -1],
  'רוק': [5, 4, 2, 0, -1, 1, 3, 5, 5, 5],
  'פופ': [-1, 1, 3, 4, 3, 1, -1, -1, 0, 1],
  'ג׳אז': [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  'קלאסי': [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  'אלקטרוני': [6, 5, 1, 0, -2, 2, 1, 2, 5, 6],
  'מוגבר לקשישים': [8, 8, 6, 3, 0, 0, 2, 4, 5, 5],
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

class AudioEngine {
  constructor() {
    this.audio = null;
    this.ctx = null;
    this.source = null;
    this.preamp = null;
    this.filters = [];
    this.master = null;
    this.analyser = null;
    this.ready = false;
    this.listeners = new Set();
    this.currentUrl = null;
    this.gainValue = 1;
    this.eqGains = EQ_FREQUENCIES.map(() => 0);
    this.eqEnabled = true;
    this.pitchLock = true;
  }

  /* ---------------- setup ---------------- */

  ensureElement() {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    this.audio = audio;

    audio.addEventListener('timeupdate', () => this.emit('time'));
    audio.addEventListener('durationchange', () => this.emit('duration'));
    audio.addEventListener('loadedmetadata', () => this.emit('duration'));
    audio.addEventListener('play', () => this.emit('play'));
    audio.addEventListener('pause', () => this.emit('pause'));
    audio.addEventListener('ended', () => this.emit('ended'));
    audio.addEventListener('error', () => this.emit('error'));
    audio.addEventListener('waiting', () => this.emit('buffering', true));
    audio.addEventListener('playing', () => this.emit('buffering', false));
    audio.addEventListener('canplay', () => this.emit('buffering', false));
    audio.addEventListener('seeked', () => this.emit('time'));
    return audio;
  }

  ensureContext() {
    const audio = this.ensureElement();
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const preamp = ctx.createGain();
      preamp.gain.value = 1;
      this.filters = EQ_FREQUENCIES.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = 0;
        return filter;
      });
      const master = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;

      source.connect(preamp);
      let node = preamp;
      for (const filter of this.filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(master);
      master.connect(analyser);
      analyser.connect(ctx.destination);

      this.ctx = ctx;
      this.source = source;
      this.preamp = preamp;
      this.master = master;
      this.analyser = analyser;
      this.ready = true;
      this.applyEq();
      return ctx;
    } catch {
      this.ready = false;
      return null;
    }
  }

  async resume() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  /* ---------------- events ---------------- */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload) {
    this.listeners.forEach((fn) => {
      try {
        fn(type, payload);
      } catch {
        /* ignore */
      }
    });
  }

  /* ---------------- playback ---------------- */

  async load(url, { autoplay = true, startAt = 0 } = {}) {
    const audio = this.ensureElement();
    this.currentUrl = url;
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    audio.playbackRate = this.rate || 1;
    audio.preservesPitch = this.pitchLock;
    audio.mozPreservesPitch = this.pitchLock;
    audio.webkitPreservesPitch = this.pitchLock;
    if (startAt > 0) {
      try {
        audio.currentTime = startAt;
      } catch {
        /* not seekable yet */
      }
    }
    if (autoplay) await this.play();
    return audio;
  }

  async play() {
    if (!this.audio) return;
    await this.resume();
    try {
      await this.audio.play();
    } catch (err) {
      this.emit('error', err);
    }
  }

  pause() {
    if (!this.audio) return;
    this.audio.pause();
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.currentUrl = null;
  }

  seek(seconds) {
    if (!this.audio) return;
    const duration = this.audio.duration;
    const time = Number.isFinite(duration) ? clamp(seconds, 0, Math.max(0, duration - 0.05)) : seconds;
    try {
      this.audio.currentTime = time;
      this.emit('time');
    } catch {
      /* ignore */
    }
  }

  get time() {
    return this.audio ? this.audio.currentTime || 0 : 0;
  }

  get duration() {
    return this.audio && Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  setVolume(value) {
    const v = clamp(value, 0, 1);
    if (this.audio) this.audio.volume = v;
    this.emit('volume', v);
  }

  setRate(value) {
    this.rate = clamp(value, 0.5, 2);
    if (this.audio) this.audio.playbackRate = this.rate;
    this.emit('rate', this.rate);
  }

  /* ---------------- equalizer ---------------- */

  setEqGains(gains) {
    this.eqGains = EQ_FREQUENCIES.map((_, i) => clamp(Number(gains[i]) || 0, -12, 12));
    this.applyEq();
    this.emit('eq', this.eqGains);
  }

  setEqEnabled(enabled) {
    this.eqEnabled = Boolean(enabled);
    this.applyEq();
    this.emit('eq', this.eqGains);
  }

  setPreamp(value) {
    this.gainValue = clamp(Number(value) || 0, -12, 12);
    this.applyEq();
  }

  applyEq() {
    if (!this.ready) return;
    this.filters.forEach((filter, i) => {
      filter.gain.setTargetAtTime(this.eqEnabled ? this.eqGains[i] : 0, this.ctx.currentTime, 0.02);
    });
    const preampDb = this.eqEnabled ? this.gainValue : 0;
    this.preamp.gain.setTargetAtTime(10 ** (preampDb / 20), this.ctx.currentTime, 0.02);
  }

  /** Frequency data for the visualizer, or null when Web Audio is unavailable. */
  getSpectrum() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  dispose() {
    try {
      this.stop();
      if (this.ctx) this.ctx.close();
    } catch {
      /* ignore */
    }
  }
}

export const engine = new AudioEngine();
