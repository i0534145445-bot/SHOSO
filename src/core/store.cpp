#include "store.h"
#include "str.h"

#include <cstdio>
#include <cstdlib>

namespace shoso {

static const char* kFormatVersion = "1";

std::vector<std::string> splitLines(const std::string& text) {
    std::vector<std::string> out;
    std::string cur;
    for (char c : text) {
        if (c == '\n') {
            if (!cur.empty() && cur.back() == '\r') cur.pop_back();
            out.push_back(cur);
            cur.clear();
        } else cur.push_back(c);
    }
    if (!cur.empty() && cur.back() == '\r') cur.pop_back();
    if (!cur.empty() || !text.empty()) out.push_back(cur);
    return out;
}

static std::vector<std::string> splitTabs(const std::string& line) {
    std::vector<std::string> raw = split(line, '\t');
    std::vector<std::string> out;
    out.reserve(raw.size());
    for (const std::string& f : raw) out.push_back(unescapeField(f));
    return out;
}

static void put(std::string& out, const std::string& field) {
    out += escapeField(field);
    out.push_back('\t');
}
static void putInt(std::string& out, long long v) {
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%lld", v);
    out += buf;
    out.push_back('\t');
}
static void endLine(std::string& out) {
    if (!out.empty() && out.back() == '\t') out.pop_back();
    out.push_back('\n');
}

// ------------------------------------------------------------------ settings
std::string Settings::serialize() const {
    std::string out;
    out += "# SHOSO settings v" + std::string(kFormatVersion) + "\n";
    put(out, "S");
    putInt(out, volume);
    put(out, mute ? "1" : "0");
    putInt(out, activeQueue);
    put(out, minimizeToTray ? "1" : "0");
    put(out, scanOnStart ? "1" : "0");
    put(out, showArtInList ? "1" : "0");
    putInt(out, songsSort);
    put(out, lastDir);
    putInt(out, sleepMinutes);
    put(out, sleepEndOfTrack ? "1" : "0");
    putInt(out, theme);
    putInt(out, windowX); putInt(out, windowY); putInt(out, windowW); putInt(out, windowH);
    put(out, maximized ? "1" : "0");
    putInt(out, view);
    put(out, lastSearch);
    endLine(out);
    for (const std::string& f : musicFolders) {
        put(out, "F");
        put(out, f);
        endLine(out);
    }
    return out;
}

bool Settings::parse(const std::string& text) {
    musicFolders.clear();
    bool any = false;
    for (const std::string& line : splitLines(text)) {
        if (line.empty() || line[0] == '#') continue;
        std::vector<std::string> f = splitTabs(line);
        if (f.empty()) continue;
        if (f[0] == "S" && f.size() >= 18) {
            volume          = parseIntSafe(f[1], volume);
            mute            = f[2] == "1";
            activeQueue     = parseIntSafe(f[3], 0);
            minimizeToTray  = f[4] == "1";
            scanOnStart     = f[5] == "1";
            showArtInList   = f[6] == "1";
            songsSort       = parseIntSafe(f[7], 0);
            lastDir         = f[8];
            sleepMinutes    = parseIntSafe(f[9], 0);
            sleepEndOfTrack = f[10] == "1";
            theme           = parseIntSafe(f[11], 0);
            windowX         = parseIntSafe(f[12], -1);
            windowY         = parseIntSafe(f[13], -1);
            windowW         = parseIntSafe(f[14], 1080);
            windowH         = parseIntSafe(f[15], 720);
            maximized       = f[16] == "1";
            view            = parseIntSafe(f[17], 0);
            if (f.size() > 18) lastSearch = f[18];
            if (volume < 0) volume = 0;
            if (volume > 100) volume = 100;
            if (activeQueue < 0 || activeQueue > 9) activeQueue = 0;
            any = true;
        } else if (f[0] == "F" && f.size() >= 2) {
            if (!f[1].empty()) musicFolders.push_back(f[1]);
            any = true;
        }
    }
    return any;
}

// ------------------------------------------------------------------- tracks
std::string serializeTracks(const std::vector<Track>& tracks) {
    std::string out;
    out.reserve(tracks.size() * 160 + 64);
    out += "# SHOSO library v" + std::string(kFormatVersion) + "\n";
    for (const Track& t : tracks) {
        put(out, "T");
        putInt(out, t.id);
        put(out, t.path);
        put(out, t.title);
        put(out, t.artist);
        put(out, t.album);
        put(out, t.albumArtist);
        put(out, t.genre);
        putInt(out, t.year);
        putInt(out, t.trackNo);
        putInt(out, t.discNo);
        putInt(out, t.durationMs);
        putInt(out, t.bitrate);
        putInt(out, t.sampleRate);
        putInt(out, (long long)t.fileSize);
        putInt(out, (long long)t.mtime);
        put(out, t.hasArt ? "1" : "0");
        endLine(out);
    }
    return out;
}

bool parseTracks(const std::string& text, std::vector<Track>& out, uint32_t& nextId) {
    out.clear();
    uint32_t maxId = 0;
    for (const std::string& line : splitLines(text)) {
        if (line.empty() || line[0] == '#') continue;
        std::vector<std::string> f = splitTabs(line);
        if (f.size() < 17 || f[0] != "T") continue;
        Track t;
        t.id          = (uint32_t)std::strtoul(f[1].c_str(), nullptr, 10);
        t.path        = f[2];
        t.title       = f[3];
        t.artist      = f[4];
        t.album       = f[5];
        t.albumArtist = f[6];
        t.genre       = f[7];
        t.year        = parseIntSafe(f[8], 0);
        t.trackNo     = parseIntSafe(f[9], 0);
        t.discNo      = parseIntSafe(f[10], 0);
        t.durationMs  = parseIntSafe(f[11], 0);
        t.bitrate     = parseIntSafe(f[12], 0);
        t.sampleRate  = parseIntSafe(f[13], 0);
        t.fileSize    = (unsigned long long)std::strtoull(f[14].c_str(), nullptr, 10);
        t.mtime       = (unsigned long long)std::strtoull(f[15].c_str(), nullptr, 10);
        t.hasArt      = f[16] == "1";
        if (t.path.empty()) continue;
        if (t.id == 0) t.id = ++maxId; else if (t.id > maxId) maxId = t.id;
        out.push_back(std::move(t));
    }
    if (maxId >= nextId) nextId = maxId + 1;
    return true;
}

// ---------------------------------------------------------------- playlists
std::string serializePlaylists(const std::vector<Playlist>& pls) {
    std::string out;
    out += "# SHOSO playlists v" + std::string(kFormatVersion) + "\n";
    for (const Playlist& p : pls) {
        put(out, "P");
        putInt(out, p.id);
        put(out, p.name);
        put(out, p.system ? "1" : "0");
        putInt(out, (long long)p.created);
        putInt(out, (long long)p.modified);
        endLine(out);
        for (uint32_t id : p.trackIds) {
            put(out, "I");
            putInt(out, p.id);
            putInt(out, id);
            endLine(out);
        }
    }
    return out;
}

bool parsePlaylists(const std::string& text, std::vector<Playlist>& out, uint32_t& nextId) {
    out.clear();
    uint32_t maxId = 0;
    for (const std::string& line : splitLines(text)) {
        if (line.empty() || line[0] == '#') continue;
        std::vector<std::string> f = splitTabs(line);
        if (f.empty()) continue;
        if (f[0] == "P" && f.size() >= 6) {
            Playlist p;
            p.id = (uint32_t)std::strtoul(f[1].c_str(), nullptr, 10);
            p.name = f[2];
            p.system = f[3] == "1";
            p.created = (unsigned long long)std::strtoull(f[4].c_str(), nullptr, 10);
            p.modified = (unsigned long long)std::strtoull(f[5].c_str(), nullptr, 10);
            if (p.id == 0) p.id = ++maxId; else if (p.id > maxId) maxId = p.id;
            out.push_back(std::move(p));
        } else if (f[0] == "I" && f.size() >= 3) {
            uint32_t pid = (uint32_t)std::strtoul(f[1].c_str(), nullptr, 10);
            uint32_t tid = (uint32_t)std::strtoul(f[2].c_str(), nullptr, 10);
            for (Playlist& p : out) if (p.id == pid) { p.trackIds.push_back(tid); break; }
        }
    }
    if (maxId >= nextId) nextId = maxId + 1;
    return true;
}

// ------------------------------------------------------------------- queues
std::string serializeQueues(const std::vector<Queue>& qs) {
    std::string out;
    out += "# SHOSO queues v" + std::string(kFormatVersion) + "\n";
    for (size_t qi = 0; qi < qs.size(); ++qi) {
        const Queue& q = qs[qi];
        put(out, "Q");
        putInt(out, (long long)qi);
        put(out, q.name);
        putInt(out, q.orderPos);
        putInt(out, q.positionMs);
        put(out, q.shuffle ? "1" : "0");
        putInt(out, (int)q.repeat);
        put(out, q.wasPlaying ? "1" : "0");
        putInt(out, (long long)q.lastUsed);
        endLine(out);
        for (size_t i = 0; i < q.tracks.size(); ++i) {
            put(out, "q");
            putInt(out, (long long)qi);
            putInt(out, q.tracks[i]);
            int ord = (i < q.order.size()) ? q.order[i] : -1;
            putInt(out, ord);
            endLine(out);
        }
    }
    return out;
}

bool parseQueues(const std::string& text, std::vector<Queue>& out) {
    out.clear();
    struct Item { uint32_t trackId; int orderEntry; };
    std::vector<std::vector<Item>> items;
    for (const std::string& line : splitLines(text)) {
        if (line.empty() || line[0] == '#') continue;
        std::vector<std::string> f = splitTabs(line);
        if (f.empty()) continue;
        if (f[0] == "Q" && f.size() >= 9) {
            int idx = parseIntSafe(f[1], (int)out.size());
            while ((int)out.size() <= idx) {
                Queue q;
                char b[32];
                std::snprintf(b, sizeof(b), "%d", (int)out.size() + 1);
                q.name = std::string("תור ") + b;
                out.push_back(q);
                items.push_back({});
            }
            Queue& q = out[idx];
            q.name = f[2].empty() ? q.name : f[2];
            q.orderPos = parseIntSafe(f[3], -1);
            q.positionMs = parseIntSafe(f[4], 0);
            q.shuffle = f[5] == "1";
            int rep = parseIntSafe(f[6], 1);
            q.repeat = (rep == 0) ? RepeatMode::Off : (rep == 2 ? RepeatMode::One : RepeatMode::All);
            q.wasPlaying = f[7] == "1";
            q.lastUsed = (unsigned long long)std::strtoull(f[8].c_str(), nullptr, 10);
        } else if (f[0] == "q" && f.size() >= 4) {
            int idx = parseIntSafe(f[1], 0);
            if (idx < 0 || idx >= (int)out.size()) continue;
            Item it;
            it.trackId = (uint32_t)std::strtoul(f[2].c_str(), nullptr, 10);
            it.orderEntry = parseIntSafe(f[3], -1);
            items[idx].push_back(it);
        }
    }
    for (size_t qi = 0; qi < out.size() && qi < items.size(); ++qi) {
        Queue& q = out[qi];
        q.tracks.clear();
        for (const Item& it : items[qi]) q.tracks.push_back(it.trackId);
        q.rebuildOrderIdentity();
        // restore the saved shuffle order when it is a valid permutation
        std::vector<int> restored;
        restored.reserve(items[qi].size());
        bool ok = true;
        std::vector<char> seen(q.tracks.size(), 0);
        for (const Item& it : items[qi]) {
            if (it.orderEntry < 0 || it.orderEntry >= (int)q.tracks.size()) { ok = false; break; }
            if (seen[it.orderEntry]) { ok = false; break; }
            seen[it.orderEntry] = 1;
            restored.push_back(it.orderEntry);
        }
        if (ok && restored.size() == q.tracks.size()) q.order = restored;
        if (q.orderPos < -1 || q.orderPos >= (int)q.order.size()) q.orderPos = q.tracks.empty() ? -1 : 0;
    }
    return true;
}

// ------------------------------------------------------------------- paths
StorePaths makeStorePaths(const std::string& baseDirUtf8, char sep) {
    StorePaths p;
    std::string base = baseDirUtf8;
    while (!base.empty() && (base.back() == '\\' || base.back() == '/')) base.pop_back();
    p.dir = base;
    auto j = [&](const std::string& name) {
        std::string s = base;
        if (!s.empty() && s.back() != sep) s.push_back(sep);
        return s + name;
    };
    p.settings  = j("settings.dat");
    p.library   = j("library.dat");
    p.playlists = j("playlists.dat");
    p.queues    = j("queues.dat");
    p.log       = j("log.txt");
    p.artCache  = j("art");
    return p;
}

// ------------------------------------------------------------------- Store
static bool readIfThere(FileIO* io, const std::string& path, std::string& out) {
    if (!io) return false;
    if (!io->fileExists(path)) return false;
    return io->readText(path, out);
}

void Store::load(Settings& s, std::vector<Track>& tracks, uint32_t& nextTrackId,
                 std::vector<Playlist>& playlists, uint32_t& nextPlaylistId,
                 std::vector<Queue>& queues) {
    std::string text;
    if (readIfThere(io_, paths_.settings, text)) s.parse(text);
    if (readIfThere(io_, paths_.library, text)) parseTracks(text, tracks, nextTrackId);
    if (readIfThere(io_, paths_.playlists, text)) parsePlaylists(text, playlists, nextPlaylistId);
    if (readIfThere(io_, paths_.queues, text)) parseQueues(text, queues);
}

void Store::saveSettings(const Settings& s) {
    if (io_) io_->writeTextAtomic(paths_.settings, s.serialize());
}
void Store::saveTracks(const std::vector<Track>& tracks) {
    if (io_) io_->writeTextAtomic(paths_.library, serializeTracks(tracks));
}
void Store::savePlaylists(const std::vector<Playlist>& pls) {
    if (io_) io_->writeTextAtomic(paths_.playlists, serializePlaylists(pls));
}
void Store::saveQueues(const std::vector<Queue>& qs) {
    if (io_) io_->writeTextAtomic(paths_.queues, serializeQueues(qs));
}

} // namespace shoso
