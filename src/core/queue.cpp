#include "queue.h"
#include "str.h"

#include <algorithm>
#include <cstddef>
#include <cstdio>

namespace shoso {

const char* kFavoritesName = "מועדפים";

const char* repeatNameHe(RepeatMode r) {
    switch (r) {
        case RepeatMode::One: return "חזרה על שיר אחד";
        case RepeatMode::All: return "חזרה על כל התור";
        case RepeatMode::Off:
        default: return "ללא חזרה";
    }
}

uint32_t simpleHash(const std::string& s) {
    uint32_t h = 2166136261u;
    for (unsigned char c : s) { h ^= c; h *= 16777619u; }
    return h ? h : 1u;
}

// xorshift32 - small, deterministic, good enough for shuffling
struct Rng {
    uint32_t s;
    explicit Rng(uint32_t seed) : s(seed ? seed : 0x9E3779B9u) {}
    uint32_t next() {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5; return s;
    }
};

void shuffleIndices(std::vector<int>& v, uint32_t seed) {
    if (v.size() < 2) return;
    Rng rng(seed);
    for (size_t i = v.size() - 1; i > 0; --i) {
        size_t j = rng.next() % (uint32_t)(i + 1);
        std::swap(v[i], v[j]);
    }
}

// ---------------------------------------------------------------- Playlist
bool Playlist::contains(uint32_t id) const {
    return std::find(trackIds.begin(), trackIds.end(), id) != trackIds.end();
}

void Playlist::addTrack(uint32_t id) {
    if (id == 0 || contains(id)) return;
    trackIds.push_back(id);
}

void Playlist::insertTracks(size_t at, const std::vector<uint32_t>& ids) {
    if (at > trackIds.size()) at = trackIds.size();
    std::vector<uint32_t> fresh;
    fresh.reserve(ids.size());
    for (uint32_t id : ids) if (id != 0 && !contains(id) &&
                               std::find(fresh.begin(), fresh.end(), id) == fresh.end()) fresh.push_back(id);
    trackIds.insert(trackIds.begin() + (ptrdiff_t)at, fresh.begin(), fresh.end());
}

bool Playlist::removeTrack(uint32_t id) {
    auto it = std::find(trackIds.begin(), trackIds.end(), id);
    if (it == trackIds.end()) return false;
    trackIds.erase(it);
    return true;
}

// ------------------------------------------------------------------- Queue
int Queue::currentIndex() const {
    if (orderPos < 0 || orderPos >= (int)order.size()) return -1;
    int idx = order[orderPos];
    if (idx < 0 || idx >= (int)tracks.size()) return -1;
    return idx;
}

uint32_t Queue::currentId() const {
    int idx = currentIndex();
    return idx < 0 ? 0u : tracks[idx];
}

void Queue::rebuildOrderIdentity() {
    order.clear();
    order.reserve(tracks.size());
    for (size_t i = 0; i < tracks.size(); ++i) order.push_back((int)i);
}

void Queue::setShuffle(bool on, uint32_t seed) {
    if (shuffle == on) return;
    int cur = currentIndex();
    shuffle = on;
    if (!on) {
        // back to logical order, keep the same track selected
        rebuildOrderIdentity();
        orderPos = (cur >= 0) ? cur : (tracks.empty() ? -1 : 0);
        if (tracks.empty()) orderPos = -1;
        return;
    }
    std::vector<int> rest;
    rest.reserve(tracks.size());
    for (size_t i = 0; i < tracks.size(); ++i) if ((int)i != cur) rest.push_back((int)i);
    shuffleIndices(rest, seed ? seed : simpleHash(name) + (uint32_t)tracks.size());
    order.clear();
    if (cur >= 0) order.push_back(cur);
    order.insert(order.end(), rest.begin(), rest.end());
    orderPos = order.empty() ? -1 : 0;
}

void Queue::playTrackAt(size_t logicalIndex) {
    if (logicalIndex >= tracks.size()) return;
    if (order.size() != tracks.size()) rebuildOrderIdentity();
    for (size_t i = 0; i < order.size(); ++i) {
        if (order[i] == (int)logicalIndex) { orderPos = (int)i; return; }
    }
    order.push_back((int)logicalIndex);
    orderPos = (int)order.size() - 1;
}

bool Queue::advance(bool forward) {
    if (tracks.empty()) { orderPos = -1; return false; }
    if (order.size() != tracks.size()) rebuildOrderIdentity();
    if (orderPos < 0 || orderPos >= (int)order.size()) {
        orderPos = 0;
        positionMs = 0;
        return true;
    }
    if (!forward) {
        if (orderPos == 0) {
            if (repeat == RepeatMode::All) { orderPos = (int)order.size() - 1; positionMs = 0; return true; }
            positionMs = 0;
            return true;   // stay on first track, restart it
        }
        orderPos--;
        positionMs = 0;
        return true;
    }
    if (orderPos + 1 >= (int)order.size()) {
        if (repeat == RepeatMode::All) {
            orderPos = 0;
            if (shuffle) {
                int cur = currentIndex();
                std::vector<int> rest;
                for (size_t i = 0; i < tracks.size(); ++i) if ((int)i != cur) rest.push_back((int)i);
                shuffleIndices(rest, simpleHash(name) ^ (uint32_t)tracks.size() ^ 0x5bf03635u);
                order.clear();
                if (cur >= 0) order.push_back(cur);
                order.insert(order.end(), rest.begin(), rest.end());
            }
            positionMs = 0;
            return true;
        }
        return false;      // end of queue
    }
    orderPos++;
    positionMs = 0;
    return true;
}

void Queue::clear() {
    tracks.clear();
    order.clear();
    orderPos = -1;
    positionMs = 0;
    wasPlaying = false;
}

void Queue::append(const std::vector<uint32_t>& ids) {
    int cur = currentIndex();
    uint32_t curId = cur >= 0 ? tracks[cur] : 0;
    tracks.insert(tracks.end(), ids.begin(), ids.end());
    rebuildOrderIdentity();
    if (shuffle) {
        // keep shuffled feel: rebuild around the current track
        std::vector<int> rest;
        for (size_t i = 0; i < tracks.size(); ++i) if ((int)i != cur) rest.push_back((int)i);
        shuffleIndices(rest, simpleHash(name) ^ (uint32_t)tracks.size());
        order.clear();
        if (cur >= 0) order.push_back(cur);
        order.insert(order.end(), rest.begin(), rest.end());
        orderPos = order.empty() ? -1 : 0;
    } else {
        orderPos = (curId != 0) ? cur : (orderPos >= 0 ? orderPos : -1);
    }
    if (tracks.empty()) orderPos = -1;
}

void Queue::insertAfterCurrent(const std::vector<uint32_t>& ids) {
    int cur = currentIndex();
    size_t at = (cur >= 0) ? (size_t)cur + 1 : 0;
    tracks.insert(tracks.begin() + (ptrdiff_t)at, ids.begin(), ids.end());
    rebuildOrderIdentity();
    if (!shuffle && cur >= 0) {
        orderPos = cur;
    } else if (shuffle) {
        std::vector<int> rest;
        for (size_t i = 0; i < tracks.size(); ++i) if ((int)i != cur) rest.push_back((int)i);
        shuffleIndices(rest, simpleHash(name) ^ (uint32_t)tracks.size());
        order.clear();
        if (cur >= 0) order.push_back(cur);
        order.insert(order.end(), rest.begin(), rest.end());
        orderPos = order.empty() ? -1 : 0;
        if (!ids.empty() && cur >= 0) {
            // put the freshly inserted tracks right after the current one
            std::vector<int> bumped;
            for (size_t k = 0; k < ids.size(); ++k) bumped.push_back((int)(at + k));
            order.erase(order.begin() + 1, order.end());
            order.insert(order.end(), bumped.begin(), bumped.end());
            for (size_t i = 0; i < tracks.size(); ++i) {
                bool inserted = false;
                for (int b : bumped) if (b == (int)i) inserted = true;
                if (!inserted && (int)i != cur) order.push_back((int)i);
            }
            orderPos = 0;
        }
    } else {
        orderPos = (at > 0) ? (int)(at - 1) : -1;
    }
}

void Queue::removeAt(size_t logicalIndex) {
    if (logicalIndex >= tracks.size()) return;
    int cur = currentIndex();
    tracks.erase(tracks.begin() + (ptrdiff_t)logicalIndex);
    int newCur = -1;
    if (cur >= 0) {
        if ((int)logicalIndex < cur) newCur = cur - 1;
        else if ((int)logicalIndex == cur) newCur = (cur > 0) ? cur - 1 : (tracks.empty() ? -1 : 0);
        else newCur = cur;
    }
    rebuildOrderIdentity();
    if (shuffle) {
        std::vector<int> rest;
        for (size_t i = 0; i < tracks.size(); ++i) if ((int)i != newCur) rest.push_back((int)i);
        shuffleIndices(rest, simpleHash(name) ^ (uint32_t)tracks.size());
        order.clear();
        if (newCur >= 0) order.push_back(newCur);
        order.insert(order.end(), rest.begin(), rest.end());
        orderPos = order.empty() ? -1 : 0;
    } else {
        orderPos = newCur;
    }
}

std::vector<Queue> makeDefaultQueues(int count) {
    std::vector<Queue> qs;
    if (count < 1) count = 1;
    if (count > 10) count = 10;
    for (int i = 0; i < count; ++i) {
        Queue q;
        char buf[32];
        std::snprintf(buf, sizeof(buf), "%d", i + 1);
        q.name = std::string("תור ") + buf;
        qs.push_back(q);
    }
    return qs;
}

} // namespace shoso
