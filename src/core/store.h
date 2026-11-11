// SHOSO Music - persistence: settings, library, playlists, queues
// A tiny line/field text format (tab separated, escaped) - no external deps.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

#include "library.h"
#include "queue.h"

namespace shoso {

// Abstract file access so the core can be unit tested with stdio on Linux
struct FileIO {
    virtual ~FileIO() {}
    virtual bool readText(const std::string& pathUtf8, std::string& out) = 0;
    virtual bool writeTextAtomic(const std::string& pathUtf8, const std::string& data) = 0;
    virtual bool fileExists(const std::string& pathUtf8) = 0;
};

struct Settings {
    std::vector<std::string> musicFolders;   // watched folders (UTF-8 native paths)
    int  volume = 80;                        // 0..100
    bool mute = false;
    int  activeQueue = 0;
    bool minimizeToTray = true;
    bool scanOnStart = true;
    bool showArtInList = false;
    int  songsSort = 0;                      // SortMode
    std::string lastDir;
    int  sleepMinutes = 0;                   // 0 = off
    bool sleepEndOfTrack = false;
    int  theme = 0;                          // 0 = dark, 1 = light
    int  windowX = -1, windowY = -1, windowW = 1080, windowH = 720;
    bool maximized = false;
    int  view = 0;                           // 0 songs, 1 albums, 2 artists, 3 folders, 4 playlists, 5 genres
    bool lockSeekWhileDragging = false;
    int  crossfadeUnused = 0;
    std::string lastSearch;

    std::string serialize() const;
    bool parse(const std::string& text);
};

// ------------------------------------------------------------ serialization
std::string serializeTracks(const std::vector<Track>& tracks);
bool        parseTracks(const std::string& text, std::vector<Track>& out, uint32_t& nextId);

std::string serializePlaylists(const std::vector<Playlist>& pls);
bool        parsePlaylists(const std::string& text, std::vector<Playlist>& out, uint32_t& nextId);

std::string serializeQueues(const std::vector<Queue>& qs);
bool        parseQueues(const std::string& text, std::vector<Queue>& out);

// line splitting that tolerates \r\n
std::vector<std::string> splitLines(const std::string& text);

// ------------------------------------------------------------ app store
struct StorePaths {
    std::string dir;         // e.g. %APPDATA%\SHOSO
    std::string settings;
    std::string library;
    std::string playlists;
    std::string queues;
    std::string log;
    std::string artCache;
};

StorePaths makeStorePaths(const std::string& baseDirUtf8, char sep);

class Store {
public:
    Store(FileIO* io, const StorePaths& paths) : io_(io), paths_(paths) {}

    void load(Settings& s, std::vector<Track>& tracks, uint32_t& nextTrackId,
              std::vector<Playlist>& playlists, uint32_t& nextPlaylistId,
              std::vector<Queue>& queues);
    void saveSettings(const Settings& s);
    void saveTracks(const std::vector<Track>& tracks);
    void savePlaylists(const std::vector<Playlist>& playlists);
    void saveQueues(const std::vector<Queue>& queues);
    const StorePaths& paths() const { return paths_; }

private:
    FileIO* io_;
    StorePaths paths_;
};

} // namespace shoso
