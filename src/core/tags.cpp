#include "tags.h"
#include "str.h"

#include <cctype>
#include <cstring>

namespace shoso {
namespace {

// ------------------------------------------------------------- small readers
struct Reader {
    const uint8_t* p;
    size_t n;
    size_t i = 0;
    Reader(const uint8_t* d, size_t len) : p(d ? d : reinterpret_cast<const uint8_t*>("")), n(d ? len : 0) {}
    bool eof(size_t need = 1) const { return i + need > n; }
    uint8_t  u8()  { return eof(1) ? 0 : p[i++]; }
    uint16_t be16(){ if (eof(2)) { i = n; return 0; } uint16_t v = (uint16_t)((p[i] << 8) | p[i + 1]); i += 2; return v; }
    uint32_t be32(){ if (eof(4)) { i = n; return 0; } uint32_t v = ((uint32_t)p[i] << 24) | ((uint32_t)p[i+1] << 16) | ((uint32_t)p[i+2] << 8) | p[i+3]; i += 4; return v; }
    uint64_t be64(){ uint64_t v = 0; for (int k = 0; k < 8; ++k) v = (v << 8) | u8(); return v; }
    uint32_t le32(){ if (eof(4)) { i = n; return 0; } uint32_t v = ((uint32_t)p[i+3] << 24) | ((uint32_t)p[i+2] << 16) | ((uint32_t)p[i+1] << 8) | p[i]; i += 4; return v; }
    uint32_t synchsafe(){ if (eof(4)) { i = n; return 0; } uint32_t v = ((uint32_t)(p[i] & 0x7F) << 21) | ((uint32_t)(p[i+1] & 0x7F) << 14) | ((uint32_t)(p[i+2] & 0x7F) << 7) | (uint32_t)(p[i+3] & 0x7F); i += 4; return v; }
    void skip(size_t k) { i = (i + k > n) ? n : i + k; }
    const uint8_t* cur() const { return p + i; }
    size_t left() const { return n - i; }
};

std::string decodeTextFrame(uint8_t enc, const uint8_t* data, size_t len) {
    if (len == 0) return std::string();
    // strip trailing nulls
    while (len > 0 && data[len - 1] == 0) --len;
    if (len == 0) return std::string();
    switch (enc) {
        case 0: return latin1ToUtf8(data, len);
        case 3: return std::string(reinterpret_cast<const char*>(data), len);
        case 1: {
            const uint8_t* s = data; size_t l = len;
            if (l >= 2 && s[0] == 0xFF && s[1] == 0xFE) { s += 2; l -= 2; }
            else if (l >= 2 && s[0] == 0xFE && s[1] == 0xFF) {
                // UTF-16BE -> swap into a temp buffer
                size_t even = l & ~static_cast<size_t>(1);
                std::vector<uint8_t> tmp(even);
                for (size_t k = 0; k < even; k += 2) { tmp[k] = s[k + 1]; tmp[k + 1] = s[k]; }
                return utf16ToUtf8(reinterpret_cast<const char16_t*>(tmp.data()), even / 2);
            }
            return utf16ToUtf8(reinterpret_cast<const char16_t*>(s), (l & ~static_cast<size_t>(1)) / 2);
        }
        case 2: {
            size_t even = len & ~static_cast<size_t>(1);
            std::vector<uint8_t> tmp(even);
            for (size_t k = 0; k < even; k += 2) { tmp[k] = data[k + 1]; tmp[k + 1] = data[k]; }
            return utf16ToUtf8(reinterpret_cast<const char16_t*>(tmp.data()), even / 2);
        }
        default: return latin1ToUtf8(data, len);
    }
}

// Reads a NUL terminated string in the given encoding, advances offset.
size_t readNullTerm(const uint8_t* data, size_t len, size_t off, uint8_t enc, std::string& out) {
    if (enc == 1 || enc == 2) {
        size_t k = off;
        while (k + 1 < len) {
            if (data[k] == 0 && data[k + 1] == 0) {
                out = decodeTextFrame(enc, data + off, k - off);
                return k + 2;
            }
            k += 2;
        }
        out = decodeTextFrame(enc, data + off, len - off);
        return len;
    }
    size_t k = off;
    while (k < len && data[k] != 0) ++k;
    out = decodeTextFrame(enc, data + off, k - off);
    return (k < len) ? k + 1 : len;
}

const char* id3Genre(int idx) {
    static const char* g[] = {
        "Blues","Classic Rock","Country","Dance","Disco","Funk","Grunge","Hip-Hop","Jazz","Metal",
        "New Age","Oldies","Other","Pop","R&B","Rap","Reggae","Rock","Techno","Industrial",
        "Alternative","Ska","Death Metal","Pranks","Soundtrack","Euro-Techno","Ambient","Trip-Hop","Vocal","Jazz+Funk",
        "Fusion","Trance","Classical","Instrumental","Acid","House","Game","Sound Clip","Gospel","Noise",
        "AlternRock","Bass","Soul","Punk","Space","Meditative","Instrumental Pop","Instrumental Rock","Ethnic","Gothic",
        "Darkwave","Techno-Industrial","Electronic","Pop-Folk","Eurodance","Dream","Southern Rock","Comedy","Cult","Gangsta",
        "Top 40","Christian Rap","Pop/Funk","Jungle","Native American","Cabaret","New Wave","Psychadelic","Rave","Showtunes",
        "Trailer","Lo-Fi","Tribal","Acid Punk","Acid Jazz","Polka","Retro","Musical","Rock & Roll","Hard Rock"
    };
    if (idx >= 0 && idx < (int)(sizeof(g) / sizeof(g[0]))) return g[idx];
    return nullptr;
}

std::string cleanGenre(const std::string& raw) {
    std::string s = trim(raw);
    if (s.empty()) return s;
    // "(17)Rock" / "(17)" / "17" / "(CR)"
    if (s[0] == '(') {
        size_t close = s.find(')');
        if (close != std::string::npos) {
            std::string inner = s.substr(1, close - 1);
            std::string rest = trim(s.substr(close + 1));
            int idx = parseIntSafe(inner, -1);
            const char* name = (idx >= 0) ? id3Genre(idx) : nullptr;
            if (name && rest.empty()) return name;
            if (!rest.empty()) return rest;
            if (name) return name;
        }
    } else {
        bool allDigits = true;
        for (char c : s) if (c < '0' || c > '9') { allDigits = false; break; }
        if (allDigits) {
            const char* name = id3Genre(parseIntSafe(s, -1));
            if (name) return name;
        }
    }
    return s;
}

void applyTextFrame(AudioTags& t, const std::string& id, const std::string& valueRaw) {
    std::string v = trim(valueRaw);
    if (v.empty()) return;
    t.hasTag = true;
    std::string key = id;
    // ID3v2.2 uses 3 letter ids
    if (key == "TT2") key = "TIT2";
    else if (key == "TP1") key = "TPE1";
    else if (key == "TP2") key = "TPE2";
    else if (key == "TAL") key = "TALB";
    else if (key == "TYE") key = "TYER";
    else if (key == "TCO") key = "TCON";
    else if (key == "TRK") key = "TRCK";
    else if (key == "TPA") key = "TPOS";
    else if (key == "COM") key = "COMM";

    if (key == "TIT2") { if (t.title.empty()) t.title = v; }
    else if (key == "TPE1") { if (t.artist.empty()) t.artist = v; }
    else if (key == "TPE2") { if (t.albumArtist.empty()) t.albumArtist = v; }
    else if (key == "TALB") { if (t.album.empty()) t.album = v; }
    else if (key == "TCON") { if (t.genre.empty()) t.genre = cleanGenre(v); }
    else if (key == "COMM" || key == "USLT") { if (t.comment.empty()) t.comment = v; }
    else if (key == "TYER" || key == "TDRC" || key == "TDRL" || key == "TYE") {
        if (t.year == 0) {
            int y = parseIntSafe(v.substr(0, 4), 0);
            if (y >= 1900 && y <= 2200) t.year = y;
        }
    }
    else if (key == "TRCK") { parseTrackField(v, t.trackNo, t.trackTotal); }
    else if (key == "TPOS") { parseTrackField(v, t.discNo, t.discTotal); }
}

size_t parseId3v2(const uint8_t* data, size_t len, AudioTags& out) {
    if (len < 10 || data[0] != 'I' || data[1] != 'D' || data[2] != '3') return 0;
    uint8_t major = data[3];
    uint8_t flags = data[5];
    if (major < 2 || major > 4) return 0;
    uint32_t bodySize = ((uint32_t)(data[6] & 0x7F) << 21) | ((uint32_t)(data[7] & 0x7F) << 14) |
                        ((uint32_t)(data[8] & 0x7F) << 7) | (uint32_t)(data[9] & 0x7F);
    if (bodySize == 0) return 10;
    size_t total = 10 + bodySize + ((flags & 0x10) ? 10u : 0u);
    size_t bodyEnd = 10 + bodySize;
    if (bodyEnd > len) bodyEnd = len;      // truncated header vs buffer - parse what we have
    size_t i = 10;
    bool compressed = (flags & 0x40) != 0;   // v2.3 extended header
    if (compressed && major == 3 && i + 4 <= bodyEnd) {
        uint32_t extSize = ((uint32_t)data[i] << 24) | ((uint32_t)data[i+1] << 16) | ((uint32_t)data[i+2] << 8) | data[i+3];
        if (extSize > 4 && i + extSize <= bodyEnd) i += extSize;
    } else if (compressed && major == 4 && i + 4 <= bodyEnd) {
        uint32_t extSize = ((uint32_t)(data[i] & 0x7F) << 21) | ((uint32_t)(data[i+1] & 0x7F) << 14) |
                           ((uint32_t)(data[i+2] & 0x7F) << 7) | (uint32_t)(data[i+3] & 0x7F);
        if (extSize >= 4 && i + extSize <= bodyEnd) i += extSize;
    }

    int guard = 0;
    while (i + (major == 2 ? 6u : 10u) <= bodyEnd && guard++ < 4000) {
        if (data[i] == 0) break; // padding
        std::string id;
        uint32_t fsize = 0;
        uint16_t fflags = 0;
        size_t headerLen = 0;
        if (major == 2) {
            id.assign(reinterpret_cast<const char*>(data + i), 3);
            fsize = ((uint32_t)data[i+3] << 16) | ((uint32_t)data[i+4] << 8) | data[i+5];
            headerLen = 6;
        } else {
            id.assign(reinterpret_cast<const char*>(data + i), 4);
            fsize = (major == 4)
                ? (((uint32_t)(data[i+4] & 0x7F) << 21) | ((uint32_t)(data[i+5] & 0x7F) << 14) |
                   ((uint32_t)(data[i+6] & 0x7F) << 7) | (uint32_t)(data[i+7] & 0x7F))
                : (((uint32_t)data[i+4] << 24) | ((uint32_t)data[i+5] << 16) | ((uint32_t)data[i+6] << 8) | data[i+7]);
            fflags = (uint16_t)((data[i+8] << 8) | data[i+9]);
            headerLen = 10;
        }
        if (fsize == 0 || fsize > 40u * 1024u * 1024u) { i += headerLen; if (fsize == 0) continue; else break; }
        size_t body = i + headerLen;
        if (body + fsize > bodyEnd) {
            // frame extends past what we have: use available bytes for text frames, else stop
            if (id.rfind("T", 0) == 0 && body < bodyEnd) {
                size_t avail = bodyEnd - body;
                if (avail >= 1) {
                    std::string v = decodeTextFrame(data[body], data + body + 1, avail - 1);
                    applyTextFrame(out, id, v);
                }
            }
            break;
        }
        const uint8_t* fb = data + body;

        // skip compressed/encrypted frames we cannot decode
        bool badFrame = (major >= 3) && ((fflags & 0x0040) || (fflags & 0x0004));
        if (!badFrame) {
            if (id == "APIC" || id == "PIC") {
                if (out.cover.bytes.empty() && fsize > 4) {
                    uint8_t enc = fb[0];
                    size_t off = 1;
                    std::string mime;
                    if (id == "PIC") {
                        if (off + 3 <= fsize) {
                            char fmt[4] = { (char)fb[off], (char)fb[off+1], (char)fb[off+2], 0 };
                            mime = (std::strcmp(fmt, "PNG") == 0) ? "image/png" : "image/jpeg";
                            off += 3;
                        } else {
                            mime = "image/jpeg";
                        }
                    } else {
                        std::string m;
                        off = readNullTerm(fb, fsize, off, 0, m);
                        mime = m.empty() ? "image/jpeg" : m;
                    }
                    if (off < fsize) {
                        uint8_t picType = fb[off++];
                        std::string desc;
                        off = readNullTerm(fb, fsize, off, enc, desc);
                        if (off < fsize) {
                            bool prefer = (picType == 3) || out.cover.bytes.empty();
                            if (prefer) {
                                out.cover.mime = mime;
                                out.cover.bytes.assign(fb + off, fb + fsize);
                            }
                        }
                    }
                }
            } else if (id == "COMM" || id == "USLT" || id == "ULT" || id == "COM") {
                uint8_t enc = fb[0];
                size_t off = 4; // encoding + 3 byte language
                if (off < fsize) {
                    std::string desc, text;
                    off = readNullTerm(fb, fsize, off, enc, desc);
                    if (off <= fsize) text = decodeTextFrame(enc, fb + off, fsize - off);
                    if (text.empty()) text = desc;
                    applyTextFrame(out, (id == "ULT" || id == "COM") ? "COMM" : id, text);
                }
            } else if (!id.empty() && (id[0] == 'T' || id[0] == 't')) {
                uint8_t enc = fb[0];
                std::string v = decodeTextFrame(enc, fb + 1, fsize - 1);
                // some tags pack multiple values with NUL separators - keep the first
                size_t z = v.find('\0');
                if (z != std::string::npos) v = v.substr(0, z);
                applyTextFrame(out, id, v);
            }
        }
        i = body + fsize;
    }
    return total;
}

// ---------------- MP3 frame header / Xing ----------------
struct Mp3FrameInfo {
    bool valid = false;
    int mpegVersion = 0;   // 1, 2 or 25 (2.5)
    int layer = 0;         // 1..3
    int bitrateKbps = 0;
    int sampleRate = 0;
    int channels = 0;
    int samplesPerFrame = 1152;
    int frameBytes = 0;
};

bool parseMp3FrameHeader(const uint8_t* p, size_t avail, Mp3FrameInfo& info) {
    if (avail < 4) return false;
    if (p[0] != 0xFF || (p[1] & 0xE0) != 0xE0) return false;
    int verBits = (p[1] >> 3) & 0x03;
    int layerBits = (p[1] >> 1) & 0x03;
    if (verBits == 1 || layerBits == 0) return false;
    int bitrateIdx = (p[2] >> 4) & 0x0F;
    int srateIdx = (p[2] >> 2) & 0x03;
    int padding = (p[2] >> 1) & 0x01;
    int chanMode = (p[3] >> 6) & 0x03;
    if (bitrateIdx == 0 || bitrateIdx == 15 || srateIdx == 3) return false;

    int ver = (verBits == 3) ? 1 : (verBits == 2) ? 2 : 25;
    int layer = 4 - layerBits;
    static const int brV1L3[16] = {0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0};
    static const int brV1L2[16] = {0,32,48,56,64,80,96,112,128,160,192,224,256,320,384,0};
    static const int brV1L1[16] = {0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,0};
    static const int brV2L3[16] = {0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0};
    static const int brV2L1[16] = {0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0};
    static const int srV1[4]  = {44100,48000,32000,0};
    static const int srV2[4]  = {22050,24000,16000,0};
    static const int srV25[4] = {11025,12000,8000,0};

    int bitrate = 0;
    if (ver == 1) bitrate = (layer == 3) ? brV1L3[bitrateIdx] : (layer == 2 ? brV1L2[bitrateIdx] : brV1L1[bitrateIdx]);
    else          bitrate = (layer == 3 || layer == 2) ? brV2L3[bitrateIdx] : brV2L1[bitrateIdx];
    int sr = (ver == 1) ? srV1[srateIdx] : (ver == 2 ? srV2[srateIdx] : srV25[srateIdx]);
    if (bitrate == 0 || sr == 0) return false;

    int spf = (layer == 1) ? 384 : (layer == 2 ? 1152 : (ver == 1 ? 1152 : 576));
    int frameBytes = 0;
    if (layer == 1) frameBytes = (12 * bitrate * 1000 / sr + padding) * 4;
    else            frameBytes = (layer == 3 && ver != 1) ? (72 * bitrate * 1000 / sr + padding)
                                                          : (144 * bitrate * 1000 / sr + padding);
    if (frameBytes <= 0) return false;

    info.valid = true;
    info.mpegVersion = ver;
    info.layer = layer;
    info.bitrateKbps = bitrate;
    info.sampleRate = sr;
    info.channels = (chanMode == 3) ? 1 : 2;
    info.samplesPerFrame = spf;
    info.frameBytes = frameBytes;
    return true;
}

// Looks for a Xing/Info/VBRI header inside the first frame and returns frame count.
bool xingFrameCount(const uint8_t* frame, size_t avail, const Mp3FrameInfo& info, uint32_t& frames, uint32_t& bytes) {
    frames = 0; bytes = 0;
    if (avail < 40) return false;
    size_t off = 4;
    if (info.layer == 3) {
        size_t sideInfo = (info.mpegVersion == 1) ? (info.channels == 1 ? 17u : 32u)
                                                  : (info.channels == 1 ? 9u : 17u);
        off += sideInfo;
    }
    if (off + 8 > avail) return false;
    bool isXing = (frame[off] == 'X' && frame[off+1] == 'i' && frame[off+2] == 'n' && frame[off+3] == 'g');
    bool isInfo = (frame[off] == 'I' && frame[off+1] == 'n' && frame[off+2] == 'f' && frame[off+3] == 'o');
    if (isXing || isInfo) {
        uint32_t flagsWord = ((uint32_t)frame[off+4] << 24) | ((uint32_t)frame[off+5] << 16) |
                             ((uint32_t)frame[off+6] << 8) | frame[off+7];
        size_t p = off + 8;
        if (flagsWord & 0x1) {
            if (p + 4 > avail) return false;
            frames = ((uint32_t)frame[p] << 24) | ((uint32_t)frame[p+1] << 16) |
                     ((uint32_t)frame[p+2] << 8) | frame[p+3];
            p += 4;
        }
        if (flagsWord & 0x2) {
            if (p + 4 > avail) return false;
            bytes = ((uint32_t)frame[p] << 24) | ((uint32_t)frame[p+1] << 16) |
                    ((uint32_t)frame[p+2] << 8) | frame[p+3];
        }
        return frames > 0 && frames < 10000000;
    }
    // VBRI (Fraunhofer) header always starts at byte 36 of the frame
    if (avail >= 36 + 14 && frame[36] == 'V' && frame[37] == 'B' && frame[38] == 'R' && frame[39] == 'I') {
        frames = ((uint32_t)frame[46] << 24) | ((uint32_t)frame[47] << 16) |
                 ((uint32_t)frame[48] << 8) | frame[49];
        return frames > 0 && frames < 10000000;
    }
    return false;
}

std::string id3v1Field(const uint8_t* p, size_t n) {
    while (n > 0 && (p[n - 1] == 0 || p[n - 1] == ' ')) --n;
    return trim(latin1ToUtf8(p, n));
}

void parseId3v1(const uint8_t* tail, size_t tailLen, AudioTags& t) {
    if (tailLen < 128) return;
    const uint8_t* p = tail + (tailLen - 128);
    if (p[0] != 'T' || p[1] != 'A' || p[2] != 'G') return;
    t.hasTag = true;
    if (t.title.empty())  t.title  = id3v1Field(p + 3, 30);
    if (t.artist.empty()) t.artist = id3v1Field(p + 33, 30);
    if (t.album.empty())  t.album  = id3v1Field(p + 63, 30);
    if (t.year == 0)      t.year   = parseIntSafe(id3v1Field(p + 93, 4), 0);
    // track number trick: comment[28] == 0
    if (t.trackNo == 0 && p[125] == 0 && p[126] != 0) t.trackNo = p[126];
    if (t.comment.empty()) t.comment = id3v1Field(p + 97, (p[125] == 0 && p[126] != 0) ? 28 : 30);
    if (t.genre.empty()) {
        const char* g = id3Genre(p[127]);
        if (g) t.genre = g;
    }
}

size_t parseFlac(const uint8_t* data, size_t len, AudioTags& out) {
    if (len < 4 || data[0] != 'f' || data[1] != 'L' || data[2] != 'a' || data[3] != 'C') return 0;
    size_t i = 4;
    int guard = 0;
    while (i + 4 <= len && guard++ < 128) {
        uint8_t hdr = data[i];
        bool last = (hdr & 0x80) != 0;
        uint8_t type = hdr & 0x7F;
        uint32_t blen = ((uint32_t)data[i+1] << 16) | ((uint32_t)data[i+2] << 8) | data[i+3];
        i += 4;
        if (blen > 200u * 1024u * 1024u) break;
        size_t bodyEnd = i + blen;
        if (bodyEnd > len) bodyEnd = len;
        if (type == 0 && bodyEnd - i >= 34) {
            // STREAMINFO
            const uint8_t* s = data + i;
            uint32_t sr = ((uint32_t)s[10] << 12) | ((uint32_t)s[11] << 4) | ((uint32_t)s[12] >> 4);
            uint32_t ch = ((s[12] >> 1) & 0x07) + 1;
            uint32_t bps = (((uint32_t)s[12] & 0x01) << 4) | ((uint32_t)s[13] >> 4);
            uint64_t totalSamples = ((uint64_t)(s[13] & 0x0F) << 32) | ((uint64_t)s[14] << 24) |
                                    ((uint64_t)s[15] << 16) | ((uint64_t)s[16] << 8) | s[17];
            out.sampleRateHz = (int)sr;
            out.channels = (int)ch;
            out.bitrateKbps = 0;
            if (sr > 0 && totalSamples > 0)
                out.durationMs = (long long)((totalSamples * 1000ULL) / sr);
            (void)bps;
            out.hasTag = true;
        } else if (type == 4 && bodyEnd > i) {
            // VORBIS_COMMENT
            Reader r(data + i, bodyEnd - i);
            uint32_t vlen = r.le32();
            r.skip(vlen);
            uint32_t count = r.le32();
            if (count > 10000) count = 10000;
            for (uint32_t k = 0; k < count && !r.eof(4); ++k) {
                uint32_t clen = r.le32();
                if (clen == 0 || r.eof(clen)) break;
                std::string kv(reinterpret_cast<const char*>(r.cur()), clen);
                r.skip(clen);
                size_t eq = kv.find('=');
                if (eq == std::string::npos) continue;
                std::string key = foldLower(trim(kv.substr(0, eq)));
                std::string val = trim(kv.substr(eq + 1));
                if (val.empty()) continue;
                out.hasTag = true;
                if (key == "title") { if (out.title.empty()) out.title = val; }
                else if (key == "artist") { if (out.artist.empty()) out.artist = val; }
                else if (key == "album") { if (out.album.empty()) out.album = val; }
                else if (key == "albumartist") { if (out.albumArtist.empty()) out.albumArtist = val; }
                else if (key == "genre") { if (out.genre.empty()) out.genre = val; }
                else if (key == "date" || key == "year") { if (out.year == 0) out.year = parseIntSafe(val.substr(0, 4), 0); }
                else if (key == "tracknumber") { if (out.trackNo == 0) parseTrackField(val, out.trackNo, out.trackTotal); }
                else if (key == "tracktotal") { if (out.trackTotal == 0) out.trackTotal = parseIntSafe(val, 0); }
                else if (key == "discnumber") { if (out.discNo == 0) parseTrackField(val, out.discNo, out.discTotal); }
                else if (key == "comment") { if (out.comment.empty()) out.comment = val; }
            }
        } else if (type == 6 && bodyEnd > i + 32 && out.cover.bytes.empty()) {
            Reader r(data + i, bodyEnd - i);
            uint32_t mimeLen = r.be32();
            if (mimeLen < 64 && !r.eof(mimeLen)) {
                std::string mime(reinterpret_cast<const char*>(r.cur()), mimeLen);
                r.skip(mimeLen);
                uint32_t descLen = r.be32();
                if (descLen < 4096 && !r.eof(descLen)) {
                    r.skip(descLen);
                    r.skip(16); // width height depth colors
                    uint32_t dataLen = r.be32();
                    if (dataLen > 0 && dataLen <= r.left()) {
                        out.cover.mime = mime.empty() ? "image/jpeg" : mime;
                        out.cover.bytes.assign(r.cur(), r.cur() + dataLen);
                    }
                }
            }
        }
        if (last) break;
        i = i + blen;
    }
    return i;
}

bool isMp4Container(const char* t) {
    static const char* conts[] = {"moov","trak","mdia","minf","stbl","udta","edts","ilst","dinf","mvex"};
    for (const char* c : conts) if (std::memcmp(c, t, 4) == 0) return true;
    return false;
}

void mp4ReadIlstItem(const uint8_t* p, size_t len, const std::string& name, AudioTags& out) {
    // item box -> 'data' box
    size_t i = 0;
    while (i + 8 <= len) {
        uint64_t size = ((uint64_t)p[i] << 24) | ((uint64_t)p[i+1] << 16) | ((uint64_t)p[i+2] << 8) | p[i+3];
        char type[5] = {0};
        std::memcpy(type, p + i + 4, 4);
        size_t hdr = 8;
        if (size == 1) {
            if (i + 16 > len) break;
            size = 0; for (int k = 0; k < 8; ++k) size = (size << 8) | p[i + 8 + k];
            hdr = 16;
        } else if (size == 0) {
            size = len - i;
        }
        if (size < hdr || i + size > len) break;
        if (std::memcmp(type, "data", 4) == 0 && size >= hdr + 8) {
            uint32_t flags = ((uint32_t)p[i+hdr+0] << 24) | ((uint32_t)p[i+hdr+1] << 16) |
                             ((uint32_t)p[i+hdr+2] << 8) | p[i+hdr+3];
            const uint8_t* v = p + i + hdr + 8;
            size_t vlen = (size_t)(size - hdr - 8);
            std::string text;
            if ((flags & 0xFF) == 1 || (flags & 0xFF) == 0) text = std::string(reinterpret_cast<const char*>(v), vlen);
            else if ((flags & 0xFF) == 13 && out.cover.bytes.empty()) { out.cover.mime = "image/jpeg"; out.cover.bytes.assign(v, v + vlen); }
            else if ((flags & 0xFF) == 14 && out.cover.bytes.empty()) { out.cover.mime = "image/png"; out.cover.bytes.assign(v, v + vlen); }
            else if ((flags & 0xFF) == 0 && (name == "trkn" || name == "disk") && vlen >= 4) {
                int num = (v[2] << 8) | v[3];
                int tot = (vlen >= 6) ? ((v[4] << 8) | v[5]) : 0;
                if (name == "trkn") { out.trackNo = num; out.trackTotal = tot; }
                else { out.discNo = num; out.discTotal = tot; }
            }
            if (!text.empty()) {
                text = trim(text);
                out.hasTag = true;
                if (name == "\xA9" "nam" || name == "titl") { if (out.title.empty()) out.title = text; }
                else if (name == "\xA9" "ART" || name == "aART") {
                    if (name == "aART") { if (out.albumArtist.empty()) out.albumArtist = text; }
                    else if (out.artist.empty()) out.artist = text;
                }
                else if (name == "\xA9" "alb" || name == "albm") { if (out.album.empty()) out.album = text; }
                else if (name == "\xA9" "day" || name == "day") { if (out.year == 0) out.year = parseIntSafe(text.substr(0, 4), 0); }
                else if (name == "\xA9" "gen" || name == "gnre") { if (out.genre.empty()) out.genre = text; }
                else if (name == "\xA9" "cmt" || name == "desc") { if (out.comment.empty()) out.comment = text; }
                else if (name == "trkn") { int a=0,b=0; if (parseTrackField(text,a,b)) { out.trackNo=a; out.trackTotal=b; } }
                else if (name == "disk") { int a=0,b=0; if (parseTrackField(text,a,b)) { out.discNo=a; out.discTotal=b; } }
            }
        }
        i += (size_t)size;
    }
}

void mp4Walk(const uint8_t* p, size_t len, int depth, AudioTags& out) {
    if (depth > 8) return;
    size_t i = 0;
    while (i + 8 <= len) {
        uint64_t size = ((uint64_t)p[i] << 24) | ((uint64_t)p[i+1] << 16) | ((uint64_t)p[i+2] << 8) | p[i+3];
        char type[5] = {0};
        std::memcpy(type, p + i + 4, 4);
        size_t hdr = 8;
        if (size == 1) {
            if (i + 16 > len) break;
            size = 0; for (int k = 0; k < 8; ++k) size = (size << 8) | p[i + 8 + k];
            hdr = 16;
        } else if (size == 0) {
            size = len - i;
        }
        if (size < hdr || size > (uint64_t)len) break;
        if (i + size > len) size = len - i;
        const uint8_t* body = p + i + hdr;
        size_t bodyLen = (size_t)size - hdr;

        if (std::memcmp(type, "meta", 4) == 0) {
            if (bodyLen > 4) mp4Walk(body + 4, bodyLen - 4, depth + 1, out); // full box
        } else if (isMp4Container(type)) {
            mp4Walk(body, bodyLen, depth + 1, out);
        } else if (std::memcmp(type, "mvhd", 4) == 0 && bodyLen >= 20) {
            uint8_t ver = body[0];
            uint32_t timescale = 0; uint64_t dur = 0;
            if (ver == 1 && bodyLen >= 32) {
                timescale = ((uint32_t)body[20] << 24) | ((uint32_t)body[21] << 16) | ((uint32_t)body[22] << 8) | body[23];
                dur = 0; for (int k = 0; k < 8; ++k) dur = (dur << 8) | body[24 + k];
            } else {
                timescale = ((uint32_t)body[12] << 24) | ((uint32_t)body[13] << 16) | ((uint32_t)body[14] << 8) | body[15];
                dur = ((uint32_t)body[16] << 24) | ((uint32_t)body[17] << 16) | ((uint32_t)body[18] << 8) | body[19];
            }
            if (timescale > 0 && dur > 0 && out.durationMs == 0)
                out.durationMs = (long long)((dur * 1000ULL) / timescale);
            out.hasTag = true;
        } else if (bodyLen > 8) {
            // metadata items live directly under 'ilst'
            if ((uint8_t)type[0] == 0xA9 || std::memcmp(type, "aART", 4) == 0 || std::memcmp(type, "trkn", 4) == 0 ||
                std::memcmp(type, "disk", 4) == 0 || std::memcmp(type, "covr", 4) == 0 ||
                std::memcmp(type, "gnre", 4) == 0 || std::memcmp(type, "titl", 4) == 0 ||
                std::memcmp(type, "albm", 4) == 0 || std::memcmp(type, "day", 4) == 0 ||
                std::memcmp(type, "desc", 4) == 0) {
                mp4ReadIlstItem(body, bodyLen, std::string(type, 4), out);
            }
        }
        i += (size_t)size;
    }
}

} // namespace

// ------------------------------------------------------------------ public
bool tagsFromFilename(const std::string& fileNameNoExt, std::string& artist, std::string& title) {
    std::string s = trim(fileNameNoExt);
    if (s.empty()) return false;
    // strip leading track number: "01 ", "01.", "01-", "01 - ", "(01)"
    size_t i = 0;
    if (s[0] == '(') {
        size_t c = s.find(')');
        if (c != std::string::npos && c <= 5) {
            bool digits = true;
            for (size_t k = 1; k < c; ++k) if (!isdigit((unsigned char)s[k])) digits = false;
            if (digits) i = c + 1;
        }
    } else {
        size_t k = 0;
        while (k < s.size() && k < 3 && s[k] >= '0' && s[k] <= '9') ++k;
        if (k > 0 && k < s.size() && (s[k] == ' ' || s[k] == '.' || s[k] == '-' || s[k] == '_' || s[k] == ')')) i = k;
    }
    while (i < s.size() && (s[i] == ' ' || s[i] == '.' || s[i] == '-' || s[i] == '_')) ++i;
    s = trim(s.substr(i));
    if (s.empty()) s = trim(fileNameNoExt);

    // "Artist - Title"
    size_t sep = s.find(" - ");
    if (sep != std::string::npos && sep > 0 && sep + 3 < s.size()) {
        artist = trim(s.substr(0, sep));
        title = trim(s.substr(sep + 3));
        if (!artist.empty() && !title.empty()) return true;
    }
    title = s;
    return !title.empty();
}

AudioTags parseAudioTags(const std::string& extLower,
                         const uint8_t* head, size_t headLen,
                         unsigned long long fileSize,
                         const uint8_t* tail, size_t tailLen) {
    AudioTags t;
    if (!head || headLen == 0) return t;

    if (extLower == "flac") {
        parseFlac(head, headLen, t);
        if (t.durationMs > 0 && fileSize > 0)
            t.bitrateKbps = (int)(((double)fileSize * 8.0) / (double)t.durationMs);
        return t;
    }
    if (extLower == "m4a" || extLower == "m4b" || extLower == "m4p" || extLower == "aac" || extLower == "mp4" || extLower == "alac") {
        mp4Walk(head, headLen, 0, t);
        if (t.durationMs > 0 && fileSize > 0)
            t.bitrateKbps = (int)((double)fileSize * 8.0 / (double)t.durationMs);
        return t;
    }
    if (extLower == "wav") {
        // RIFF header: size at 4, "fmt " chunk gives channels/rate/bytes-per-sec
        if (headLen >= 44 && head[0]=='R' && head[1]=='I' && head[2]=='F' && head[3]=='F') {
            Reader r(head, headLen);
            r.skip(8);
            if (r.left() >= 4 && std::memcmp(r.cur(), "WAVE", 4) == 0) {
                r.skip(4);
                int guard = 0;
                while (!r.eof(8) && guard++ < 64) {
                    char id[5] = {0}; std::memcpy(id, r.cur(), 4); r.skip(4);
                    uint32_t sz = r.le32();
                    if (std::memcmp(id, "fmt ", 4) == 0 && sz >= 16 && !r.eof(16)) {
                        uint16_t ch = (uint16_t)(r.cur()[2] | (r.cur()[3] << 8));
                        uint32_t sr = (uint32_t)r.cur()[4] | ((uint32_t)r.cur()[5] << 8) | ((uint32_t)r.cur()[6] << 16) | ((uint32_t)r.cur()[7] << 24);
                        uint32_t bps = (uint32_t)r.cur()[8] | ((uint32_t)r.cur()[9] << 8) | ((uint32_t)r.cur()[10] << 16) | ((uint32_t)r.cur()[11] << 24);
                        t.channels = (int)ch; t.sampleRateHz = (int)sr;
                        t.bitrateKbps = (bps > 0) ? (int)(bps / 125) : 0;
                        if (sr > 0 && bps > 0 && fileSize > 44)
                            t.durationMs = (long long)(((fileSize - 44) * 1000ULL) / bps);
                        t.hasTag = true;
                    }
                    r.skip(sz + (sz & 1));
                }
            }
        }
        parseId3v1(tail, tailLen, t);
        return t;
    }

    // ---- MP3 / generic ID3 ----
    size_t tagLen = parseId3v2(head, headLen, t);
    size_t audioStart = tagLen;
    Mp3FrameInfo info;
    // locate the first valid frame (guards against junk between tag and audio)
    size_t search = audioStart;
    size_t limit = headLen;
    if (limit > search + 64 * 1024) limit = search + 64 * 1024;
    for (; search + 4 <= limit; ++search) {
        if (head[search] == 0xFF && (head[search + 1] & 0xE0) == 0xE0) {
            Mp3FrameInfo cand;
            if (parseMp3FrameHeader(head + search, limit - search, cand)) {
                // sanity: accept only if this frame carries Xing/VBRI or the next frame syncs too
                uint32_t frames = 0, bytes = 0;
                bool hasXing = xingFrameCount(head + search, limit - search, cand, frames, bytes);
                size_t next = search + (size_t)cand.frameBytes;
                Mp3FrameInfo nxt;
                bool nextOk = (next + 4 <= headLen) && parseMp3FrameHeader(head + next, headLen - next, nxt);
                if (hasXing || nextOk) {
                    info = cand;
                    audioStart = search;
                    break;
                }
            }
        }
    }
    if (info.valid) {
        t.channels = info.channels;
        t.sampleRateHz = info.sampleRate;
        t.bitrateKbps = info.bitrateKbps;
        t.hasTag = true;
        uint32_t frames = 0, bytes = 0;
        if (xingFrameCount(head + audioStart, headLen - audioStart, info, frames, bytes)) {
            t.durationMs = (long long)(((double)frames * info.samplesPerFrame * 1000.0) / info.sampleRate);
        } else if (fileSize > audioStart && info.bitrateKbps > 0) {
            unsigned long long audioBytes = (unsigned long long)fileSize - audioStart;
            if (tailLen >= 128) audioBytes -= 128; // ID3v1
            t.durationMs = (long long)((audioBytes * 8ULL) / (unsigned long long)(info.bitrateKbps * 1000) * 1000ULL);
        }
    } else if (fileSize > audioStart && t.durationMs == 0) {
        // unknown bitrate - no estimate
        (void)audioStart;
    }
    parseId3v1(tail, tailLen, t);
    return t;
}

} // namespace shoso
