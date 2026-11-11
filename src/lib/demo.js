/**
 * Demo library generator.
 *
 * Renders a handful of short instrumental loops with the Web Audio API and hands
 * them to the player as WAV blobs, so the app can be tried instantly without any
 * local music (useful in the browser preview and in the Windows app alike).
 */

const SAMPLE_RATE = 22050;

const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
};

const DEMOS = [
  {
    title: 'אור ראשון',
    artist: 'SHOSO Sessions',
    album: 'דמו אינסטרומנטלי',
    genre: 'אמביינט',
    year: '2026',
    bpm: 76,
    chordProg: ['C3', 'A3', 'F3', 'G3'],
    melody: ['C5', 'E5', 'G5', 'E5', 'D5', 'C5', 'A4', 'G4'],
    cover: ['#8b5cf6', '#38bdf8'],
    wave: 'sine',
  },
  {
    title: 'רחוב אלנבי בלילה',
    artist: 'SHOSO Sessions',
    album: 'דמו אינסטרומנטלי',
    genre: 'אלקטרוני',
    year: '2026',
    bpm: 104,
    chordProg: ['A3', 'A3', 'F3', 'G3'],
    melody: ['A5', 'G5', 'E5', 'G5', 'A5', 'C5', 'D5', 'E5'],
    cover: ['#0ea5e9', '#22d3ee'],
    wave: 'triangle',
  },
  {
    title: 'מנגינה של בוקר',
    artist: 'נועה לוי',
    album: 'פסנתר ומיתרים',
    genre: 'קלאסי',
    year: '2025',
    bpm: 68,
    chordProg: ['F3', 'C3', 'D3', 'A3'],
    melody: ['C5', 'D5', 'E5', 'G5', 'E5', 'D5', 'C5', 'A4'],
    cover: ['#f59e0b', '#fbbf24'],
    wave: 'sine',
  },
  {
    title: 'גרוב במרתף',
    artist: 'The Basement Trio',
    album: 'לייב בדרום',
    genre: 'ג׳אז',
    year: '2024',
    bpm: 92,
    chordProg: ['D3', 'G3', 'C3', 'A3'],
    melody: ['D5', 'F4', 'G5', 'A4', 'C5', 'D5', 'G5', 'F4'],
    cover: ['#10b981', '#34d399'],
    wave: 'triangle',
  },
  {
    title: 'קצב הנגב',
    artist: 'Midbar Project',
    album: 'שטח פתוח',
    genre: 'רוק',
    year: '2025',
    bpm: 118,
    chordProg: ['E3', 'C3', 'G3', 'D3'],
    melody: ['E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'B4', 'E5'],
    cover: ['#f43f5e', '#fb7185'],
    wave: 'sawtooth',
  },
  {
    title: 'שקיעה בתל אביב',
    artist: 'SHOSO Sessions',
    album: 'דמו אינסטרומנטלי',
    genre: 'אמביינט',
    year: '2026',
    bpm: 84,
    chordProg: ['G3', 'E3', 'C3', 'D3'],
    melody: ['G4', 'B4', 'D5', 'B4', 'A4', 'G4', 'E4', 'D4'],
    cover: ['#8b5cf6', '#f472b6'],
    wave: 'sine',
  },
];

const LRC_TEMPLATE = [
  '[ar:SHOSO Sessions]',
  '[ti:%TITLE%]',
  '[00:02.00]מילים לדוגמה – אפשר להחליף בקובץ LRC משלך',
  '[00:07.50]שורה שנייה מתנגנת עם המוזיקה',
  '[00:13.00]SHOSO קורא קבצי .lrc אוטומטית',
  '[00:18.00]ומסנכרן אותם בזמן אמת',
  '[00:23.00]נסו לגרור קובץ שיר לחלון',
].join('\n');

const coverSvg = (title, artist, colors) => {
  const [c1, c2] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="r" cx="72%" cy="18%" r="70%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.42)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <rect width="600" height="600" fill="url(#r)"/>
  <g stroke="rgba(8,10,16,0.55)" stroke-width="16" stroke-linecap="round">
    <path d="M220 400V230"/><path d="M300 450V170"/><path d="M380 370V280"/>
  </g>
  <circle cx="452" cy="152" r="26" fill="rgba(8,10,16,0.55)"/>
  <text x="42" y="524" font-family="Segoe UI, Arial" font-size="40" font-weight="700" fill="rgba(255,255,255,0.94)">${title}</text>
  <text x="42" y="562" font-family="Segoe UI, Arial" font-size="24" fill="rgba(255,255,255,0.68)">${artist}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/** Encode a Float32Array of mono samples into a 16-bit PCM WAV blob URL. */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Render a looped chord bed + melody + soft percussion offline.
 * Returns { samples, duration }.
 */
function renderLoop(spec) {
  const beat = 60 / spec.bpm;
  const bars = 8;
  const duration = beat * 4 * bars;
  const length = Math.ceil(duration * SAMPLE_RATE);
  const out = new Float32Array(length);

  const addTone = (freq, start, dur, gain, wave = 'sine', decay = 1.6) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const to = Math.min(length, Math.floor((start + dur) * SAMPLE_RATE));
    for (let i = from; i < to; i += 1) {
      const t = (i - from) / SAMPLE_RATE;
      const env = Math.min(1, t * 26) * Math.exp(-t * decay);
      const phase = 2 * Math.PI * freq * t;
      let sample;
      if (wave === 'triangle') sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
      else if (wave === 'sawtooth') sample = 2 * ((freq * t) % 1) - 1;
      else sample = Math.sin(phase);
      out[i] += sample * env * gain;
    }
  };

  const addKick = (start) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const dur = 0.22;
    const to = Math.min(length, Math.floor((start + dur) * SAMPLE_RATE));
    for (let i = from; i < to; i += 1) {
      const t = (i - from) / SAMPLE_RATE;
      const freq = 110 * Math.exp(-t * 26) + 42;
      out[i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 15) * 0.22;
    }
  };

  const addHat = (start) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const dur = 0.06;
    const to = Math.min(length, Math.floor((start + dur) * SAMPLE_RATE));
    for (let i = from; i < to; i += 1) {
      const t = (i - from) / SAMPLE_RATE;
      out[i] += (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.05;
    }
  };

  // Chord bed – one long note per bar.
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = spec.chordProg[bar % spec.chordProg.length];
    const freq = NOTES[chord];
    addTone(freq, bar * beat * 4, beat * 4, 0.16, 'sine', 0.35);
    addTone(freq * 2, bar * beat * 4, beat * 4, 0.07, 'sine', 0.35);
    addTone(freq * 1.5, bar * beat * 4, beat * 4, 0.05, 'triangle', 0.4);
  }

  // Melody – eighth notes, two passes of the motif per 4 bars.
  const step = beat / 2;
  for (let bar = 0; bar < bars; bar += 1) {
    for (let i = 0; i < 8; i += 1) {
      const note = spec.melody[(i + bar * 2) % spec.melody.length];
      addTone(NOTES[note], (bar * 8 + i) * step, step * 0.92, 0.12, spec.wave, 3.2);
    }
  }

  // Percussion
  for (let bar = 0; bar < bars; bar += 1) {
    addKick(bar * beat * 4);
    addKick(bar * beat * 4 + beat * 2);
    addHat(bar * beat * 4 + beat);
    addHat(bar * beat * 4 + beat * 3);
  }

  // Fade in/out + gentle limiter.
  const fade = 0.35 * SAMPLE_RATE;
  for (let i = 0; i < length; i += 1) {
    let gain = 1;
    if (i < fade) gain = i / fade;
    if (i > length - fade) gain = Math.min(gain, (length - i) / fade);
    out[i] = Math.tanh(out[i] * gain * 1.1) * 0.85;
  }

  return { samples: out, duration };
}

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
};

/** Build demo tracks as library objects that the player can play immediately. */
export async function buildDemoTracks() {
  const tracks = [];
  for (let index = 0; index < DEMOS.length; index += 1) {
    const spec = DEMOS[index];
    const { samples, duration } = renderLoop(spec);
    const blob = encodeWav(samples, SAMPLE_RATE);
    const url = URL.createObjectURL(blob);

    // Prepend a tiny silent gap so the very first note is not clipped.
    const id = `demo-${hash(`${spec.artist}:${spec.title}`)}`;
    tracks.push({
      id,
      path: url,
      dir: `demo/${spec.album}`,
      fileName: `${spec.title}.wav`,
      title: spec.title,
      artist: spec.artist,
      albumArtist: spec.artist,
      album: spec.album,
      genre: spec.genre,
      year: spec.year,
      trackNo: index + 1,
      discNo: 1,
      duration,
      bitrate: SAMPLE_RATE * 16,
      codec: 'PCM 16-bit',
      sampleRate: SAMPLE_RATE,
      size: blob.size,
      mtime: Date.now() - index * 86400000,
      picture: coverSvg(spec.title, spec.artist, spec.cover),
      hasLyrics: true,
      _lyrics: { type: 'lrc', text: LRC_TEMPLATE.replace('%TITLE%', spec.title) },
    });
  }
  return tracks;
}
