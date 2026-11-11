#!/usr/bin/env python3
"""Regenerates the SHOSO Music application icon (PNG + multi-size ICO).

    PYTHONPATH=tools/py python3 tools/make_icon.py [--png 256] [--out src/win/resources/app.ico]

Design: rounded square, purple->blue vertical gradient, translucent wave band,
white beamed double note. Rendered at 4x and downscaled for smooth edges.
Requires Pillow (see tools/get_zig.sh / pip install pillow).
"""
import argparse
import math
import os
import sys

from PIL import Image, ImageDraw

PURPLE = (139, 92, 246)
BLUE = (37, 118, 229)
WAVE = (255, 255, 255, 46)


def vgradient(size, top, bottom):
    g = Image.new("RGB", (1, 2), top)
    g.putpixel((0, 1), bottom)
    return g.resize((size, size), Image.BILINEAR)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def rotated_ellipse(layer_size, center, rx, ry, angle_deg, fill):
    """Draws a filled ellipse rotated by angle_deg onto a transparent RGBA layer."""
    pad = int(max(rx, ry) * 2 + 8)
    tmp = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    d.ellipse([pad - rx, pad - ry, pad + rx, pad + ry], fill=fill)
    tmp = tmp.rotate(angle_deg, resample=Image.BICUBIC, expand=False)
    layer = Image.new("RGBA", (layer_size, layer_size), (0, 0, 0, 0))
    layer.paste(tmp, (int(center[0] - pad), int(center[1] - pad)), tmp)
    return layer


def render(size):
    ss = size * 4                                  # supersample factor
    s = ss

    bg = vgradient(s, PURPLE, BLUE)

    # translucent wave sweeping from the lower left
    wave = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(wave).ellipse(
        [int(-0.55 * s), int(0.62 * s), int(1.05 * s), int(2.10 * s)], fill=WAVE)
    bg = Image.alpha_composite(bg.convert("RGBA"), wave)

    # white beamed double note
    fg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    stem_w = int(0.052 * s)
    x1 = int(0.415 * s)          # left stem left edge
    x2 = int(0.755 * s)          # right stem left edge
    beam_top1 = int(0.285 * s)   # beam top at the left
    beam_top2 = int(0.205 * s)   # beam top at the right (slanted up)
    beam_h = int(0.115 * s)
    head1_y = int(0.775 * s)
    head2_y = int(0.685 * s)
    # stems: from the beam down to the note heads
    d.rectangle([x1, beam_top1, x1 + stem_w, head1_y], fill=(255, 255, 255, 255))
    d.rectangle([x2, beam_top2, x2 + stem_w, head2_y], fill=(255, 255, 255, 255))
    # the slanted beam
    d.polygon([(x1, beam_top1), (x2 + stem_w, beam_top2),
               (x2 + stem_w, beam_top2 + beam_h), (x1, beam_top1 + beam_h)],
              fill=(255, 255, 255, 255))
    # note heads (slightly tilted ellipses)
    rx, ry = int(0.125 * s), int(0.088 * s)
    for cx, cy in ((int(0.335 * s), head1_y), (int(0.672 * s), head2_y)):
        fg = Image.alpha_composite(fg, rotated_ellipse(s, (cx, cy), rx, ry, -18,
                                                       (255, 255, 255, 255)))
    img = Image.alpha_composite(bg, fg)

    # clip to the rounded square
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_mask(s, int(0.24 * s)))
    return out.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", type=int, default=256, help="size of the exported preview png")
    ap.add_argument("--out", default="src/win/resources/app.ico")
    ap.add_argument("--preview", default="docs/icon_%d.png")
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ico = os.path.join(root, args.out)
    png = os.path.join(root, args.preview % args.png)

    sizes = [16, 24, 32, 48, 64, 96, 128, 256]
    imgs = [render(n) for n in sizes]
    os.makedirs(os.path.dirname(ico), exist_ok=True)
    imgs[-1].save(ico, format="ICO", sizes=[(n, n) for n in sizes],
              append_images=imgs[:-1])
    os.makedirs(os.path.dirname(png), exist_ok=True)
    render(args.png).save(png)
    print("wrote", ico, "and", png)
    return 0


if __name__ == "__main__":
    sys.exit(main())
