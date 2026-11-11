#include "theme.h"
#include "log.h"

#include <algorithm>

namespace shoso {

static Theme g_themeDark;
static Theme g_themeLight = [] {
    Theme t;
    t.windowBg   = RGB(246, 246, 250);
    t.panelBg    = RGB(255, 255, 255);
    t.barBg      = RGB(248, 248, 252);
    t.listBg     = RGB(255, 255, 255);
    t.listAlt    = RGB(246, 246, 250);
    t.hoverBg    = RGB(236, 236, 244);
    t.selectedBg = RGB(224, 216, 255);
    t.border     = RGB(214, 214, 224);
    t.text       = RGB(28, 28, 36);
    t.textDim    = RGB(96, 96, 112);
    t.textFaint  = RGB(140, 140, 155);
    t.accent     = RGB(104, 70, 230);
    t.accentSoft = RGB(150, 125, 240);
    t.playing    = RGB(96, 60, 220);
    t.danger     = RGB(200, 60, 70);
    t.trackFill  = RGB(104, 70, 230);
    t.trackBg    = RGB(222, 222, 232);
    t.dark = false;
    return t;
}();
static bool g_dark = true;

const Theme& theme() { return g_dark ? g_themeDark : g_themeLight; }
void setThemeDark(bool dark) { g_dark = dark; }

// -------------------------------------------------------------------- fonts
static FontSet g_fonts;

static HFONT makeFont(int sizeAt96, int dpi, bool bold) {
    return CreateFontW(-MulDiv(sizeAt96, dpi, 72), 0, 0, 0, bold ? FW_SEMIBOLD : FW_NORMAL,
                       FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                       CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                       DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
}

FontSet& fontsFor(int dpi) {
    if (g_fonts.dpi == dpi && g_fonts.ui) return g_fonts;
    if (g_fonts.ui) {
        DeleteObject(g_fonts.ui); DeleteObject(g_fonts.uiBold);
        DeleteObject(g_fonts.title); DeleteObject(g_fonts.smallF); DeleteObject(g_fonts.status);
        DeleteObject(g_fonts.listF);
    }
    g_fonts.ui     = makeFont(10, dpi, false);
    g_fonts.uiBold = makeFont(10, dpi, true);
    g_fonts.title  = makeFont(11, dpi, true);
    g_fonts.smallF = makeFont(9, dpi, false);
    g_fonts.status = makeFont(9, dpi, false);
    g_fonts.listF = CreateFontW(-MulDiv(105, dpi, 720), 0, 0, 0, FW_NORMAL,
                                FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
    g_fonts.dpi = dpi;
    return g_fonts;
}

// ------------------------------------------------------------------ drawing
struct PenSel {
    HDC dc; HPEN pen, old;
    PenSel(HDC d, COLORREF c, int w) : dc(d) { pen = CreatePen(PS_SOLID, w, c); old = (HPEN)SelectObject(d, pen); }
    ~PenSel() { SelectObject(dc, old); DeleteObject(pen); }
};
struct BrushSel {
    HDC dc; HBRUSH br, old;
    BrushSel(HDC d, COLORREF c) : dc(d) { br = CreateSolidBrush(c); old = (HBRUSH)SelectObject(d, br); }
    ~BrushSel() { SelectObject(dc, old); DeleteObject(br); }
};
struct FontSel {
    HDC dc; HFONT old;
    FontSel(HDC d, HFONT f) : dc(d) { old = f ? (HFONT)SelectObject(d, f) : nullptr; }
    ~FontSel() { if (old) SelectObject(dc, old); }
};
struct NullBrushSel {
    HDC dc; HBRUSH old;
    NullBrushSel(HDC d) : dc(d) { old = (HBRUSH)SelectObject(d, GetStockObject(NULL_BRUSH)); }
    ~NullBrushSel() { SelectObject(dc, old); }
};

void fillSolid(HDC hdc, const RECT& r, COLORREF c) {
    BrushSel b(hdc, c);
    PenSel p(hdc, c, 1);
    Rectangle(hdc, r.left, r.top, r.right + 1, r.bottom + 1);
}

void frameRect(HDC hdc, const RECT& r, COLORREF c, int w) {
    PenSel p(hdc, c, w);
    NullBrushSel nb(hdc);
    Rectangle(hdc, r.left, r.top, r.right, r.bottom);
}

void roundRectFill(HDC hdc, const RECT& r, int radius, COLORREF c) {
    BrushSel b(hdc, c);
    PenSel p(hdc, c, 1);
    RoundRect(hdc, r.left, r.top, r.right, r.bottom, radius * 2, radius * 2);
}

void fillPolygon(HDC hdc, const POINT* pts, int n, COLORREF c) {
    BrushSel b(hdc, c);
    PenSel p(hdc, c, 1);
    Polygon(hdc, pts, n);
}

static bool hasHebrew(const std::wstring& w) {
    for (wchar_t ch : w) {
        if (ch >= 0x0590 && ch <= 0x05FF) return true;
        if (ch >= 0xFB1D && ch <= 0xFB4F) return true;
    }
    return false;
}

void drawTextU(HDC hdc, const std::string& utf8, RECT r, COLORREF color, HFONT font, DWORD align) {
    std::wstring w = utf8ToWide(utf8);
    if (w.empty()) return;
    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, color);
    FontSel f(hdc, font);
    DWORD flags = align;
    if (hasHebrew(w)) flags |= DT_RTLREADING;
    DrawTextW(hdc, w.c_str(), (int)w.size(), &r, flags);
}

int textWidthU(HDC hdc, const std::string& utf8, HFONT font) {
    std::wstring w = utf8ToWide(utf8);
    FontSel f(hdc, font);
    SIZE sz = {0, 0};
    GetTextExtentPoint32W(hdc, w.c_str(), (int)w.size(), &sz);
    return sz.cx;
}

std::string measureTextU(HDC, const std::string&, HFONT) { return std::string(); }

// ------------------------------------------------------------------- glyphs
namespace glyph {

static void poly(HDC hdc, const POINT* pts, int n, COLORREF c) {
    BrushSel b(hdc, c);
    PenSel p(hdc, c, 1);
    Polygon(hdc, pts, n);
}
static void line(HDC hdc, int x1, int y1, int x2, int y2, COLORREF c, int w) {
    PenSel p(hdc, c, w);
    MoveToEx(hdc, x1, y1, nullptr);
    LineTo(hdc, x2, y2);
}
static void circleFill(HDC hdc, int cx, int cy, int r, COLORREF c) {
    BrushSel b(hdc, c);
    PenSel p(hdc, c, 1);
    Ellipse(hdc, cx - r, cy - r, cx + r + 1, cy + r + 1);
}
static void circleOutline(HDC hdc, int cx, int cy, int r, COLORREF c, int w) {
    PenSel p(hdc, c, w);
    NullBrushSel nb(hdc);
    Ellipse(hdc, cx - r, cy - r, cx + r + 1, cy + r + 1);
}
static void rectFill(HDC hdc, int l, int t, int r, int b, COLORREF c) {
    BrushSel br(hdc, c);
    PenSel p(hdc, c, 1);
    Rectangle(hdc, l, t, r + 1, b + 1);
}
static void arrowHead(HDC hdc, int tipX, int tipY, int dx, int dy, int size, COLORREF c) {
    // dx,dy = unit direction the arrow points to
    int px = -dy, py = dx;
    POINT pts[3] = {
        {tipX, tipY},
        {tipX - dx * size + px * size / 2, tipY - dy * size + py * size / 2},
        {tipX - dx * size - px * size / 2, tipY - dy * size - py * size / 2},
    };
    poly(hdc, pts, 3, c);
}

void draw(HDC hdc, Kind k, const RECT& rr, COLORREF color, int dpi) {
    int w = rr.right - rr.left, h = rr.bottom - rr.top;
    if (w <= 0 || h <= 0) return;
    int s = std::min(w, h);
    int cx = rr.left + w / 2, cy = rr.top + h / 2;
    int u = std::max(1, s / 24);
    int lw = std::max(1, u * 2);
    int hw = std::max(1, u * 3);

    switch (k) {
        case Play: {
            POINT p[3] = {{cx + 5 * u, cy - 7 * u}, {cx + 5 * u, cy + 7 * u}, {cx - 6 * u, cy}};
            poly(hdc, p, 3, color);
            break;
        }
        case Pause:
            rectFill(hdc, cx - 6 * u, cy - 7 * u, cx - 2 * u, cy + 7 * u, color);
            rectFill(hdc, cx + 2 * u, cy - 7 * u, cx + 6 * u, cy + 7 * u, color);
            break;
        case Stop:
            rectFill(hdc, cx - 5 * u, cy - 5 * u, cx + 5 * u, cy + 5 * u, color);
            break;
        case Prev: {   // RTL: previous points right
            POINT p[3] = {{cx - 5 * u, cy - 7 * u}, {cx - 5 * u, cy + 7 * u}, {cx + 4 * u, cy}};
            poly(hdc, p, 3, color);
            rectFill(hdc, cx + 4 * u, cy - 7 * u, cx + 6 * u, cy + 7 * u, color);
            break;
        }
        case Next: {   // RTL: next points left
            POINT p[3] = {{cx + 5 * u, cy - 7 * u}, {cx + 5 * u, cy + 7 * u}, {cx - 4 * u, cy}};
            poly(hdc, p, 3, color);
            rectFill(hdc, cx - 6 * u, cy - 7 * u, cx - 4 * u, cy + 7 * u, color);
            break;
        }
        case Shuffle: {
            // B first (under), then A on top
            line(hdc, cx - 8 * u, cy + 4 * u, cx - 2 * u, cy + 4 * u, color, lw);
            line(hdc, cx - 2 * u, cy + 4 * u, cx + 2 * u, cy - 4 * u, color, lw);
            line(hdc, cx + 2 * u, cy - 4 * u, cx + 5 * u, cy - 4 * u, color, lw);
            arrowHead(hdc, cx + 8 * u, cy - 4 * u, 1, 0, hw, color);
            line(hdc, cx - 8 * u, cy - 4 * u, cx - 2 * u, cy - 4 * u, color, lw);
            line(hdc, cx - 2 * u, cy - 4 * u, cx + 2 * u, cy + 4 * u, color, lw);
            line(hdc, cx + 2 * u, cy + 4 * u, cx + 5 * u, cy + 4 * u, color, lw);
            arrowHead(hdc, cx + 8 * u, cy + 4 * u, 1, 0, hw, color);
            break;
        }
        case RepeatOff:
        case RepeatAll:
        case RepeatOne: {
            line(hdc, cx + 6 * u, cy - 4 * u, cx - 4 * u, cy - 4 * u, color, lw);
            arrowHead(hdc, cx - 7 * u, cy - 4 * u, -1, 0, hw, color);
            line(hdc, cx + 6 * u, cy - 4 * u, cx + 6 * u, cy + 0 * u, color, lw);
            line(hdc, cx - 6 * u, cy + 4 * u, cx + 4 * u, cy + 4 * u, color, lw);
            arrowHead(hdc, cx + 7 * u, cy + 4 * u, 1, 0, hw, color);
            line(hdc, cx - 6 * u, cy + 4 * u, cx - 6 * u, cy + 0 * u, color, lw);
            if (k == RepeatOne) {
                line(hdc, cx, cy - 2 * u, cx, cy + 2 * u, color, lw);
                line(hdc, cx - 2 * u, cy - 1 * u, cx, cy - 2 * u, color, lw);
            }
            break;
        }
        case Heart:
        case HeartFill: {
            bool fill = (k == HeartFill);
            if (fill) {
                circleFill(hdc, cx - 3 * u, cy - 2 * u, 4 * u, color);
                circleFill(hdc, cx + 3 * u, cy - 2 * u, 4 * u, color);
                POINT p[3] = {{cx - 7 * u, cy - 1 * u}, {cx + 7 * u, cy - 1 * u}, {cx, cy + 7 * u}};
                poly(hdc, p, 3, color);
            } else {
                circleOutline(hdc, cx - 3 * u, cy - 2 * u, 4 * u, color, lw);
                circleOutline(hdc, cx + 3 * u, cy - 2 * u, 4 * u, color, lw);
                line(hdc, cx - 7 * u, cy - 1 * u, cx, cy + 7 * u, color, lw);
                line(hdc, cx + 7 * u, cy - 1 * u, cx, cy + 7 * u, color, lw);
            }
            break;
        }
        case Search: {
            circleOutline(hdc, cx - 1 * u, cy - 1 * u, 5 * u, color, lw);
            line(hdc, cx + 3 * u, cy + 3 * u, cx + 7 * u, cy + 7 * u, color, lw + lw / 2);
            break;
        }
        case Menu:
            line(hdc, cx - 7 * u, cy - 5 * u, cx + 7 * u, cy - 5 * u, color, lw);
            line(hdc, cx - 7 * u, cy, cx + 7 * u, cy, color, lw);
            line(hdc, cx - 7 * u, cy + 5 * u, cx + 7 * u, cy + 5 * u, color, lw);
            break;
        case Folder: {
            rectFill(hdc, cx - 7 * u, cy - 2 * u, cx + 7 * u, cy + 6 * u, color);
            POINT p[4] = {{cx - 7 * u, cy - 2 * u}, {cx - 6 * u, cy - 6 * u},
                          {cx - 1 * u, cy - 6 * u}, {cx + 0 * u, cy - 2 * u}};
            poly(hdc, p, 4, color);
            break;
        }
        case Add:
            line(hdc, cx - 6 * u, cy, cx + 6 * u, cy, color, lw);
            line(hdc, cx, cy - 6 * u, cx, cy + 6 * u, color, lw);
            break;
        case Clock: {
            circleOutline(hdc, cx, cy, 7 * u, color, lw);
            line(hdc, cx, cy, cx, cy - 4 * u, color, lw);
            line(hdc, cx, cy, cx + 3 * u, cy + 1 * u, color, lw);
            break;
        }
        case Note: {
            circleFill(hdc, cx - 3 * u, cy + 5 * u, 3 * u, color);
            circleFill(hdc, cx + 4 * u, cy + 3 * u, 3 * u, color);
            line(hdc, cx - 1 * u, cy + 5 * u, cx - 1 * u, cy - 5 * u, color, lw);
            line(hdc, cx + 6 * u, cy + 3 * u, cx + 6 * u, cy - 7 * u, color, lw);
            line(hdc, cx - 1 * u, cy - 5 * u, cx + 6 * u, cy - 7 * u, color, lw * 2);
            break;
        }
        case Back: {   // RTL back points right
            line(hdc, cx + 4 * u, cy, cx - 3 * u, cy - 6 * u, color, lw);
            line(hdc, cx + 4 * u, cy, cx - 3 * u, cy + 6 * u, color, lw);
            break;
        }
        case Sort: {
            line(hdc, cx - 7 * u, cy - 5 * u, cx + 7 * u, cy - 5 * u, color, lw);
            line(hdc, cx - 3 * u, cy, cx + 7 * u, cy, color, lw);
            line(hdc, cx + 1 * u, cy + 5 * u, cx + 7 * u, cy + 5 * u, color, lw);
            line(hdc, cx - 5 * u, cy - 3 * u, cx - 5 * u, cy + 4 * u, color, lw);
            arrowHead(hdc, cx - 5 * u, cy + 7 * u, 0, 1, hw, color);
            break;
        }
        case Close:
            line(hdc, cx - 5 * u, cy - 5 * u, cx + 5 * u, cy + 5 * u, color, lw);
            line(hdc, cx - 5 * u, cy + 5 * u, cx + 5 * u, cy - 5 * u, color, lw);
            break;
        case Check:
            line(hdc, cx - 6 * u, cy, cx - 2 * u, cy + 4 * u, color, lw);
            line(hdc, cx - 2 * u, cy + 4 * u, cx + 6 * u, cy - 5 * u, color, lw);
            break;
        case Queue:
            line(hdc, cx - 7 * u, cy - 5 * u, cx + 7 * u, cy - 5 * u, color, lw);
            line(hdc, cx - 7 * u, cy, cx + 7 * u, cy, color, lw);
            line(hdc, cx - 7 * u, cy + 5 * u, cx - 1 * u, cy + 5 * u, color, lw);
            {
                POINT p[3] = {{cx + 6 * u, cy + 2 * u}, {cx + 6 * u, cy + 8 * u}, {cx + 1 * u, cy + 5 * u}};
                poly(hdc, p, 3, color);
            }
            break;
        case Trash: {
            rectFill(hdc, cx - 5 * u, cy - 3 * u, cx + 5 * u, cy + 7 * u, color);
            line(hdc, cx - 7 * u, cy - 4 * u, cx + 7 * u, cy - 4 * u, color, lw);
            rectFill(hdc, cx - 2 * u, cy - 7 * u, cx + 2 * u, cy - 5 * u, color);
            line(hdc, cx - 2 * u, cy - 1 * u, cx - 2 * u, cy + 5 * u, theme().windowBg, lw);
            line(hdc, cx + 2 * u, cy - 1 * u, cx + 2 * u, cy + 5 * u, theme().windowBg, lw);
            break;
        }
        case Info: {
            circleOutline(hdc, cx, cy, 7 * u, color, lw);
            line(hdc, cx, cy - 2 * u, cx, cy + 4 * u, color, lw);
            circleFill(hdc, cx, cy - 4 * u, u, color);
            break;
        }
        case Disc: {
            circleOutline(hdc, cx, cy, 7 * u, color, lw);
            circleFill(hdc, cx, cy, 2 * u, color);
            break;
        }
        case Mic: {
            roundRectFill(hdc, RECT{cx - 3 * u, cy - 8 * u, cx + 3 * u, cy + 2 * u}, 3 * u, color);
            // arc below
            PenSel p(hdc, color, lw);
            NullBrushSel nb(hdc);
            Arc(hdc, cx - 6 * u, cy - 4 * u, cx + 6 * u, cy + 8 * u, cx - 6 * u, cy + 2 * u, cx + 6 * u, cy + 2 * u);
            line(hdc, cx, cy + 6 * u, cx, cy + 8 * u, color, lw);
            line(hdc, cx - 3 * u, cy + 8 * u, cx + 3 * u, cy + 8 * u, color, lw);
            break;
        }
    }
}

} // namespace glyph

// -------------------------------------------------------------- flat button
void paintButtonBg(HDC hdc, const RECT& r, BtnSkin skin, const Theme& th, int dpi) {
    (void)dpi;
    COLORREF bg = 0;
    bool drawBg = false;
    if (!skin.enabled) {
        drawBg = false;
    } else if (skin.pressed) {
        bg = th.hoverBg; drawBg = true;
    } else if (skin.active) {
        bg = th.selectedBg; drawBg = true;
    } else if (skin.hovered) {
        bg = th.hoverBg; drawBg = true;
    }
    if (drawBg) {
        roundRectFill(hdc, r, std::max(3, (int)((r.bottom - r.top) / 5)), bg);
    }
    if (skin.active) {
        int t2 = std::max(2, (int)((r.bottom - r.top) / 14));
        RECT b = r;
        b.top = r.bottom - t2;
        b.bottom = r.bottom - 1;
        fillSolid(hdc, b, th.accent);
    }
}

void paintFlatButton(HDC hdc, const RECT& r, BtnSkin skin, const Theme& th,
                     glyph::Kind kind, int dpi, const std::string& label, HFONT labelFont) {
    paintButtonBg(hdc, r, skin, th, dpi);
    COLORREF fg = skin.enabled ? (skin.active ? th.accent : th.text) : th.textFaint;
    if (!label.empty()) {
        drawTextU(hdc, label, r, fg, labelFont ? labelFont : fontsFor(dpi).ui,
                  DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    } else {
        RECT inner = r;
        int pad = std::max(2, (int)((r.right - r.left) / 6));
        inner.left += pad; inner.right -= pad;
        inner.top += pad / 2; inner.bottom -= pad / 2;
        glyph::draw(hdc, kind, inner, fg, dpi);
    }
}

} // namespace shoso
