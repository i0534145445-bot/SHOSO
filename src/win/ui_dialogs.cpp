// SHOSO Music - modal dialogs built at runtime (no .rc templates), RTL aware
#include "app.h"

#include <functional>

namespace shoso {

static const wchar_t* kDlgClass = L"SHOSOMusic.Dialog";

struct DlgState;
typedef std::function<void(DlgState&, bool ok)> DlgDone;
typedef std::function<void(DlgState&)> DlgInit;
typedef std::function<bool(DlgState&, int id, int code)> DlgCmd;

struct DlgState {
    App* a = nullptr;
    HWND hwnd = nullptr;
    std::map<int, HWND> byId;
    DlgDone onDone;
    DlgInit onInit;
    DlgCmd onCommand;
};

static bool g_modalDone = false;

enum {
    DLG_MINTRAY = 3001, DLG_SCANSTART, DLG_THEME_DARK, DLG_THEME_LIGHT,
    DLG_FOLDERS, DLG_ADDF, DLG_REMF,
    DLG_SLEEP_OFF = 3020, DLG_SLEEP_15, DLG_SLEEP_30, DLG_SLEEP_45, DLG_SLEEP_60, DLG_SLEEP_90, DLG_SLEEP_END,
    DLG_NAME = 3030,
    DLG_TEXT = 3040, DLG_COPY = 3041
};

static void endModal(HWND h) {
    g_modalDone = true;
    DestroyWindow(h);
}

static HWND ctrlOf(DlgState* st, int id) {
    if (!st) return nullptr;
    auto it = st->byId.find(id);
    return it == st->byId.end() ? nullptr : it->second;
}

static LRESULT CALLBACK DlgProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    DlgState* st = (DlgState*)GetWindowLongPtrW(h, GWLP_USERDATA);
    switch (m) {
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC dc = BeginPaint(h, &ps);
            RECT rc; GetClientRect(h, &rc);
            fillSolid(dc, rc, theme().windowBg);
            EndPaint(h, &ps);
            return 0;
        }
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLORBTN:
        case WM_CTLCOLORLISTBOX: {
            HDC dc = (HDC)w;
            SetTextColor(dc, theme().text);
            SetBkColor(dc, theme().windowBg);
            SetBkMode(dc, OPAQUE);
            static HBRUSH br = nullptr;
            static COLORREF bc = 0;
            if (!br || bc != theme().windowBg) {
                if (br) DeleteObject(br);
                br = CreateSolidBrush(theme().windowBg);
                bc = theme().windowBg;
            }
            return (LRESULT)br;
        }
        case WM_COMMAND: {
            int id = LOWORD(w);
            int code = HIWORD(w);
            if (!st) return 0;
            if (st->onCommand && st->onCommand(*st, id, code)) return 0;
            if (id == IDCANCEL || id == IDOK) {
                if (st->onDone) st->onDone(*st, id == IDOK);
                endModal(h);
            }
            return 0;
        }
        case WM_CLOSE:
            if (st && st->onDone) st->onDone(*st, false);
            endModal(h);
            return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

static bool registerDlgClass(HINSTANCE hinst) {
    WNDCLASSEXW wc = {sizeof(wc)};
    wc.lpfnWndProc = DlgProc;
    wc.hInstance = hinst;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.lpszClassName = kDlgClass;
    wc.hIcon = LoadIconW(hinst, MAKEINTRESOURCEW(101));
    return RegisterClassExW(&wc) != 0;
}

struct CtrlSpec {
    int kind;              // 0 static, 1 check, 2 radio, 3 edit, 4 listbox, 5 button, 6 multi-edit
    int id;
    const wchar_t* text;
    int x, y, w, h;
    bool firstInGroup;
};

static void runDialog(App& a, const std::wstring& title, int wDip, int hDip,
                      const std::vector<CtrlSpec>& ctrls, DlgState cfg) {
    int dpi = dpiOf(a.hwnd);
    registerDlgClass(a.hinst);
    int w = scale(wDip, dpi), hh = scale(hDip, dpi);
    RECT rw; GetWindowRect(a.hwnd, &rw);
    int x = rw.left + ((rw.right - rw.left) - w) / 2;
    int y = rw.top + ((rw.bottom - rw.top) - hh) / 2;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    DlgState* st = new DlgState(cfg);
    st->a = &a;

    HWND h = CreateWindowExW(WS_EX_DLGMODALFRAME | WS_EX_LAYOUTRTL, kDlgClass, title.c_str(),
                             WS_POPUP | WS_CAPTION | WS_SYSMENU,
                             x, y, w, hh, a.hwnd, nullptr, a.hinst, nullptr);
    if (!h) { delete st; return; }
    st->hwnd = h;
    SetWindowLongPtrW(h, GWLP_USERDATA, (LONG_PTR)st);
    FontSet& fs = fontsFor(dpi);
    for (const CtrlSpec& c : ctrls) {
        const wchar_t* cls = L"STATIC";
        DWORD style = WS_CHILD | WS_VISIBLE;
        DWORD ex = 0;
        switch (c.kind) {
            case 0: cls = L"STATIC"; style |= SS_RIGHT; break;
            case 1: cls = L"BUTTON"; style |= BS_AUTOCHECKBOX | BS_RIGHT | WS_TABSTOP; break;
            case 2: cls = L"BUTTON"; style |= BS_AUTORADIOBUTTON | BS_RIGHT | WS_TABSTOP |
                        (c.firstInGroup ? WS_GROUP : 0); break;
            case 3: cls = L"EDIT"; style |= ES_AUTOHSCROLL | ES_RIGHT | WS_BORDER | WS_TABSTOP; ex = WS_EX_RTLREADING; break;
            case 4: cls = L"LISTBOX"; style |= LBS_NOTIFY | WS_BORDER | WS_VSCROLL | WS_TABSTOP; break;
            case 5: cls = L"BUTTON"; style |= BS_PUSHBUTTON | WS_TABSTOP |
                        ((c.id == IDOK) ? BS_DEFPUSHBUTTON : 0); break;
            case 6: cls = L"EDIT"; style |= ES_MULTILINE | ES_READONLY | WS_BORDER | WS_VSCROLL | WS_TABSTOP; ex = WS_EX_RTLREADING; break;
        }
        HWND ch = CreateWindowExW(ex, cls, c.text ? c.text : L"", style,
                                  scale(c.x, dpi), scale(c.y, dpi), scale(c.w, dpi), scale(c.h, dpi),
                                  h, (HMENU)(INT_PTR)c.id, a.hinst, nullptr);
        SendMessageW(ch, WM_SETFONT, (WPARAM)fs.ui, TRUE);
        st->byId[c.id] = ch;
    }
    if (st->onInit) st->onInit(*st);
    g_modalDone = false;
    EnableWindow(a.hwnd, FALSE);
    ShowWindow(h, SW_SHOW);
    UpdateWindow(h);
    MSG msg;
    while (!g_modalDone && GetMessageW(&msg, nullptr, 0, 0) > 0) {
        if (!IsDialogMessageW(h, &msg)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
    }
    EnableWindow(a.hwnd, TRUE);
    SetForegroundWindow(a.hwnd);
    delete st;
}

// ------------------------------------------------------------------ settings
void openSettingsDialog() {
    App& a = app();
    std::vector<CtrlSpec> c = {
        {1, DLG_MINTRAY, L"הסתר למגש המערכת בעת מזעור", 14, 16, 300, 22, false},
        {1, DLG_SCANSTART, L"סרוק את תיקיות המוזיקה בהפעלה", 14, 42, 300, 22, false},
        {2, DLG_THEME_DARK, L"ערכת נושא כהה", 14, 74, 150, 22, true},
        {2, DLG_THEME_LIGHT, L"ערכת נושא בהירה", 170, 74, 150, 22, false},
        {0, 0, L"תיקיות מוזיקה:", 14, 104, 300, 18, false},
        {4, DLG_FOLDERS, nullptr, 14, 124, 300, 130, false},
        {5, DLG_ADDF, L"הוספה...", 14, 260, 90, 26, false},
        {5, DLG_REMF, L"הסרה", 110, 260, 90, 26, false},
        {5, IDOK, L"אישור", 226, 296, 90, 26, false},
        {5, IDCANCEL, L"ביטול", 130, 296, 90, 26, false},
    };
    DlgState cfg;
    bool themeBefore = theme().dark;
    std::vector<std::string> resultFolders = a.settings.musicFolders;
    bool resultOk = false;
    bool resultMin = a.settings.minimizeToTray;
    bool resultScan = a.settings.scanOnStart;
    bool resultDark = themeBefore;

    cfg.onInit = [&a](DlgState& s) {
        SendMessageW(ctrlOf(&s, DLG_MINTRAY), BM_SETCHECK, a.settings.minimizeToTray ? BST_CHECKED : BST_UNCHECKED, 0);
        SendMessageW(ctrlOf(&s, DLG_SCANSTART), BM_SETCHECK, a.settings.scanOnStart ? BST_CHECKED : BST_UNCHECKED, 0);
        SendMessageW(ctrlOf(&s, a.settings.theme == 0 ? DLG_THEME_DARK : DLG_THEME_LIGHT), BM_SETCHECK, BST_CHECKED, 0);
        for (const std::string& f : a.settings.musicFolders)
            SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_ADDSTRING, 0, (LPARAM)W(f).c_str());
    };
    cfg.onCommand = [](DlgState& s, int id, int) {
        if (id == DLG_ADDF) {
            std::string dir = pickFolderDialog(s.hwnd, "בחרו תיקיית מוזיקה");
            if (!dir.empty()) SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_ADDSTRING, 0, (LPARAM)W(dir).c_str());
            return true;
        }
        if (id == DLG_REMF) {
            int sel = (int)SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_GETCURSEL, 0, 0);
            if (sel >= 0) SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_DELETESTRING, sel, 0);
            return true;
        }
        return false;
    };
    cfg.onDone = [&](DlgState& s, bool ok) {
        resultOk = ok;
        if (!ok) return;
        resultMin = SendMessageW(ctrlOf(&s, DLG_MINTRAY), BM_GETCHECK, 0, 0) == BST_CHECKED;
        resultScan = SendMessageW(ctrlOf(&s, DLG_SCANSTART), BM_GETCHECK, 0, 0) == BST_CHECKED;
        resultDark = SendMessageW(ctrlOf(&s, DLG_THEME_DARK), BM_GETCHECK, 0, 0) == BST_CHECKED;
        resultFolders.clear();
        int n = (int)SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_GETCOUNT, 0, 0);
        for (int i = 0; i < n; ++i) {
            int len = (int)SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_GETTEXTLEN, i, 0);
            std::vector<wchar_t> buf(len + 1, 0);
            SendMessageW(ctrlOf(&s, DLG_FOLDERS), LB_GETTEXT, i, (LPARAM)buf.data());
            resultFolders.push_back(U(std::wstring(buf.data())));
        }
    };
    runDialog(a, L"הגדרות - " + W(kAppNameHe), 330, 336, c, cfg);

    if (resultOk) {
        a.settings.minimizeToTray = resultMin;
        a.settings.scanOnStart = resultScan;
        a.settings.theme = resultDark ? 0 : 1;
        setThemeDark(resultDark);
        bool foldersChanged = (resultFolders != a.settings.musicFolders);
        a.settings.musicFolders = resultFolders;
        a.markDirty();
        InvalidateRect(a.hwnd, nullptr, TRUE);
        if (foldersChanged) a.startScan(false);
    } else {
        setThemeDark(themeBefore);
    }
}

// ------------------------------------------------------------------- sleep
void openSleepDialog() {
    App& a = app();
    std::vector<CtrlSpec> c = {
        {2, DLG_SLEEP_OFF, L"כבוי", 14, 16, 240, 22, true},
        {2, DLG_SLEEP_15, L"עצירת הנגינה בעוד 15 דקות", 14, 42, 240, 22, false},
        {2, DLG_SLEEP_30, L"עצירת הנגינה בעוד 30 דקות", 14, 68, 240, 22, false},
        {2, DLG_SLEEP_45, L"עצירת הנגינה בעוד 45 דקות", 14, 94, 240, 22, false},
        {2, DLG_SLEEP_60, L"עצירת הנגינה בעוד שעה", 14, 120, 240, 22, false},
        {2, DLG_SLEEP_90, L"עצירת הנגינה בעוד שעה וחצי", 14, 146, 240, 22, false},
        {2, DLG_SLEEP_END, L"עצירה בסוף השיר הנוכחי", 14, 172, 240, 22, false},
        {5, IDOK, L"אישור", 176, 206, 90, 26, false},
        {5, IDCANCEL, L"ביטול", 80, 206, 90, 26, false},
    };
    int pick = -1;
    DlgState cfg;
    cfg.onInit = [&a](DlgState& s) {
        int checked = DLG_SLEEP_OFF;
        if (a.sleepAtEnd) checked = DLG_SLEEP_END;
        else if (a.sleepSecondsLeft > 0) {
            int mins = (a.sleepSecondsLeft + 59) / 60;
            checked = mins <= 15 ? DLG_SLEEP_15 : mins <= 30 ? DLG_SLEEP_30 :
                      mins <= 45 ? DLG_SLEEP_45 : mins <= 60 ? DLG_SLEEP_60 : DLG_SLEEP_90;
        }
        SendMessageW(ctrlOf(&s, checked), BM_SETCHECK, BST_CHECKED, 0);
    };
    cfg.onDone = [&pick](DlgState& s, bool ok) {
        if (!ok) return;
        for (int id = DLG_SLEEP_OFF; id <= DLG_SLEEP_END; ++id) {
            if (SendMessageW(ctrlOf(&s, id), BM_GETCHECK, 0, 0) == BST_CHECKED) { pick = id; break; }
        }
    };
    runDialog(a, L"טיימר שינה", 280, 246, c, cfg);
    switch (pick) {
        case DLG_SLEEP_OFF: a.applySleep(0, false); break;
        case DLG_SLEEP_15: a.applySleep(15, false); break;
        case DLG_SLEEP_30: a.applySleep(30, false); break;
        case DLG_SLEEP_45: a.applySleep(45, false); break;
        case DLG_SLEEP_60: a.applySleep(60, false); break;
        case DLG_SLEEP_90: a.applySleep(90, false); break;
        case DLG_SLEEP_END: a.applySleep(0, true); break;
        default: break;
    }
}

// ------------------------------------------------------------- playlist name
void openNamePlaylistDialog(uint32_t existingId) {
    App& a = app();
    Playlist* existing = a.playlistById(existingId);
    std::vector<CtrlSpec> c = {
        {0, 0, existing ? L"שם חדש לפלייליסט:" : L"שם הפלייליסט החדש:", 14, 16, 260, 18, false},
        {3, DLG_NAME, nullptr, 14, 40, 260, 26, false},
        {5, IDOK, L"אישור", 184, 78, 90, 26, false},
        {5, IDCANCEL, L"ביטול", 88, 78, 90, 26, false},
    };
    std::string newName;
    DlgState cfg;
    if (existing) {
        std::string cur = existing->name;
        cfg.onInit = [cur](DlgState& s) { SetWindowTextW(ctrlOf(&s, DLG_NAME), W(cur).c_str()); };
    }
    cfg.onDone = [&newName](DlgState& s, bool ok) {
        if (!ok) return;
        wchar_t buf[256] = {0};
        GetWindowTextW(ctrlOf(&s, DLG_NAME), buf, 255);
        newName = trim(U(buf));
    };
    runDialog(a, existing ? L"שינוי שם פלייליסט" : L"פלייליסט חדש", 300, 118, c, cfg);
    if (newName.empty()) return;
    if (existing) {
        existing->name = newName;
        existing->modified = nowEpochSec();
    } else {
        Playlist p;
        p.id = a.nextPlaylistId++;
        p.name = newName;
        p.created = nowEpochSec();
        a.playlists.push_back(p);
    }
    a.markDirty();
    a.refreshList();
}

// --------------------------------------------------------------- properties
void openPropertiesDialog(uint32_t trackId) {
    App& a = app();
    const Track* t = a.library.byId(trackId);
    if (!t) return;
    std::string info;
    info += "קובץ: " + t->path + "\r\n";
    info += "שם: " + t->displayTitle() + "\r\n";
    info += "אמן: " + t->displayArtist() + "\r\n";
    info += "אלבום: " + t->displayAlbum() + "\r\n";
    if (t->year) info += "שנה: " + std::to_string(t->year) + "\r\n";
    if (t->trackNo) info += "רצועה: " + std::to_string(t->trackNo) + "\r\n";
    if (!t->genre.empty()) info += "סגנון: " + t->genre + "\r\n";
    info += "אורך: " + formatClock(t->durationMs) + "\r\n";
    if (t->bitrate) info += "קצב נתונים: " + std::to_string(t->bitrate) + " kbps\r\n";
    if (t->sampleRate) info += "קצב דגימה: " + std::to_string(t->sampleRate) + " Hz\r\n";
    info += "גודל: " + formatSize(t->fileSize) + "\r\n";
    info += std::string("עטיפת אלבום מוטמעת: ") + (t->hasArt ? "כן" : "לא") + "\r\n";

    std::vector<CtrlSpec> c = {
        {6, DLG_TEXT, nullptr, 14, 14, 380, 250, false},
        {5, DLG_COPY, L"העתקה", 208, 272, 90, 26, false},
        {5, IDCANCEL, L"סגירה", 112, 272, 90, 26, false},
    };
    DlgState cfg;
    cfg.onInit = [info](DlgState& s) { SetWindowTextW(ctrlOf(&s, DLG_TEXT), W(info).c_str()); };
    cfg.onCommand = [info](DlgState& s, int id, int) {
        if (id == DLG_COPY) { copyToClipboard(s.hwnd, info); return true; }
        return false;
    };
    cfg.onDone = [](DlgState&, bool) {};
    runDialog(a, L"מאפיינים", 410, 312, c, cfg);
}

// --------------------------------------------------------------------- about
void openAboutDialog() {
    App& a = app();
    std::vector<CtrlSpec> c = {
        {0, 0, L"SHOSO מיוזיק", 14, 16, 300, 26, false},
        {0, 0, L"גרסה 1.0.0", 14, 44, 300, 18, false},
        {0, 0, L"נגן מוזיקה מקומי בסגנון Musicolet: ללא רשת, ללא פרסומות,", 14, 70, 300, 34, false},
        {0, 0, L"תומך ב-MP3, FLAC, WAV, M4A, OGG ועוד דרך מפענחי המערכת.", 14, 106, 300, 34, false},
        {5, IDCANCEL, L"סגירה", 114, 150, 90, 26, false},
    };
    DlgState cfg;
    cfg.onDone = [](DlgState&, bool) {};
    runDialog(a, L"אודות", 330, 190, c, cfg);
}

// --------------------------------------------------------------- diagnostics
std::string buildDiagnostics() {
    App& a = app();
    std::string s;
    s += "SHOSO Music diagnostics\r\n=======================\r\n";
    OSVERSIONINFOW vi = {sizeof(vi)};
    GetVersionExW(&vi);
    s += "OS: " + std::to_string(vi.dwMajorVersion) + "." + std::to_string(vi.dwMinorVersion) +
         " build " + std::to_string(vi.dwBuildNumber) + "\r\n";
    s += "module dir: " + moduleDirUtf8() + "\r\n";
    s += "appdata: " + appDataDirUtf8() + "\r\n";
    s += "dpi: " + std::to_string(a.dpi) + "\r\n";
    s += "library tracks: " + std::to_string(a.library.size()) + "\r\n";
    s += "playlists: " + std::to_string(a.playlists.size()) + "\r\n";
    s += "queues: " + std::to_string(a.queues.size()) + " active=" + std::to_string(a.activeQueue) + "\r\n";
    s += "music folders:\r\n";
    for (const std::string& f : a.settings.musicFolders) s += "  - " + f + "\r\n";
    s += "player open: " + std::string(a.player.isOpen() ? "yes" : "no") + "\r\n";
    s += "player error: " + a.player.lastError() + "\r\n";
    s += "mci volume supported: " + std::string(a.player.volumeSupported() ? "yes" : "no") + "\r\n";
    const Track* t = a.currentTrack();
    s += "current track: " + std::string(t ? t->path : "(none)") + "\r\n";
    s += "playing: " + std::string(a.playing ? "yes" : "no") + "\r\n";
    return s;
}

} // namespace shoso
