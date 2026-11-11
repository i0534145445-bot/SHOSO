// SHOSO Music - common Windows includes
#pragma once
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <objidl.h>
#include <shobjidl.h>
#include <objbase.h>
#include <gdiplus.h>
#include <mmsystem.h>
#include <uxtheme.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "../core/str.h"

namespace shoso {

// utf-8 <-> wide helpers used everywhere in the win layer
inline std::wstring W(const std::string& utf8) { return utf8ToWide(utf8); }
inline std::string  U(const std::wstring& w)   { return wideToUtf8(w); }

} // namespace shoso
