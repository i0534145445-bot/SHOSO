// SHOSO Music - core string helpers (platform independent, UTF-8 inside)
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace shoso {

// ---------- Unicode conversions ----------
std::string    utf16ToUtf8(const char16_t* s, size_t n);
std::u16string utf8ToUtf16(const std::string& s);
std::string    utf32ToUtf8(const char32_t* s, size_t n);
std::u32string utf8ToUtf32(const std::string& s);
std::string    wideToUtf8(const std::wstring& w);
std::wstring   utf8ToWide(const std::string& s);
std::string    latin1ToUtf8(const uint8_t* s, size_t n);

// ---------- Generic helpers ----------
std::string trim(const std::string& s);
std::string foldLower(const std::string& s);            // ASCII case folding, UTF-8 safe
bool iequals(const std::string& a, const std::string& b);
bool containsFold(const std::string& haystack, const std::string& needle);
bool startsWithFold(const std::string& s, const std::string& prefix);
std::vector<std::string> split(const std::string& s, char sep);
std::string join(const std::vector<std::string>& parts, const std::string& sep);
int  parseIntSafe(const std::string& s, int def = 0);
bool parseTrackField(const std::string& s, int& num, int& total); // "3/12"

// ---------- Formatting (Hebrew UI) ----------
std::string formatClock(long long ms);        // 3:45  /  1:02:03
std::string formatLongDuration(long long ms); // "45 דק'" / "שעה ו-12 דק'"
std::string hePlural(int n, const std::string& one, const std::string& many);
std::string formatSize(unsigned long long bytes);

// ---------- Store escaping (tab separated text format) ----------
std::string escapeField(const std::string& s);
std::string unescapeField(const std::string& s);

} // namespace shoso
