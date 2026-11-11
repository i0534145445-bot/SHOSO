#include "scanner.h"
#include "log.h"
#include "platform.h"
#include "../core/tags.h"

#include <chrono>
#include <functional>

namespace shoso {

static std::atomic<bool> g_running{false};
static std::atomic<bool> g_cancel{false};

bool scannerRunning() { return g_running.load(); }
void scannerCancel() { g_cancel.store(true); }

static bool skipDirName(const std::wstring& n) {
    if (n == L"." || n == L"..") return true;
    static const wchar_t* bad[] = {L"$RECYCLE.BIN", L"System Volume Information", L"Windows",
                                   L"$WinREAgent", L"Recovery", L"MSOCache", L"node_modules"};
    for (const wchar_t* b : bad) if (n == b) return true;
    return false;
}

struct ScanSink {
    std::vector<Track>* batch = nullptr;
    std::function<void()> flush;
};

static void scanDir(const std::wstring& dirW, ScanSink& sink, ScanStats& stats, int depth) {
    std::vector<Track>& out = *sink.batch;
    if (depth > 24 || g_cancel.load()) return;
    std::wstring pattern = dirW + L"\\*";
    WIN32_FIND_DATAW fd = {0};
    HANDLE h = FindFirstFileExW(pattern.c_str(), FindExInfoBasic, &fd, FindExSearchNameMatch, nullptr,
#ifdef FIND_FIRST_EX_LARGE_FETCH
                                      FIND_FIRST_EX_LARGE_FETCH
#else
                                      0
#endif
    );
    if (h == INVALID_HANDLE_VALUE) return;
    std::vector<std::wstring> subdirs;
    do {
        if (g_cancel.load()) break;
        std::wstring name(fd.cFileName);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) continue;
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) || name == L".") { /* hidden dirs skipped below */ }
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) continue;
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_SYSTEM) continue;
            if (skipDirName(name)) continue;
            subdirs.push_back(name);
            continue;
        }
        std::string ext = extLowerOf(U(name));
        if (!isAudioExt(ext)) continue;
        ++stats.filesSeen;
        std::string path = U(dirW) + "\\" + U(name);
        unsigned long long size = 0, mtime = 0;
        if (!fileStatUtf8(path, size, mtime)) continue;
        std::vector<uint8_t> head, tail;
        if (!readHeadTail(path, head, 512 * 1024, tail, 512)) { ++stats.errors; continue; }
        AudioTags tags = parseAudioTags(ext, head.data(), head.size(), size, tail.data(), tail.size());
        Track t;
        t.id = 0;
        t.path = path;
        t.title = tags.title;
        t.artist = tags.artist;
        t.album = tags.album;
        t.albumArtist = tags.albumArtist;
        t.genre = tags.genre;
        t.year = tags.year;
        t.trackNo = tags.trackNo;
        t.discNo = tags.discNo;
        t.durationMs = tags.durationMs;
        t.bitrate = tags.bitrateKbps;
        t.sampleRate = tags.sampleRateHz;
        t.fileSize = size;
        t.mtime = mtime;
        t.hasArt = tags.cover.valid();
        if (t.title.empty() || t.artist.empty()) {
            std::string fa, ft;
            tagsFromFilename(stripExt(U(name)), fa, ft);
            if (t.title.empty()) t.title = ft;
            if (t.artist.empty()) t.artist = fa;
        }
        ++stats.tracksFound;
        out.push_back(std::move(t));
        if (out.size() >= 120 && sink.flush) {
            sink.flush();
            FindClose(h);
            for (const std::wstring& sd : subdirs)
                scanDir(dirW + L"\\" + sd, sink, stats, depth + 1);
            return;
        }
    } while (FindNextFileW(h, &fd));
    FindClose(h);
    for (const std::wstring& sd : subdirs) scanDir(dirW + L"\\" + sd, sink, stats, depth + 1);
}

void scannerStart(const std::vector<std::string>& rootsUtf8, HWND hwnd, UINT msgBatch, UINT msgDone) {
    if (g_running.load()) return;
    g_running.store(true);
    g_cancel.store(false);
    std::vector<std::string> roots = rootsUtf8;
    std::thread([hwnd, msgBatch, msgDone, roots]() {
        auto t0 = std::chrono::steady_clock::now();
        ScanStats stats;
        ScanSink sink;
        sink.batch = new std::vector<Track>();
        sink.flush = [&]() {
            if (sink.batch->empty()) return;
            PostMessageW(hwnd, msgBatch, (WPARAM)sink.batch, 0);
            sink.batch = new std::vector<Track>();
        };
        for (const std::string& root : roots) {
            if (g_cancel.load()) break;
            scanDir(W(root), sink, stats, 0);
            sink.flush();
        }
        // final partial batch
        if (!sink.batch->empty()) {
            PostMessageW(hwnd, msgBatch, (WPARAM)sink.batch, 0);
        } else {
            delete sink.batch;
        }
        auto t1 = std::chrono::steady_clock::now();
        stats.seconds = std::chrono::duration<double>(t1 - t0).count();
        stats.cancelled = g_cancel.load();
        ScanStats* done = new ScanStats(stats);
        PostMessageW(hwnd, msgDone, (WPARAM)done, 0);
        g_running.store(false);
    }).detach();
}

} // namespace shoso
