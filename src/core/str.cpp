#include "str.h"

#include <algorithm>
#include <cstdio>

namespace shoso {

// ---------------------------------------------------------------- conversions
static void appendUtf8(std::string& out, uint32_t cp) {
    if (cp <= 0x7F) {
        out.push_back(static_cast<char>(cp));
    } else if (cp <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp <= 0xFFFF) {
        out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp <= 0x10FFFF) {
        out.push_back(static_cast<char>(0xF0 | (cp >> 18)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else {
        out.push_back('?');
    }
}

std::u32string utf8ToUtf32(const std::string& s) {
    std::u32string out;
    out.reserve(s.size());
    size_t i = 0;
    while (i < s.size()) {
        uint8_t c = static_cast<uint8_t>(s[i]);
        uint32_t cp = 0;
        int extra = 0;
        if (c < 0x80) { cp = c; extra = 0; }
        else if ((c & 0xE0) == 0xC0) { cp = c & 0x1Fu; extra = 1; }
        else if ((c & 0xF0) == 0xE0) { cp = c & 0x0Fu; extra = 2; }
        else if ((c & 0xF8) == 0xF0) { cp = c & 0x07u; extra = 3; }
        else { out.push_back(0xFFFD); ++i; continue; }
        if (i + extra >= s.size() + 0 && extra > 0 && i + static_cast<size_t>(extra) >= s.size()) {
            out.push_back(0xFFFD);
            break;
        }
        bool ok = true;
        for (int k = 1; k <= extra; ++k) {
            uint8_t cc = static_cast<uint8_t>(s[i + k]);
            if ((cc & 0xC0) != 0x80) { ok = false; break; }
            cp = (cp << 6) | (cc & 0x3Fu);
        }
        if (!ok) { out.push_back(0xFFFD); ++i; continue; }
        out.push_back(cp);
        i += static_cast<size_t>(extra) + 1;
    }
    return out;
}

std::string utf32ToUtf8(const char32_t* s, size_t n) {
    std::string out;
    for (size_t i = 0; i < n; ++i) appendUtf8(out, static_cast<uint32_t>(s[i]));
    return out;
}

std::string utf16ToUtf8(const char16_t* s, size_t n) {
    std::string out;
    for (size_t i = 0; i < n; ++i) {
        uint32_t c = static_cast<uint16_t>(s[i]);
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
            uint32_t c2 = static_cast<uint16_t>(s[i + 1]);
            if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                ++i;
            } else {
                c = 0xFFFD;
            }
        } else if (c >= 0xD800 && c <= 0xDFFF) {
            c = 0xFFFD;
        }
        appendUtf8(out, c);
    }
    return out;
}

std::u16string utf8ToUtf16(const std::string& s) {
    std::u32string u32 = utf8ToUtf32(s);
    std::u16string out;
    out.reserve(u32.size());
    for (uint32_t cp : u32) {
        if (cp <= 0xFFFF) {
            out.push_back(static_cast<char16_t>(cp));
        } else {
            cp -= 0x10000;
            out.push_back(static_cast<char16_t>(0xD800 + (cp >> 10)));
            out.push_back(static_cast<char16_t>(0xDC00 + (cp & 0x3FF)));
        }
    }
    return out;
}

std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return std::string();
    if (sizeof(wchar_t) == 2) {
        return utf16ToUtf8(reinterpret_cast<const char16_t*>(w.data()), w.size());
    }
    return utf32ToUtf8(reinterpret_cast<const char32_t*>(w.data()), w.size());
}

std::wstring utf8ToWide(const std::string& s) {
    std::wstring out;
    if (sizeof(wchar_t) == 2) {
        std::u16string u = utf8ToUtf16(s);
        out.assign(reinterpret_cast<const wchar_t*>(u.data()), u.size());
    } else {
        std::u32string u = utf8ToUtf32(s);
        out.assign(reinterpret_cast<const wchar_t*>(u.data()), u.size());
    }
    return out;
}

std::string latin1ToUtf8(const uint8_t* s, size_t n) {
    std::string out;
    for (size_t i = 0; i < n; ++i) appendUtf8(out, s[i]);
    return out;
}

// ---------------------------------------------------------------- helpers
static bool isSpaceChar(char c) { return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\v' || c == '\f'; }

std::string trim(const std::string& s) {
    size_t b = 0, e = s.size();
    while (b < e && isSpaceChar(s[b])) ++b;
    while (e > b && isSpaceChar(s[e - 1])) --e;
    return s.substr(b, e - b);
}

std::string foldLower(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        if (c >= 'A' && c <= 'Z') out.push_back(static_cast<char>(c - 'A' + 'a'));
        else out.push_back(c);
    }
    return out;
}

bool iequals(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); ++i) {
        char x = a[i], y = b[i];
        if (x >= 'A' && x <= 'Z') x = static_cast<char>(x - 'A' + 'a');
        if (y >= 'A' && y <= 'Z') y = static_cast<char>(y - 'A' + 'a');
        if (x != y) return false;
    }
    return true;
}

bool containsFold(const std::string& haystack, const std::string& needle) {
    if (needle.empty()) return true;
    if (needle.size() > haystack.size()) return false;
    const size_t last = haystack.size() - needle.size();
    for (size_t i = 0; i <= last; ++i) {
        size_t k = 0;
        for (; k < needle.size(); ++k) {
            char x = haystack[i + k], y = needle[k];
            if (x >= 'A' && x <= 'Z') x = static_cast<char>(x - 'A' + 'a');
            if (y >= 'A' && y <= 'Z') y = static_cast<char>(y - 'A' + 'a');
            if (x != y) break;
        }
        if (k == needle.size()) return true;
    }
    return false;
}

bool startsWithFold(const std::string& s, const std::string& prefix) {
    if (prefix.size() > s.size()) return false;
    for (size_t i = 0; i < prefix.size(); ++i) {
        char x = s[i], y = prefix[i];
        if (x >= 'A' && x <= 'Z') x = static_cast<char>(x - 'A' + 'a');
        if (y >= 'A' && y <= 'Z') y = static_cast<char>(y - 'A' + 'a');
        if (x != y) return false;
    }
    return true;
}

std::vector<std::string> split(const std::string& s, char sep) {
    std::vector<std::string> out;
    std::string cur;
    for (char c : s) {
        if (c == sep) { out.push_back(cur); cur.clear(); }
        else cur.push_back(c);
    }
    out.push_back(cur);
    return out;
}

std::string join(const std::vector<std::string>& parts, const std::string& sep) {
    std::string out;
    for (size_t i = 0; i < parts.size(); ++i) {
        if (i) out += sep;
        out += parts[i];
    }
    return out;
}

int parseIntSafe(const std::string& s, int def) {
    std::string t = trim(s);
    if (t.empty()) return def;
    size_t i = 0;
    bool neg = false;
    if (t[0] == '-' || t[0] == '+') { neg = (t[0] == '-'); i = 1; }
    int v = 0;
    bool any = false;
    for (; i < t.size(); ++i) {
        if (t[i] < '0' || t[i] > '9') break;
        v = v * 10 + (t[i] - '0');
        any = true;
        if (v > 100000000) { v = 100000000; break; }
    }
    if (!any) return def;
    return neg ? -v : v;
}

bool parseTrackField(const std::string& s, int& num, int& total) {
    num = 0; total = 0;
    std::string t = trim(s);
    if (t.empty()) return false;
    size_t slash = t.find('/');
    bool ok = false;
    if (slash != std::string::npos) {
        num = parseIntSafe(t.substr(0, slash), 0);
        total = parseIntSafe(t.substr(slash + 1), 0);
        ok = num > 0;
    } else {
        num = parseIntSafe(t, 0);
        ok = num > 0;
    }
    return ok;
}

// ---------------------------------------------------------------- formatting
std::string formatClock(long long ms) {
    if (ms < 0) ms = 0;
    long long total = (ms + 500) / 1000;
    long long h = total / 3600;
    long long m = (total % 3600) / 60;
    long long s = total % 60;
    char buf[32];
    if (h > 0) std::snprintf(buf, sizeof(buf), "%lld:%02lld:%02lld", h, m, s);
    else       std::snprintf(buf, sizeof(buf), "%lld:%02lld", m, s);
    return buf;
}

std::string formatLongDuration(long long ms) {
    long long totalMin = (ms + 30000) / 60000;
    char buf[64];
    if (totalMin <= 0) return "0 דק'";
    if (totalMin < 60) { std::snprintf(buf, sizeof(buf), "%lld דק'", totalMin); return buf; }
    long long h = totalMin / 60, m = totalMin % 60;
    if (m == 0) { std::snprintf(buf, sizeof(buf), "%lld שעות", h); return buf; }
    std::snprintf(buf, sizeof(buf), "%lld שע' ו-%lld דק'", h, m);
    return buf;
}

std::string hePlural(int n, const std::string& one, const std::string& many) {
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%d ", n);
    return std::string(buf) + (n == 1 ? one : many);
}

std::string formatSize(unsigned long long bytes) {
    char buf[48];
    double v = static_cast<double>(bytes);
    if (v < 1024.0) { std::snprintf(buf, sizeof(buf), "%llu B", bytes); return buf; }
    v /= 1024.0;
    if (v < 1024.0) { std::snprintf(buf, sizeof(buf), "%.1f KB", v); return buf; }
    v /= 1024.0;
    std::snprintf(buf, sizeof(buf), "%.1f MB", v);
    return buf;
}

// ---------------------------------------------------------------- escaping
std::string escapeField(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '\t': out += "\\t"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            default: out.push_back(c);
        }
    }
    return out;
}

std::string unescapeField(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '\\' && i + 1 < s.size()) {
            char n = s[++i];
            switch (n) {
                case 't': out.push_back('\t'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case '\\': out.push_back('\\'); break;
                default: out.push_back('\\'); out.push_back(n); break;
            }
        } else {
            out.push_back(s[i]);
        }
    }
    return out;
}

} // namespace shoso
