// SHOSO Setup - per-user installer / uninstaller (no admin rights needed)
//
//   SHOSO-Setup.exe              -> installs to %LOCALAPPDATA%\Programs\SHOSO
//   SHOSO-Setup.exe /uninstall   -> removes shortcuts, associations and files
//
// The player binary is embedded as RCDATA (#200) at build time.
#include "win_inc.h"
#include "theme.h"
#include "platform.h"
#include "log.h"

using namespace shoso;

#define IDR_PAYLOAD 200
#define IDI_APP 101

enum { IDC_INSTALL = 500, IDC_CANCEL, IDC_DESKTOP, IDC_LAUNCH, IDC_PROGRESS, IDC_STATUS };

static const wchar_t* kCls = L"SHOSOSetup.Wnd";
static HWND g_hwnd = nullptr;
static HWND g_prog = nullptr, g_status = nullptr, g_desktop = nullptr, g_launch = nullptr;
static HWND g_install = nullptr, g_cancel = nullptr;
static HINSTANCE g_hinst = nullptr;
static bool g_busy = false;

static std::wstring installDir() {
    wchar_t buf[MAX_PATH] = {0};
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, buf))) {
        return std::wstring(buf) + L"\\Programs\\SHOSO";
    }
    return L"C:\\SHOSO";
}

static void setStatus(const std::wstring& s) {
    if (g_status) SetWindowTextW(g_status, s.c_str());
}

static bool writeFileBytes(const std::wstring& path, const void* data, DWORD size) {
    HANDLE h = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    DWORD written = 0;
    bool ok = WriteFile(h, data, size, &written, nullptr) && written == size;
    CloseHandle(h);
    return ok;
}

static bool makeShortcut(const std::wstring& lnkPath, const std::wstring& target,
                         const std::wstring& args, const std::wstring& desc) {
    IShellLinkW* link = nullptr;
    if (FAILED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link))))
        return false;
    bool ok = false;
    link->SetPath(target.c_str());
    if (!args.empty()) link->SetArguments(args.c_str());
    if (!desc.empty()) link->SetDescription(desc.c_str());
    link->SetIconLocation(target.c_str(), 0);
    std::wstring dir = target.substr(0, target.find_last_of(L"\\/"));
    link->SetWorkingDirectory(dir.c_str());
    IPersistFile* pf = nullptr;
    if (SUCCEEDED(link->QueryInterface(IID_PPV_ARGS(&pf)))) {
        ok = SUCCEEDED(pf->Save(lnkPath.c_str(), TRUE));
        pf->Release();
    }
    link->Release();
    return ok;
}

static void regSetStr(HKEY root, const std::wstring& path, const wchar_t* name, const std::wstring& value) {
    HKEY k = nullptr;
    if (RegCreateKeyExW(root, path.c_str(), 0, nullptr, 0, KEY_WRITE, nullptr, &k, nullptr) != ERROR_SUCCESS)
        return;
    RegSetValueExW(k, name, 0, REG_SZ, (const BYTE*)value.c_str(),
                   (DWORD)((value.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(k);
}

static void registerAssociations(const std::wstring& exe) {
    const wchar_t* exts[] = {L".mp3", L".flac", L".wav", L".m4a", L".m4b", L".aac",
                             L".ogg", L".oga", L".opus", L".wma"};
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\SHOSO.Music.File", nullptr, L"SHOSO Music");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\SHOSO.Music.File\\DefaultIcon", nullptr, exe + L",0");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\SHOSO.Music.File\\shell\\open\\command", nullptr,
              L"\"" + exe + L"\" \"%1\"");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\Applications\\SHOSO-Music.exe\\shell\\open\\command",
              nullptr, L"\"" + exe + L"\" \"%1\"");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\Applications\\SHOSO-Music.exe",
              L"FriendlyAppName", L"SHOSO Music");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Classes\\Applications\\SHOSO-Music.exe\\DefaultIcon",
              nullptr, exe + L",0");
    for (const wchar_t* e : exts) {
        regSetStr(HKEY_CURRENT_USER, std::wstring(L"Software\\Classes\\") + e + L"\\OpenWithProgids",
                  L"SHOSO.Music.File", L"");
        regSetStr(HKEY_CURRENT_USER, std::wstring(L"Software\\Classes\\") + e + L"\\OpenWithList",
                  L"SHOSO-Music.exe", L"");
    }
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}

static void removeAssociations() {
    const wchar_t* exts[] = {L".mp3", L".flac", L".wav", L".m4a", L".m4b", L".aac",
                             L".ogg", L".oga", L".opus", L".wma"};
    for (const wchar_t* e : exts) {
        HKEY k = nullptr;
        std::wstring p = std::wstring(L"Software\\Classes\\") + e + L"\\OpenWithProgids";
        if (RegOpenKeyExW(HKEY_CURRENT_USER, p.c_str(), 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            RegDeleteValueW(k, L"SHOSO.Music.File");
            RegCloseKey(k);
        }
        if (RegOpenKeyExW(HKEY_CURRENT_USER, p.c_str(), 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            RegDeleteValueW(k, L"SHOSO-Music.exe");
            RegCloseKey(k);
        }
    }
    RegDeleteTreeW(HKEY_CURRENT_USER, L"Software\\Classes\\SHOSO.Music.File");
    RegDeleteTreeW(HKEY_CURRENT_USER, L"Software\\Classes\\Applications\\SHOSO-Music.exe");
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}

static std::wstring startMenuLnk() {
    wchar_t buf[MAX_PATH] = {0};
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_PROGRAMS, nullptr, SHGFP_TYPE_CURRENT, buf)))
        return std::wstring(buf) + L"\\SHOSO Music.lnk";
    return L"";
}
static std::wstring desktopLnk() {
    wchar_t buf[MAX_PATH] = {0};
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_DESKTOPDIRECTORY, nullptr, SHGFP_TYPE_CURRENT, buf)))
        return std::wstring(buf) + L"\\SHOSO Music.lnk";
    return L"";
}

static void doInstall() {
    if (g_busy) return;
    g_busy = true;
    EnableWindow(g_install, FALSE);
    EnableWindow(g_cancel, FALSE);
    SendMessageW(g_prog, PBM_SETMARQUEE, TRUE, 0);

    setStatus(L"מחלץ קבצים...");
    HRSRC hr = FindResourceW(nullptr, MAKEINTRESOURCEW(IDR_PAYLOAD), RT_RCDATA);
    if (!hr) { setStatus(L"שגיאה: המשאב לא נמצא"); return; }
    HGLOBAL hg = LoadResource(nullptr, hr);
    void* data = LockResource(hg);
    DWORD size = SizeofResource(nullptr, hr);
    if (!data || size == 0) { setStatus(L"שגיאה בפתיחת המשאב"); return; }

    std::wstring dir = installDir();
    ensureDirUtf8(U(dir));
    std::wstring exe = dir + L"\\SHOSO-Music.exe";
    if (!writeFileBytes(exe, data, size)) {
        setStatus(L"שגיאה בכתיבת הקובץ: " + exe);
        return;
    }
    setStatus(L"יוצר קיצורי דרך...");
    wchar_t selfPath[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, selfPath, MAX_PATH);
    CopyFileW(selfPath, (dir + L"\\Uninstall.exe").c_str(), FALSE);

    std::wstring lnk = startMenuLnk();
    if (!lnk.empty()) makeShortcut(lnk, exe, L"", L"SHOSO Music");
    if (SendMessageW(g_desktop, BM_GETCHECK, 0, 0) == BST_CHECKED) {
        std::wstring d = desktopLnk();
        if (!d.empty()) makeShortcut(d, exe, L"", L"SHOSO Music");
    }
    setStatus(L"רושם הרשאות קבצים...");
    registerAssociations(exe);

    setStatus(L"רושם הסרה...");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"DisplayName", L"SHOSO Music");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"DisplayIcon", exe);
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"UninstallString", L"\"" + dir + L"\\Uninstall.exe\" /uninstall");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"Publisher", L"SHOSO");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"DisplayVersion", L"1.0.0");
    regSetStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music",
              L"NoRepair", L"1");

    SendMessageW(g_prog, PBM_SETMARQUEE, FALSE, 0);
    setStatus(L"ההתקנה הושלמה בהצלחה!");
    SetWindowTextW(g_install, L"סיום");
    g_busy = false;
    EnableWindow(g_cancel, TRUE);
    EnableWindow(g_install, TRUE);
    // remember launch intent
    SetWindowLongPtrW(g_hwnd, GWLP_USERDATA,
        SendMessageW(g_launch, BM_GETCHECK, 0, 0) == BST_CHECKED ? 1 : 0);
}

static void doUninstall() {
    std::wstring dir = installDir();
    std::wstring lnk = startMenuLnk();
    if (!lnk.empty()) DeleteFileW(lnk.c_str());
    std::wstring d = desktopLnk();
    if (!d.empty()) DeleteFileW(d.c_str());
    removeAssociations();
    RegDeleteTreeW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SHOSO_Music");
    DeleteFileW((dir + L"\\SHOSO-Music.exe").c_str());
    // schedule self removal
    wchar_t selfPath[MAX_PATH] = {0};
    GetModuleFileNameW(nullptr, selfPath, MAX_PATH);
    std::wstring cmd = L"/c ping 127.0.0.1 -n 2 > nul & del /f /q \"" + std::wstring(selfPath) +
                       L"\" & del /f /q \"" + dir + L"\\Uninstall.exe\" & rmdir /q \"" + dir + L"\"";
    ShellExecuteW(nullptr, L"open", L"cmd.exe", cmd.c_str(), nullptr, SW_HIDE);
    MessageBoxW(nullptr, L"SHOSO Music הוסר מהמחשב.", L"SHOSO Setup", MB_ICONINFORMATION);
}

static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
        case WM_CREATE: {
            g_hwnd = h;
            int dpi = dpiOf(h);
            FontSet& fs = fontsFor(dpi);
            g_status = CreateWindowExW(0, L"STATIC", L"מוכן להתקנה", WS_CHILD | WS_VISIBLE | SS_RIGHT,
                                       scale(20, dpi), scale(20, dpi), scale(420, dpi), scale(40, dpi),
                                       h, (HMENU)(INT_PTR)IDC_STATUS, g_hinst, nullptr);
            g_prog = CreateWindowExW(0, PROGRESS_CLASSW, L"", WS_CHILD | WS_VISIBLE | PBS_MARQUEE,
                                     scale(20, dpi), scale(66, dpi), scale(420, dpi), scale(18, dpi),
                                     h, (HMENU)(INT_PTR)IDC_PROGRESS, g_hinst, nullptr);
            g_desktop = CreateWindowExW(0, L"BUTTON", L"צור קיצור דרך בשולחן העבודה",
                                        WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX | BS_RIGHT,
                                        scale(20, dpi), scale(96, dpi), scale(420, dpi), scale(24, dpi),
                                        h, (HMENU)(INT_PTR)IDC_DESKTOP, g_hinst, nullptr);
            g_launch = CreateWindowExW(0, L"BUTTON", L"הפעל את SHOSO Music בסיום",
                                       WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX | BS_RIGHT,
                                       scale(20, dpi), scale(122, dpi), scale(420, dpi), scale(24, dpi),
                                       h, (HMENU)(INT_PTR)IDC_LAUNCH, g_hinst, nullptr);
            g_install = CreateWindowExW(0, L"BUTTON", L"התקנה", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                                        scale(250, dpi), scale(158, dpi), scale(90, dpi), scale(30, dpi),
                                        h, (HMENU)(INT_PTR)IDC_INSTALL, g_hinst, nullptr);
            g_cancel = CreateWindowExW(0, L"BUTTON", L"ביטול", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                       scale(150, dpi), scale(158, dpi), scale(90, dpi), scale(30, dpi),
                                       h, (HMENU)(INT_PTR)IDC_CANCEL, g_hinst, nullptr);
            SendMessageW(g_status, WM_SETFONT, (WPARAM)fs.title, TRUE);
            SendMessageW(g_prog, WM_SETFONT, (WPARAM)fs.ui, TRUE);
            SendMessageW(g_desktop, WM_SETFONT, (WPARAM)fs.ui, TRUE);
            SendMessageW(g_launch, WM_SETFONT, (WPARAM)fs.ui, TRUE);
            SendMessageW(g_install, WM_SETFONT, (WPARAM)fs.uiBold, TRUE);
            SendMessageW(g_cancel, WM_SETFONT, (WPARAM)fs.ui, TRUE);
            SendMessageW(g_launch, BM_SETCHECK, BST_CHECKED, 0);
            SendMessageW(g_desktop, BM_SETCHECK, BST_CHECKED, 0);
            return 0;
        }
        case WM_ERASEBKGND: return 1;
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
        case WM_CTLCOLORBTN: {
            HDC dc = (HDC)w;
            SetTextColor(dc, theme().text);
            SetBkColor(dc, theme().windowBg);
            SetBkMode(dc, OPAQUE);
            static HBRUSH br = nullptr;
            static COLORREF brc = 0;
            if (!br || brc != theme().windowBg) {
                if (br) DeleteObject(br);
                br = CreateSolidBrush(theme().windowBg); brc = theme().windowBg;
            }
            return (LRESULT)br;
        }
        case WM_COMMAND: {
            int id = LOWORD(w);
            if (id == IDC_INSTALL) {
                wchar_t txt[64] = {0};
                GetWindowTextW(g_install, txt, 63);
                if (std::wstring(txt) == L"סיום") {
                    if (GetWindowLongPtrW(h, GWLP_USERDATA) == 1) {
                        ShellExecuteW(nullptr, L"open", (installDir() + L"\\SHOSO-Music.exe").c_str(),
                                      nullptr, nullptr, SW_SHOWNORMAL);
                    }
                    DestroyWindow(h);
                    return 0;
                }
                doInstall();
                return 0;
            }
            if (id == IDC_CANCEL) { DestroyWindow(h); return 0; }
            return 0;
        }
        case WM_CLOSE:
            DestroyWindow(h);
            return 0;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

int WINAPI wWinMain(HINSTANCE hinst, HINSTANCE, PWSTR cmdLine, int) {
    g_hinst = hinst;
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    INITCOMMONCONTROLSEX icc = {sizeof(icc), ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES};
    InitCommonControlsEx(&icc);

    setThemeDark(false);  // installer uses the standard light look
    std::wstring args = cmdLine ? cmdLine : L"";
    if (args.find(L"/uninstall") != std::wstring::npos || args.find(L"-uninstall") != std::wstring::npos) {
        doUninstall();
        return 0;
    }

    WNDCLASSEXW wc = {sizeof(wc)};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hinst;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.lpszClassName = kCls;
    wc.hIcon = LoadIconW(hinst, MAKEINTRESOURCEW(IDI_APP));
    RegisterClassExW(&wc);

    UINT dpi = 96;
    {   typedef UINT(WINAPI* GFDS)(void);
        GFDS fn = (GFDS)GetProcAddress(GetModuleHandleW(L"user32.dll"), "GetDpiForSystem");
        if (fn) dpi = fn();
    }
    RECT wr = {0, 0, scale(470, (int)dpi), scale(208, (int)dpi)};
    AdjustWindowRectEx(&wr, WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU, FALSE, WS_EX_LAYOUTRTL);
    HWND h = CreateWindowExW(WS_EX_LAYOUTRTL, kCls, L"התקנת SHOSO Music",
                             WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
                             CW_USEDEFAULT, CW_USEDEFAULT, wr.right - wr.left, wr.bottom - wr.top,
                             nullptr, nullptr, hinst, nullptr);
    if (!h) return 1;
    ShowWindow(h, SW_SHOW);
    UpdateWindow(h);
    MSG m;
    while (GetMessageW(&m, nullptr, 0, 0) > 0) {
        if (!IsDialogMessageW(h, &m)) { TranslateMessage(&m); DispatchMessageW(&m); }
    }
    CoUninitialize();
    return 0;
}
