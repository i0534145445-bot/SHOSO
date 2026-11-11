#include "log.h"
#include "win_inc.h"

#include <cstdarg>
#include <ctime>

namespace shoso {

static std::wstring g_logPath;
static bool g_echo = false;
static CRITICAL_SECTION g_logCs;
static bool g_csInit = false;

void logInit(const std::string& logPathUtf8, bool echoConsole) {
    g_logPath = utf8ToWide(logPathUtf8);
    g_echo = echoConsole;
    if (!g_csInit) { InitializeCriticalSection(&g_logCs); g_csInit = true; }
    if (echoConsole) {
        if (!AttachConsole((DWORD)-1)) AllocConsole();
        freopen("CONOUT$", "w", stdout);
    }
    // truncate the log at startup but keep the previous one around
    std::wstring prev = g_logPath + L".prev";
    MoveFileExW(g_logPath.c_str(), prev.c_str(), MOVEFILE_REPLACE_EXISTING);
    FILE* f = _wfopen(g_logPath.c_str(), L"wb");
    if (f) {
        const char* banner = "SHOSO Music log\n";
        fwrite(banner, 1, strlen(banner), f);
        fclose(f);
    }
}

static std::string timestamp() {
    SYSTEMTIME st;
    GetLocalTime(&st);
    char buf[64];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02d %02d:%02d:%02d.%03d",
             st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    return buf;
}

void logLine(const char* level, const std::string& msg) {
    if (g_logPath.empty()) return;
    if (!g_csInit) { InitializeCriticalSection(&g_logCs); g_csInit = true; }
    EnterCriticalSection(&g_logCs);
    FILE* f = _wfopen(g_logPath.c_str(), L"ab");
    if (f) {
        std::string line = timestamp() + " [" + level + "] " + msg + "\n";
        fwrite(line.data(), 1, line.size(), f);
        fclose(f);
    }
    if (g_echo) {
        printf("%s [%s] %s\n", timestamp().c_str(), level, msg.c_str());
        fflush(stdout);
    }
    LeaveCriticalSection(&g_logCs);
}

void logClose() { g_logPath.clear(); }

unsigned long lastWinError() { return (unsigned long)GetLastError(); }

std::string winErrorText(unsigned long code) {
    wchar_t* buf = nullptr;
    DWORD len = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
                               FORMAT_MESSAGE_IGNORE_INSERTS, nullptr, code,
                               MAKELANGID(LANG_HEBREW, SUBLANG_DEFAULT), (LPWSTR)&buf, 0, nullptr);
    if (len == 0) {
        len = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
                             FORMAT_MESSAGE_IGNORE_INSERTS, nullptr, code,
                             MAKELANGID(LANG_ENGLISH, SUBLANG_ENGLISH_US), (LPWSTR)&buf, 0, nullptr);
    }
    std::string out;
    if (len > 0 && buf) out = wideToUtf8(std::wstring(buf, len));
    if (buf) LocalFree(buf);
    while (!out.empty() && (out.back() == '\n' || out.back() == '\r')) out.pop_back();
    return out;
}

} // namespace shoso
