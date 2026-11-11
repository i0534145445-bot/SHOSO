// SHOSO Music - main window: Musicolet-style layout, painting, routing, tray
#include "app.h"

#include <algorithm>

namespace shoso {

static const wchar_t* kMainClass = L"SHOSOMusic.MainWnd";

enum { CMD_TRAY_SHOW = 2000, CMD_TRAY_PLAY, CMD_TRAY_NEXT, CMD_TRAY_PREV, CMD_TRAY_EXIT };

struct BtnInfo {
    glyph::Kind kind = glyph::Menu;
    bool hover = false;
};
static std::map<HWND, BtnInfo> g_btns;
static BtnInfo& btnInfo(HWND h) { return g_btns[h]; }

static int sc(const App& a, int v) { return scale(v, a.dpi); }

// nav slots (right -> left): queues, songs, folders, albums, artists, playlists, now-playing, menu
static int navViewOf(int i) {
    switch (i) {
        case 0: return VIEW_QUEUE;
        case 1: return VIEW_SONGS;
        case 2: return VIEW_FOLDERS;
        case 3: return VIEW_ALBUMS;
        case 4: return VIEW_ARTISTS;
        default: return VIEW_PLAYLISTS;
    }
}
static glyph::Kind navGlyph(int i) {
    switch (i) {
        case 0: return glyph::Queue;
        case 1: return glyph::Note;
        case 2: return glyph::Folder;
        case 3: return glyph::Disc;
        case 4: return glyph::Person;
        case 5: return glyph::Stack;
        default: return glyph::Menu;
    }
}

static HWND makeButton(App& a, HWND parent, int id, glyph::Kind kind) {
    HWND hw = CreateWindowExW(0, L"BUTTON", L"", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                              0, 0, 10, 10, parent, (HMENU)(INT_PTR)id, a.hinst, nullptr);
    btnInfo(hw).kind = kind;
    return hw;
}

static LRESULT CALLBACK BtnSubclass(HWND h, UINT m, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR);
static void trackHover(HWND h) {
    TRACKMOUSEEVENT tme = {sizeof(tme)};
    tme.dwFlags = TME_LEAVE;
    tme.hwndTrack = h;
    TrackMouseEvent(&tme);
}
static LRESULT CALLBACK BtnSubclass(HWND h, UINT m, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR) {
    BtnInfo& bi = btnInfo(h);
    switch (m) {
        case WM_MOUSEMOVE:
            if (!bi.hover) { bi.hover = true; trackHover(h); InvalidateRect(h, nullptr, FALSE); }
            break;
        case WM_MOUSELEAVE:
            bi.hover = false;
            InvalidateRect(h, nullptr, FALSE);
            break;
    }
    return DefSubclassProc(h, m, w, l);
}

static LRESULT CALLBACK EditSubclass(HWND h, UINT m, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR) {
    if (m == WM_KEYDOWN) {
        if (w == VK_RETURN) {
            App& a = app();
            if (!a.rows.empty()) a.playRowsFrom(0);
            return 0;
        }
        if (w == VK_DOWN) { SetFocus(app().hwndList); return 0; }
        if (w == VK_ESCAPE) {
            SetWindowTextW(h, L"");
            SetFocus(app().hwndList);
            return 0;
        }
    }
    return DefSubclassProc(h, m, w, l);
}

static bool ptIn(const RECT& r, POINT p) { return p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom; }

// ------------------------------------------------------------------- layout
void App::relayout() {
    if (!hwnd) return;
    dpi = dpiOf(hwnd);
    GetClientRect(hwnd, &rcClient);
    int W = rcClient.right, H = rcClient.bottom;
    int qbarH = sc(*this, 48), row2H = sc(*this, 40);
    int searchH = sc(*this, 46), navH = sc(*this, 58);

    rcQueueBar = RECT{0, 0, W, qbarH};
    rcRow2 = RECT{0, qbarH, W, qbarH + row2H};
    rcNav = RECT{0, H - navH, W, H};
    rcSearchRow = RECT{0, H - navH - searchH, W, H - navH};
    rcList = RECT{0, rcRow2.bottom, W, rcSearchRow.top};
    rcNP = RECT{0, 0, W, rcNav.top};
    rcBottom = rcNP;

    FontSet& fs = fontsFor(dpi);
    SendMessageW(hwndSearch, WM_SETFONT, (WPARAM)fs.ui, TRUE);
    SendMessageW(hwndList, WM_SETFONT, (WPARAM)fs.ui, TRUE);
    for (auto& kv : g_btns) SendMessageW(kv.first, WM_SETFONT, (WPARAM)fs.ui, TRUE);

    // ---- queue bar: [ X ] [ N. name .... v ]  (rtl: dropdown hugs the right)
    int pad = sc(*this, 10);
    int dropW = std::min(sc(*this, 320), W / 2);
    int dropH = sc(*this, 32);
    int dy = (qbarH - dropH) / 2;
    RECT drop = {W - pad - dropW, dy, W - pad, dy + dropH};
    MoveWindow(btnQDrop, drop.left, drop.top, dropW, dropH, TRUE);
    MoveWindow(btnQClear, drop.left - sc(*this, 38), dy, sc(*this, 34), dropH, TRUE);

    // ---- row 2: play/pause, back, sort  (right side); menu lives in the nav bar
    int y2 = rcRow2.top + (row2H - sc(*this, 34)) / 2;
    int x = W - pad;
    MoveWindow(btnPlayPause, x - sc(*this, 34), y2, sc(*this, 34), sc(*this, 34), TRUE);
    x -= sc(*this, 38);
    MoveWindow(btnBack, x - sc(*this, 34), y2, sc(*this, 34), sc(*this, 34), TRUE);
    x -= sc(*this, 38);
    MoveWindow(btnSort, x - sc(*this, 34), y2, sc(*this, 34), sc(*this, 34), TRUE);

    // ---- search row
    g_searchBox = RECT{pad, rcSearchRow.top + sc(*this, 6), W - pad, rcSearchRow.bottom - sc(*this, 8)};
    MoveWindow(hwndSearch, g_searchBox.left + sc(*this, 10), g_searchBox.top + sc(*this, 5),
               (g_searchBox.right - g_searchBox.left) - sc(*this, 44),
               (g_searchBox.bottom - g_searchBox.top) - sc(*this, 10), TRUE);

    // ---- list + empty overlay
    MoveWindow(hwndList, rcList.left, rcList.top, rcList.right - rcList.left,
               rcList.bottom - rcList.top, TRUE);
    MoveWindow(hwndEmpty, rcList.left, rcList.top, rcList.right - rcList.left,
               rcList.bottom - rcList.top, TRUE);

    // ---- bottom navigation: 8 equal slots
    int slot = W / 8;
    for (int i = 0; i < 6; ++i)
        MoveWindow(btnNav[i], W - (i + 1) * slot, rcNav.top, slot, navH, TRUE);
    MoveWindow(btnNavNp, W - 7 * slot, rcNav.top, slot, navH, TRUE);
    MoveWindow(btnNavMenu, W - 8 * slot, rcNav.top, slot, navH, TRUE);

    npLayout();
    InvalidateRect(hwnd, nullptr, FALSE);
}

// "now playing" geometry + its two trackbars
void App::npLayout() {
    if (!hwnd) return;
    int W = rcNP.right, H = rcNP.bottom;
    int pad = sc(*this, 14);
    npBack = RECT{W - sc(*this, 50), sc(*this, 6), W - sc(*this, 10), sc(*this, 46)};

    int cover = std::min((W * 46) / 100, (H * 50) / 100);
    cover = std::max(cover, sc(*this, 150));
    int cy0 = sc(*this, 26);
    npCover = RECT{(W - cover) / 2, cy0, (W + cover) / 2, cy0 + cover};

    int ty = npCover.bottom + sc(*this, 18);
    int iconsY = ty + sc(*this, 84);
    int seekY = iconsY + sc(*this, 52);
    int transY = seekY + sc(*this, 52);

    int iw = sc(*this, 40), gap = sc(*this, 22);
    int total = 6 * iw + 5 * gap;
    int ix = (W - total) / 2;
    npHeart = RECT{ix, iconsY, ix + iw, iconsY + iw}; ix += iw + gap;
    npInfo = RECT{ix, iconsY, ix + iw, iconsY + iw}; ix += iw + gap;
    npAddQ = RECT{ix, iconsY, ix + iw, iconsY + iw}; ix += iw + gap;
    npSleep = RECT{ix, iconsY, ix + iw, iconsY + iw}; ix += iw + gap;
    npRepeat = RECT{ix, iconsY, ix + iw, iconsY + iw}; ix += iw + gap;
    npShuffle = RECT{ix, iconsY, ix + iw, iconsY + iw};

    int timeW = sc(*this, 48);
    if (hwndSeek) MoveWindow(hwndSeek, pad + timeW + sc(*this, 6), seekY + sc(*this, 8),
                             W - 2 * (pad + timeW + sc(*this, 6)), sc(*this, 26), TRUE);
    int pw = sc(*this, 46), gw = sc(*this, 30);
    int tw = 3 * pw + 2 * gw;
    int tx = (W - tw) / 2;
    npPrev = RECT{tx, transY, tx + pw, transY + pw}; tx += pw + gw;
    npPlay = RECT{tx, transY - sc(*this, 6), tx + pw + sc(*this, 10), transY + pw + sc(*this, 4)};
    tx += pw + gw + sc(*this, 10);
    npNext = RECT{tx, transY, tx + pw, transY + pw};
    if (hwndVol) MoveWindow(hwndVol, W - pad - sc(*this, 24) - sc(*this, 6) - sc(*this, 120),
                            transY + sc(*this, 10), sc(*this, 120), sc(*this, 26), TRUE);
}

void App::setNowPlaying(bool on) {
    if (showNowPlaying == on) return;
    showNowPlaying = on;
    int hide = on ? SW_HIDE : SW_SHOW;
    ShowWindow(hwndList, hide);
    ShowWindow(hwndEmpty, on ? SW_HIDE : (rows.empty() ? SW_SHOW : SW_HIDE));
    ShowWindow(hwndSearch, hide);
    ShowWindow(btnQDrop, hide);
    ShowWindow(btnQClear, hide);
    ShowWindow(btnPlayPause, hide);
    ShowWindow(btnSort, hide);
    ShowWindow(btnBack, (!on && !backStack.empty()) ? SW_SHOW : SW_HIDE);
    ShowWindow(hwndSeek, on ? SW_SHOW : SW_HIDE);
    ShowWindow(hwndVol, on ? SW_SHOW : SW_HIDE);
    npLayout();
    InvalidateRect(hwnd, nullptr, FALSE);
    if (!on) SetFocus(hwndList);
}

// ------------------------------------------------------------------- paints
static void paintQueueBar(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcQueueBar, th.windowBg);
}

static void paintRow2(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcRow2, th.windowBg);
    FontSet& fs = fontsFor(a.dpi);
    // position counter "i/n" centered, like Musicolet's queue header row
    int n = (int)a.q().size();
    int i = a.q().currentIndex();
    std::string counter = n > 0 ? std::to_string(i + 1) + "/" + std::to_string(n) : std::string();
    if (!counter.empty())
        drawTextU(hdc, counter, a.rcRow2, th.textDim, fs.ui, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
}

static void paintSearchRow(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcSearchRow, th.windowBg);
    RECT f = a.g_searchBox;
    roundRectFill(hdc, f, (f.bottom - f.top) / 2, th.panelBg);
    if (a.searchFocused || !a.search.empty()) {
        RECT u = {f.left + sc(a, 8), f.bottom - sc(a, 2), f.right - sc(a, 8), f.bottom};
        fillSolid(hdc, u, th.accent);
    }
    RECT ic = {f.right - sc(a, 34), f.top, f.right - sc(a, 10), f.bottom};
    glyph::draw(hdc, glyph::Search, ic, th.textFaint, a.dpi);
}

static void paintNav(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcNav, th.barBg);
    RECT line = {a.rcNav.left, a.rcNav.top, a.rcNav.right, a.rcNav.top + 1};
    fillSolid(hdc, line, th.border);
}

static std::string snackText(App& a) {
    if (a.scanning) return a.g_statusLeft;
    if (!a.flashMsg.empty() && (long)(a.flashUntil - GetTickCount()) > 0) return a.flashMsg;
    if (!a.playError.empty()) return a.playError;
    return std::string();
}

static void paintSnackbar(App& a, HDC hdc, const RECT& host) {
    std::string txt = snackText(a);
    if (txt.empty()) return;
    const Theme& th = theme();
    FontSet& fs = fontsFor(a.dpi);
    int tw = textWidthU(hdc, txt, fs.ui);
    int w = tw + sc(a, 28), h = sc(a, 30);
    int x = host.left + ((host.right - host.left) - w) / 2;
    RECT r = {x, host.bottom - h - sc(a, 6), x + w, host.bottom - sc(a, 6)};
    roundRectFill(hdc, r, sc(a, 6), th.panelBg);
    frameRect(hdc, r, th.border, 1);
    drawTextU(hdc, txt, r, a.scanning ? th.accent : th.text, fs.ui,
              DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
}

static void paintNowPlaying(App& a, HDC hdc) {
    const Theme& th = theme();
    FontSet& fs = fontsFor(a.dpi);
    fillSolid(hdc, a.rcNP, th.windowBg);

    glyph::draw(hdc, glyph::Back, a.npBack, th.textDim, a.dpi);

    // cover
    RECT c = a.npCover;
    roundRectFill(hdc, c, sc(a, 6), th.panelBg);
    const Track* t = a.currentTrack();
    HBITMAP art = t ? artForTrack(*t, c.right - c.left - 2) : nullptr;
    if (art) {
        HDC m = CreateCompatibleDC(hdc);
        HBITMAP old = (HBITMAP)SelectObject(m, art);
        BitBlt(hdc, c.left + 1, c.top + 1, c.right - c.left - 2, c.bottom - c.top - 2, m, 0, 0, SRCCOPY);
        SelectObject(m, old);
        DeleteDC(m);
    } else {
        glyph::draw(hdc, glyph::Note, c, th.textFaint, a.dpi);
    }

    if (t) {
        RECT r1 = {a.rcNP.left + sc(a, 30), c.bottom + sc(a, 14), a.rcNP.right - sc(a, 30), c.bottom + sc(a, 44)};
        RECT r2 = {r1.left, r1.bottom, r1.right, r1.bottom + sc(a, 24)};
        RECT r3 = {r1.left, r2.bottom, r1.right, r2.bottom + sc(a, 24)};
        drawTextU(hdc, t->displayTitle(), r1, th.text, fs.title, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        drawTextU(hdc, t->displayArtist(), r2, th.textDim, fs.ui, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        drawTextU(hdc, t->displayAlbum(), r3, th.textDim, fs.ui, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    } else {
        RECT r1 = {a.rcNP.left + sc(a, 30), c.bottom + sc(a, 14), a.rcNP.right - sc(a, 30), c.bottom + sc(a, 44)};
        drawTextU(hdc, "לא מתנגן כעת", r1, th.textFaint, fs.ui, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    }

    // action icon row
    bool fav = t && a.isFavorite(t->id);
    glyph::draw(hdc, fav ? glyph::HeartFill : glyph::Heart, a.npHeart, fav ? th.accent : th.textDim, a.dpi);
    glyph::draw(hdc, glyph::Info, a.npInfo, th.textDim, a.dpi);
    glyph::draw(hdc, glyph::AddQueue, a.npAddQ, th.textDim, a.dpi);
    bool sleepOn = a.sleepSecondsLeft > 0 || a.sleepAtEnd;
    glyph::draw(hdc, glyph::Clock, a.npSleep, sleepOn ? th.accent : th.textDim, a.dpi);
    glyph::Kind rk = a.q().repeat == RepeatMode::One ? glyph::RepeatOne :
                     a.q().repeat == RepeatMode::All ? glyph::RepeatAll : glyph::RepeatOff;
    glyph::draw(hdc, rk, a.npRepeat, a.q().repeat != RepeatMode::Off ? th.accent : th.textDim, a.dpi);
    glyph::draw(hdc, glyph::Shuffle, a.npShuffle, a.q().shuffle ? th.accent : th.textDim, a.dpi);

    // seek times
    long long dur = a.player.isOpen() ? a.player.lengthMs() : (t ? t->durationMs : 0);
    if (dur <= 0 && t) dur = t->durationMs;
    long long pos = a.seekDragging ? a.seekDragMs : a.lastPosMs;
    RECT pr = {a.rcNP.left + sc(a, 14), a.npShuffle.bottom + sc(a, 20),
               a.rcNP.left + sc(a, 14) + sc(a, 48), a.npShuffle.bottom + sc(a, 46)};
    RECT tr = {a.rcNP.right - sc(a, 14) - sc(a, 48), pr.top, a.rcNP.right - sc(a, 14), pr.bottom};
    drawTextU(hdc, formatClock(pos), pr, th.textDim, fs.status, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
    drawTextU(hdc, formatClock(dur), tr, th.textDim, fs.status, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

    // transport
    glyph::draw(hdc, glyph::Prev, a.npPrev, th.text, a.dpi);
    glyph::draw(hdc, glyph::Next, a.npNext, th.text, a.dpi);
    glyph::draw(hdc, a.playing ? glyph::Pause : glyph::Play, a.npPlay, th.text, a.dpi);
    RECT sp = {a.rcNP.right - sc(a, 14) - sc(a, 24), a.npPrev.top + sc(a, 10),
               a.rcNP.right - sc(a, 14), a.npPrev.top + sc(a, 36)};
    glyph::draw(hdc, glyph::Speaker, sp, th.textDim, a.dpi);

    paintSnackbar(a, hdc, a.rcNP);
}

// ------------------------------------------------------------- window proc
static void trayAdd(App& a);
static void trayUpdate(App& a);
static void trayRemove(App& a);
static void hideToTray(App& a);
static void showFromTray(App& a);
static void trayMenu(App& a);

static void onClose(App& a) {
    scannerCancel();
    a.saveNow();
    DestroyWindow(a.hwnd);
}

static void npHit(App& a, POINT p) {
    const Track* t = a.currentTrack();
    if (ptIn(a.npBack, p)) { a.setNowPlaying(false); return; }
    if (ptIn(a.npHeart, p)) { if (t) { a.toggleFavorite(t->id); InvalidateRect(a.hwnd, &a.rcNP, FALSE); } return; }
    if (ptIn(a.npInfo, p)) { if (t) openPropertiesDialog(t->id); return; }
    if (ptIn(a.npAddQ, p)) {
        if (t) {
            std::vector<uint32_t> ids = {t->id};
            POINT pt = {a.npAddQ.left, a.npAddQ.bottom};
            ClientToScreen(a.hwnd, &pt);
            showAddToPlaylistMenu(pt, ids);
        }
        return;
    }
    if (ptIn(a.npSleep, p)) { openSleepDialog(); return; }
    if (ptIn(a.npRepeat, p)) {
        RepeatMode r = a.q().repeat;
        r = (r == RepeatMode::Off) ? RepeatMode::All : (r == RepeatMode::All ? RepeatMode::One : RepeatMode::Off);
        a.q().repeat = r;
        a.markDirty();
        a.updateTransportUi();
        return;
    }
    if (ptIn(a.npShuffle, p)) {
        a.q().setShuffle(!a.q().shuffle, (uint32_t)GetTickCount());
        a.markDirty();
        a.updateTransportUi();
        if (a.view == VIEW_QUEUE) a.refreshList();
        return;
    }
    if (ptIn(a.npPrev, p)) { a.nextTrack(false); return; }
    if (ptIn(a.npNext, p)) { a.nextTrack(true); return; }
    if (ptIn(a.npPlay, p)) { a.togglePlay(); return; }
}

static LRESULT CALLBACK MainWndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    App& a = app();
    switch (m) {
        case WM_CREATE: {
            a.hwnd = h;
            a.dpi = dpiOf(h);
            a.hwndSearch = CreateWindowExW(WS_EX_RTLREADING, L"EDIT", L"",
                WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL | ES_RIGHT, 0, 0, 10, 10, h,
                (HMENU)(INT_PTR)IDC_SEARCH, a.hinst, nullptr);
            SendMessageW(a.hwndSearch, EM_SETCUEBANNER, TRUE, (LPARAM)L"חיפוש בספרייה...");
            SetWindowSubclass(a.hwndSearch, EditSubclass, 1, 0);

            a.hwndList = CreateWindowExW(0, WC_LISTVIEWW, L"",
                WS_CHILD | WS_VISIBLE | LVS_REPORT | LVS_OWNERDATA | LVS_OWNERDRAWFIXED |
                LVS_SHOWSELALWAYS | LVS_NOCOLUMNHEADER,
                0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_LIST, a.hinst, nullptr);
            ListView_SetExtendedListViewStyle(a.hwndList,
                LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER | LVS_EX_LABELTIP);
            ListView_SetBkColor(a.hwndList, theme().listBg);
            ListView_SetTextBkColor(a.hwndList, theme().listBg);
            ListView_SetTextColor(a.hwndList, theme().text);
            HMODULE ux = LoadLibraryW(L"uxtheme.dll");
            if (ux) {
                typedef HRESULT(WINAPI* FnSWT)(HWND, LPCWSTR, LPCWSTR);
                FnSWT swt = (FnSWT)(void*)GetProcAddress(ux, "SetWindowTheme");
                if (swt) swt(a.hwndList, L"DarkMode_Explorer", nullptr);
                FreeLibrary(ux);
            }

            a.hwndEmpty = CreateWindowExW(0, L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW,
                                          0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_EMPTY, a.hinst, nullptr);

            a.hwndSeek = CreateWindowExW(WS_EX_LAYOUTRTL, TRACKBAR_CLASSW, L"",
                WS_CHILD | TBS_HORZ | TBS_NOTICKS | TBS_FIXEDLENGTH,
                0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_SEEK, a.hinst, nullptr);
            a.hwndVol = CreateWindowExW(WS_EX_LAYOUTRTL, TRACKBAR_CLASSW, L"",
                WS_CHILD | TBS_HORZ | TBS_NOTICKS,
                0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_VOLUME, a.hinst, nullptr);
            SendMessageW(a.hwndSeek, TBM_SETRANGE, FALSE, MAKELONG(0, 1000));
            SendMessageW(a.hwndSeek, TBM_SETPAGESIZE, 0, 50);
            SendMessageW(a.hwndVol, TBM_SETRANGE, FALSE, MAKELONG(0, 100));
            SendMessageW(a.hwndVol, TBM_SETPOS, TRUE, a.settings.volume);

            a.btnQDrop = makeButton(a, h, IDC_QDROP, glyph::ChevronDown);
            a.btnQClear = makeButton(a, h, IDC_QCLEAR, glyph::Close);
            a.btnPlayPause = makeButton(a, h, IDC_PLAYPAUSE, glyph::Play);
            a.btnBack = makeButton(a, h, IDC_BACK, glyph::Back);
            a.btnSort = makeButton(a, h, IDC_SORT, glyph::Sort);
            for (int i = 0; i < 6; ++i) a.btnNav[i] = makeButton(a, h, IDC_NAV_FIRST + i, navGlyph(i));
            a.btnNavNp = makeButton(a, h, IDC_NAV_NP, glyph::PlayCircle);
            a.btnNavMenu = makeButton(a, h, IDC_NAV_MENU, glyph::DotsV);
            for (auto& kv : g_btns) SetWindowSubclass(kv.first, BtnSubclass, 2, 0);
            ShowWindow(a.btnBack, SW_HIDE);

            DragAcceptFiles(h, TRUE);
            SetTimer(h, TMR_POS, 300, nullptr);
            RegisterHotKey(h, HK_MEDIA_PLAY, MOD_NOREPEAT, VK_MEDIA_PLAY_PAUSE);
            RegisterHotKey(h, HK_MEDIA_NEXT, MOD_NOREPEAT, VK_MEDIA_NEXT_TRACK);
            RegisterHotKey(h, HK_MEDIA_PREV, MOD_NOREPEAT, VK_MEDIA_PREV_TRACK);
            RegisterHotKey(h, HK_MEDIA_STOP, MOD_NOREPEAT, VK_MEDIA_STOP);
            trayAdd(a);
            a.refreshList();
            a.relayout();
            a.updateTitle();
            a.updateTransportUi();
            return 0;
        }
        case WM_SIZE:
            a.relayout();
            return 0;
        case WM_MOVE:
            if (!IsIconic(h) && !IsZoomed(h)) {
                RECT wr; GetWindowRect(h, &wr);
                a.settings.windowX = wr.left; a.settings.windowY = wr.top;
                a.settings.windowW = wr.right - wr.left; a.settings.windowH = wr.bottom - wr.top;
            }
            return 0;
        case WM_DPICHANGED:
            a.dpi = HIWORD(w);
            {
                RECT* pr = (RECT*)l;
                SetWindowPos(h, nullptr, pr->left, pr->top, pr->right - pr->left,
                             pr->bottom - pr->top, SWP_NOZORDER | SWP_NOACTIVATE);
            }
            a.relayout();
            return 0;
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(h, &ps);
            RECT rc; GetClientRect(h, &rc);
            HDC mem = CreateCompatibleDC(hdc);
            HBITMAP bmp = CreateCompatibleBitmap(hdc, rc.right - rc.left, rc.bottom - rc.top);
            HBITMAP old = (HBITMAP)SelectObject(mem, bmp);
            fillSolid(mem, rc, theme().windowBg);
            if (a.showNowPlaying) {
                paintNowPlaying(a, mem);
                paintNav(a, mem);
            } else {
                paintQueueBar(a, mem);
                paintRow2(a, mem);
                paintSearchRow(a, mem);
                paintNav(a, mem);
                paintSnackbar(a, mem, a.rcRow2);
            }
            BitBlt(hdc, 0, 0, rc.right - rc.left, rc.bottom - rc.top, mem, 0, 0, SRCCOPY);
            SelectObject(mem, old);
            DeleteObject(bmp);
            DeleteDC(mem);
            EndPaint(h, &ps);
            return 0;
        }
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORSTATIC: {
            HDC hdc = (HDC)w;
            SetTextColor(hdc, theme().text);
            SetBkColor(hdc, theme().panelBg);
            SetBkMode(hdc, TRANSPARENT);
            static HBRUSH br = nullptr;
            static COLORREF brColor = 0;
            if (!br || brColor != theme().panelBg) {
                if (br) DeleteObject(br);
                br = CreateSolidBrush(theme().panelBg);
                brColor = theme().panelBg;
            }
            return (LRESULT)br;
        }
        case WM_MEASUREITEM:
            if (w == IDC_LIST) {
                MEASUREITEMSTRUCT* mis = (MEASUREITEMSTRUCT*)l;
                mis->itemHeight = (UINT)scale(64, a.dpi);
                return TRUE;
            }
            return 0;
        case WM_DRAWITEM: {
            UINT id = (UINT)w;
            DRAWITEMSTRUCT* di = (DRAWITEMSTRUCT*)l;
            if (id == IDC_LIST) { drawListRow(a, di); return TRUE; }
            if (id == IDC_EMPTY) {
                const Theme& th = theme();
                fillSolid(di->hDC, di->rcItem, th.listBg);
                FontSet& fs = fontsFor(a.dpi);
                int cx = (di->rcItem.left + di->rcItem.right) / 2;
                int cy = (di->rcItem.top + di->rcItem.bottom) / 2;
                RECT gr = {cx - sc(a, 40), cy - sc(a, 76), cx + sc(a, 40), cy - sc(a, 6)};
                glyph::draw(di->hDC, glyph::Note, gr, th.textFaint, a.dpi);
                RECT t1 = {di->rcItem.left, cy, di->rcItem.right, cy + sc(a, 30)};
                drawTextU(di->hDC, "הספרייה ריקה", t1, th.textDim, fs.title, DT_CENTER | DT_SINGLELINE);
                RECT t2 = {di->rcItem.left, cy + sc(a, 30), di->rcItem.right, cy + sc(a, 54)};
                bool hasFolders = !a.settings.musicFolders.empty();
                drawTextU(di->hDC, hasFolders ? "לא נמצאו שירים בתיקיות שנבחרו" :
                          "לחצו כאן כדי לבחור תיקיית מוזיקה", t2, th.textFaint, fs.ui,
                          DT_CENTER | DT_SINGLELINE);
                return TRUE;
            }
            auto it = g_btns.find(di->hwndItem);
            if (it == g_btns.end()) return TRUE;
            const Theme& th = theme();
            BtnSkin skin;
            skin.hovered = it->second.hover;
            skin.pressed = (di->itemState & ODS_SELECTED) != 0;
            skin.enabled = (di->itemState & ODS_DISABLED) == 0;
            RECT r = di->rcItem;
            bool active = false;
            glyph::Kind kind = it->second.kind;
            COLORREF gc = skin.enabled ? th.textDim : th.textFaint;
            if (id >= IDC_NAV_FIRST && id < IDC_NAV_FIRST + 6) {
                active = !a.showNowPlaying && a.view == navViewOf((int)id - IDC_NAV_FIRST);
            } else if (id == IDC_NAV_NP) {
                active = a.showNowPlaying;
            } else if (id == IDC_PLAYPAUSE) {
                kind = a.playing ? glyph::Pause : glyph::Play;
                gc = skin.enabled ? th.text : th.textFaint;
            } else if (id == IDC_QCLEAR) {
                gc = th.textFaint;
            }
            if (skin.hovered && skin.enabled) roundRectFill(di->hDC, r, sc(a, 8), th.hoverBg);
            if (id == IDC_QDROP) {
                roundRectFill(di->hDC, r, sc(a, 6), th.panelBg);
                frameRect(di->hDC, r, th.border, 1);
                RECT chev = {r.left + sc(a, 6), r.top, r.left + sc(a, 26), r.bottom};
                glyph::draw(di->hDC, glyph::ChevronDown, chev, th.textDim, a.dpi);
                RECT tx = {r.left + sc(a, 28), r.top, r.right - sc(a, 10), r.bottom};
                std::string label = std::to_string(a.activeQueue + 1) + ". " + a.q().name;
                drawTextU(di->hDC, label, tx, th.text, fontsFor(a.dpi).uiBold,
                          DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
                return TRUE;
            }
            if (id >= IDC_NAV_FIRST && id <= IDC_NAV_MENU) {
                int gh = r.bottom - r.top;
                int gw = r.right - r.left;
                int side = std::min(gw, gh) - 2 * (gh / 5);
                RECT gr = {r.left + (gw - side) / 2, r.top + gh / 5,
                           r.left + (gw + side) / 2, r.top + gh / 5 + side};
                glyph::draw(di->hDC, kind, gr, active ? th.accent : gc, a.dpi);
                if (active) {
                    RECT u = {r.left + (r.right - r.left) / 2 - sc(a, 14), r.bottom - sc(a, 4),
                              r.left + (r.right - r.left) / 2 + sc(a, 14), r.bottom - sc(a, 1)};
                    fillSolid(di->hDC, u, th.accent);
                }
                return TRUE;
            }
            glyph::draw(di->hDC, kind, r, gc, a.dpi);
            return TRUE;
        }
        case WM_HSCROLL: {
            HWND sb = (HWND)l;
            int code = LOWORD(w);
            if (sb == a.hwndSeek) {
                int pos = (int)SendMessageW(a.hwndSeek, TBM_GETPOS, 0, 0);
                const Track* t = a.currentTrack();
                long long dur = a.player.isOpen() ? a.player.lengthMs() : (t ? t->durationMs : 0);
                if (dur <= 0) return 0;
                long long ms = dur * pos / 1000;
                if (code == SB_THUMBTRACK) {
                    a.seekDragging = true;
                    a.seekDragMs = ms;
                    InvalidateRect(h, &a.rcNP, FALSE);
                } else if (code == SB_ENDSCROLL || code == SB_THUMBPOSITION) {
                    if (a.seekDragging) { a.seekDragging = false; a.seekTo(a.seekDragMs); }
                } else {
                    a.seekTo(ms);
                }
            } else if (sb == a.hwndVol) {
                int pos = (int)SendMessageW(a.hwndVol, TBM_GETPOS, 0, 0);
                a.setVolume(pos);
            }
            return 0;
        }
        case WM_NOTIFY:
            return onNotify(a, h, (NMHDR*)l);
        case WM_COMMAND: {
            int id = LOWORD(w);
            int code = HIWORD(w);
            if (code == EN_CHANGE && id == IDC_SEARCH) {
                wchar_t buf[256] = {0};
                GetWindowTextW(a.hwndSearch, buf, 255);
                a.pendingSearch = U(buf);
                SetTimer(h, TMR_SEARCH, 250, nullptr);
                InvalidateRect(h, &a.rcSearchRow, FALSE);
                return 0;
            }
            if ((code == EN_SETFOCUS || code == EN_KILLFOCUS) && id == IDC_SEARCH) {
                a.searchFocused = (code == EN_SETFOCUS);
                InvalidateRect(h, &a.rcSearchRow, FALSE);
                return 0;
            }
            if (code == BN_CLICKED || code == BN_DOUBLECLICKED) { onButton(a, id); return 0; }
            if (code == 0) { onMenuCommand(a, id); return 0; }
            return 0;
        }
        case WM_LBUTTONUP:
            if (a.showNowPlaying) {
                POINT p = {LOWORD(l), HIWORD(l)};
                npHit(a, p);
            }
            return 0;
        case WM_KEYDOWN: {
            if (GetFocus() == a.hwndSearch) return DefWindowProcW(h, m, w, l);
            bool ctrl = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
            if (w == VK_SPACE) { a.togglePlay(); return 0; }
            if (w == VK_F5) { a.startScan(true); return 0; }
            if (w == VK_DELETE && a.view == VIEW_QUEUE) { onMenuCommand(a, CMD_ROW_REMOVE_QUEUE); return 0; }
            if (ctrl && w == 'F') { SetFocus(a.hwndSearch); return 0; }
            if (w == VK_ESCAPE) {
                if (a.showNowPlaying) { a.setNowPlaying(false); return 0; }
                if (!a.backStack.empty() || a.scope.valid()) a.goBack();
                return 0;
            }
            if (w == VK_RETURN && a.showNowPlaying) { a.togglePlay(); return 0; }
            if (w >= '1' && w <= '6' && ctrl) { a.setView(navViewOf((int)(w - '1'))); return 0; }
            return DefWindowProcW(h, m, w, l);
        }
        case WM_TIMER: {
            switch (w) {
                case TMR_POS: {
                    if (!a.flashMsg.empty() && (long)(a.flashUntil - GetTickCount()) <= 0)
                        a.updateStatusText();
                    if (a.playing && a.player.isOpen() && !a.seekDragging) {
                        long long pos = a.player.positionMs();
                        a.q().positionMs = pos;
                        a.lastPosMs = pos;
                        SendMessageW(a.hwndSeek, TBM_SETPOS, (WPARAM)FALSE,
                                     (LPARAM)(pos * 1000 / std::max<long long>(1, a.player.lengthMs())));
                        if (a.showNowPlaying) InvalidateRect(h, &a.rcNP, FALSE);
                        long long dur = a.player.lengthMs();
                        if (dur > 0 && pos >= dur - 150) {
                            KillTimer(h, TMR_POS);
                            onTrackEnded(a);
                            SetTimer(h, TMR_POS, 300, nullptr);
                        }
                    }
                    return 0;
                }
                case TMR_SLEEP: {
                    if (a.sleepSecondsLeft <= 0 && !a.sleepAtEnd) { KillTimer(h, TMR_SLEEP); return 0; }
                    if (a.sleepSecondsLeft > 0) {
                        --a.sleepSecondsLeft;
                        if (a.sleepSecondsLeft <= 0) {
                            a.sleepAtEnd = false;
                            a.player.pause();
                            a.playing = false;
                            a.updateTransportUi();
                            KillTimer(h, TMR_SLEEP);
                        }
                        a.updateStatusText();
                    }
                    return 0;
                }
                case TMR_SAVE:
                    if (a.dirty) a.saveNow();
                    return 0;
                case TMR_SEARCH: {
                    KillTimer(h, TMR_SEARCH);
                    if (a.pendingSearch != a.search) {
                        a.search = a.pendingSearch;
                        a.refreshList();
                    }
                    return 0;
                }
            }
            return 0;
        }
        case MM_MCINOTIFY:
            if (w == MCI_NOTIFY_SUCCESSFUL) onTrackEnded(a);
            else if (w == MCI_NOTIFY_FAILURE) {
                a.playing = false;
                a.updateTransportUi();
            }
            return 0;
        case WM_HOTKEY:
            switch (w) {
                case HK_MEDIA_PLAY: a.togglePlay(); break;
                case HK_MEDIA_NEXT: a.nextTrack(true); break;
                case HK_MEDIA_PREV: a.nextTrack(false); break;
                case HK_MEDIA_STOP:
                    a.player.stopAndClose(); a.playing = false; a.updateTransportUi();
                    break;
            }
            return 0;
        case WM_APPCOMMAND: {
            int cmd = GET_APPCOMMAND_LPARAM(l);
            switch (cmd) {
                case APPCOMMAND_MEDIA_PLAY_PAUSE: a.togglePlay(); return TRUE;
                case APPCOMMAND_MEDIA_NEXTTRACK: a.nextTrack(true); return TRUE;
                case APPCOMMAND_MEDIA_PREVIOUSTRACK: a.nextTrack(false); return TRUE;
                case APPCOMMAND_MEDIA_STOP:
                    a.player.stopAndClose(); a.playing = false; a.updateTransportUi(); return TRUE;
            }
            return DefWindowProcW(h, m, w, l);
        }
        case WM_DROPFILES: {
            HDROP hd = (HDROP)w;
            UINT n = DragQueryFileW(hd, 0xFFFFFFFF, nullptr, 0);
            std::vector<std::string> paths;
            for (UINT i = 0; i < n; ++i) {
                wchar_t buf[MAX_PATH + 1] = {0};
                if (DragQueryFileW(hd, i, buf, MAX_PATH)) paths.push_back(U(buf));
            }
            DragFinish(hd);
            if (!paths.empty()) a.openFiles(paths);
            return 0;
        }
        case WM_COPYDATA: {
            COPYDATASTRUCT* cds = (COPYDATASTRUCT*)l;
            if (cds->dwData == WM_SHOSO_OPENFILES && cds->lpData && cds->cbData) {
                std::string s((const char*)cds->lpData, cds->cbData);
                std::vector<std::string> paths = split(s, '\n');
                if (!paths.empty()) {
                    a.openFiles(paths);
                    showFromTray(a);
                }
            }
            return 0;
        }
        case WM_SHOSO_BATCH:
            a.onScanBatch((std::vector<Track>*)w);
            return 0;
        case WM_SHOSO_SCANDONE:
            a.onScanDone((ScanStats*)w);
            return 0;
        case WM_SHOSO_TRAY: {
            if (l == WM_LBUTTONDBLCLK || l == WM_LBUTTONUP) showFromTray(a);
            else if (l == WM_RBUTTONUP) trayMenu(a);
            return 0;
        }
        case WM_SYSCOMMAND:
            if ((w & 0xFFF0) == SC_MINIMIZE && a.settings.minimizeToTray) {
                hideToTray(a);
                return 0;
            }
            return DefWindowProcW(h, m, w, l);
        case WM_CLOSE:
            onClose(a);
            return 0;
        case WM_DESTROY:
            scannerCancel();
            trayRemove(a);
            KillTimer(h, TMR_POS); KillTimer(h, TMR_SLEEP); KillTimer(h, TMR_SAVE); KillTimer(h, TMR_SEARCH);
            UnregisterHotKey(h, HK_MEDIA_PLAY); UnregisterHotKey(h, HK_MEDIA_NEXT);
            UnregisterHotKey(h, HK_MEDIA_PREV); UnregisterHotKey(h, HK_MEDIA_STOP);
            a.saveNow();
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

// --------------------------------------------------------------------- tray
static NOTIFYICONDATAW g_nid = {0};
static bool g_trayOk = false;

static void trayAdd(App& a) {
    g_nid.cbSize = sizeof(g_nid);
    g_nid.hWnd = a.hwnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    g_nid.uCallbackMessage = WM_SHOSO_TRAY;
    g_nid.hIcon = LoadIconW(a.hinst, MAKEINTRESOURCEW(101));
    lstrcpynW(g_nid.szTip, W(kAppNameHe).c_str(), 63);
    g_trayOk = Shell_NotifyIconW(NIM_ADD, &g_nid) != FALSE;
}

static void trayUpdate(App& a) {
    if (!g_trayOk) return;
    const Track* t = a.currentTrack();
    std::wstring tip = W(kAppNameHe);
    if (t) tip = W(t->displayTitle() + " - " + t->displayArtist());
    lstrcpynW(g_nid.szTip, tip.c_str(), 63);
    g_nid.uFlags = NIF_TIP;
    Shell_NotifyIconW(NIM_MODIFY, &g_nid);
}

static void trayRemove(App& a) {
    (void)a;
    if (g_trayOk) Shell_NotifyIconW(NIM_DELETE, &g_nid);
    g_trayOk = false;
}

static void hideToTray(App& a) {
    ShowWindow(a.hwnd, SW_HIDE);
    trayUpdate(a);
}

static void showFromTray(App& a) {
    ShowWindow(a.hwnd, SW_SHOW);
    if (IsIconic(a.hwnd)) ShowWindow(a.hwnd, SW_RESTORE);
    SetForegroundWindow(a.hwnd);
}

static void trayMenu(App& a) {
    HMENU m = CreatePopupMenu();
    const Track* t = a.currentTrack();
    if (t) {
        AppendMenuW(m, MF_STRING | MF_GRAYED, 0, W(t->displayTitle()).c_str());
        AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
    }
    AppendMenuW(m, MF_STRING, CMD_TRAY_PLAY, a.playing ? L"השהייה" : L"נגינה");
    AppendMenuW(m, MF_STRING, CMD_TRAY_NEXT, L"השיר הבא");
    AppendMenuW(m, MF_STRING, CMD_TRAY_PREV, L"השיר הקודם");
    AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(m, MF_STRING, CMD_TRAY_SHOW, L"הצגת החלון");
    AppendMenuW(m, MF_STRING, CMD_TRAY_EXIT, L"יציאה");
    SetForegroundWindow(a.hwnd);
    POINT pt;
    GetCursorPos(&pt);
    int cmd = (int)TrackPopupMenu(m, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_LAYOUTRTL, pt.x, pt.y, 0, a.hwnd, nullptr);
    DestroyMenu(m);
    switch (cmd) {
        case CMD_TRAY_PLAY: a.togglePlay(); break;
        case CMD_TRAY_NEXT: a.nextTrack(true); break;
        case CMD_TRAY_PREV: a.nextTrack(false); break;
        case CMD_TRAY_SHOW: showFromTray(a); break;
        case CMD_TRAY_EXIT: a.saveNow(); DestroyWindow(a.hwnd); break;
    }
}

// ------------------------------------------------------------------ public
void App::updateTitle() {
    const Track* t = currentTrack();
    std::string title = kAppNameHe;
    if (t && playing) title = t->displayTitle() + " - " + t->displayArtist() + " | " + kAppNameHe;
    SetWindowTextW(hwnd, W(title).c_str());
}

void App::updateTransportUi() {
    if (!hwnd) return;
    const Track* t = currentTrack();
    long long dur = player.isOpen() ? player.lengthMs() : (t ? t->durationMs : 0);
    if (dur <= 0 && t) dur = t->durationMs;
    if (!seekDragging) {
        SendMessageW(hwndSeek, TBM_SETPOS, (WPARAM)TRUE,
                     (LPARAM)(dur > 0 ? lastPosMs * 1000 / dur : 0));
    }
    InvalidateRect(btnPlayPause, nullptr, TRUE);
    InvalidateRect(btnNavNp, nullptr, TRUE);
    if (showNowPlaying) InvalidateRect(hwnd, &rcNP, FALSE);
    InvalidateRect(hwnd, &rcRow2, FALSE);
    updateTitle();
    trayUpdate(*this);
}

void App::updateNowArt(bool force) {
    const Track* t = currentTrack();
    uint32_t id = t ? t->id : 0;
    if (!force && id == nowArtTrack) return;
    nowArtTrack = id;
    InvalidateRect(hwnd, &rcNP, FALSE);
    InvalidateRect(hwndList, nullptr, FALSE);
}

void App::updateStatusText() {
    long long totalMs = 0;
    size_t count = rows.size();
    if (view == VIEW_SONGS || view == VIEW_QUEUE) {
        for (const Row& r : rows) {
            const Track* t = library.byId(r.trackId);
            if (t) totalMs += t->durationMs;
        }
    }
    std::string right;
    if (scope.valid()) right = scope.label + " · ";
    else right = std::string(kViewNamesHe[view]) + " · ";
    right += hePlural((int)count, view == VIEW_ALBUMS ? "אלבום" :
                      view == VIEW_ARTISTS ? "אמן" :
                      view == VIEW_FOLDERS ? "תיקייה" :
                      view == VIEW_PLAYLISTS ? "פלייליסט" : "שיר",
                      view == VIEW_ALBUMS ? "אלבומים" :
                      view == VIEW_ARTISTS ? "אמנים" :
                      view == VIEW_FOLDERS ? "תיקיות" :
                      view == VIEW_PLAYLISTS ? "פלייליסטים" : "שירים");
    if (totalMs > 0) right += " · " + formatLongDuration(totalMs);

    std::string left;
    if (scanning) {
        left = "סורק תיקיות... " + std::to_string(scannedTracks) + " שירים נמצאו";
    } else {
        left = q().name + " · " + hePlural((int)q().size(), "שיר", "שירים");
        if (sleepSecondsLeft > 0) {
            left += " · שינה בעוד " + formatClock((long long)sleepSecondsLeft * 1000);
        } else if (sleepAtEnd) {
            left += " · עצירה בסוף השיר";
        }
    }
    g_statusRight = right;
    if (!flashMsg.empty() && (long)(flashUntil - GetTickCount()) > 0) {
        g_statusLeft = flashMsg;
    } else {
        if (!flashMsg.empty()) flashMsg.clear();
        g_statusLeft = playError.empty() ? left : playError;
    }
    if (hwnd) {
        InvalidateRect(hwnd, &rcRow2, FALSE);
        if (showNowPlaying) InvalidateRect(hwnd, &rcNP, FALSE);
    }
}

void App::flash(const std::string& msg, unsigned long ms) {
    flashMsg = msg;
    flashUntil = GetTickCount() + (ms ? ms : 5000);
    g_statusLeft = msg;
    if (hwnd) {
        InvalidateRect(hwnd, &rcRow2, FALSE);
        if (showNowPlaying) InvalidateRect(hwnd, &rcNP, FALSE);
    }
}

// ------------------------------------------------------------------ create
bool registerMainClass(HINSTANCE hinst) {
    WNDCLASSEXW wc = {sizeof(wc)};
    wc.lpfnWndProc = MainWndProc;
    wc.hInstance = hinst;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = nullptr;
    wc.lpszClassName = kMainClass;
    wc.hIcon = LoadIconW(hinst, MAKEINTRESOURCEW(101));
    wc.hIconSm = LoadIconW(hinst, MAKEINTRESOURCEW(101));
    return RegisterClassExW(&wc) != 0;
}

HWND createMainWindow(HINSTANCE hinst) {
    App& a = app();
    a.hinst = hinst;
    if (!registerMainClass(hinst)) return nullptr;
    int x = a.settings.windowX >= 0 ? a.settings.windowX : (int)CW_USEDEFAULT;
    int y = a.settings.windowY >= 0 ? a.settings.windowY : (int)CW_USEDEFAULT;
    int w = a.settings.windowW > 200 ? a.settings.windowW : 1080;
    int hh = a.settings.windowH > 200 ? a.settings.windowH : 720;
    HWND h = CreateWindowExW(0, kMainClass, W(kAppNameHe).c_str(),
                             WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
                             x, y, w, hh, nullptr, nullptr, hinst, nullptr);
    if (!h) return nullptr;
    if (a.settings.maximized) ShowWindow(h, SW_SHOWMAXIMIZED);
    return h;
}

} // namespace shoso
