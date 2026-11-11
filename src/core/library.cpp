#include "library.h"
#include "str.h"

#include <algorithm>
#include <map>

namespace shoso {

// ------------------------------------------------------------------ paths
static const char* kAudioExts[] = {
    "mp3", "flac", "wav", "m4a", "m4b", "m4p", "aac", "ogg", "oga", "opus",
    "wma", "aiff", "aif", "ape", "mp4", "alac", "mp2", "mpa", "wv"
};

bool isAudioExt(const std::string& extLower) {
    for (const char* e : kAudioExts) if (extLower == e) return true;
    return false;
}

std::string extLowerOf(const std::string& path) {
    size_t dot = path.rfind('.');
    size_t sep = path.find_last_of("\\/");
    if (dot == std::string::npos || (sep != std::string::npos && dot < sep)) return std::string();
    return foldLower(path.substr(dot + 1));
}

std::string fileNameOf(const std::string& path) {
    size_t sep = path.find_last_of("\\/");
    return (sep == std::string::npos) ? path : path.substr(sep + 1);
}

std::string parentDirOf(const std::string& path) {
    size_t sep = path.find_last_of("\\/");
    if (sep == std::string::npos) return std::string();
    if (sep == 0) return path.substr(0, 1);
    // keep "C:\" intact
    if (sep == 2 && path[1] == ':') return path.substr(0, 3);
    return path.substr(0, sep);
}

std::string stripExt(const std::string& fileName) {
    size_t dot = fileName.rfind('.');
    if (dot == std::string::npos || dot == 0) return fileName;
    return fileName.substr(0, dot);
}

char pathSepFor(const std::string& path) {
    if (path.find('/') != std::string::npos && path.find('\\') == std::string::npos) return '/';
    return '\\';
}

std::string pathJoin(const std::string& dir, const std::string& name) {
    if (dir.empty()) return name;
    char last = dir[dir.size() - 1];
    if (last == '\\' || last == '/') return dir + name;
    return dir + pathSepFor(dir) + name;
}

std::string normalizePath(const std::string& path) {
    std::string out;
    out.reserve(path.size());
    for (size_t i = 0; i < path.size(); ++i) {
        char c = path[i];
        bool sepNow = (c == '\\' || c == '/');
        bool sepPrev = !out.empty() && (out[out.size() - 1] == '\\' || out[out.size() - 1] == '/');
        if (sepNow && sepPrev) continue;   // collapse duplicates
        out.push_back(c);
    }
    return out;
}

// ------------------------------------------------------------------ Track
std::string Track::displayTitle() const {
    if (!title.empty()) return title;
    return stripExt(fileNameOf(path));
}
std::string Track::displayArtist() const {
    return artist.empty() ? std::string("אמן לא ידוע") : artist;
}
std::string Track::displayAlbum() const {
    return album.empty() ? std::string("אלבום לא ידוע") : album;
}
std::string Track::albumKey() const {
    return foldLower(displayAlbum()) + "\x01" + foldLower(albumArtist.empty() ? artist : albumArtist);
}

// ------------------------------------------------------------------ sorting
const char* sortModeNameHe(SortMode m) {
    switch (m) {
        case SortMode::Title: return "שם השיר";
        case SortMode::Album: return "אלבום";
        case SortMode::Artist: return "אמן";
        case SortMode::Year: return "שנה";
        case SortMode::Duration: return "אורך";
        case SortMode::DateAdded: return "סדר הוספה";
        case SortMode::Path: return "נתיב קובץ";
        case SortMode::ArtistAlbumTrack:
        default: return "אמן / אלבום / רצועה";
    }
}

SortMode sortModeFromInt(int v) {
    if (v < 0 || v > 7) return SortMode::ArtistAlbumTrack;
    return static_cast<SortMode>(v);
}

static bool cmpStr(const std::string& a, const std::string& b) {
    std::string fa = foldLower(a), fb = foldLower(b);
    if (fa != fb) return fa < fb;
    return a < b;
}

void sortTracks(std::vector<Track>& tracks, SortMode mode) {
    switch (mode) {
        case SortMode::Title:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                return cmpStr(a.displayTitle(), b.displayTitle());
            });
            break;
        case SortMode::Album:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                if (cmpStr(a.displayAlbum(), b.displayAlbum())) return true;
                if (cmpStr(b.displayAlbum(), a.displayAlbum())) return false;
                if (a.discNo != b.discNo) return a.discNo < b.discNo;
                if (a.trackNo != b.trackNo) return a.trackNo < b.trackNo;
                return cmpStr(a.displayTitle(), b.displayTitle());
            });
            break;
        case SortMode::Year:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                if (a.year != b.year) return a.year > b.year;
                return cmpStr(a.displayAlbum(), b.displayAlbum());
            });
            break;
        case SortMode::Duration:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                return a.durationMs > b.durationMs;
            });
            break;
        case SortMode::DateAdded:
            // insertion order already; keep stable by id
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                return a.id < b.id;
            });
            break;
        case SortMode::Path:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                return cmpStr(a.path, b.path);
            });
            break;
        case SortMode::Artist:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                if (cmpStr(a.displayArtist(), b.displayArtist())) return true;
                if (cmpStr(b.displayArtist(), a.displayArtist())) return false;
                return cmpStr(a.displayTitle(), b.displayTitle());
            });
            break;
        case SortMode::ArtistAlbumTrack:
        default:
            std::stable_sort(tracks.begin(), tracks.end(), [](const Track& a, const Track& b) {
                if (cmpStr(a.displayArtist(), b.displayArtist())) return true;
                if (cmpStr(b.displayArtist(), a.displayArtist())) return false;
                if (cmpStr(a.displayAlbum(), b.displayAlbum())) return true;
                if (cmpStr(b.displayAlbum(), a.displayAlbum())) return false;
                if (a.year != b.year) return a.year < b.year;
                if (a.discNo != b.discNo) return a.discNo < b.discNo;
                if (a.trackNo != b.trackNo) return a.trackNo < b.trackNo;
                return cmpStr(a.displayTitle(), b.displayTitle());
            });
            break;
    }
}

// ------------------------------------------------------------------ grouping
std::vector<AlbumGroup> groupByAlbum(const std::vector<Track>& tracks) {
    std::map<std::string, size_t> idx;
    std::vector<AlbumGroup> out;
    for (const Track& t : tracks) {
        std::string key = t.albumKey();
        auto it = idx.find(key);
        size_t pos;
        if (it == idx.end()) {
            AlbumGroup g;
            g.key = key;
            g.album = t.displayAlbum();
            g.artist = t.albumArtist.empty() ? t.displayArtist() : t.albumArtist;
            g.year = t.year;
            idx[key] = out.size();
            pos = out.size();
            out.push_back(std::move(g));
        } else {
            pos = it->second;
            if (out[pos].year == 0 && t.year != 0) out[pos].year = t.year;
        }
        out[pos].trackIds.push_back(t.id);
        out[pos].totalMs += t.durationMs;
    }
    std::sort(out.begin(), out.end(), [](const AlbumGroup& a, const AlbumGroup& b) {
        std::string aa = foldLower(a.artist), bb = foldLower(b.artist);
        if (aa != bb) return aa < bb;
        std::string al = foldLower(a.album), bl = foldLower(b.album);
        if (al != bl) return al < bl;
        return a.year < b.year;
    });
    return out;
}

std::vector<ArtistGroup> groupByArtist(const std::vector<Track>& tracks) {
    std::map<std::string, size_t> idx;
    std::map<std::string, std::map<std::string, int>> albumsPerArtist;
    std::vector<ArtistGroup> out;
    for (const Track& t : tracks) {
        std::string a = t.displayArtist();
        std::string key = foldLower(a);
        auto it = idx.find(key);
        size_t pos;
        if (it == idx.end()) {
            ArtistGroup g;
            g.artist = a;
            idx[key] = out.size();
            pos = out.size();
            out.push_back(std::move(g));
        } else pos = it->second;
        out[pos].trackIds.push_back(t.id);
        out[pos].totalMs += t.durationMs;
        albumsPerArtist[key][t.albumKey()] = 1;
    }
    for (size_t i = 0; i < out.size(); ++i) {
        std::string key = foldLower(out[i].artist);
        out[i].albumCount = albumsPerArtist[key].size();
    }
    std::sort(out.begin(), out.end(), [](const ArtistGroup& a, const ArtistGroup& b) {
        return foldLower(a.artist) < foldLower(b.artist);
    });
    return out;
}

std::vector<FolderGroup> groupByFolder(const std::vector<Track>& tracks) {
    std::map<std::string, size_t> idx;
    std::vector<FolderGroup> out;
    for (const Track& t : tracks) {
        std::string f = t.folder();
        std::string key = foldLower(f);
        auto it = idx.find(key);
        size_t pos;
        if (it == idx.end()) {
            FolderGroup g;
            g.folder = f;
            std::string name = fileNameOf(f);
            g.name = name.empty() ? f : name;
            idx[key] = out.size();
            pos = out.size();
            out.push_back(std::move(g));
        } else pos = it->second;
        out[pos].trackIds.push_back(t.id);
        out[pos].totalMs += t.durationMs;
    }
    std::sort(out.begin(), out.end(), [](const FolderGroup& a, const FolderGroup& b) {
        return foldLower(a.folder) < foldLower(b.folder);
    });
    return out;
}

std::vector<GenreGroup> groupByGenre(const std::vector<Track>& tracks) {
    std::map<std::string, size_t> idx;
    std::vector<GenreGroup> out;
    for (const Track& t : tracks) {
        std::string g = t.genre.empty() ? std::string("ללא סגנון") : t.genre;
        std::string key = foldLower(g);
        auto it = idx.find(key);
        size_t pos;
        if (it == idx.end()) {
            GenreGroup gg; gg.genre = g;
            idx[key] = out.size(); pos = out.size();
            out.push_back(std::move(gg));
        } else pos = it->second;
        out[pos].trackIds.push_back(t.id);
        out[pos].totalMs += t.durationMs;
    }
    std::sort(out.begin(), out.end(), [](const GenreGroup& a, const GenreGroup& b) {
        return foldLower(a.genre) < foldLower(b.genre);
    });
    return out;
}

// ------------------------------------------------------------------ search
bool trackMatches(const Track& t, const std::string& foldedQuery) {
    if (foldedQuery.empty()) return true;
    if (containsFold(t.title, foldedQuery)) return true;
    if (containsFold(t.artist, foldedQuery)) return true;
    if (containsFold(t.album, foldedQuery)) return true;
    if (containsFold(t.albumArtist, foldedQuery)) return true;
    if (containsFold(t.genre, foldedQuery)) return true;
    if (containsFold(t.path, foldedQuery)) return true;
    return false;
}

std::vector<size_t> searchTracks(const std::vector<Track>& tracks, const std::string& queryUtf8) {
    std::vector<size_t> out;
    out.reserve(tracks.size());
    std::string q = foldLower(trim(queryUtf8));
    if (q.empty()) {
        for (size_t i = 0; i < tracks.size(); ++i) out.push_back(i);
        return out;
    }
    // multi word: every word must match somewhere
    std::vector<std::string> words = split(q, ' ');
    std::vector<std::string> clean;
    for (const std::string& w : words) { std::string t = trim(w); if (!t.empty()) clean.push_back(t); }
    for (size_t i = 0; i < tracks.size(); ++i) {
        bool ok = true;
        for (const std::string& w : clean) {
            if (!trackMatches(tracks[i], w)) { ok = false; break; }
        }
        if (ok) out.push_back(i);
    }
    return out;
}

// ------------------------------------------------------------------ Library
void Library::clear() {
    tracks_.clear();
    pathIndex_.clear();
    nextId_ = 1;
}

void Library::rebuildIndex() {
    pathIndex_.clear();
    pathIndex_.reserve(tracks_.size());
    for (size_t i = 0; i < tracks_.size(); ++i) pathIndex_.emplace_back(foldLower(tracks_[i].path), i);
    std::sort(pathIndex_.begin(), pathIndex_.end(),
              [](const std::pair<std::string, size_t>& a, const std::pair<std::string, size_t>& b) {
                  return a.first < b.first;
              });
}

bool Library::hasPath(const std::string& path) const {
    std::string key = foldLower(path);
    for (const auto& kv : pathIndex_) if (kv.first == key) return true;
    for (const Track& t : tracks_) if (iequals(t.path, path)) return true;
    return false;
}

uint32_t Library::addTrack(const Track& t) {
    Track copy = t;
    if (copy.id == 0) copy.id = nextId_++;
    else if (copy.id >= nextId_) nextId_ = copy.id + 1;
    tracks_.push_back(copy);
    pathIndex_.emplace_back(foldLower(copy.path), tracks_.size() - 1);
    return copy.id;
}

const Track* Library::byId(uint32_t id) const {
    for (const Track& t : tracks_) if (t.id == id) return &t;
    return nullptr;
}

size_t Library::indexOfId(uint32_t id) const {
    for (size_t i = 0; i < tracks_.size(); ++i) if (tracks_[i].id == id) return i;
    return static_cast<size_t>(-1);
}

long long Library::totalDurationMs() const {
    long long total = 0;
    for (const Track& t : tracks_) total += t.durationMs;
    return total;
}

} // namespace shoso
