"""Animated graphic sequences rendered as RGBA PNG frame sequences."""
import math, os, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from core import (W, H, F, font, vis, draw_rtl, draw_center, text_wh,
                  INK, PARCH, GOLD, GOLD_L, CYAN, WHITE, fit_font)


# ------------------------------------------------------------ easing
def e_out(t, k=3.0):
    t = max(0.0, min(1.0, t))
    return 1.0 - (1.0 - t) ** k


def e_in(t, k=3.0):
    t = max(0.0, min(1.0, t))
    return t ** k


def e_io(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def seg(t, a, b):
    return max(0.0, min(1.0, (t - a) / max(1e-6, b - a)))


def rgba(w=W, h=H):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


_VGRAD_CACHE = {}


def vgrad(size, top=(0, 0, 0, 0), bot=(0, 0, 0, 220)):
    key = (size, top, bot)
    if key in _VGRAD_CACHE:
        return _VGRAD_CACHE[key].copy()
    w, h = size
    a = np.linspace(top[3], bot[3], h).astype(np.float32)[:, None]
    r = np.linspace(top[0], bot[0], h).astype(np.float32)[:, None]
    g = np.linspace(top[1], bot[1], h).astype(np.float32)[:, None]
    b = np.linspace(top[2], bot[2], h).astype(np.float32)[:, None]
    arr = np.zeros((h, w, 4), np.float32)
    arr[..., 0] = r; arr[..., 1] = g; arr[..., 2] = b; arr[..., 3] = a
    im = Image.fromarray(arr.astype(np.uint8), "RGBA")
    _VGRAD_CACHE[key] = im
    return im.copy()


def soft_glow(size, cx, cy, rad, color=(201, 162, 39), a=90):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / float(rad)
    al = np.clip(1.0 - d, 0, 1) ** 2.2 * a
    arr = np.zeros((h, w, 4), np.float32)
    arr[..., 0] = color[0]; arr[..., 1] = color[1]; arr[..., 2] = color[2]
    arr[..., 3] = al
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def rule(d, x0, x1, y, col, wd, prog, vertical=False):
    """Draw a hairline that grows from its centre."""
    if prog <= 0:
        return
    if vertical:
        cy = (x0 + x1) / 2.0
        half = (x1 - x0) / 2.0 * prog
        d.line([(y, cy - half), (y, cy + half)], fill=col, width=wd)
    else:
        cx = (x0 + x1) / 2.0
        half = (x1 - x0) / 2.0 * prog
        d.line([(cx - half, y), (cx + half, y)], fill=col, width=wd)


# ------------------------------------------------------------ writer
class Seq:
    def __init__(self, path, fps=25):
        self.dir = path
        self.fps = fps
        self.n = 0
        shutil.rmtree(path, ignore_errors=True)
        os.makedirs(path, exist_ok=True)

    def add(self, im):
        im.save(f"{self.dir}/f{self.n:05d}.png", compress_level=1)
        self.n += 1

    def __len__(self):
        return self.n


# ------------------------------------------------------------ elements
def chapter_card(out, num_heb, title, sub, bg, dur=4.2, layout="center", tag="", fps=25):
    """Animated chapter plate: blurred real background, hairline system, staged title."""
    s = Seq(out, fps)
    N = int(dur * fps)
    bgi = Image.open(bg).convert("RGB")
    bw, bh = bgi.size
    sc = max(W / bw, H / bh) * 1.14
    bgi = bgi.resize((int(bw * sc), int(bh * sc)), Image.BILINEAR)
    bgi = bgi.filter(ImageFilter.GaussianBlur(26))
    l, t = (bgi.width - W) // 2, (bgi.height - H) // 2
    bgi = bgi.crop((l, t, l + W, t + H))
    BZ = 1.08
    bgz = bgi.resize((int(W * BZ), int(H * BZ)), Image.BILINEAR)
    words = title.split()
    d0 = ImageDraw.Draw(rgba())

    for i in range(N):
        t_ = i / fps
        fr = rgba()
        # background push + brightness ramp
        z = 1.0 + 0.05 * (1 - e_out(seg(t_, 0, dur)))
        cw, ch = int(W * z / BZ), int(H * z / BZ)
        b = bgz.crop(((bgz.width - cw) // 2, (bgz.height - ch) // 2,
                      (bgz.width - cw) // 2 + cw, (bgz.height - ch) // 2 + ch))
        if (cw, ch) != (W, H):
            b = b.resize((W, H), Image.BILINEAR)
        fr.paste(b, (0, 0))
        shade = Image.new("RGBA", (W, H), (6, 8, 12, int(150 * e_out(seg(t_, 0, 0.7)))))
        fr = Image.alpha_composite(fr, shade)
        fr = Image.alpha_composite(fr, vgrad((W, H), (0, 0, 0, 40), (0, 0, 0, 190)))
        fr = Image.alpha_composite(fr, soft_glow((W, H), W * .5, H * .58, 760, GOLD, 46 * e_out(seg(t_, .2, 1.2))))

        d = ImageDraw.Draw(fr)
        # hairline system
        rp = e_out(seg(t_, 0.25, 0.95))
        gp = e_out(seg(t_, 2.9, 3.5))
        if layout == "center":
            rule(d, W * .30, W * .70, H * .40, GOLD + (int(150 * rp),), 2, rp)
            rule(d, W * .30, W * .70, H * .615, GOLD + (int(150 * rp),), 2, rp)
        elif layout == "right":
            rule(d, W * .52, W * .92, H * .40, GOLD + (int(150 * rp),), 2, rp)
            rule(d, W * .52, W * .92, H * .615, GOLD + (int(150 * rp),), 2, rp)
            rule(d, H * .40, H * .615, W * .92, GOLD + (int(120 * rp),), 2, rp, vertical=True)
        else:  # split
            rule(d, W * .08, W * .46, H * .40, GOLD + (int(150 * rp),), 2, rp)
            rule(d, W * .54, W * .92, H * .615, GOLD + (int(150 * rp),), 2, rp)

        # chapter number
        nf = font("sans", 34)
        na = int(255 * e_out(seg(t_, 0.45, 1.0)) * (1 - e_in(seg(t_, dur - .55, dur - .05))))
        if layout == "center":
            draw_center(d, (W * .5, H * .345), num_heb, nf, (214, 196, 150, na), spacing=14)
        else:
            draw_rtl(d, (W * .90, H * .345), num_heb, nf, (214, 196, 150, na), anchor="ra", spacing=14)

        # title words, staggered
        tf, ts = fit_font(d0, title, "title", int(W * (0.60 if layout != "center" else 0.72)), 150, 40)
        gap = int(ts * 0.30)
        widths = [text_wh(d0, w, tf)[0] for w in words]
        total = sum(widths) + gap * (len(words) - 1)
        if layout == "center":
            x = W * .5 + total / 2
        else:
            x = W * .90
        for k, w in enumerate(words):
            p = e_out(seg(t_, 0.62 + k * 0.13, 1.05 + k * 0.13))
            op = e_in(seg(t_, dur - .5, dur - .02))
            alpha = int(255 * p * (1 - op))
            dy = int((1 - p) * ts * 0.42)
            col = (246, 240, 224, alpha)
            if layout == "center":
                draw_rtl(d, (x, H * .50 + dy), w, tf, col, anchor="ra")
            else:
                draw_rtl(d, (x, H * .50 + dy), w, tf, col, anchor="ra")
            x -= widths[k] + gap

        # subtitle
        sf = font("sans_r", 40)
        sp = e_out(seg(t_, 1.75, 2.35))
        sop = e_in(seg(t_, dur - .5, dur - .02))
        scol = (226, 214, 186, int(235 * sp * (1 - sop)))
        if layout == "center":
            draw_center(d, (W * .5, H * .665), sub, sf, scol, spacing=12)
        else:
            draw_rtl(d, (W * .90, H * .665), sub, sf, scol, anchor="ra", spacing=12)

        if tag:
            tgf = font("sans", 26)
            tp = e_out(seg(t_, 2.35, 2.9))
            top_ = e_in(seg(t_, dur - .55, dur - .05))
            tcol = (200, 186, 158, int(200 * tp * (1 - top_)))
            if layout == "center":
                draw_center(d, (W * .5, H * .80), tag, tgf, tcol, spacing=10)
            else:
                draw_rtl(d, (W * .90, H * .80), tag, tgf, tcol, anchor="ra", spacing=10)

        s.add(fr)
    return s.dir, s.n


def kinetic(out, words, emph=None, dur=3.0, layout="stack", fps=25, sub=None):
    """Kinetic typography: staged build with size/weight contrast on the key word."""
    s = Seq(out, fps)
    N = int(dur * fps)
    d0 = ImageDraw.Draw(rgba())
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        outp = e_in(seg(t_, dur - .45, dur - .02))
        global_a = 1 - outp
        # soft scrim so text reads over footage
        if layout == "stack":
            scrim = vgrad((W, H), (0, 0, 0, 0), (0, 0, 0, 150))
            fr = Image.alpha_composite(fr, scrim)
        d = ImageDraw.Draw(fr)
        if layout == "stack":
            n = len(words)
            f_big, s_big = fit_font(d0, max(words, key=len), "title", int(W * .80), 128, 34)
            f_sm, s_sm = font("title2", int(s_big * 0.56)), int(s_big * 0.56)
            y = H * .40
            for k, w in enumerate(words):
                p = e_out(seg(t_, 0.12 + k * 0.20, 0.62 + k * 0.20))
                dy = int((1 - p) * 34)
                is_e = (emph is not None and k == emph)
                f = f_big if is_e else f_sm
                col = (250, 244, 230, int(255 * p * global_a)) if is_e else \
                      (216, 202, 172, int(240 * p * global_a))
                draw_center(d, (W * .5, y + dy + k * int(s_big * 0.86)), w, f, col)
                if is_e:
                    wp = e_out(seg(t_, 0.5 + k * 0.2, 1.0 + k * 0.2))
                    rule(d, W * .5 - s_big * 2.6, W * .5 + s_big * 2.6,
                         y + dy + k * int(s_big * 0.86) + int(s_big * .62),
                         GOLD + (int(170 * wp * global_a),), 3, wp)
        elif layout == "right":
            n = len(words)
            f_big, s_big = fit_font(d0, max(words, key=len), "title", int(W * .62), 116, 32)
            f_sm, s_sm = font("title2", int(s_big * 0.58)), int(s_big * 0.58)
            x, y = W * .90, H * .35
            for k, w in enumerate(words):
                p = e_out(seg(t_, 0.12 + k * 0.20, 0.62 + k * 0.20))
                dx = int((1 - p) * -46)
                is_e = (emph is not None and k == emph)
                f = f_big if is_e else f_sm
                col = (250, 244, 230, int(255 * p * global_a)) if is_e else \
                      (216, 202, 172, int(240 * p * global_a))
                draw_rtl(d, (x + dx, y + k * int(s_big * 0.90)), w, f, col, anchor="ra")
            rp = e_out(seg(t_, .1, .9))
            rule(d, H * .35 - s_big * .55, H * .35 + n * s_big * .90, W * .925,
                 GOLD + (int(150 * rp * global_a),), 3, rp, vertical=True)
        if sub:
            sp = e_out(seg(t_, 0.9, 1.5))
            f2 = font("sans_r", 38)
            draw_center(d, (W * .5, H * .86), sub, f2,
                        (222, 210, 182, int(220 * sp * global_a)), spacing=12)
        s.add(fr)
    return s.dir, s.n


def quote_card(out, quote, who, dur=5.0, fps=25, align="center", style="quote"):
    """A pulled quote: quotation marks grow, lines stagger in, attribution last."""
    s = Seq(out, fps)
    N = int(dur * fps)
    d0 = ImageDraw.Draw(rgba())
    lines = quote.split("|")
    qf, qs = fit_font(d0, max(lines, key=len), "title2", int(W * .74), 76, 28)
    wf = font("sans", 34)
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        fr = Image.alpha_composite(fr, vgrad((W, H), (0, 0, 0, 30), (0, 0, 0, 205)))
        d = ImageDraw.Draw(fr)
        outp = e_in(seg(t_, dur - .5, dur - .03))
        ga = 1 - outp
        mp = e_out(seg(t_, .05, .55))
        mcol = (201, 162, 39, int(150 * mp * ga))
        mf = font("title", 150)
        if align == "center":
            draw_center(d, (W * .5, H * .27), "״", mf, mcol)
        else:
            draw_rtl(d, (W * .90, H * .27), "״", mf, mcol, anchor="ra")
        lh = int(qs * 1.42)
        y0 = H * .5 - (len(lines) - 1) * lh / 2
        for k, ln in enumerate(lines):
            p = e_out(seg(t_, .30 + k * .28, .95 + k * .28))
            dy = int((1 - p) * 26)
            col = (248, 242, 228, int(255 * p * ga))
            if align == "center":
                draw_center(d, (W * .5, y0 + k * lh + dy), ln, qf, col)
            else:
                draw_rtl(d, (W * .90, y0 + k * lh + dy), ln, qf, col, anchor="ra")
        rp = e_out(seg(t_, .30, 1.0))
        rule(d, W * .5 - 260, W * .5 + 260, y0 + len(lines) * lh - int(qs * .4),
             GOLD + (int(140 * rp * ga),), 2, rp)
        wp = e_out(seg(t_, 1.05 + len(lines) * .28, 1.65 + len(lines) * .28))
        if who:
            if align == "center":
                draw_center(d, (W * .5, y0 + len(lines) * lh + int(qs * .35)), who, wf,
                            (212, 194, 150, int(230 * wp * ga)), spacing=12)
            else:
                draw_rtl(d, (W * .90, y0 + len(lines) * lh + int(qs * .35)), who, wf,
                         (212, 194, 150, int(230 * wp * ga)), anchor="ra", spacing=12)
        s.add(fr)
    return s.dir, s.n


def calendar_seq(out, dates, dur=4.6, fps=25):
    """A page that flips through dates and settles on the last one."""
    s = Seq(out, fps)
    N = int(dur * fps)
    d0 = ImageDraw.Draw(rgba())
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        fr = Image.alpha_composite(fr, vgrad((W, H), (0, 0, 0, 40), (0, 0, 0, 210)))
        d = ImageDraw.Draw(fr)
        idx = int(t_ / (dur / len(dates)))
        idx = min(idx, len(dates) - 1)
        local = (t_ - idx * (dur / len(dates))) / (dur / len(dates))
        flip = e_io(min(1.0, local * 2.2))
        sy = abs(math.cos(flip * math.pi)) if local < 0.5 else 1.0
        sy = max(0.06, sy)
        plate_w, plate_h = int(W * .40), int(H * .46 * sy)
        plate_w = max(8, plate_w)
        plate_h = max(8, plate_h)
        pw, ph = int(W * .40), int(H * .46)
        cx, cy = W * .5, H * .50
        plate = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        pd = ImageDraw.Draw(plate)
        pd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=14, fill=(236, 226, 200, 236))
        pd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=14, outline=(120, 96, 42, 220), width=3)
        pd.rectangle([0, 0, pw - 1, int(ph * .17)], fill=(150, 44, 40, 235))
        hf = font("sans_b", 40)
        draw_center(pd, (pw // 2, int(ph * .085)), dates[idx][0], hf, (246, 234, 206, 255), spacing=10)
        yf, ys = fit_font(d0, dates[idx][1], "title", int(pw * .78), 96, 30)
        draw_center(pd, (pw // 2, int(ph * .46)), dates[idx][1], yf, (32, 28, 24, 255))
        gf = font("sans", 30)
        draw_center(pd, (pw // 2, int(ph * .74)), dates[idx][2], gf, (86, 70, 44, 235), spacing=10)
        for k in range(3):
            pd.line([(int(pw * (.18 + k * .32)), int(ph * .82)),
                     (int(pw * (.18 + k * .32)), int(ph * .88))], fill=(120, 96, 42, 150), width=2)
        plate = plate.resize((plate_w, plate_h), Image.LANCZOS)
        fr.alpha_composite(plate, (int(cx - plate_w / 2), int(cy - plate_h / 2)))
        s.add(fr)
    return s.dir, s.n


def map_seq(out, bg, pts, dur=6.0, fps=25, labels=()):
    """Animated route across a map image. pts = [(x%,y%), ...]"""
    s = Seq(out, fps)
    N = int(dur * fps)
    m = Image.open(bg).convert("RGB")
    m = m.resize((W, H), Image.BILINEAR)
    MZ = 1.12
    mz = m.resize((int(W * MZ), int(H * MZ)), Image.BILINEAR)
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        z = 1.10 - 0.10 * e_out(seg(t_, 0, dur))
        cw, ch = int(W * z / MZ), int(H * z / MZ)
        mm = mz.crop(((mz.width - cw) // 2, (mz.height - ch) // 2,
                      (mz.width - cw) // 2 + cw, (mz.height - ch) // 2 + ch))
        if (cw, ch) != (W, H):
            mm = mm.resize((W, H), Image.BILINEAR)
        fr.paste(mm, (0, 0))
        fr = Image.alpha_composite(fr, vgrad((W, H), (0, 0, 0, 60), (0, 0, 0, 150)))
        d = ImageDraw.Draw(fr)
        P = [(x * W, y * H) for x, y in pts]
        prog = e_io(seg(t_, 0.35, dur - 1.3))
        # draw polyline progressively
        total = sum(math.dist(P[k], P[k + 1]) for k in range(len(P) - 1))
        want = total * prog
        acc = 0.0
        pts_d = [P[0]]
        for k in range(len(P) - 1):
            seg_len = math.dist(P[k], P[k + 1])
            if acc + seg_len <= want:
                pts_d.append(P[k + 1]); acc += seg_len
            else:
                f = (want - acc) / max(1e-6, seg_len)
                pts_d.append((P[k][0] + (P[k + 1][0] - P[k][0]) * f,
                              P[k][1] + (P[k + 1][1] - P[k][1]) * f))
                break
        if len(pts_d) > 1:
            d.line(pts_d, fill=(196, 150, 44, 235), width=5, joint="curve")
            d.line(pts_d, fill=(250, 232, 180, 160), width=2, joint="curve")
        for k, p in enumerate(P):
            ap = e_out(seg(t_, 0.35 + k * (dur - 2.0) / max(1, len(P)), 0.9 + k * (dur - 2.0) / max(1, len(P))))
            r = 9 + 5 * math.sin(t_ * 3 + k)
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=(240, 214, 150, int(240 * ap)),
                      outline=(120, 84, 20, int(220 * ap)), width=2)
        lf = font("title2", 52)
        for (txt, xp, yp, delay) in labels:
            ap = e_out(seg(t_, delay, delay + 0.7))
            d.text((xp * W, yp * H), vis(txt), font=lf, fill=(250, 244, 226, int(255 * ap)),
                   anchor="ma", stroke_width=6, stroke_fill=(10, 12, 16, int(220 * ap)))
        s.add(fr)
    return s.dir, s.n


def name_plate(out, name, role, dur=3.0, fps=25, side="right"):
    s = Seq(out, fps)
    N = int(dur * fps)
    d0 = ImageDraw.Draw(rgba())
    nf, ns = fit_font(d0, name, "title2", int(W * .40), 54, 26)
    rf = font("sans", 26)
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        d = ImageDraw.Draw(fr)
        p = e_out(seg(t_, 0.1, 0.7))
        outp = e_in(seg(t_, dur - .5, dur - .05))
        a = int(255 * p * (1 - outp))
        if side == "right":
            x = W * .955
            rule(d, H * 0, H * 0, 0, (0, 0, 0, 0), 1, 0)
            draw_rtl(d, (x, H * .80), name, nf, (248, 242, 226, a), anchor="ra")
            draw_rtl(d, (x, H * .80 + ns * 1.05), role, rf, (206, 190, 152, int(a * .9)),
                     anchor="ra", spacing=10)
            rule(d, W * .955 - (ns * 7), W * .955, H * .80 - ns * .62, GOLD + (int(170 * p * (1 - outp)),), 2, p)
        else:
            x = W * .045
            draw_rtl(d, (x, H * .80), name, nf, (248, 242, 226, a), anchor="la")
            draw_rtl(d, (x, H * .80 + ns * 1.05), role, rf, (206, 190, 152, int(a * .9)),
                     anchor="la", spacing=10)
        s.add(fr)
    return s.dir, s.n


def title_mask(out, text, dur=5.0, fps=25, size=420):
    """Black plate with the letters punched out: the footage shows through them."""
    s = Seq(out, fps)
    N = int(dur * fps)
    for i in range(N):
        t_ = i / fps
        p = e_out(seg(t_, 0.15, 1.1))
        z = 1.0 + 0.06 * (1 - p)
        fs = font("title", int(size * z))
        # opaque plate outside the letters, then it opens to reveal the full frame
        a = int(255 * (1.0 - e_io(seg(t_, dur - 1.6, dur - 0.45))))
        mask = Image.new("L", (W, H), a)
        md = ImageDraw.Draw(mask)
        md.text((W * .5, H * .5), vis(text), font=fs, fill=0, anchor="mm")
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        fr.putalpha(mask)
        s.add(fr)
    return s.dir, s.n


def credits_seq(out, lines, dur=16.0, fps=25, title=""):
    s = Seq(out, fps)
    N = int(dur * fps)
    tf = font("title", 62)
    lf = font("sans_r", 34)
    hf = font("sans_b", 36)
    step = H * .052
    total_h = len(lines) * step
    y0 = H * .92
    speed = (y0 + total_h + 60.0) / max(1e-6, dur)
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        fr = Image.alpha_composite(fr, Image.new("RGBA", (W, H), (8, 9, 13, 226)))
        d = ImageDraw.Draw(fr)
        y = y0 - t_ * speed
        ga = e_out(seg(t_, 0, .8)) * (1 - e_in(seg(t_, dur - 1.2, dur)))
        for k, (kind, txt) in enumerate(lines):
            yy = y + k * (H * .052)
            if yy < -60 or yy > H + 60:
                continue
            a = int(255 * ga)
            if kind == "h":
                draw_center(d, (W * .5, yy), txt, hf, (214, 178, 92, a), spacing=12)
            elif kind == "t":
                draw_center(d, (W * .5, yy), txt, tf, (244, 238, 224, a))
            else:
                draw_center(d, (W * .5, yy), txt, lf, (198, 190, 172, int(a * .92)), spacing=10)
        s.add(fr)
    return s.dir, s.n


def end_card(out, name, blessing, dur=8.0, fps=25):
    s = Seq(out, fps)
    N = int(dur * fps)
    d0 = ImageDraw.Draw(rgba())
    nf, ns = fit_font(d0, name, "title", int(W * .78), 104, 34)
    bf, bs = fit_font(d0, blessing, "title2", int(W * .66), 46, 22)
    for i in range(N):
        t_ = i / fps
        fr = rgba()
        fr = Image.alpha_composite(fr, Image.new("RGBA", (W, H), (8, 9, 13, 232)))
        d = ImageDraw.Draw(fr)
        ga = 1 - e_in(seg(t_, dur - 1.0, dur - .05))
        p1 = e_out(seg(t_, .35, 1.35))
        p2 = e_out(seg(t_, 1.5, 2.6))
        rp = e_out(seg(t_, 1.2, 2.0))
        rule(d, W * .5 - 300, W * .5 + 300, H * .40 - ns * .85, GOLD + (int(160 * rp * ga),), 2, rp)
        draw_center(d, (W * .5, H * .445 + (1 - p1) * 24), name, nf,
                    (250, 244, 228, int(255 * p1 * ga)))
        draw_center(d, (W * .5, H * .60 + (1 - p2) * 20), blessing, bf,
                    (214, 200, 168, int(238 * p2 * ga)), spacing=14)
        s.add(fr)
    return s.dir, s.n
