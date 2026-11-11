// SHOSO Music - library model: tracks, grouping (albums/artists/folders), search & sort
#pragma once
#include <cstdint>
#include <string>
#include <vector>

#include "tags.h"

namespace shoso {

// ---------- path helpers (work with both '\' and '/' separators) ----------
bool        isAudioExt(const std::string& extLower);
std::string extLowerOf(const std::string& path);
std::string parentDirOf(const std::string& path);
std::string fileNameOf(const std::string& path);
std::string stripExt(const std::string& fileName);
char        pathSepFor(const std::string& path);
std::string pathJoin(const std::string& dir, const std::string& name);
std::string normalizePath(const std::string& path);   // collapses duplicate separators

// ---------- track ----------
struct Track {
    uint32_t    id = 0;
    std::string path;          // native path, UTF-8 encoded
    std::string title;
    std::string artist;
    std::string album;
    std::string albumArtist;
    std::string genre;
    int         year = 0;
    int         trackNo = 0;
    int         discNo = 0;
    long long   durationMs = 0;
    int         bitrate = 0;
    int         sampleRate = 0;
    unsigned long long fileSize = 0;
    unsigned long long mtime = 0;
    bool        hasArt = false;

    std::string displayTitle() const;     // title, or file name when untagged
    std::string displayArtist() const;    // artist or "אמן לא ידוע"
    std::string displayAlbum() const;     // album or "אלבום לא ידוע"
    std::string albumKey() const;         // album + albumArtist (for grouping)
    std::string folder() const { return parentDirOf(path); }
};

enum class SortMode {
    ArtistAlbumTrack = 0,
    Title = 1,
    Album = 2,
    Artist = 3,
    Year = 4,
    Duration = 5,
    DateAdded = 6,
    Path = 7
};

const char* sortModeNameHe(SortMode m);
SortMode    sortModeFromInt(int v);

void sortTracks(std::vector<Track>& tracks, SortMode mode);

// ---------- grouping ----------
struct AlbumGroup {
    std::string album, artist, key;
    int year = 0;
    std::vector<uint32_t> trackIds;
    long long totalMs = 0;
};
struct ArtistGroup {
    std::string artist;
    std::vector<uint32_t> trackIds;
    size_t albumCount = 0;
    long long totalMs = 0;
};
struct FolderGroup {
    std::string folder, name;
    std::vector<uint32_t> trackIds;
    long long totalMs = 0;
};
struct GenreGroup {
    std::string genre;
    std::vector<uint32_t> trackIds;
    long long totalMs = 0;
};

std::vector<AlbumGroup>  groupByAlbum(const std::vector<Track>& tracks);
std::vector<ArtistGroup> groupByArtist(const std::vector<Track>& tracks);
std::vector<FolderGroup> groupByFolder(const std::vector<Track>& tracks);
std::vector<GenreGroup>  groupByGenre(const std::vector<Track>& tracks);

// ---------- search ----------
// Returns matching track indices (into `tracks`). Empty query -> all indices.
std::vector<size_t> searchTracks(const std::vector<Track>& tracks, const std::string& queryUtf8);
bool trackMatches(const Track& t, const std::string& foldedQuery);

// ---------- library container ----------
class Library {
public:
    void clear();
    uint32_t addTrack(const Track& t);          // returns id (dedupes by path)
    bool hasPath(const std::string& path) const;
    const Track* byId(uint32_t id) const;
    size_t indexOfId(uint32_t id) const;
    size_t size() const { return tracks_.size(); }
    std::vector<Track>& tracks() { return tracks_; }
    const std::vector<Track>& tracks() const { return tracks_; }
    uint32_t nextId() const { return nextId_; }
    void setNextId(uint32_t id) { nextId_ = id; }
    long long totalDurationMs() const;
    void rebuildIndex();

private:
    std::vector<Track> tracks_;
    std::vector<std::pair<std::string, size_t>> pathIndex_; // sorted by path
    uint32_t nextId_ = 1;
};

} // namespace shoso
