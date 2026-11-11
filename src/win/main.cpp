// SHOSO Music - process entry point
#include "app.h"

int WINAPI wWinMain(HINSTANCE hinst, HINSTANCE, PWSTR, int) {
    using namespace shoso;

    // DPI awareness (also declared in the embedded manifest)
    HMODULE user32 = GetModuleHandleW(L"user32.dll");
    if (user32) {
        typedef BOOL(WINAPI* FnCtx)(DPI_AWARENESS_CONTEXT);
        FnCtx f = (FnCtx)(void*)GetProcAddress(user32, "SetProcessDpiAwarenessContext");
        if (f) f(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    std::string cmdline;
    std::vector<std::string> files;
    for (int i = 1; i < argc; ++i) {
        std::string a = U(argv[i]);
        cmdline += a + " ";
        if (a.rfind("--", 0) == 0) continue;
        files.push_back(a);
    }

    logInit(appDataDirUtf8() + "\\log.txt", cmdline.find("--console") != std::string::npos);
    SH_LOG("=== start === args: " + cmdline);

    HANDLE mtx = CreateMutexW(nullptr, TRUE, L"SHOSO_Music_Single_Instance_v1");
    bool firstInstance = (GetLastError() != ERROR_ALREADY_EXISTS);
    if (!firstInstance) {
        HWND other = FindWindowW(L"SHOSOMusic.MainWnd", nullptr);
        if (other) {
            if (!files.empty()) {
                std::string joined = join(files, "\n");
                COPYDATASTRUCT cds = {(ULONG_PTR)WM_SHOSO_OPENFILES, (DWORD)joined.size(), (void*)joined.data()};
                SendMessageW(other, WM_COPYDATA, 0, (LPARAM)&cds);
            }
            ShowWindow(other, SW_RESTORE);
            SetForegroundWindow(other);
        }
        if (mtx) { ReleaseMutex(mtx); CloseHandle(mtx); }
        logClose();
        return 0;
    }

    INITCOMMONCONTROLSEX icc = {sizeof(icc), ICC_BAR_CLASSES | ICC_LISTVIEW_CLASSES |
                                ICC_STANDARD_CLASSES | ICC_COOL_CLASSES};
    InitCommonControlsEx(&icc);
    artInit();

    App& a = app();
    a.loadAll();

    HWND h = createMainWindow(hinst);
    if (!h) {
        SH_ERR("createMainWindow failed err=" + std::to_string(GetLastError()));
        msgBox(nullptr, "שגיאה ביצירת החלון הראשי", kAppNameHe, MB_ICONERROR);
        return 1;
    }
    ShowWindow(h, a.settings.maximized ? SW_SHOWMAXIMIZED : SW_SHOW);
    UpdateWindow(h);

    if (cmdline.find("--diag") != std::string::npos) {
        std::string p = appDataDirUtf8() + "\\diagnostics.txt";
        WinFileIO io;
        io.writeTextAtomic(p, buildDiagnostics());
        shellOpenDefault(p);
    }
    if (!files.empty()) {
        a.openFiles(files);
    } else if (a.settings.scanOnStart && !a.settings.musicFolders.empty()) {
        a.startScan(false);
    }

    MSG m = {0};
    while (GetMessageW(&m, nullptr, 0, 0) > 0) {
        TranslateMessage(&m);
        DispatchMessageW(&m);
    }
    a.saveNow();
    artShutdown();
    SH_LOG("=== exit ===");
    logClose();
    CoUninitialize();
    if (mtx) { ReleaseMutex(mtx); CloseHandle(mtx); }
    return (int)m.wParam;
}
