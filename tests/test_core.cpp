// SHOSO Music - core unit tests (run on any platform, no Windows needed)
//   build:  g++ -std=c++17 -Wall -Wextra tests/test_core.cpp src/core/*.cpp -o build/test_core
//   run:    ./build/test_core
#include "../src/core/library.h"
#include "../src/core/queue.h"
#include "../src/core/store.h"
#include "../src/core/str.h"
#include "../src/core/tags.h"

#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

using namespace shoso;

static int g_checks = 0;
static int g_fail = 0;

#define CHECK(cond) do { ++g_checks; if (!(cond)) { ++g_fail; \
    std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); } } while (0)

#define CHECK_STR(actual, expected) do { ++g_checks; \
    std::string _a = (actual); std::string _e = (expected); \
    if (_a != _e) { ++g_fail; std::printf("  FAIL %s:%d  got [%s] want [%s]\n", __FILE__, __LINE__, _a.c_str(), _e.c_str()); } } while (0)

#define CHECK_INT(actual, expected) do { ++g_checks; long long _a = (long long)(actual); long long _e = (long long)(expected); \
    if (_a != _e) { ++g_fail; std::printf("  FAIL %s:%d  got %lld want %lld\n", __FILE__, __LINE__, _a, _e); } } while (0)

#define SECTION(name) std::printf("[%s]\n", name)

// --------------------------------------------------------------- helpers
static std::vector<uint8_t> bytes(const std::string& s) { return std::vector<uint8_t>(s.begin(), s.end()); }

static void appendBytes(std::vector<uint8_t>& v, const std::string& s) { v.insert(v.end(), s.begin(), s.end()); }

static void putBe32(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back((uint8_t)(x >> 24)); v.push_back((uint8_t)(x >> 16));
    v.push_back((uint8_t)(x >> 8));  v.push_back((uint8_t)x);
}
static void putBe32Synch(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back((uint8_t)((x >> 21) & 0x7F)); v.push_back((uint8_t)((x >> 14) & 0x7F));
    v.push_back((uint8_t)((x >> 7) & 0x7F));  v.push_back((uint8_t)(x & 0x7F));
}
static void putLe32(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back((uint8_t)x); v.push_back((uint8_t)(x >> 8));
    v.push_back((uint8_t)(x >> 16)); v.push_back((uint8_t)(x >> 24));
}

static void addTextFrame(std::vector<uint8_t>& out, const char* id, uint8_t enc, const std::vector<uint8_t>& payload) {
    std::vector<uint8_t> idb = bytes(id);
    out.insert(out.end(), idb.begin(), idb.end());
    putBe32(out, (uint32_t)payload.size() + 1);
    out.push_back(0); out.push_back(0);
    out.push_back(enc);
    out.insert(out.end(), payload.begin(), payload.end());
}

static std::vector<uint8_t> utf16leWithBom(const std::string& utf8) {
    std::u16string u = utf8ToUtf16(utf8);
    std::vector<uint8_t> v;
    v.push_back(0xFF); v.push_back(0xFE);
    for (char16_t c : u) { v.push_back((uint8_t)(c & 0xFF)); v.push_back((uint8_t)(c >> 8)); }
    return v;
}

static void addApicFrame(std::vector<uint8_t>& out, const std::vector<uint8_t>& img, uint8_t picType = 3) {
    std::vector<uint8_t> payload;
    std::vector<uint8_t> mime = bytes("image/jpeg");
    payload.insert(payload.end(), mime.begin(), mime.end());
    payload.push_back(0);          // mime terminator
    payload.push_back(picType);
    payload.push_back(0);          // empty description (latin1, null terminated)
    payload.insert(payload.end(), img.begin(), img.end());

    std::vector<uint8_t> idb = bytes("APIC");
    out.insert(out.end(), idb.begin(), idb.end());
    putBe32(out, (uint32_t)payload.size() + 1);
    out.push_back(0); out.push_back(0);
    out.push_back(0);              // encoding latin1
    out.insert(out.end(), payload.begin(), payload.end());
}

// Fake but structurally valid mp3: ID3v2.3 + first frame carrying a Xing header
static std::vector<uint8_t> makeFakeMp3(const std::vector<uint8_t>& id3Body, uint32_t xingFrames,
                                        int bitrateIdx = 9, size_t frameBytes = 417) {
    std::vector<uint8_t> f;
    appendBytes(f, "ID3");
    f.push_back(3); f.push_back(0); f.push_back(0);
    putBe32Synch(f, (uint32_t)id3Body.size());
    f.insert(f.end(), id3Body.begin(), id3Body.end());

    size_t audioStart = f.size();
    f.push_back(0xFF); f.push_back(0xFB); f.push_back((uint8_t)(bitrateIdx << 4)); f.push_back(0x00);
    size_t xingOff = audioStart + 4 + 32;      // side information size, MPEG1 stereo
    while (f.size() < xingOff) f.push_back(0);
    std::vector<uint8_t> xing = bytes("Xing");
    f.insert(f.end(), xing.begin(), xing.end());
    putBe32(f, 0x00000001);                    // only the "frames" field is present
    putBe32(f, xingFrames);
    while (f.size() < audioStart + frameBytes) f.push_back(0);
    return f;
}

// ------------------------------------------------------------------- tests
static void testStrings() {
    SECTION("strings");
    std::string he = "שלום עולם - נגן המוזיקה";
    std::u16string u16 = utf8ToUtf16(he);
    CHECK_STR(utf16ToUtf8(u16.data(), u16.size()), he);
    std::wstring w = utf8ToWide(he);
    CHECK_STR(wideToUtf8(w), he);

    std::string em = "🎵 שיר";
    std::u16string e16 = utf8ToUtf16(em);
    CHECK_INT(e16.size(), 6);                  // surrogate pair + space + 3 letters
    CHECK_STR(utf16ToUtf8(e16.data(), e16.size()), em);
    CHECK_STR(wideToUtf8(utf8ToWide(em)), em);

    CHECK_STR(trim("  abc \t"), "abc");
    CHECK_STR(foldLower("AbCé"), "abcé");
    CHECK(iequals("Eyal", "eyal"));
    CHECK(containsFold("Eyal Golan", "golan"));
    CHECK(!containsFold("Eyal Golan", "zion"));
    CHECK(containsFold("anything", ""));
    CHECK(startsWithFold("Shalom", "shal"));

    CHECK_STR(formatClock(0), "0:00");
    CHECK_STR(formatClock(65 * 1000), "1:05");
    CHECK_STR(formatClock(3723 * 1000), "1:02:03");
    CHECK_STR(hePlural(1, "שיר", "שירים"), "1 שיר");
    CHECK_STR(hePlural(7, "שיר", "שירים"), "7 שירים");
    CHECK_STR(formatLongDuration(710000), "12 דק'");
    CHECK_STR(formatLongDuration(3600000 * 2 + 60000 * 5), "2 שע' ו-5 דק'");
    CHECK_STR(formatSize(1536), "1.5 KB");

    CHECK_STR(escapeField("a\tb\\c\nd"), "a\\tb\\\\c\\nd");
    CHECK_STR(unescapeField("a\\tb\\\\c\\nd"), "a\tb\\c\nd");
    CHECK_STR(unescapeField(escapeField("שלום\tעולם")), "שלום\tעולם");

    int num = 0, total = 0;
    CHECK(parseTrackField("3/12", num, total));
    CHECK_INT(num, 3); CHECK_INT(total, 12);
    CHECK(parseTrackField("7", num, total));
    CHECK_INT(num, 7); CHECK_INT(total, 0);
    CHECK(!parseTrackField("", num, total));
    CHECK_INT(parseIntSafe("abc", -5), -5);
    CHECK_INT(parseIntSafe("42", 0), 42);
}

static void testPaths() {
    SECTION("paths");
    CHECK_STR(fileNameOf("C:\\Music\\Eyal\\song.mp3"), "song.mp3");
    CHECK_STR(parentDirOf("C:\\Music\\Eyal\\song.mp3"), "C:\\Music\\Eyal");
    CHECK_STR(parentDirOf("C:\\song.mp3"), "C:\\");
    CHECK_STR(extLowerOf("C:\\a\\b.MP3"), "mp3");
    CHECK_STR(extLowerOf("C:\\a\\noext"), "");
    CHECK_STR(stripExt("song.mp3"), "song");
    CHECK_STR(pathJoin("C:\\Music", "a.mp3"), "C:\\Music\\a.mp3");
    CHECK_STR(pathJoin("C:\\Music\\", "a.mp3"), "C:\\Music\\a.mp3");
    CHECK_STR(normalizePath("C:\\Music\\\\Eyal"), "C:\\Music\\Eyal");
    CHECK(isAudioExt("flac"));
    CHECK(isAudioExt("m4a"));
    CHECK(!isAudioExt("jpg"));
}

static void testFilenameTags() {
    SECTION("filename tags");
    std::string a, t;
    CHECK(tagsFromFilename("01. Eyal Golan - Shiri", a, t));
    CHECK_STR(a, "Eyal Golan"); CHECK_STR(t, "Shiri");
    CHECK(tagsFromFilename("03 - Kol Haolam", a, t));
    CHECK_STR(t, "Kol Haolam");
    CHECK(tagsFromFilename("Shir Yashan", a, t));
    CHECK_STR(t, "Shir Yashan");
    CHECK(tagsFromFilename("12 - Artist - Title", a, t));
    CHECK_STR(a, "Artist"); CHECK_STR(t, "Title");
    CHECK(tagsFromFilename("(04) Song Name", a, t));
    CHECK_STR(t, "Song Name");
}

static void testId3() {
    SECTION("ID3v2.3 + Xing + ID3v1");
    std::vector<uint8_t> body;
    addTextFrame(body, "TIT2", 1, utf16leWithBom("שיר ראשון"));
    addTextFrame(body, "TPE1", 3, bytes("Eyal Golan"));
    addTextFrame(body, "TALB", 0, bytes("Haalbum"));
    addTextFrame(body, "TYER", 0, bytes("2004"));
    addTextFrame(body, "TRCK", 0, bytes("3/12"));
    addTextFrame(body, "TPOS", 0, bytes("1/2"));
    addTextFrame(body, "TCON", 0, bytes("(13)"));
    addTextFrame(body, "TPE2", 0, bytes("Album Artist"));
    std::vector<uint8_t> img(64, 0xAB);
    addApicFrame(body, img, 3);

    std::vector<uint8_t> mp3 = makeFakeMp3(body, 7000);
    std::vector<uint8_t> tail(128, 0);
    std::memcpy(tail.data(), "TAG", 3);
    std::memcpy(tail.data() + 63, "Id3v1 Album", 11);

    AudioTags tags = parseAudioTags("mp3", mp3.data(), mp3.size(), mp3.size() + 128, tail.data(), tail.size());
    CHECK(tags.hasTag);
    CHECK_STR(tags.title, "שיר ראשון");
    CHECK_STR(tags.artist, "Eyal Golan");
    CHECK_STR(tags.album, "Haalbum");
    CHECK_STR(tags.albumArtist, "Album Artist");
    CHECK_INT(tags.year, 2004);
    CHECK_INT(tags.trackNo, 3);
    CHECK_INT(tags.trackTotal, 12);
    CHECK_INT(tags.discNo, 1);
    CHECK_INT(tags.discTotal, 2);
    CHECK_STR(tags.genre, "Pop");            // ID3 genre id 13
    CHECK_INT(tags.bitrateKbps, 128);
    CHECK_INT(tags.sampleRateHz, 44100);
    CHECK_INT(tags.channels, 2);
    CHECK_INT(tags.durationMs, (long long)(7000.0 * 1152 / 44100 * 1000));
    CHECK_INT(tags.cover.bytes.size(), 64);
    CHECK_STR(tags.cover.mime, "image/jpeg");

    SECTION("ID3v1 only, CBR duration estimate");
    std::vector<uint8_t> plain(4000, 0);
    for (size_t i = 0; i + 417 <= plain.size(); i += 417) {
        plain[i] = 0xFF; plain[i+1] = 0xFB; plain[i+2] = 0x90; plain[i+3] = 0x00;
    }
    std::vector<uint8_t> v1(128, 0);
    std::memcpy(v1.data(), "TAG", 3);
    std::memcpy(v1.data() + 3, "Old Title", 9);
    std::memcpy(v1.data() + 33, "Old Artist", 10);
    std::memcpy(v1.data() + 63, "Old Album", 9);
    std::memcpy(v1.data() + 93, "1999", 4);
    v1[125] = 0; v1[126] = 5; v1[127] = 17;   // track 5, genre Rock
    AudioTags t2 = parseAudioTags("mp3", plain.data(), plain.size(), 4000000, v1.data(), v1.size());
    CHECK_STR(t2.title, "Old Title");
    CHECK_STR(t2.artist, "Old Artist");
    CHECK_STR(t2.album, "Old Album");
    CHECK_INT(t2.year, 1999);
    CHECK_INT(t2.trackNo, 5);
    CHECK_STR(t2.genre, "Rock");
    CHECK(t2.durationMs > 240000 && t2.durationMs < 260000);   // 4MB @128kbps ~ 250s

    SECTION("ID3v2.4 synchsafe sizes + UTF-8");
    std::vector<uint8_t> b4;
    std::vector<uint8_t> idb = bytes("TIT2");
    b4.insert(b4.end(), idb.begin(), idb.end());
    std::vector<uint8_t> payload = bytes("UTF8 Title");
    putBe32Synch(b4, (uint32_t)payload.size() + 1);
    b4.push_back(0); b4.push_back(0); b4.push_back(3);
    b4.insert(b4.end(), payload.begin(), payload.end());
    std::vector<uint8_t> f4;
    appendBytes(f4, "ID3");
    f4.push_back(4); f4.push_back(0); f4.push_back(0);
    putBe32Synch(f4, (uint32_t)b4.size());
    f4.insert(f4.end(), b4.begin(), b4.end());
    AudioTags t4 = parseAudioTags("mp3", f4.data(), f4.size(), f4.size(), nullptr, 0);
    CHECK_STR(t4.title, "UTF8 Title");

    SECTION("ID3v2.2 three letter ids");
    std::vector<uint8_t> b2;
    std::vector<uint8_t> id2 = bytes("TT2");
    b2.insert(b2.end(), id2.begin(), id2.end());
    b2.push_back(0); b2.push_back(0); b2.push_back(7);   // 24 bit size = 6 text bytes + encoding
    b2.push_back(0);                                      // encoding latin1
    appendBytes(b2, "OldTag");
    std::vector<uint8_t> f2;
    appendBytes(f2, "ID3");
    f2.push_back(2); f2.push_back(0); f2.push_back(0);
    putBe32Synch(f2, (uint32_t)b2.size());
    f2.insert(f2.end(), b2.begin(), b2.end());
    AudioTags t5 = parseAudioTags("mp3", f2.data(), f2.size(), f2.size(), nullptr, 0);
    CHECK_STR(t5.title, "OldTag");
}

static void testFlac() {
    SECTION("FLAC");
    std::vector<uint8_t> f;
    appendBytes(f, "fLaC");
    // STREAMINFO block (34 bytes)
    f.push_back(0x00);
    f.push_back(0x00); f.push_back(0x00); f.push_back(0x22);
    std::vector<uint8_t> si(34, 0);
    uint32_t sr = 44100;
    uint64_t totalSamples = 441000;          // exactly 10 seconds
    si[10] = (uint8_t)(sr >> 12);
    si[11] = (uint8_t)((sr >> 4) & 0xFF);
    si[12] = (uint8_t)(((sr & 0xF) << 4) | ((2 - 1) << 1) | ((16 - 1) >> 4));
    si[13] = (uint8_t)((((16 - 1) & 0xF) << 4) | ((totalSamples >> 32) & 0xF));
    si[14] = (uint8_t)(totalSamples >> 24);
    si[15] = (uint8_t)(totalSamples >> 16);
    si[16] = (uint8_t)(totalSamples >> 8);
    si[17] = (uint8_t)(totalSamples);
    f.insert(f.end(), si.begin(), si.end());
    // VORBIS_COMMENT block (last)
    std::vector<uint8_t> vc;
    auto addStr = [&](const std::string& s) {
        putLe32(vc, (uint32_t)s.size());
        vc.insert(vc.end(), s.begin(), s.end());
    };
    addStr("reference libFLAC 1.3.3");
    putLe32(vc, 3);
    addStr("TITLE=שיר פלאק");
    addStr("ARTIST=Flac Artist");
    addStr("TRACKNUMBER=2");
    f.push_back(0x84);
    f.push_back((uint8_t)(vc.size() >> 16)); f.push_back((uint8_t)(vc.size() >> 8)); f.push_back((uint8_t)vc.size());
    f.insert(f.end(), vc.begin(), vc.end());

    AudioTags t = parseAudioTags("flac", f.data(), f.size(), 5000000, nullptr, 0);
    CHECK_STR(t.title, "שיר פלאק");
    CHECK_STR(t.artist, "Flac Artist");
    CHECK_INT(t.trackNo, 2);
    CHECK_INT(t.sampleRateHz, 44100);
    CHECK_INT(t.channels, 2);
    CHECK_INT(t.durationMs, 10000);
    CHECK(t.bitrateKbps > 0);
}

static void testMp4() {
    SECTION("MP4/M4A");
    auto box = [](const std::string& type, const std::vector<uint8_t>& payload) {
        std::vector<uint8_t> out;
        putBe32(out, (uint32_t)(payload.size() + 8));
        std::vector<uint8_t> t = bytes(type);
        out.insert(out.end(), t.begin(), t.end());
        out.insert(out.end(), payload.begin(), payload.end());
        return out;
    };
    auto dataBox = [&](const std::string& text) {
        std::vector<uint8_t> p;
        p.push_back(0); p.push_back(0); p.push_back(0); p.push_back(1);   // flags: utf8 text
        p.push_back(0); p.push_back(0); p.push_back(0); p.push_back(0);   // reserved
        p.insert(p.end(), text.begin(), text.end());
        return box("data", p);
    };
    auto item = [&](const std::string& name, const std::string& value) { return box(name, dataBox(value)); };

    std::vector<uint8_t> ilst;
    auto nam = item("\xA9" "nam", "M4A Title");   ilst.insert(ilst.end(), nam.begin(), nam.end());
    auto art = item("\xA9" "ART", "M4A Artist");  ilst.insert(ilst.end(), art.begin(), art.end());
    auto alb = item("\xA9" "alb", "M4A Album");   ilst.insert(ilst.end(), alb.begin(), alb.end());
    auto day = item("\xA9" "day", "2011-05-04");  ilst.insert(ilst.end(), day.begin(), day.end());
    auto aar = item("aART", "M4A Album Artist");   ilst.insert(ilst.end(), aar.begin(), aar.end());

    std::vector<uint8_t> meta;
    meta.push_back(0); meta.push_back(0); meta.push_back(0); meta.push_back(0);  // full box version/flags
    auto hdlr = box("hdlr", std::vector<uint8_t>(20, 0));
    meta.insert(meta.end(), hdlr.begin(), hdlr.end());
    auto ilstBox = box("ilst", ilst);
    meta.insert(meta.end(), ilstBox.begin(), ilstBox.end());

    std::vector<uint8_t> mvhdP;
    mvhdP.push_back(0); mvhdP.push_back(0); mvhdP.push_back(0); mvhdP.push_back(0);   // version + flags
    for (int i = 0; i < 8; ++i) mvhdP.push_back(0);                                   // created/modified
    putBe32(mvhdP, 1000);                                                             // timescale
    putBe32(mvhdP, 214);                                                              // duration -> 214ms... make it bigger
    mvhdP.resize(mvhdP.size() - 4);
    putBe32(mvhdP, 214000);                                                           // 214 seconds
    for (int i = 0; i < 80; ++i) mvhdP.push_back(0);
    auto mvhd = box("mvhd", mvhdP);

    std::vector<uint8_t> udta;
    auto metaBox = box("meta", meta);
    udta.insert(udta.end(), metaBox.begin(), metaBox.end());
    auto udtaBox = box("udta", udta);

    std::vector<uint8_t> moovP;
    moovP.insert(moovP.end(), mvhd.begin(), mvhd.end());
    moovP.insert(moovP.end(), udtaBox.begin(), udtaBox.end());
    auto moov = box("moov", moovP);

    std::vector<uint8_t> f = box("ftyp", bytes("M4A isom"));
    f.insert(f.end(), moov.begin(), moov.end());

    AudioTags t = parseAudioTags("m4a", f.data(), f.size(), 5000000, nullptr, 0);
    CHECK_STR(t.title, "M4A Title");
    CHECK_STR(t.artist, "M4A Artist");
    CHECK_STR(t.album, "M4A Album");
    CHECK_STR(t.albumArtist, "M4A Album Artist");
    CHECK_INT(t.year, 2011);
    CHECK_INT(t.durationMs, 214000);
    CHECK(t.bitrateKbps > 0);
}

static Track mkTrack(uint32_t id, const std::string& path, const std::string& title,
                     const std::string& artist, const std::string& album, int year, long long dur, int trackNo) {
    Track t;
    t.id = id; t.path = path; t.title = title; t.artist = artist; t.album = album;
    t.year = year; t.durationMs = dur; t.trackNo = trackNo;
    return t;
}

static void testLibrary() {
    SECTION("library grouping / search / sort");
    std::vector<Track> tracks;
    tracks.push_back(mkTrack(1, "C:\\Music\\A\\01.mp3", "Shir Alef", "Eyal Golan", "Album One", 2001, 200000, 1));
    tracks.push_back(mkTrack(2, "C:\\Music\\A\\02.mp3", "Shir Bet",  "Eyal Golan", "Album One", 2001, 210000, 2));
    tracks.push_back(mkTrack(3, "C:\\Music\\B\\01.mp3", "Song C",    "Zohar Argov","Album Two", 1980, 180000, 1));
    tracks.push_back(mkTrack(4, "C:\\Music\\B\\noext",  "",          "",           "",          0,    120000, 0));

    CHECK_INT(groupByAlbum(tracks).size(), 3);
    CHECK_INT(groupByArtist(tracks).size(), 3);
    auto folders = groupByFolder(tracks);
    CHECK_INT(folders.size(), 2);
    CHECK_INT(folders[0].trackIds.size(), 2);
    CHECK_INT(groupByGenre(tracks).size(), 1);   // everything under "ללא סגנון"

    long long total = 0;
    for (const Track& t : tracks) total += t.durationMs;
    CHECK_INT(total, 710000);
    CHECK_STR(formatLongDuration(total), "12 דק'");

    CHECK_STR(tracks[3].displayTitle(), "noext");
    CHECK_STR(tracks[3].displayArtist(), "אמן לא ידוע");
    CHECK_STR(tracks[3].displayAlbum(), "אלבום לא ידוע");

    CHECK_INT(searchTracks(tracks, "eyal").size(), 2);
    CHECK_INT(searchTracks(tracks, "shir album one").size(), 2);
    CHECK_INT(searchTracks(tracks, "zzz").size(), 0);
    CHECK_INT(searchTracks(tracks, "").size(), 4);
    CHECK_INT(searchTracks(tracks, "   ").size(), 4);

    std::vector<Track> copy = tracks;
    sortTracks(copy, SortMode::Title);
    CHECK_STR(copy[0].displayTitle(), "noext");
    CHECK_STR(copy[1].displayTitle(), "Shir Alef");
    sortTracks(copy, SortMode::Year);
    CHECK_INT(copy[0].year, 2001);
    sortTracks(copy, SortMode::Duration);
    CHECK_INT(copy[0].id, 2);
    sortTracks(copy, SortMode::ArtistAlbumTrack);
    CHECK_STR(copy[0].displayArtist(), "Eyal Golan");
    CHECK_INT(copy[0].trackNo, 1);
    CHECK_STR(copy[1].displayTitle(), "Shir Bet");
    sortTracks(copy, SortMode::Path);
    CHECK_STR(copy[0].path, "C:\\Music\\A\\01.mp3");
    CHECK_STR(sortModeNameHe(SortMode::Title), "שם השיר");
    CHECK(sortModeFromInt(3) == SortMode::Artist);
    CHECK(sortModeFromInt(99) == SortMode::ArtistAlbumTrack);

    Library lib;
    for (const Track& t : tracks) lib.addTrack(t);
    CHECK_INT(lib.size(), 4);
    CHECK(lib.byId(2) != nullptr);
    CHECK(lib.byId(999) == nullptr);
    CHECK(lib.hasPath("c:\\music\\a\\01.mp3"));
    CHECK(!lib.hasPath("c:\\nope.mp3"));
    CHECK_INT(lib.totalDurationMs(), 710000);
    CHECK_INT(lib.indexOfId(3), 2);
    lib.rebuildIndex();
    CHECK(lib.hasPath("C:\\Music\\A\\01.mp3"));
}

static bool queueHas(const Queue& q, uint32_t id) {
    return std::find(q.tracks.begin(), q.tracks.end(), id) != q.tracks.end();
}

static void testQueue() {
    SECTION("queue");
    Queue q;
    q.name = "תור 1";
    q.append({1, 2, 3, 4, 5});
    CHECK_INT(q.size(), 5);
    CHECK_INT(q.currentIndex(), -1);
    q.playTrackAt(2);
    CHECK_INT(q.currentId(), 3);
    CHECK(q.advance(true));
    CHECK_INT(q.currentId(), 4);
    CHECK(q.advance(false));
    CHECK_INT(q.currentId(), 3);

    q.repeat = RepeatMode::Off;
    q.playTrackAt(4);
    CHECK(!q.advance(true));              // end of queue with repeat off
    q.repeat = RepeatMode::All;
    CHECK(q.advance(true));               // wraps around
    CHECK_INT(q.currentId(), 1);
    q.playTrackAt(0);
    CHECK(q.advance(false));              // wraps backwards
    CHECK_INT(q.currentId(), 5);

    q.setShuffle(true, 12345);
    CHECK_INT(q.currentId(), 5);          // shuffle keeps the playing track
    std::vector<int> seen;
    seen.push_back((int)q.currentId());
    for (int i = 0; i < 4; ++i) { q.advance(true); seen.push_back((int)q.currentId()); }
    std::sort(seen.begin(), seen.end());
    CHECK(seen == std::vector<int>({1, 2, 3, 4, 5}));
    CHECK_INT(q.order.size(), 5);

    q.setShuffle(false, 1);
    CHECK_INT(q.size(), 5);
    CHECK(q.currentIndex() >= 0);

    q.playTrackAt(0);
    q.insertAfterCurrent({9});
    CHECK_INT(q.size(), 6);
    CHECK(queueHas(q, 9));
    CHECK_INT(q.currentId(), 1);
    CHECK_INT(q.tracks[1], 9);            // inserted right after the current track
    CHECK(q.advance(true));
    CHECK_INT(q.currentId(), 9);

    q.removeAt(0);
    CHECK_INT(q.size(), 5);
    CHECK(!queueHas(q, 1));

    q.clear();
    CHECK_INT(q.size(), 0);
    CHECK(q.empty());
    CHECK(!q.advance(true));

    // shuffle order stays a valid permutation after edits
    Queue s;
    s.name = "תור 2";
    s.append({10, 11, 12, 13});
    s.setShuffle(true, 7);
    s.playTrackAt(1);
    s.append({14});
    CHECK_INT(s.order.size(), 5);
    std::vector<int> perm = s.order;
    std::sort(perm.begin(), perm.end());
    CHECK(perm == std::vector<int>({0, 1, 2, 3, 4}));
    CHECK_INT(s.currentId(), 11);
}

static void testPlaylist() {
    SECTION("playlist");
    Playlist p;
    p.id = 1; p.name = "Road trip";
    p.addTrack(5); p.addTrack(6); p.addTrack(5);      // duplicate ignored
    CHECK_INT(p.trackIds.size(), 2);
    CHECK(p.contains(6));
    p.insertTracks(1, {7, 8, 7});
    CHECK_INT(p.trackIds.size(), 4);
    CHECK_INT(p.trackIds[1], 7);
    CHECK(p.removeTrack(7));
    CHECK_INT(p.trackIds.size(), 3);
    CHECK(!p.removeTrack(777));
    p.insertTracks(999, {20});                        // clamped to the end
    CHECK_INT(p.trackIds.back(), 20);
    CHECK_STR(std::string(kFavoritesName), "מועדפים");
    CHECK_STR(repeatNameHe(RepeatMode::One), "חזרה על שיר אחד");
}

// ------------------------------------------------------------ stdio FileIO
struct StdioFileIO : FileIO {
    bool readText(const std::string& path, std::string& out) override {
        std::FILE* f = std::fopen(path.c_str(), "rb");
        if (!f) return false;
        out.clear();
        char buf[8192];
        size_t n;
        while ((n = std::fread(buf, 1, sizeof(buf), f)) > 0) out.append(buf, n);
        std::fclose(f);
        return true;
    }
    bool writeTextAtomic(const std::string& path, const std::string& data) override {
        std::FILE* f = std::fopen(path.c_str(), "wb");
        if (!f) return false;
        bool ok = std::fwrite(data.data(), 1, data.size(), f) == data.size();
        std::fclose(f);
        return ok;
    }
    bool fileExists(const std::string& path) override {
        std::FILE* f = std::fopen(path.c_str(), "rb");
        if (!f) return false;
        std::fclose(f);
        return true;
    }
};

static void testStore() {
    SECTION("store round trip");
    Settings s;
    s.musicFolders = {"C:\\Music", "D:\\שירים"};
    s.volume = 65; s.activeQueue = 2; s.songsSort = 3; s.theme = 1;
    s.windowW = 1234; s.maximized = true; s.lastDir = "C:\\Music\\A"; s.sleepMinutes = 30;
    s.lastSearch = "אייל";
    Settings s2;
    CHECK(s2.parse(s.serialize()));
    CHECK_INT(s2.volume, 65);
    CHECK_INT(s2.activeQueue, 2);
    CHECK_INT(s2.songsSort, 3);
    CHECK_INT(s2.theme, 1);
    CHECK_INT(s2.windowW, 1234);
    CHECK(s2.maximized);
    CHECK_INT(s2.musicFolders.size(), 2);
    CHECK_STR(s2.musicFolders[1], "D:\\שירים");
    CHECK_INT(s2.sleepMinutes, 30);
    CHECK_STR(s2.lastSearch, "אייל");
    CHECK_STR(Settings().serialize().substr(0, 1), "#");

    std::vector<Track> tracks;
    Track t; t.id = 7; t.path = "C:\\Music\\tab\tsong.mp3"; t.title = "Title\twith tab";
    t.artist = "אמן"; t.album = "אלבום\nשורה שנייה"; t.year = 2020; t.durationMs = 240000;
    t.bitrate = 320; t.sampleRate = 44100; t.fileSize = 9000000; t.mtime = 133000000; t.hasArt = true;
    tracks.push_back(t);
    Track t2; t2.id = 8; t2.path = "C:\\Music\\b.mp3"; t2.title = "Second"; tracks.push_back(t2);
    std::vector<Track> back; uint32_t nextId = 1;
    CHECK(parseTracks(serializeTracks(tracks), back, nextId));
    CHECK_INT(back.size(), 2);
    CHECK_STR(back[0].path, tracks[0].path);
    CHECK_STR(back[0].title, tracks[0].title);
    CHECK_STR(back[0].album, tracks[0].album);
    CHECK_INT(back[0].durationMs, 240000);
    CHECK_INT(back[0].mtime, 133000000);
    CHECK(back[0].hasArt);
    CHECK_INT(nextId, 9);

    std::vector<Playlist> pls(1);
    pls[0].id = 3; pls[0].name = "עבודה"; pls[0].trackIds = {7, 8};
    std::vector<Playlist> pback; uint32_t pnext = 1;
    CHECK(parsePlaylists(serializePlaylists(pls), pback, pnext));
    CHECK_INT(pback.size(), 1);
    CHECK_STR(pback[0].name, "עבודה");
    CHECK_INT(pback[0].trackIds.size(), 2);
    CHECK_INT(pback[0].trackIds[1], 8);
    CHECK_INT(pnext, 4);

    std::vector<Queue> qs = makeDefaultQueues(3);
    qs[1].append({7, 8});
    qs[1].setShuffle(true, 99);
    qs[1].orderPos = 1;
    qs[1].positionMs = 4321;
    qs[1].repeat = RepeatMode::One;
    qs[1].wasPlaying = true;
    std::vector<Queue> qback;
    CHECK(parseQueues(serializeQueues(qs), qback));
    CHECK_INT(qback.size(), 3);
    CHECK_INT(qback[1].size(), 2);
    CHECK_INT(qback[1].orderPos, 1);
    CHECK_INT(qback[1].positionMs, 4321);
    CHECK(qback[1].shuffle);
    CHECK(qback[1].repeat == RepeatMode::One);
    CHECK(qback[1].wasPlaying);
    CHECK_INT(qback[1].order.size(), 2);
    CHECK_STR(qback[2].name, "תור 3");
    CHECK_INT(makeDefaultQueues(20).size(), 10);
    CHECK_INT(makeDefaultQueues(0).size(), 1);

    StorePaths paths = makeStorePaths("C:\\Users\\me\\AppData\\Roaming\\SHOSO", '\\');
    CHECK_STR(paths.settings, "C:\\Users\\me\\AppData\\Roaming\\SHOSO\\settings.dat");
    CHECK_STR(paths.log, "C:\\Users\\me\\AppData\\Roaming\\SHOSO\\log.txt");
    CHECK_STR(makeStorePaths("/tmp/", '/').library, "/tmp/library.dat");

    // end to end through the FileIO abstraction
    StdioFileIO io;
    StorePaths tp = makeStorePaths("/tmp/shoso_store_test", '/');
    std::system("mkdir -p /tmp/shoso_store_test");
    Store store(&io, tp);
    store.saveSettings(s);
    store.saveTracks(tracks);
    store.savePlaylists(pls);
    store.saveQueues(qs);
    Settings s3; std::vector<Track> t3; uint32_t n3 = 1;
    std::vector<Playlist> p3; uint32_t pn3 = 1; std::vector<Queue> q3;
    store.load(s3, t3, n3, p3, pn3, q3);
    CHECK_INT(s3.volume, 65);
    CHECK_INT(t3.size(), 2);
    CHECK_INT(p3.size(), 1);
    CHECK_INT(q3.size(), 3);
    CHECK_INT(q3[1].positionMs, 4321);
}

int main() {
    std::printf("SHOSO core tests\n");
    testStrings();
    testPaths();
    testFilenameTags();
    testId3();
    testFlac();
    testMp4();
    testLibrary();
    testQueue();
    testPlaylist();
    testStore();
    std::printf("\n%d checks, %d failures\n", g_checks, g_fail);
    return g_fail == 0 ? 0 : 1;
}
