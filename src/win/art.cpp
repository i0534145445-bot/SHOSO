#include "art.h"
#include "log.h"

#include <shlwapi.h>
#include "platform.h"
#include "../core/tags.h"

namespace shoso {

static ULONG_PTR g_token = 0;
static bool g_started = false;

struct CacheEntry {
    uint64_t key;
    HBITMAP bmp;
    unsigned long long lastUse;
};
static std::vector<CacheEntry> g_cache;
static std::map<std::string, bool> g_folderProbe;      // folder -> has a cover file
static std::map<std::string, std::vector<uint8_t>> g_folderBytes;
static unsigned long long g_clock = 1;

bool artInit() {
    if (g_started) return true;
    Gdiplus::GdiplusStartupInput input;
    if (Gdiplus::GdiplusStartup(&g_token, &input, nullptr) != Gdiplus::Ok) {
        SH_ERR("GdiplusStartup failed");
        return false;
    }
    g_started = true;
    return true;
}

void artShutdown() {
    artClearCache();
    if (g_started) { Gdiplus::GdiplusShutdown(g_token); g_started = false; g_token = 0; }
}

static HBITMAP decodeScaled(const std::vector<uint8_t>& bytes, int pixels) {
    if (bytes.empty() || !g_started) return nullptr;
    IStream* stream = SHCreateMemStream(bytes.data(), (UINT)bytes.size());
    if (!stream) return nullptr;
    HBITMAP result = nullptr;
    Gdiplus::Bitmap* src = Gdiplus::Bitmap::FromStream(stream);
    if (src && src->GetLastStatus() == Gdiplus::Ok) {
        UINT sw = src->GetWidth(), sh = src->GetHeight();
        if (sw > 0 && sh > 0) {
            Gdiplus::Bitmap* dst = new Gdiplus::Bitmap(pixels, pixels, PixelFormat32bppARGB);
            if (dst && dst->GetLastStatus() == Gdiplus::Ok) {
                Gdiplus::Graphics g(dst);
                g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic);
                g.SetSmoothingMode(Gdiplus::SmoothingModeHighQuality);
                g.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
                // cover crop: centre square of the source
                UINT side = std::min(sw, sh);
                UINT sx = (sw - side) / 2, sy = (sh - side) / 2;
                g.DrawImage(src, Gdiplus::Rect(0, 0, pixels, pixels),
                            (INT)sx, (INT)sy, (INT)side, (INT)side, Gdiplus::UnitPixel);
                dst->GetHBITMAP(Gdiplus::Color(0, 0, 0, 0), &result);
            }
            delete dst;
        }
    }
    if (src) delete src;
    stream->Release();
    return result;
}

static const char* kCoverNames[] = {"cover.jpg", "cover.jpeg", "cover.png", "folder.jpg",
                                    "folder.jpeg", "folder.png", "front.jpg", "front.png",
                                    "album.jpg", "album.png"};

static bool folderCoverBytes(const std::string& folder, std::vector<uint8_t>& out) {
    auto it = g_folderProbe.find(folder);
    if (it != g_folderProbe.end()) {
        if (!it->second) return false;
        auto b = g_folderBytes.find(folder);
        if (b != g_folderBytes.end()) { out = b->second; return !out.empty(); }
        return false;
    }
    for (const char* name : kCoverNames) {
        std::string p = pathJoin(folder, name);
        std::vector<uint8_t> data;
        if (readFileBytes(p, data, 8u * 1024u * 1024u) && data.size() > 64) {
            g_folderProbe[folder] = true;
            g_folderBytes[folder] = data;
            out = data;
            return true;
        }
    }
    g_folderProbe[folder] = false;
    return false;
}

bool coverBytesForTrack(const Track& t, std::vector<uint8_t>& out, std::string& mime) {
    out.clear(); mime.clear();
    std::vector<uint8_t> head, tail;
    if (readHeadTail(t.path, head, 512 * 1024, tail, 512)) {
        AudioTags tags = parseAudioTags(extLowerOf(t.path), head.data(), head.size(),
                                        t.fileSize, tail.data(), tail.size());
        if (tags.cover.valid()) {
            out = tags.cover.bytes;
            mime = tags.cover.mime;
            return true;
        }
    }
    if (folderCoverBytes(t.folder(), out)) {
        mime = (out.size() > 4 && out[1] == 'P' && out[2] == 'N' && out[3] == 'G') ? "image/png" : "image/jpeg";
        return true;
    }
    return false;
}

HBITMAP artForTrack(const Track& t, int pixels) {
    if (pixels <= 0) return nullptr;
    uint64_t key = ((uint64_t)t.id << 16) | (uint64_t)(pixels & 0xFFFF);
    for (CacheEntry& e : g_cache) {
        if (e.key == key) { e.lastUse = ++g_clock; return e.bmp; }
    }
    std::vector<uint8_t> bytes;
    std::string mime;
    if (!coverBytesForTrack(t, bytes, mime)) return nullptr;
    HBITMAP bmp = decodeScaled(bytes, pixels);
    if (!bmp) return nullptr;
    if (g_cache.size() >= 96) {
        size_t oldest = 0;
        for (size_t i = 1; i < g_cache.size(); ++i)
            if (g_cache[i].lastUse < g_cache[oldest].lastUse) oldest = i;
        DeleteObject(g_cache[oldest].bmp);
        g_cache.erase(g_cache.begin() + (ptrdiff_t)oldest);
    }
    CacheEntry e;
    e.key = key; e.bmp = bmp; e.lastUse = ++g_clock;
    g_cache.push_back(e);
    return bmp;
}

void artDropTrack(uint32_t trackId) {
    for (size_t i = 0; i < g_cache.size();) {
        if ((g_cache[i].key >> 16) == (uint64_t)trackId) {
            DeleteObject(g_cache[i].bmp);
            g_cache.erase(g_cache.begin() + (ptrdiff_t)i);
        } else ++i;
    }
}

void artClearCache() {
    for (CacheEntry& e : g_cache) if (e.bmp) DeleteObject(e.bmp);
    g_cache.clear();
    g_folderProbe.clear();
    g_folderBytes.clear();
}

} // namespace shoso
