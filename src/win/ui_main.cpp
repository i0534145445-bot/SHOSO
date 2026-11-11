// SHOSO Music - main window: layout, painting, message routing, tray, hotkeys
#include "app.h"

namespace shoso {

static const wchar_t* kMainClass = L"SHOSOMusic.MainWnd";

enum { CMD_TRAY_SHOW = 2000, CMD_TRAY_PLAY, CMD_TRAY_NEXT, CMD_TRAY_PREV, CMD_TRAY_EXIT };

struct BtnInfo {
    glyph::Kind kind = glyph::Menu;
    std::string label;
    bool hover = false;
    bool hasLabel = false;
};
static std::map<HWND, BtnInfo> g_btns;

static BtnInfo& btnInfo(HWND h) { return g_btns[h]; }

// ------------------------------------------------------------- small helpers
static int sc(const App& a, int v) { return scale(v, a.dpi); }

static HWND makeButton(App& a, HWND parent, int id, int x, int y, int w, int h,
                       glyph::Kind kind, const std::string& label = std::string()) {
    HWND hw = CreateWindowExW(0, L"BUTTON", L"", WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                              x, y, w, h, parent, (HMENU)(INT_PTR)id, a.hinst, nullptr);
    BtnInfo& bi = g_btns[hw];
    bi.kind = kind;
    bi.label = label;
    bi.hasLabel = !label.empty();
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

static LRESULT CALLBACK EditSubclass(HWND h, UINT m, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR);
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

// ------------------------------------------------------------------- layout
static const char* kTabGlyphless[6] = {"שירים", "אלבומים", "אמנים", "תיקיות", "פלייליסטים", "התור"};

void App::relayout() {
    if (!hwnd) return;
    dpi = dpiOf(hwnd);
    FontSet& fs = fontsFor(dpi);
    GetClientRect(hwnd, &rcClient);
    int W = rcClient.right, H = rcClient.bottom;
    int topH = sc(*this, 54);
    int statusH = sc(*this, 24);
    int bottomH = sc(*this, 104);
    rcTop = RECT{0, 0, W, topH};
    rcStatus = RECT{0, H - statusH - bottomH, W, H - bottomH};
    rcBottom = RECT{0, H - bottomH, W, H};
    rcList = RECT{0, topH, W, rcStatus.top};
    rcHeader = RECT{0, topH, W, topH + sc(*this, 26)};
    rcList.top = rcHeader.bottom;

    // fonts on children
    SendMessageW(hwndSearch, WM_SETFONT, (WPARAM)fs.ui, TRUE);
    SendMessageW(hwndList, WM_SETFONT, (WPARAM)fs.listF, TRUE);
    for (HWND b : tabBtns) if (b) SendMessageW(b, WM_SETFONT, (WPARAM)fs.uiBold, TRUE);
    for (auto& kv : g_btns) SendMessageW(kv.first, WM_SETFONT, (WPARAM)fs.ui, TRUE);

    int pad = sc(*this, 10);
    int btnH = sc(*this, 34);
    int y = (topH - btnH) / 2;
    int x = W - pad;

    // right -> left: menu, queue, tabs, flex, sort, addfolder, back, search
    auto take = [&](int w) { x -= w; int r = x; x -= sc(*this, 6); return r; };
    MoveWindow(btnMenu, take(sc(*this, 40)), y, sc(*this, 40), btnH, TRUE);
    MoveWindow(btnQueue, take(sc(*this, 116)), y, sc(*this, 116), btnH, TRUE);
    HDC dc = GetDC(hwnd);
    for (int i = 0; i < 6; ++i) {
        int tw = textWidthU(dc, kTabGlyphless[i], fs.uiBold) + sc(*this, 26);
        if (tw < sc(*this, 60)) tw = sc(*this, 60);
        MoveWindow(tabBtns[i], take(tw), y, tw, btnH, TRUE);
    }
    ReleaseDC(hwnd, dc);
    x -= sc(*this, 8);
    int searchW = sc(*this, 220);
    int searchX = W - pad - searchW;   // search pinned to the left edge
    RECT rcSearchBox = {searchX, y, searchX + searchW, y + btnH};
    MoveWindow(hwndSearch, rcSearchBox.left + sc(*this, 26), rcSearchBox.top + sc(*this, 4),
               searchW - sc(*this, 34), btnH - sc(*this, 8), TRUE);
    // buttons between tabs and search
    x = searchX - sc(*this, 8);
    auto takeL = [&](int w) { x -= w; int r = x; x -= sc(*this, 4); return r; };
    MoveWindow(btnSort, takeL(sc(*this, 36)), y, sc(*this, 36), btnH, TRUE);
    MoveWindow(btnAddFolder, takeL(sc(*this, 36)), y, sc(*this, 36), btnH, TRUE);
    MoveWindow(btnBack, takeL(sc(*this, 36)), y, sc(*this, 36), btnH, TRUE);
    (void)rcSearchBox;
    g_searchBox = RECT{searchX, y, searchX + searchW, y + btnH};

    // list + header + empty overlay
    MoveWindow(hwndList, rcList.left, rcList.top, rcList.right - rcList.left,
               rcList.bottom - rcList.top, TRUE);
    MoveWindow(hwndEmpty, rcList.left, rcList.top, rcList.right - rcList.left,
               rcList.bottom - rcList.top, TRUE);

    // column widths
    int listW = rcList.right - rcList.left;
    int fixed = 0, weights = 0;
    for (int w : colW) { if (w > 0) fixed += sc(*this, w); else weights += -w; }
    int flex = listW - fixed - sc(*this, 4);
    if (flex < sc(*this, 120)) flex = sc(*this, 120);
    colRects.clear();
    int cx = 0;
    for (size_t i = 0; i < colW.size(); ++i) {
        int w = colW[i] > 0 ? sc(*this, colW[i]) : (weights ? flex * (-colW[i]) / weights : flex);
        if (i == colW.size() - 1) w = listW - cx;
        ListView_SetColumnWidth(hwndList, (int)i, w);
        colRects.push_back(RECT{cx, rcHeader.top, cx + w, rcHeader.bottom});
        cx += w;
    }

    // bottom bar
    int by = rcBottom.top + sc(*this, 8);
    int bh = rcBottom.bottom - rcBottom.top - sc(*this, 14);
    int art = sc(*this, 76);
    x = W - pad;
    g_rcArt = RECT{x - art, by, x, by + art};
    x -= art + sc(*this, 12);
    int textW = sc(*this, 240);
    g_rcTitle = RECT{x - textW, by + sc(*this, 4), x, by + sc(*this, 34)};
    g_rcArtist = RECT{x - textW, by + sc(*this, 34), x, by + sc(*this, 62)};
    x -= textW + sc(*this, 10);
    // left side first: sleep + volume + total/pos labels sizes
    int leftX = pad;
    MoveWindow(btnSleep, leftX, by + (art - btnH) / 2, sc(*this, 34), btnH, TRUE);
    leftX += sc(*this, 34) + sc(*this, 6);
    int volW = sc(*this, 96);
    MoveWindow(hwndVol, leftX, by + (art - sc(*this, 26)) / 2, volW, sc(*this, 26), TRUE);
    leftX += volW + sc(*this, 10);
    int lblW = sc(*this, 48);
    g_rcTotal = RECT{leftX, by + (art - sc(*this, 22)) / 2, leftX + lblW, by + (art + sc(*this, 22)) / 2};
    leftX += lblW + sc(*this, 4);
    // middle seek: between leftX and (x - transport cluster)
    int cluster = sc(*this, 36) * 3 + sc(*this, 34) * 3 + sc(*this, 24);
    int seekRight = x - cluster;
    g_rcPos = RECT{seekRight - lblW, by + (art - sc(*this, 22)) / 2, seekRight, by + (art + sc(*this, 22)) / 2};
    int seekLeft = leftX;
    int seekW = seekRight - lblW - sc(*this, 6) - seekLeft;
    if (seekW < sc(*this, 60)) seekW = sc(*this, 60);
    MoveWindow(hwndSeek, seekLeft, by + (art - sc(*this, 26)) / 2, seekW, sc(*this, 26), TRUE);
    // transport cluster right of the pos label
    int tx = seekRight;
    MoveWindow(btnFav, tx, by + (art - btnH) / 2, sc(*this, 34), btnH, TRUE);
    tx += sc(*this, 34) + sc(*this, 2);
    MoveWindow(btnRepeat, tx, by + (art - btnH) / 2, sc(*this, 34), btnH, TRUE);
    tx += sc(*this, 34) + sc(*this, 2);
    MoveWindow(btnShuffle, tx, by + (art - btnH) / 2, sc(*this, 34), btnH, TRUE);
    tx += sc(*this, 34) + sc(*this, 8);
    MoveWindow(btnPrev, tx, by + (art - btnH) / 2, sc(*this, 36), btnH, TRUE);
    tx += sc(*this, 36) + sc(*this, 2);
    MoveWindow(btnPlay, tx, by + (art - btnH) / 2 - sc(*this, 3), sc(*this, 44), btnH + sc(*this, 6), TRUE);
    tx += sc(*this, 44) + sc(*this, 2);
    MoveWindow(btnNext, tx, by + (art - btnH) / 2, sc(*this, 36), btnH, TRUE);

    InvalidateRect(hwnd, nullptr, FALSE);
}

// ------------------------------------------------------------------- paints
static void paintTop(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcTop, th.barBg);
    RECT line = {a.rcTop.left, a.rcTop.bottom - 1, a.rcTop.right, a.rcTop.bottom};
    fillSolid(hdc, line, th.border);
    // search box
    roundRectFill(hdc, a.g_searchBox, sc(a, 8), th.listBg);
    frameRect(hdc, a.g_searchBox, th.border, 1);
    RECT ic = {a.g_searchBox.right - sc(a, 24), a.g_searchBox.top, a.g_searchBox.right - sc(a, 4), a.g_searchBox.bottom};
    glyph::draw(hdc, glyph::Search, ic, th.textDim, a.dpi);
}

static void paintHeader(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcHeader, th.panelBg);
    RECT line = {a.rcHeader.left, a.rcHeader.bottom - 1, a.rcHeader.right, a.rcHeader.bottom};
    fillSolid(hdc, line, th.border);
    FontSet& fs = fontsFor(a.dpi);
    int sortField = -1;
    if (a.view == VIEW_SONGS || a.view == VIEW_QUEUE) {
        switch (sortModeFromInt(a.settings.songsSort)) {
            case SortMode::Duration: sortField = 0; break;
            case SortMode::Album: sortField = 1; break;
            case SortMode::Artist: sortField = 2; break;
            case SortMode::Title: sortField = 3; break;
            default: sortField = -1; break;
        }
    }
    int n = 0;
    (void)n;
    for (size_t i = 0; i < a.cols.size() && i < a.colRects.size(); ++i) {
        RECT r = a.colRects[i];
        r.right -= sc(a, 10);
        r.left += sc(a, 6);
        COLORREF c = (int)i == sortField ? th.accent : th.textDim;
        drawTextU(hdc, a.cols[i], r, c, fs.smallF, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
        if ((int)i == sortField) {
            POINT p[3] = {{r.right + sc(a, 3), r.top + (r.bottom - r.top) / 2 - sc(a, 3)},
                          {r.right + sc(a, 3) + sc(a, 6), r.top + (r.bottom - r.top) / 2 - sc(a, 3)},
                          {r.right + sc(a, 3) + sc(a, 3), r.top + (r.bottom - r.top) / 2 + sc(a, 3)}};
            fillPolygon(hdc, p, 3, th.accent);
        }
    }
}

static void paintStatus(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcStatus, th.barBg);
    RECT line = {a.rcStatus.left, a.rcStatus.top, a.rcStatus.right, a.rcStatus.top + 1};
    fillSolid(hdc, line, th.border);
    FontSet& fs = fontsFor(a.dpi);
    RECT right = a.rcStatus;
    right.right -= sc(a, 10);
    right.left += sc(a, 10);
    drawTextU(hdc, a.g_statusRight, right, th.textDim, fs.status, DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    RECT left = a.rcStatus;
    left.right -= sc(a, 10);
    left.left += sc(a, 10);
    COLORREF lc = a.scanning ? th.accent : th.textDim;
    drawTextU(hdc, a.g_statusLeft, left, lc, fs.status, DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
}

static void paintBottom(App& a, HDC hdc) {
    const Theme& th = theme();
    fillSolid(hdc, a.rcBottom, th.barBg);
    RECT line = {a.rcBottom.left, a.rcBottom.top, a.rcBottom.right, a.rcBottom.top + 1};
    fillSolid(hdc, line, th.border);
    FontSet& fs = fontsFor(a.dpi);

    // art
    roundRectFill(hdc, a.g_rcArt, sc(a, 10), th.listBg);
    if (a.nowArt) {
        HDC m = CreateCompatibleDC(hdc);
        HBITMAP old = (HBITMAP)SelectObject(m, a.nowArt);
        int w = a.g_rcArt.right - a.g_rcArt.left - 2;
        int h = a.g_rcArt.bottom - a.g_rcArt.top - 2;
        BitBlt(hdc, a.g_rcArt.left + 1, a.g_rcArt.top + 1, w, h, m, 0, 0, SRCCOPY);
        SelectObject(m, old);
        DeleteDC(m);
    } else {
        glyph::draw(hdc, glyph::Note, a.g_rcArt, th.textFaint, a.dpi);
    }
    frameRect(hdc, a.g_rcArt, th.border, 1);

    const Track* t = a.currentTrack();
    if (t) {
        drawTextU(hdc, t->displayTitle(), a.g_rcTitle, th.text, fs.title,
                  DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        std::string sub = t->displayArtist();
        if (!t->displayAlbum().empty()) sub += " · " + t->displayAlbum();
        drawTextU(hdc, sub, a.g_rcArtist, th.textDim, fs.smallF,
                  DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    } else {
        drawTextU(hdc, "לא מתנגן כעת", a.g_rcTitle, th.textFaint, fs.ui,
                  DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
    }

    // time labels
    long long dur = a.player.isOpen() ? a.player.lengthMs() : (t ? t->durationMs : 0);
    if (dur <= 0 && t) dur = t->durationMs;
    long long pos = a.seekDragging ? a.seekDragMs : a.lastPosMs;
    drawTextU(hdc, formatClock(pos), a.g_rcPos, th.textDim, fs.status, DT_RIGHT | DT_VCENTER | DT_SINGLELINE);
    drawTextU(hdc, formatClock(dur), a.g_rcTotal, th.textDim, fs.status, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
}

// ------------------------------------------------------------- window proc
static void onClose(App& a) {
    scannerCancel();
    a.saveNow();
    DestroyWindow(a.hwnd);
}

static void trayAdd(App& a);
static void trayUpdate(App& a);
static void trayRemove(App& a);
static void hideToTray(App& a);
static void showFromTray(App& a);
static void trayMenu(App& a);

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
                WS_CHILD | WS_VISIBLE | LVS_REPORT | LVS_OWNERDATA | LVS_SHOWSELALWAYS | LVS_NOCOLUMNHEADER,
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
                if (swt) {
                    swt(a.hwndList, L"DarkMode_Explorer", nullptr);
                }
                FreeLibrary(ux);
            }
            SendMessageW(a.hwndList, WM_SETFONT, (WPARAM)fontsFor(a.dpi).listF, TRUE);

            a.hwndEmpty = CreateWindowExW(0, L"BUTTON", L"", WS_CHILD | BS_OWNERDRAW,
                                          0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_EMPTY, a.hinst, nullptr);

            a.hwndSeek = CreateWindowExW(WS_EX_LAYOUTRTL, TRACKBAR_CLASSW, L"",
                WS_CHILD | WS_VISIBLE | TBS_HORZ | TBS_NOTICKS | TBS_FIXEDLENGTH,
                0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_SEEK, a.hinst, nullptr);
            a.hwndVol = CreateWindowExW(WS_EX_LAYOUTRTL, TRACKBAR_CLASSW, L"",
                WS_CHILD | WS_VISIBLE | TBS_HORZ | TBS_NOTICKS,
                0, 0, 10, 10, h, (HMENU)(INT_PTR)IDC_VOLUME, a.hinst, nullptr);
            SendMessageW(a.hwndSeek, TBM_SETRANGE, FALSE, MAKELONG(0, 1000));
            SendMessageW(a.hwndSeek, TBM_SETPAGESIZE, 0, 50);
            SendMessageW(a.hwndVol, TBM_SETRANGE, FALSE, MAKELONG(0, 100));
            SendMessageW(a.hwndVol, TBM_SETPOS, TRUE, a.settings.volume);

            int y = 0;
            a.btnMenu = makeButton(a, h, IDC_MENU, 0, y, 10, 10, glyph::Menu);
            a.btnQueue = makeButton(a, h, IDC_QUEUE, 0, y, 10, 10, glyph::Queue, "תור 1");
            for (int i = 0; i < 6; ++i)
                a.tabBtns[i] = makeButton(a, h, IDC_TAB0 + i, 0, y, 10, 10, glyph::Menu, kTabGlyphless[i]);
            a.btnSort = makeButton(a, h, IDC_SORT, 0, y, 10, 10, glyph::Sort);
            a.btnAddFolder = makeButton(a, h, IDC_ADDFOLDER, 0, y, 10, 10, glyph::Add);
            a.btnBack = makeButton(a, h, IDC_BACK, 0, y, 10, 10, glyph::Back);
            a.btnPrev = makeButton(a, h, IDC_PREV, 0, y, 10, 10, glyph::Prev);
            a.btnPlay = makeButton(a, h, IDC_PLAY, 0, y, 10, 10, glyph::Play);
            a.btnNext = makeButton(a, h, IDC_NEXT, 0, y, 10, 10, glyph::Next);
            a.btnShuffle = makeButton(a, h, IDC_SHUFFLE, 0, y, 10, 10, glyph::Shuffle);
            a.btnRepeat = makeButton(a, h, IDC_REPEAT, 0, y, 10, 10, glyph::RepeatAll);
            a.btnFav = makeButton(a, h, IDC_FAV, 0, y, 10, 10, glyph::Heart);
            a.btnSleep = makeButton(a, h, IDC_SLEEP, 0, y, 10, 10, glyph::Clock);
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
            paintTop(a, mem);
            paintHeader(a, mem);
            paintStatus(a, mem);
            paintBottom(a, mem);
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
            SetBkColor(hdc, theme().listBg);
            SetBkMode(hdc, OPAQUE);
            static HBRUSH br = nullptr;
            static COLORREF brColor = 0;
            if (!br || brColor != theme().listBg) {
                if (br) DeleteObject(br);
                br = CreateSolidBrush(theme().listBg);
                brColor = theme().listBg;
            }
            return (LRESULT)br;
        }
        case WM_DRAWITEM: {
            UINT id = (UINT)w;
            DRAWITEMSTRUCT* di = (DRAWITEMSTRUCT*)l;
            if (id == IDC_EMPTY) {
                const Theme& th = theme();
                fillSolid(di->hDC, di->rcItem, th.listBg);
                FontSet& fs = fontsFor(a.dpi);
                int cx = (di->rcItem.left + di->rcItem.right) / 2;
                int cy = (di->rcItem.top + di->rcItem.bottom) / 2;
                RECT gr = {cx - sc(a, 40), cy - sc(a, 70), cx + sc(a, 40), cy - sc(a, 0)};
                glyph::draw(di->hDC, glyph::Note, gr, th.textFaint, a.dpi);
                RECT t1 = {di->rcItem.left, cy + sc(a, 6), di->rcItem.right, cy + sc(a, 34)};
                drawTextU(di->hDC, "הספרייה ריקה", t1, th.textDim, fs.title, DT_CENTER | DT_SINGLELINE);
                RECT t2 = {di->rcItem.left, cy + sc(a, 34), di->rcItem.right, cy + sc(a, 58)};
                bool hasFolders = !a.settings.musicFolders.empty();
                drawTextU(di->hDC, hasFolders ? "לא נמצאו שירים בתיקיות שנבחרו" :
                          "לחצו כאן או על + כדי לבחור תיקיית מוזיקה", t2, th.textFaint, fs.ui,
                          DT_CENTER | DT_SINGLELINE);
                return TRUE;
            }
            HWND bh = di->hwndItem;
            auto it = g_btns.find(bh);
            if (it == g_btns.end()) return TRUE;
            BtnInfo& bi = it->second;
            BtnSkin skin;
            skin.hovered = bi.hover;
            skin.pressed = (di->itemState & ODS_SELECTED) != 0;
            skin.enabled = (di->itemState & ODS_DISABLED) == 0;
            const Theme& th = theme();
            // active/toggle states
            if (id >= IDC_TAB0 && id < IDC_TAB0 + 6) skin.active = (a.view == (int)(id - IDC_TAB0));
            else if (id == IDC_SHUFFLE) skin.active = a.q().shuffle;
            else if (id == IDC_REPEAT) skin.active = a.q().repeat != RepeatMode::Off;
            else if (id == IDC_FAV) {
                const Track* t = a.currentTrack();
                skin.active = t && a.isFavorite(t->id);
            }
            else if (id == IDC_SLEEP) skin.active = a.sleepSecondsLeft > 0 || a.sleepAtEnd;
            else if (id == IDC_BACK) skin.active = false;
            if (id >= IDC_TAB0 && id < IDC_TAB0 + 6) {
                std::string label = kViewNamesHe[id - IDC_TAB0];
                paintFlatButton(di->hDC, di->rcItem, skin, th, bi.kind, a.dpi, label, fontsFor(a.dpi).uiBold);
            } else if (id == IDC_QUEUE) {
                paintButtonBg(di->hDC, di->rcItem, skin, th, a.dpi);
                int gh = di->rcItem.bottom - di->rcItem.top;
                RECT gr = {di->rcItem.right - gh + gh / 6, di->rcItem.top + gh / 6,
                           di->rcItem.right - gh / 6, di->rcItem.bottom - gh / 6};
                glyph::draw(di->hDC, glyph::Queue, gr, skin.enabled ? th.textDim : th.textFaint, a.dpi);
                RECT lr = di->rcItem;
                lr.right -= gh;
                lr.left += scale(6, a.dpi);
                std::string ql = a.q().name + "  (" + std::to_string(a.q().size()) + ")";
                drawTextU(di->hDC, ql, lr, skin.enabled ? th.text : th.textFaint,
                          fontsFor(a.dpi).ui, DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
            } else {
                paintFlatButton(di->hDC, di->rcItem, skin, th, bi.kind, a.dpi, std::string(), nullptr);
            }
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
                    InvalidateRect(h, &a.rcBottom, FALSE);
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
                return 0;
            }
            if (code == BN_CLICKED || code == BN_DOUBLECLICKED) {
                onButton(a, id);
                return 0;
            }
            if (code == 0) { onMenuCommand(a, id); return 0; }
            return 0;
        }
        case WM_KEYDOWN: {
            if (GetFocus() == a.hwndSearch) return DefWindowProcW(h, m, w, l);
            bool ctrl = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
            if (w == VK_SPACE) { a.togglePlay(); return 0; }
            if (w == VK_F5) { a.startScan(true); return 0; }
            if (w == VK_DELETE && a.view == VIEW_QUEUE) { onMenuCommand(a, CMD_ROW_REMOVE_QUEUE); return 0; }
            if (ctrl && w == 'F') { SetFocus(a.hwndSearch); return 0; }
            if (w == VK_ESCAPE) {
                if (!a.backStack.empty() || a.scope.valid()) a.goBack();
                return 0;
            }
            if (w >= '1' && w <= '6' && ctrl) { a.setView((int)(w - '1')); return 0; }
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
                        InvalidateRect(h, &a.rcBottom, FALSE);
                        long long dur = a.player.lengthMs();
                        if (dur > 0 && pos >= dur - 150) {
                            // safety net if MM_MCINOTIFY is missed
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
    InvalidateRect(hwnd, &rcBottom, FALSE);
    InvalidateRect(btnPlay, nullptr, TRUE);
    InvalidateRect(btnShuffle, nullptr, TRUE);
    InvalidateRect(btnRepeat, nullptr, TRUE);
    InvalidateRect(btnFav, nullptr, TRUE);
    InvalidateRect(btnSleep, nullptr, TRUE);
    InvalidateRect(btnQueue, nullptr, TRUE);
    updateTitle();
}

void App::updateNowArt(bool force) {
    const Track* t = currentTrack();
    uint32_t id = t ? t->id : 0;
    int px = scale(76, dpi) - 2;
    if (!force && id == nowArtTrack && px == nowArtPixels) return;
    nowArtTrack = id;
    nowArtPixels = px;
    nowArt = nullptr;
    if (t) nowArt = artForTrack(*t, px);
    InvalidateRect(hwnd, &rcBottom, FALSE);
}

void App::flash(const std::string& msg, unsigned long ms) {
    flashMsg = msg;
    flashUntil = GetTickCount() + (ms ? ms : 5000);
    g_statusLeft = msg;
    if (hwnd) InvalidateRect(hwnd, &rcStatus, FALSE);
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
        g_statusLeft = flashMsg;                 // transient feedback wins
    } else {
        if (!flashMsg.empty()) flashMsg.clear();
        g_statusLeft = playError.empty() ? left : playError;
    }
    if (hwnd) InvalidateRect(hwnd, &rcStatus, FALSE);
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
