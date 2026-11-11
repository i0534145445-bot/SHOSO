// SHOSO Music - visual theme (dark by default) + vector drawn glyphs
#pragma once
#include "win_inc.h"

namespace shoso {

// Musicolet-like palette: neutral greys + green accent
struct Theme {
    COLORREF windowBg   = RGB(30, 30, 30);
    COLORREF panelBg    = RGB(40, 40, 40);
    COLORREF barBg      = RGB(30, 30, 30);
    COLORREF listBg     = RGB(30, 30, 30);
    COLORREF listAlt    = RGB(36, 36, 36);
    COLORREF hoverBg    = RGB(48, 48, 48);
    COLORREF selectedBg = RGB(58, 58, 58);
    COLORREF border     = RGB(66, 66, 66);
    COLORREF text       = RGB(236, 236, 236);
    COLORREF textDim    = RGB(163, 163, 163);
    COLORREF textFaint  = RGB(122, 122, 122);
    COLORREF accent     = RGB(93, 187, 99);
    COLORREF accentSoft = RGB(129, 199, 132);
    COLORREF playing    = RGB(129, 199, 132);
    COLORREF danger     = RGB(229, 115, 115);
    COLORREF trackFill  = RGB(93, 187, 99);
    COLORREF trackBg    = RGB(72, 72, 72);
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
void roundRectFrame(HDC hdc, const RECT& r, int radius, COLORREF c, int w = 1);
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
    Close, Check, Queue, Trash, Info, Disc, Mic,
    Person, PlayCircle, DotsV, ChevronDown, Handle, AddQueue, Speaker, Tag, Stack
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
