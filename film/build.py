#!/usr/bin/env python3
"""Assembly: shots -> graded sequence, graphics, narration, score, mix, encode."""
import json, math, os, re, subprocess, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from core import (FF, MEDIA, W, H, FPS, run, make_shot, xfade_chain, dur_of,
                  encode_png_seq, font, vis)
import gfx
import music

SRC = MEDIA + "/src"
AUD = MEDIA + "/audio"
MUZ = MEDIA + "/music"
GFX = MEDIA + "/gfx"
SHOTD = MEDIA + "/shots"
OUT = MEDIA + "/out"
for d in (GFX, SHOTD, OUT, AUD):
    os.makedirs(d, exist_ok=True)


def s(key):
    return f"{SRC}/{key}"

# ------------------------------------------------------------------ EDL model
import edl

SHOTS = [e for e in edl.E if e[0] in ("V", "A")]
GFX_E = [e for e in edl.E if e[0] == "G"]
NARR_E = [e for e in edl.E if e[0] == "N"]
SHOT_ID = {sh[1]: i for i, sh in enumerate(SHOTS)}

RAV_SUBS = {
    edl.F_STORY: [
        "אבא שלי למד בתוך הבית־מסחר.",
        "כשהייתי נוסע מבני ברק ומבקר אותו ברחובות — היה לפניו ספר.",
        "אם לומדים — יש בן תלמיד חכם.",
    ],
    edl.F_HESPED: [
        "כאשר אנו מספידים את רבנו מרן ראש הישיבה זצ״ל",
        "אוי, מי ייתן לנו תמורתו!",
        "ותהא נשמתו הטהורה צרורה בצרור החיים, אמן.",
    ],
}

# score regions: (cue, first shot id, next region's first shot id)
MUSIC_MAP = [
    ("open", "bb1", "pl36b"), ("roots", "pl36b", "ponb1"), ("yeshiva", "ponb1", "roz4"),
    ("rebbe", "roz4", "pen5"), ("torah", "pen5", "ged3"), ("lead", "ged3", "dan1"),
    ("human", "dan1", "pen8"), ("finale", "pen8", None),
]


# ------------------------------------------------------------------ helpers
def ffmpeg_silences(path, noise="-38dB", min_d=0.22):
    cmd = [FF, "-hide_banner", "-i", path, "-af",
           f"silencedetect=noise={noise}:d={min_d}", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    txt = r.stderr
    ends = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", txt)]
    starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", txt)]
    dur = dur_of(path)
    segs, prev = [], 0.0
    for e, st in zip(ends, starts):
        if st - e > 0.12:
            segs.append((e, st))
        prev = st
    if not segs:
        segs = [(0.0, dur)]
    if segs[0][0] > 0.25:
        segs.insert(0, (0.0, segs[0][0]))
    if dur - segs[-1][1] > 0.25:
        segs.append((segs[-1][1], dur))
    return segs


def esc_ass(t):
    return t.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def wrap_heb(text, max_chars=44):
    """Cheap, punctuation-aware wrap for Hebrew subtitle lines."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 > max_chars and cur:
            lines.append(cur); cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return "\\N".join(lines)


def write_ass(path, events, style_name="VO"):
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: VO,Assistant,64,&H00F4EEE0,&H000000FF,&H00100808,&H5A0A0A0C,0,0,0,0,100,100,0,0,1,5,2,2,150,150,104,1
Style: RAV,Assistant,62,&H00F0E4C4,&H000000FF,&H00100A05,&H6A0A0A0C,0,0,0,0,100,100,0,0,1,5,2,2,150,150,104,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    def ts(x):
        x = max(0.0, x)
        h = int(x // 3600); m = int((x % 3600) // 60); s = x % 60
        return f"{h}:{m:02d}:{s:05.2f}"
    body = "".join(
        f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{esc_ass(txt)}\n"
        for (a, b, txt, st) in events)
    open(path, "w", encoding="utf-8").write(head + body)


def write_srt(path, events):
    def ts(x):
        x = max(0.0, x)
        h = int(x // 3600); m = int((x % 3600) // 60); s = x % 60
        return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
    out = []
    for i, (a, b, txt, st) in enumerate(events, 1):
        out.append(f"{i}\n{ts(a)} --> {ts(b)}\n{txt.replace(chr(92)+'N', chr(10))}\n")
    open(path, "w", encoding="utf-8").write("\n".join(out))


# ================================================================== timeline
def timeline():
    starts = [0.0]
    for i in range(len(SHOTS) - 1):
        starts.append(starts[i] + SHOTS[i][4] - SHOTS[i][8][1])
    total = starts[-1] + SHOTS[-1][4]
    return starts, total


# ================================================================== steps
def step_shots():
    starts, total = timeline()
    os.makedirs(SHOTD, exist_ok=True)
    paths = []
    for i, sh in enumerate(SHOTS):
        out = f"{SHOTD}/{sh[1]}.mp4"
        make_shot(s(sh[2]), out, sh[3], sh[4], mode=sh[5], motion=sh[6], look=sh[7])
        paths.append(out)
        print("shot %-10s %-46s %6.2f" % (sh[1], os.path.basename(sh[2])[:44], starts[i]))
    base = f"{SHOTD}/base.mp4"
    xfade_chain(paths, [SHOTS[i][8] for i in range(len(SHOTS) - 1)], base,
                tmpdir=f"{SHOTD}/xc")
    print("base", base, "timeline total", round(total, 2))
    return base, starts, total


def bg_image(path, t=2.0):
    if not path.lower().endswith((".mp4", ".mov", ".mkv")):
        return path
    key = re.sub(r"[^0-9a-zA-Z]", "_", os.path.basename(path))[:40] + f"_{t}.jpg"
    dst = f"{MEDIA}/work/bg_{key}"
    os.makedirs(MEDIA + "/work", exist_ok=True)
    if not os.path.exists(dst):
        run([FF, "-y", "-v", "error", "-ss", "%.2f" % t, "-i", path,
             "-frames:v", "1", "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,"
             f"crop={W}:{H}", dst], quiet=False)
    return dst


def step_gfx(force=False):
    starts, total = timeline()
    os.makedirs(GFX, exist_ok=True)
    items = []
    for gi, (_, kind, sid, off, kw0) in enumerate(GFX_E):
        d = f"{GFX}/{gi:02d}"
        kw = dict(kw0)
        if kw.get("lines") == "__CREDITS__":
            kw["lines"] = edl.CREDITS
        t0 = starts[SHOT_ID[sid]] + off
        cached = (not force) and os.path.isdir(d) and \
            len([f for f in os.listdir(d) if f.endswith(".png")]) > 0
        if cached:
            n = len([f for f in os.listdir(d) if f.endswith(".png")])
            items.append(dict(dir=d, t0=t0, t1=t0 + n / FPS, kind=kind))
            print("gfx", gi, kind, "cached", n)
            continue
        if kind == "chapter":
            kw["bg"] = bg_image(s(kw["bg"]))
            gfx.chapter_card(d, **kw)
        elif kind == "kinetic":
            gfx.kinetic(d, **kw)
        elif kind == "quote":
            gfx.quote_card(d, **kw)
        elif kind == "calendar":
            gfx.calendar_seq(d, **kw)
        elif kind == "mapseq":
            kw["bg"] = bg_image(s(kw["bg"]))
            gfx.map_seq(d, **kw)
        elif kind == "plate":
            gfx.name_plate(d, **kw)
        elif kind == "titlemask":
            gfx.title_mask(d, **kw)
        elif kind == "endcard":
            gfx.end_card(d, **kw)
        elif kind == "credits":
            gfx.credits_seq(d, **kw)
        else:
            raise ValueError(kind)
        n = len([f for f in os.listdir(d) if f.endswith(".png")])
        items.append(dict(dir=d, t0=t0, t1=t0 + n / FPS, kind=kind))
        print("gfx", gi, kind, "frames", n, "t", round(t0, 2), round(t0 + n / FPS, 2))
    json.dump(items, open(f"{GFX}/index.json", "w"), indent=1)
    return items


# ------------------------------------------------------------------ audio
SR_A = 44100


def decode(path, sr=SR_A, mono=True):
    ch = "1" if mono else "2"
    r = subprocess.run([FF, "-v", "quiet", "-i", path, "-f", "f32le", "-ar", str(sr),
                        "-ac", ch, "pipe:1"], capture_output=True, timeout=1800)
    a = np.frombuffer(r.stdout, np.float32).astype(np.float64)
    if not mono:
        a = a[: len(a) // 2 * 2].reshape(-1, 2)
    return a


def wav_write(path, arr, sr=SR_A):
    a = np.asarray(arr, np.float64)
    if a.ndim == 1:
        a = np.stack([a, a], 1)
    a = np.clip(a, -1.0, 1.0)
    subprocess.run([FF, "-y", "-v", "error", "-f", "f64le", "-ar", str(sr), "-ac", "2",
                    "-i", "pipe:0", "-c:a", "pcm_s24le", path],
                   input=a.astype("<f8").tobytes(), check=True)
    return path


def improved_split(path, cues):
    """Map each cue onto real speech intervals detected in the audio file."""
    segs = [x for x in ffmpeg_silences(path) if x[1] - x[0] > 0.15]
    if not segs:
        segs = [(0.0, dur_of(path))]
    M, K = len(segs), len(cues)
    if K <= M:
        lens = np.array([max(1.0, len(c)) for c in cues], float)
        frac = np.cumsum(lens) / lens.sum()
        bnd = [0] + [int(round(f * M)) for f in frac[:-1]] + [M]
        for k in range(len(bnd)):
            bnd[k] = max(0, min(M, bnd[k]))
        for k in range(1, len(bnd)):
            if bnd[k] <= bnd[k - 1]:
                bnd[k] = min(M, bnd[k - 1] + 1)
        out = []
        for k in range(K):
            i0 = min(bnd[k], M - 1)
            i1 = max(i0 + 1, min(bnd[k + 1], M))
            out.append((segs[i0][0], segs[i1 - 1][1]))
        return out
    span = (segs[0][0], segs[-1][1])
    lens = np.array([max(1.0, len(c)) for c in cues], float)
    lens /= lens.sum()
    out, t = [], span[0]
    for f in lens:
        d = (span[1] - span[0]) * f
        out.append((t, t + d))
        t += d
    return out


def reserve_push(start, dur, reserved):
    for _ in range(60):
        moved = False
        for (a, b) in sorted(reserved):
            if start < b - 0.05 and start + dur > a + 0.05:
                start = b + 0.30
                moved = True
        if not moved:
            break
    return start


def step_audio(starts, total):
    n = int((total + 8.0) * SR_A)
    vox = np.zeros((n, 2))
    feat = np.zeros((n, 2))
    mus = np.zeros((n, 2))
    reserved = []
    events = []                    # (start, end, text, style)

    feature_clips = {edl.F_NIGGUN, edl.F_HAKAFOT}
    for i, sh in enumerate(SHOTS):
        if sh[0] != "A":
            continue
        tmp = f"{MEDIA}/work/src_{sh[1]}.wav"
        run([FF, "-y", "-v", "error", "-ss", "%.3f" % sh[3], "-t", "%.3f" % sh[4],
             "-i", s(sh[2]), "-vn", "-ac", "2", "-ar", str(SR_A),
             "-af", "highpass=f=90,acompressor=threshold=0.15:ratio=3:attack=25:release=250",
             "-c:a", "pcm_s16le", tmp], quiet=False)
        a = decode(tmp, SR_A, mono=False)
        m = min(len(a), int(sh[4] * SR_A))
        t0 = int(starts[i] * SR_A)
        (feat if sh[2] in feature_clips else vox)[t0:t0 + m] += a[:m]
        reserved.append((starts[i], starts[i] + m / SR_A))
        if sh[2] in RAV_SUBS:
            lines = RAV_SUBS[sh[2]]
            w = [max(1.0, len(x)) for x in lines]
            tot = sum(w)
            tt = starts[i]
            for ln, ww in zip(lines, w):
                dd = (m / SR_A) * ww / tot
                events.append((tt, tt + dd, ln, "RAV"))
                tt += dd
        print("  src-audio %-10s %-42s at %.2f (%.2fs)"
              % (sh[1], os.path.basename(sh[2])[:40], starts[i], m / SR_A))

    prev_end = 0.0
    for (_, f, cues, sid, off) in NARR_E:
        sidx = SHOT_ID[sid]
        p = f"{AUD}/{f}"
        if not os.path.exists(p):
            print("  NARR %s MISSING - skipped" % f)
            continue
        a = decode(p, SR_A, mono=True)
        d = len(a) / SR_A
        want = max(starts[sidx] + off, prev_end + 0.30)
        want = reserve_push(want, d, reserved)
        if want > starts[sidx] + off + 0.40:
            print("  NARR %s pushed +%.2fs" % (f, want - (starts[sidx] + off)))
        t0 = int(want * SR_A)
        seg = a[:min(len(a), n - t0)]
        vox[t0:t0 + len(seg), 0] += seg
        vox[t0:t0 + len(seg), 1] += seg
        reserved.append((want, want + d))
        for k, (ra, rb) in enumerate(improved_split(p, cues)):
            events.append((want + ra, want + rb, cues[k], "VO"))
        prev_end = want + d

    # ---- score: one cue per region, repeated with crossfades to fill it
    regions = []
    for k, (name, sid0, sid1) in enumerate(MUSIC_MAP):
        i0 = SHOT_ID[sid0]
        i1 = len(SHOTS) if sid1 is None else SHOT_ID[sid1]
        t0 = starts[i0]
        t1 = total if sid1 is None else starts[min(i1, len(SHOTS) - 1)]
        y = decode(f"{MUZ}/{name}.wav", SR_A, mono=False)
        L = len(y)
        reg = t1 - t0
        pos, first = t0, True
        while pos < t1 + 0.1:
            i = int(pos * SR_A)
            seg = y[:min(L, n - i)]
            if len(seg) <= 0:
                break
            # 2.5 s cross-fade at the head of every repeat
            xf = int(2.5 * SR_A) if not first else int(1.2 * SR_A)
            r = np.ones(len(seg))
            xf = min(xf, len(seg) // 2)
            if xf:
                r[:xf] = np.linspace(0, 1, xf)
            tail = int(min(3.0 * SR_A, len(seg)))
            r[-tail:] *= np.linspace(1, 0, tail)
            mus[i:i + len(seg)] += seg * r[:, None]
            pos += (L - xf) / SR_A
            first = False
        regions.append((name, t0, t1))
        print("  music %-8s %.1f -> %.1f (%.1fs)" % (name, t0, t1, t1 - t0))

    os.makedirs(MEDIA + "/work", exist_ok=True)
    wav_write(f"{MEDIA}/work/vox.wav", vox)
    wav_write(f"{MEDIA}/work/feat.wav", feat)
    wav_write(f"{MEDIA}/work/mus.wav", mus)
    events.sort(key=lambda e: e[0])
    json.dump({"events": events, "regions": regions, "total": total},
              open(f"{MEDIA}/work/audio.json", "w"), ensure_ascii=False, indent=1)
    return events


def step_mix():
    """Duck the score under speech/singing and print the finished mix."""
    out = f"{MEDIA}/work/mix.wav"
    cmd = [FF, "-y", "-v", "error",
           "-i", f"{MEDIA}/work/vox.wav",
           "-i", f"{MEDIA}/work/feat.wav",
           "-i", f"{MEDIA}/work/mus.wav",
           "-filter_complex",
           "[0:a]highpass=f=95,acompressor=threshold=0.12:ratio=2.6:attack=12:release=220,"
           "loudnorm=I=-17:TP=-1.6:LRA=7[vo];"
           "[1:a]highpass=f=80,volume=1.4,acompressor=threshold=0.10:ratio=3:attack=20:release=250[ft];"
           "[vo][ft]amix=inputs=2:normalize=0:duration=first[spk];"
           "[spk]asplit=2[spk1][sc];"
           "[2:a]volume=0.62[mu];"
           "[mu][sc]sidechaincompress=threshold=0.045:ratio=7:attack=22:release=420:makeup=1[md];"
           "[spk1][md]amix=inputs=2:normalize=0:duration=first[mx];"
           "[mx]alimiter=limit=0.94,"
           "loudnorm=I=-16:TP=-1.5:LRA=9[outa]",
           "-map", "[outa]", "-ar", "44100", "-c:a", "pcm_s24le", out]
    run(cmd, quiet=False)
    return out


# ------------------------------------------------------------------ subs
def step_subs(events, total):
    ev = []
    for (a, b, txt, st) in events:
        a = max(0.0, a - 0.05)
        b = min(total, b + (0.14 if st == "VO" else 0.10))
        ev.append((a, b, wrap_heb(txt, 46 if st == "VO" else 40), st))
    # never let one line still be on screen when the next one appears
    ev.sort(key=lambda e: e[0])
    for k in range(len(ev) - 1):
        if ev[k][1] > ev[k + 1][0] - 0.03:
            ev[k] = (ev[k][0], max(ev[k][0] + 0.25, ev[k + 1][0] - 0.03), ev[k][2], ev[k][3])
    ass = f"{MEDIA}/work/film.ass"
    srt = f"{OUT}/film.srt"
    write_ass(ass, ev)
    write_srt(srt, ev)
    return ass, srt


# ------------------------------------------------------------------ composite
def step_final(ass):
    items = json.load(open(f"{GFX}/index.json"))
    base = f"{SHOTD}/base.mp4"
    out = f"{OUT}/film.mp4"
    cmd = [FF, "-y", "-v", "error", "-i", base]
    for it in items:
        # each graphic's own frame 0 must land on its start time in the film
        cmd += ["-itsoffset", "%.3f" % it["t0"],
                "-framerate", str(FPS), "-i", f"{it['dir']}/f%05d.png"]
    parts = [f"[0:v]subtitles={ass}:fontsdir={MEDIA}/fonts[b0]"]
    prev = "[b0]"
    for k, it in enumerate(items):
        cmd_g = f"[{k+1}:v]format=yuva420p,setsar=1"
        lbl = f"[g{k}]"
        nxt = f"[b{k+1}]"
        a, b = it["t0"], it["t1"]
        parts.append(cmd_g + lbl)
        parts.append(f"{prev}{lbl}overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'{nxt}")
        prev = nxt
    parts.append(f"{prev}format=yuv420p[v]")
    cmd += ["-i", f"{MEDIA}/work/mix.wav",
            "-filter_complex", ";".join(parts),
            "-map", "[v]", "-map", f"{len(items)+1}:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-c:a", "aac", "-b:a", "256k", "-shortest",
            "-movflags", "+faststart", out]
    run(cmd, quiet=False)
    return out


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    starts, total = timeline()
    if which in ("all", "shots"):
        base, starts, total = step_shots()
    if which in ("all", "gfx"):
        step_gfx()
    if which in ("all", "audio"):
        ev = step_audio(starts, total)
        step_mix()
        step_subs(ev, total)
    if which in ("all", "final"):
        step_final(f"{MEDIA}/work/film.ass")
