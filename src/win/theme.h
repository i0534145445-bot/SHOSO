// SHOSO Music - visual theme (dark by default) + vector drawn glyphs
#pragma once
#include "win_inc.h"

namespace shoso {

struct Theme {
    COLORREF windowBg   = RGB(16, 16, 22);
    COLORREF panelBg    = RGB(24, 24, 33);
    COLORREF barBg      = RGB(21, 21, 29);
    COLORREF listBg     = RGB(19, 19, 27);
    COLORREF listAlt    = RGB(24, 24, 33);
    COLORREF hoverBg    = RGB(33, 33, 45);
    COLORREF selectedBg = RGB(52, 45, 92);
    COLORREF border     = RGB(42, 42, 56);
    COLORREF text       = RGB(233, 233, 240);
    COLORREF textDim    = RGB(152, 152, 170);
    COLORREF textFaint  = RGB(104, 104, 122);
    COLORREF accent     = RGB(139, 108, 255);
    COLORREF accentSoft = RGB(88, 66, 190);
    COLORREF playing    = RGB(178, 156, 255);
    COLORREF danger     = RGB(235, 100, 110);
    COLORREF trackFill  = RGB(139, 108, 255);
    COLORREF trackBg    = RGB(52, 52, 68);
    bool dark = true;
};

const Theme& theme();
void setThemeDark(bool dark);

// fonts are created once per dpi; cached
struct FontSet {
    HFONT ui = nullptr;
    HFONT uiBold = nullptr;
    HFONT title = nullptr;
    HFONT smallF = nullptr;
    HFONT status = nullptr;
    HFONT listF = nullptr;
    int dpi = 0;
};
FontSet& fontsFor(int dpi);

// drawing helpers (take an already prepared HDC)
void fillSolid(HDC hdc, const RECT& r, COLORREF c);
void frameRect(HDC hdc, const RECT& r, COLORREF c, int w = 1);
void roundRectFill(HDC hdc, const RECT& r, int radius, COLORREF c);
void fillPolygon(HDC hdc, const POINT* pts, int n, COLORREF c);
void drawTextU(HDC hdc, const std::string& utf8, RECT r, COLORREF color, HFONT font,
               DWORD align = DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
std::string measureTextU(HDC hdc, const std::string& utf8, HFONT font);
int textWidthU(HDC hdc, const std::string& utf8, HFONT font);

// ------------------------------------------------------------- vector glyphs
namespace glyph {
enum Kind {
    Play, Pause, Stop, Prev, Next, Shuffle, RepeatAll, RepeatOne, RepeatOff,
    Heart, HeartFill, Search, Menu, Folder, Add, Clock, Note, Back, Sort,
    Close, Check, Queue, Trash, Info, Disc, Mic
};
void draw(HDC hdc, Kind k, const RECT& r, COLORREF color, int dpi);
} // namespace glyph

// owner drawn flat button state
struct BtnSkin {
    bool hovered = false;
    bool pressed = false;
    bool active = false;     // toggled-on look
    bool enabled = true;
};
void paintButtonBg(HDC hdc, const RECT& r, BtnSkin skin, const Theme& th, int dpi);
void paintFlatButton(HDC hdc, const RECT& r, BtnSkin skin, const Theme& th,
                     glyph::Kind kind, int dpi, const std::string& label = std::string(),
                     HFONT labelFont = nullptr);

} // namespace shoso
