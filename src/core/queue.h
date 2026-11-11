// SHOSO Music - playlists and Musicolet style multiple play queues
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace shoso {

enum class RepeatMode { Off = 0, All = 1, One = 2 };
const char* repeatNameHe(RepeatMode r);

// --------------------------------------------------------------- Playlist
struct Playlist {
    uint32_t id = 0;
    std::string name;
    std::vector<uint32_t> trackIds;
    bool system = false;      // "מועדפים" cannot be deleted
    unsigned long long created = 0;
    unsigned long long modified = 0;

    bool contains(uint32_t id) const;
    void addTrack(uint32_t id);            // appends, no duplicates
    void insertTracks(size_t at, const std::vector<uint32_t>& ids);
    bool removeTrack(uint32_t id);
};

extern const char* kFavoritesName;         // "מועדפים"

// --------------------------------------------------------------- Queue
// A queue keeps its own order, position, shuffle and repeat state so that
// switching between queues resumes each one exactly where it stopped.
struct Queue {
    std::string name;                        // "תור 1"
    std::vector<uint32_t> tracks;            // logical order
    std::vector<int> order;                  // playback order (indices into tracks)
    int orderPos = -1;                       // index into order
    long long positionMs = 0;
    bool shuffle = false;
    RepeatMode repeat = RepeatMode::All;
    bool wasPlaying = false;
    unsigned long long lastUsed = 0;

    int currentIndex() const;                // -1 when empty
    uint32_t currentId() const;              // 0 when empty
    void rebuildOrderIdentity();
    void setShuffle(bool on, uint32_t seed); // keeps the current track first
    bool empty() const { return tracks.empty(); }
    size_t size() const { return tracks.size(); }

    // Moves the cursor. Returns false when playback should stop (end of queue).
    bool advance(bool forward);
    void playTrackAt(size_t logicalIndex);   // sets cursor so that index plays now

    // content editing helpers (keep the cursor consistent)
    void clear();
    void append(const std::vector<uint32_t>& ids);
    void insertAfterCurrent(const std::vector<uint32_t>& ids);
    void removeAt(size_t logicalIndex);
};

// Deterministic Fisher-Yates so results can be reproduced in tests
void shuffleIndices(std::vector<int>& v, uint32_t seed);
uint32_t simpleHash(const std::string& s);

std::vector<Queue> makeDefaultQueues(int count);

} // namespace shoso
