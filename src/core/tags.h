// SHOSO Music - audio metadata parsing (ID3v2.2/2.3/2.4, ID3v1, FLAC, MP4/M4A)
// Pure logic over memory buffers so it can be unit tested off Windows.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace shoso {

struct CoverArt {
    std::vector<uint8_t> bytes;
    std::string mime;   // "image/jpeg" | "image/png"
    bool valid() const { return !bytes.empty(); }
    void clear() { bytes.clear(); mime.clear(); }
};

struct AudioTags {
    bool hasTag = false;
    std::string title, artist, album, albumArtist, genre, comment;
    int year = 0;
    int trackNo = 0, trackTotal = 0, discNo = 0, discTotal = 0;
    long long durationMs = 0;
    int bitrateKbps = 0;
    int sampleRateHz = 0;
    int channels = 0;
    CoverArt cover;
};

// `head`  - bytes from the start of the file (at least the tag area, 256KB is plenty)
// `tail`  - last 128..512 bytes of the file (for ID3v1), may be null
AudioTags parseAudioTags(const std::string& extLower,
                         const uint8_t* head, size_t headLen,
                         unsigned long long fileSize,
                         const uint8_t* tail, size_t tailLen);

// "01. Eyal Golan - Shiri" -> artist/title
bool tagsFromFilename(const std::string& fileNameNoExt, std::string& artist, std::string& title);

} // namespace shoso
