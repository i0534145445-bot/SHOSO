// SHOSO Music - album art decoding & cache (GDI+)
#pragma once
#include "win_inc.h"
#include "../core/library.h"

namespace shoso {

bool artInit();
void artShutdown();

// Square, premultiplied HBITMAP of the given pixel size. nullptr when no art.
// The bitmap stays owned by the cache - do not DeleteObject it.
HBITMAP artForTrack(const Track& t, int pixels);
void artDropTrack(uint32_t trackId);
void artClearCache();

// raw embedded cover bytes (for the properties dialog / export)
bool coverBytesForTrack(const Track& t, std::vector<uint8_t>& out, std::string& mime);

} // namespace shoso
