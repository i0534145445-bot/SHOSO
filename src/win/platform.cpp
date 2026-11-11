#include "platform.h"
#include "log.h"

#include <ctime>

namespace shoso {

static std::string g_appData;
static std::string g_moduleDir;

std::string moduleDirUtf8() {
    if (!g_moduleDir.empty()) return g_moduleDir;
    wchar_t buf[MAX_PATH + 1] = {0};
    DWORD len = GetModuleFileNameW(nullptr, buf, MAX_PATH);
    if (len == 0) { g_moduleDir = "."; return g_moduleDir; }
    std::wstring p(buf, len);
    size_t sep = p.find_last_of(L"\\/");
    if (sep == std::wstring::npos) g_moduleDir = ".";
    else g_moduleDir = wideToUtf8(p.substr(0, sep));
    return g_moduleDir;
}

std::string appDataDirUtf8() {
    if (!g_appData.empty()) return g_appData;
    wchar_t buf[MAX_PATH + 1] = {0};
    std::wstring base;
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, buf))) {
        base = buf;
    } else {
        base = utf8ToWide(moduleDirUtf8());
    }
    base += L"\\SHOSO";
    g_appData = wideToUtf8(base);
    ensureDirUtf8(g_appData);
    return g_appData;
}

bool ensureDirUtf8(const std::string& dirUtf8) {
    std::wstring w = utf8ToWide(dirUtf8);
    if (w.empty()) return false;
    DWORD attr = GetFileAttributesW(w.c_str());
    if (attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY)) return true;
    // create parents first
    std::string parent = parentDirOf(dirUtf8);
    if (!parent.empty() && parent != dirUtf8) ensureDirUtf8(parent);
    return CreateDirectoryW(w.c_str(), nullptr) != 0 || GetLastError() == ERROR_ALREADY_EXISTS;
}

// ------------------------------------------------------------------- FileIO
bool WinFileIO::readText(const std::string& pathUtf8, std::string& out) {
    out.clear();
    HANDLE h = CreateFileW(utf8ToWide(pathUtf8).c_str(), GENERIC_READ, FILE_SHARE_READ,
                           nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz{};
    GetFileSizeEx(h, &sz);
    out.reserve(sz.QuadPart > 0 ? (size_t)sz.QuadPart : 0);
    char buf[65536];
    DWORD got = 0;
    while (ReadFile(h, buf, sizeof(buf), &got, nullptr) && got > 0) out.append(buf, got);
    CloseHandle(h);
    return true;
}

bool WinFileIO::writeTextAtomic(const std::string& pathUtf8, const std::string& data) {
    std::wstring path = utf8ToWide(pathUtf8);
    std::wstring tmp = path + L".tmp";
    HANDLE h = CreateFileW(tmp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) {
        SH_ERR("writeTextAtomic: CreateFile failed for " + pathUtf8 + " err=" + std::to_string(GetLastError()));
        return false;
    }
    DWORD written = 0;
    size_t off = 0;
    bool ok = true;
    while (off < data.size()) {
        DWORD chunk = (DWORD)std::min<size_t>(65536, data.size() - off);
        if (!WriteFile(h, data.data() + off, chunk, &written, nullptr) || written != chunk) { ok = false; break; }
        off += written;
    }
    FlushFileBuffers(h);
    CloseHandle(h);
    if (!ok) { DeleteFileW(tmp.c_str()); return false; }
    if (!MoveFileExW(tmp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING)) {
        SH_ERR("writeTextAtomic: move failed " + pathUtf8 + " err=" + std::to_string(GetLastError()));
        DeleteFileW(tmp.c_str());
        return false;
    }
    return true;
}

bool WinFileIO::fileExists(const std::string& pathUtf8) {
    DWORD attr = GetFileAttributesW(utf8ToWide(pathUtf8).c_str());
    return attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

bool fileStatUtf8(const std::string& pathUtf8, unsigned long long& size, unsigned long long& mtime) {
    WIN32_FILE_ATTRIBUTE_DATA ad = {0};
    if (!GetFileAttributesExW(utf8ToWide(pathUtf8).c_str(), GetFileExInfoStandard, &ad)) return false;
    size = ((unsigned long long)ad.nFileSizeHigh << 32) | ad.nFileSizeLow;
    ULARGE_INTEGER li;
    li.LowPart = ad.ftLastWriteTime.dwLowDateTime;
    li.HighPart = ad.ftLastWriteTime.dwHighDateTime;
    mtime = li.QuadPart / 10000000ULL;   // 100ns ticks since 1601 -> seconds
    return true;
}

bool readFileBytes(const std::string& pathUtf8, std::vector<uint8_t>& out, size_t maxBytes) {
    out.clear();
    HANDLE h = CreateFileW(utf8ToWide(pathUtf8).c_str(), GENERIC_READ, FILE_SHARE_READ,
                           nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz{};
    GetFileSizeEx(h, &sz);
    size_t want = (size_t)std::min<long long>(sz.QuadPart > 0 ? sz.QuadPart : 0, (long long)maxBytes);
    out.resize(want);
    size_t got = 0;
    while (got < want) {
        DWORD chunk = 0;
        if (!ReadFile(h, out.data() + got, (DWORD)(want - got), &chunk, nullptr) || chunk == 0) break;
        got += chunk;
    }
    CloseHandle(h);
    out.resize(got);
    return got > 0;
}

bool readHeadTail(const std::string& pathUtf8,
                  std::vector<uint8_t>& head, size_t headWant,
                  std::vector<uint8_t>& tail, size_t tailWant) {
    head.clear(); tail.clear();
    HANDLE h = CreateFileW(utf8ToWide(pathUtf8).c_str(), GENERIC_READ, FILE_SHARE_READ,
                           nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz{};
    if (!GetFileSizeEx(h, &sz)) { CloseHandle(h); return false; }
    unsigned long long fileSize = (unsigned long long)sz.QuadPart;
    if (fileSize == 0) { CloseHandle(h); return false; }

    size_t hWant = (size_t)std::min<unsigned long long>(fileSize, headWant);
    head.resize(hWant);
    size_t got = 0;
    while (got < hWant) {
        DWORD chunk = 0;
        if (!ReadFile(h, head.data() + got, (DWORD)(hWant - got), &chunk, nullptr) || chunk == 0) break;
        got += chunk;
    }
    head.resize(got);

    size_t tWant = (size_t)std::min<unsigned long long>(fileSize, tailWant);
    LARGE_INTEGER pos;
    pos.QuadPart = (LONGLONG)(fileSize - tWant);
    if (SetFilePointerEx(h, pos, nullptr, FILE_BEGIN)) {
        tail.resize(tWant);
        got = 0;
        while (got < tWant) {
            DWORD chunk = 0;
            if (!ReadFile(h, tail.data() + got, (DWORD)(tWant - got), &chunk, nullptr) || chunk == 0) break;
            got += chunk;
        }
        tail.resize(got);
    }
    CloseHandle(h);
    return !head.empty();
}

// ------------------------------------------------------------------- shell
void openInExplorerSelect(const std::string& pathUtf8) {
    std::wstring args = L"/select,\"" + utf8ToWide(pathUtf8) + L"\"";
    ShellExecuteW(nullptr, L"open", L"explorer.exe", args.c_str(), nullptr, SW_SHOWNORMAL);
}

void shellOpenDefault(const std::string& pathUtf8) {
    ShellExecuteW(nullptr, L"open", utf8ToWide(pathUtf8).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

std::string pickFolderDialog(HWND owner, const std::string& titleUtf8) {
    std::string result;
    IFileDialog* dlg = nullptr;
    if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) {
        SH_ERR("pickFolderDialog: CoCreateInstance failed");
        return result;
    }
    DWORD opts = 0;
    if (SUCCEEDED(dlg->GetOptions(&opts))) dlg->SetOptions(opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM);
    if (!titleUtf8.empty()) dlg->SetTitle(utf8ToWide(titleUtf8).c_str());
    if (SUCCEEDED(dlg->Show(owner))) {
        IShellItem* item = nullptr;
        if (SUCCEEDED(dlg->GetResult(&item))) {
            PWSTR path = nullptr;
            if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path))) {
                result = wideToUtf8(path);
                CoTaskMemFree(path);
            }
            item->Release();
        }
    }
    dlg->Release();
    return result;
}

unsigned long long nowEpochSec() {
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER li;
    li.LowPart = ft.dwLowDateTime;
    li.HighPart = ft.dwHighDateTime;
    return li.QuadPart / 10000000ULL - 11644473600ULL;
}

// ------------------------------------------------------------------- dpi/ui
typedef UINT(WINAPI* FnGetDpiForWindow)(HWND);
static FnGetDpiForWindow g_getDpi = nullptr;
static bool g_dpiProbed = false;

int dpiOf(HWND hwnd) {
    if (!g_dpiProbed) {
        HMODULE user32 = GetModuleHandleW(L"user32.dll");
        if (user32) g_getDpi = (FnGetDpiForWindow)(void*)GetProcAddress(user32, "GetDpiForWindow");
        g_dpiProbed = true;
    }
    if (g_getDpi && hwnd) {
        UINT d = g_getDpi(hwnd);
        if (d > 0) return (int)d;
    }
    HDC dc = GetDC(nullptr);
    int d = dc ? GetDeviceCaps(dc, LOGPIXELSY) : 0;
    if (dc) ReleaseDC(nullptr, dc);
    return d > 0 ? d : 96;
}

int scale(int valueAt96, int dpi) {
    return MulDiv(valueAt96, dpi, 96);
}

void msgBox(HWND owner, const std::string& textUtf8, const std::string& titleUtf8, UINT flags) {
    MessageBoxW(owner, utf8ToWide(textUtf8).c_str(), utf8ToWide(titleUtf8).c_str(), flags);
}

int msgBoxYesNo(HWND owner, const std::string& textUtf8, const std::string& titleUtf8) {
    return MessageBoxW(owner, utf8ToWide(textUtf8).c_str(), utf8ToWide(titleUtf8).c_str(),
                       MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2);
}

void copyToClipboard(HWND owner, const std::string& textUtf8) {
    if (!OpenClipboard(owner)) return;
    EmptyClipboard();
    std::wstring w = utf8ToWide(textUtf8);
    HGLOBAL hg = GlobalAlloc(GMEM_MOVEABLE, (w.size() + 1) * sizeof(wchar_t));
    if (hg) {
        wchar_t* p = (wchar_t*)GlobalLock(hg);
        if (p) {
            memcpy(p, w.c_str(), (w.size() + 1) * sizeof(wchar_t));
            GlobalUnlock(hg);
            SetClipboardData(CF_UNICODETEXT, hg);
        }
    }
    CloseClipboard();
}

} // namespace shoso
