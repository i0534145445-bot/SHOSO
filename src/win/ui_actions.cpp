// SHOSO Music - application logic: library model, playback, scanning, persistence
#include "app.h"

#include <unordered_set>

namespace shoso {

const char* kAppNameHe = "SHOSO מיוזיק";
const char* kAppNameEn = "SHOSO Music";
const char* kViewNamesHe[6] = {"שירים", "אלבומים", "אמנים", "תיקיות", "פלייליסטים", "התור"};

static App g_app;
App& app() { return g_app; }

// ------------------------------------------------------------------ helpers
const Track* App::currentTrack() const {
    uint32_t id = q().currentId();
    return id ? library.byId(id) : nullptr;
}

Playlist* App::favorites() {
    for (Playlist& p : playlists) if (p.system) return &p;
    Playlist p;
    p.id = nextPlaylistId++;
    p.name = kFavoritesName;
    p.system = true;
    p.created = nowEpochSec();
    playlists.push_back(p);
    return &playlists.back();
}

Playlist* App::playlistById(uint32_t id) {
    for (Playlist& p : playlists) if (p.id == id) return &p;
    return nullptr;
}

const Playlist* App::playlistById(uint32_t id) const {
    for (const Playlist& p : playlists) if (p.id == id) return &p;
    return nullptr;
}

bool App::isFavorite(uint32_t trackId) const {
    for (const Playlist& p : playlists) if (p.system && p.contains(trackId)) return true;
    return false;
}

void App::toggleFavorite(uint32_t trackId) {
    Playlist* fav = favorites();
    if (fav->contains(trackId)) fav->removeTrack(trackId);
    else fav->addTrack(trackId);
    fav->modified = nowEpochSec();
    markDirty();
    refreshList();
    updateTransportUi();
}

int App::queueIndexOfTrack(uint32_t id) const {
    const std::vector<uint32_t>& t = q().tracks;
    for (size_t i = 0; i < t.size(); ++i) if (t[i] == id) return (int)i;
    return -1;
}

// ------------------------------------------------------------------ store
void App::loadAll() {
    io.reset(new WinFileIO());
    StorePaths paths = makeStorePaths(appDataDirUtf8(), '\\');
    store.reset(new Store(io.get(), paths));
    uint32_t nextTrackId = library.nextId();
    store->load(settings, library.tracks(), nextTrackId, playlists, nextPlaylistId, queues);
    library.setNextId(nextTrackId);
    library.rebuildIndex();
    if (queues.empty()) queues = makeDefaultQueues(3);
    if (activeQueue >= (int)queues.size()) activeQueue = 0;
    (void)favorites();
    setThemeDark(settings.theme == 0);
    view = (settings.view >= 0 && settings.view <= 5) ? settings.view : VIEW_SONGS;
    search = settings.lastSearch;
    SH_LOG("loaded library tracks=" + std::to_string(library.size()) +
           " playlists=" + std::to_string(playlists.size()) +
           " queues=" + std::to_string(queues.size()));
}

void App::saveNow() {
    if (!store) return;
    settings.view = view;
    settings.lastSearch = search;
    settings.activeQueue = activeQueue;
    store->saveSettings(settings);
    store->saveTracks(library.tracks());
    store->savePlaylists(playlists);
    store->saveQueues(queues);
    dirty = false;
    if (hwnd) KillTimer(hwnd, TMR_SAVE);
}

void App::markDirty() {
    dirty = true;
    if (hwnd) SetTimer(hwnd, TMR_SAVE, 2500, nullptr);
}

// ------------------------------------------------------------------ columns
struct ColDef { const char* label; int width; int field; };
enum Field { F_TITLE = 0, F_ARTIST, F_ALBUM, F_DUR, F_YEAR, F_COUNT, F_ALBCOUNT, F_PATH, F_NAME };

static const ColDef* colDefs(int view, int& count) {
    static const ColDef songs[] = {
        {"אורך", 72, F_DUR}, {"אלבום", -3, F_ALBUM}, {"אמן", -3, F_ARTIST}, {"שיר", -4, F_TITLE}};
    static const ColDef albums[] = {
        {"שנה", 60, F_YEAR}, {"שירים", 76, F_COUNT}, {"אורך", 84, F_DUR},
        {"אמן", -3, F_ARTIST}, {"אלבום", -4, F_ALBUM}};
    static const ColDef artists[] = {
        {"אלבומים", 88, F_ALBCOUNT}, {"שירים", 76, F_COUNT}, {"אורך", 84, F_DUR}, {"אמן", -5, F_ARTIST}};
    static const ColDef folders[] = {
        {"שירים", 76, F_COUNT}, {"אורך", 84, F_DUR}, {"תיקייה", -6, F_PATH}};
    static const ColDef playlists[] = {
        {"שירים", 76, F_COUNT}, {"אורך", 84, F_DUR}, {"שם", -6, F_NAME}};
    switch (view) {
        case VIEW_ALBUMS: count = 5; return albums;
        case VIEW_ARTISTS: count = 4; return artists;
        case VIEW_FOLDERS: count = 3; return folders;
        case VIEW_PLAYLISTS: count = 3; return playlists;
        case VIEW_SONGS:
        case VIEW_QUEUE:
        default: count = 4; return songs;
    }
}

void App::setupColumns() {
    int n = 0;
    const ColDef* defs = colDefs(view, n);
    cols.clear();
    colW.clear();
    for (int i = 0; i < n; ++i) {
        cols.push_back(defs[i].label);
        colW.push_back(defs[i].width);
    }
    if (!hwndList) return;
    while (ListView_DeleteColumn(hwndList, 0)) {}
    LVCOLUMNW lc = {0};
    lc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_FMT | LVCF_SUBITEM;
    lc.fmt = LVCFMT_RIGHT;
    for (int i = 0; i < n; ++i) {
        std::wstring w = utf8ToWide(defs[i].label);
        lc.pszText = &w[0];
        lc.cchTextMax = (int)w.size();
        lc.cx = 100;
        lc.iSubItem = i;
        ListView_InsertColumn(hwndList, i, &lc);
    }
}

// ------------------------------------------------------------------ rows
static std::string groupTextFor(const App& a, const Row& r, int field) {
    switch (r.kind) {
        case ROW_ALBUM: {
            const AlbumGroup& g = a.albums[r.groupIndex];
            switch (field) {
                case F_ALBUM: return g.album;
                case F_ARTIST: return g.artist;
                case F_COUNT: return hePlural((int)g.trackIds.size(), "שיר", "שירים");
                case F_DUR: return formatLongDuration(g.totalMs);
                case F_YEAR: return g.year ? std::to_string(g.year) : std::string();
                default: return std::string();
            }
        }
        case ROW_ARTIST: {
            const ArtistGroup& g = a.artists[r.groupIndex];
            switch (field) {
                case F_ARTIST: return g.artist;
                case F_COUNT: return hePlural((int)g.trackIds.size(), "שיר", "שירים");
                case F_ALBCOUNT: return hePlural((int)g.albumCount, "אלבום", "אלבומים");
                case F_DUR: return formatLongDuration(g.totalMs);
                default: return std::string();
            }
        }
        case ROW_FOLDER: {
            const FolderGroup& g = a.folders[r.groupIndex];
            switch (field) {
                case F_PATH: return g.folder;
                case F_NAME: return g.name;
                case F_COUNT: return hePlural((int)g.trackIds.size(), "שיר", "שירים");
                case F_DUR: return formatLongDuration(g.totalMs);
                default: return std::string();
            }
        }
        case ROW_PLAYLIST: {
            const Playlist* p = a.playlistById(r.playlistId);
            if (!p) return std::string();
            long long ms = 0;
            size_t found = 0;
            for (uint32_t id : p->trackIds) {
                const Track* t = a.library.byId(id);
                if (t) { ms += t->durationMs; ++found; }
            }
            switch (field) {
                case F_NAME: return p->name;
                case F_COUNT: return hePlural((int)found, "שיר", "שירים");
                case F_DUR: return formatLongDuration(ms);
                default: return std::string();
            }
        }
        default: return std::string();
    }
}

std::string App::rowText(size_t rowIndex, int col) const {
    if (rowIndex >= rows.size()) return std::string();
    int n = 0;
    const ColDef* defs = colDefs(view, n);
    if (col < 0 || col >= n || col >= (int)cols.size()) return std::string();
    int field = defs[col].field;
    const Row& r = rows[rowIndex];
    if (r.kind == ROW_TRACK) {
        const Track* t = library.byId(r.trackId);
        if (!t) return std::string();
        switch (field) {
            case F_TITLE: return t->displayTitle();
            case F_ARTIST: return t->displayArtist();
            case F_ALBUM: return t->displayAlbum();
            case F_DUR: return t->durationMs > 0 ? formatClock(t->durationMs) : std::string("--:--");
            case F_YEAR: return t->year ? std::to_string(t->year) : std::string();
            case F_PATH: return t->path;
            default: return std::string();
        }
    }
    return groupTextFor(*this, r, field);
}

static bool rowMatchesSearch(const App& a, size_t i, const std::string& folded) {
    if (folded.empty()) return true;
    int n = 0;
    const ColDef* defs = colDefs(a.view, n);
    for (int c = 0; c < n; ++c) {
        if (defs[c].field == F_DUR || defs[c].field == F_COUNT || defs[c].field == F_ALBCOUNT) continue;
        if (containsFold(a.rowText(i, c), folded)) return true;
    }
    return false;
}

static std::vector<Track> tracksInScope(const App& a) {
    std::vector<Track> base;
    const Scope& s = a.scope;
    if (!s.valid()) { base = a.library.tracks(); return base; }
    for (const Track& t : a.library.tracks()) {
        switch (s.type) {
            case 1: if (t.albumKey() == s.key) base.push_back(t); break;
            case 2: if (foldLower(t.displayArtist()) == foldLower(s.key)) base.push_back(t); break;
            case 3: if (iequals(t.folder(), s.key)) base.push_back(t); break;
            case 5: if (foldLower(t.genre.empty() ? std::string("ללא סגנון") : t.genre) == foldLower(s.key)) base.push_back(t); break;
            case 4: {
                const Playlist* p = a.playlistById(s.playlistId);
                if (p && p->contains(t.id)) base.push_back(t);
                break;
            }
            default: break;
        }
    }
    return base;
}

void App::rebuildRows() {
    rows.clear();
    albums.clear(); artists.clear(); folders.clear(); genres.clear();
    std::vector<Track> base = tracksInScope(*this);
    if (view == VIEW_SONGS || view == VIEW_QUEUE) {
        if (view == VIEW_QUEUE) {
            for (uint32_t id : q().tracks) {
                if (!library.byId(id)) continue;
                Row r; r.kind = ROW_TRACK; r.trackId = id;
                rows.push_back(r);
            }
        } else {
            sortTracks(base, sortModeFromInt(settings.songsSort));
            for (const Track& t : base) {
                Row r; r.kind = ROW_TRACK; r.trackId = t.id;
                rows.push_back(r);
            }
        }
    } else if (view == VIEW_ALBUMS) {
        albums = groupByAlbum(base);
        for (size_t i = 0; i < albums.size(); ++i) {
            Row r; r.kind = ROW_ALBUM; r.groupIndex = i;
            rows.push_back(r);
        }
    } else if (view == VIEW_ARTISTS) {
        artists = groupByArtist(base);
        for (size_t i = 0; i < artists.size(); ++i) {
            Row r; r.kind = ROW_ARTIST; r.groupIndex = i;
            rows.push_back(r);
        }
    } else if (view == VIEW_FOLDERS) {
        folders = groupByFolder(base);
        for (size_t i = 0; i < folders.size(); ++i) {
            Row r; r.kind = ROW_FOLDER; r.groupIndex = i;
            rows.push_back(r);
        }
    } else if (view == VIEW_PLAYLISTS) {
        playlistOrder.clear();
        for (const Playlist& p : playlists) playlistOrder.push_back(p.id);
        std::sort(playlistOrder.begin(), playlistOrder.end(), [&](uint32_t a, uint32_t b) {
            const Playlist* pa = playlistById(a);
            const Playlist* pb = playlistById(b);
            if (pa && pa->system) return !(pb && pb->system);
            if (pb && pb->system) return false;
            if (!pa || !pb) return false;
            return foldLower(pa->name) < foldLower(pb->name);
        });
        for (uint32_t id : playlistOrder) {
            Row r; r.kind = ROW_PLAYLIST; r.playlistId = id;
            rows.push_back(r);
        }
    }

    // search filter
    std::string folded = foldLower(trim(search));
    if (!folded.empty()) {
        std::vector<Row> kept;
        kept.reserve(rows.size());
        for (size_t i = 0; i < rows.size(); ++i) {
            if (rowMatchesSearch(*this, i, folded)) kept.push_back(rows[i]);
        }
        rows.swap(kept);
    }
    setupColumns();
    updateStatusText();
}

void App::refreshList() {
    rebuildRows();
    if (!hwndList) return;
    ListView_SetItemCountEx(hwndList, (int)rows.size(), LVSICF_NOSCROLL);
    ShowWindow(hwndEmpty, rows.empty() ? SW_SHOW : SW_HIDE);
    InvalidateRect(hwndList, nullptr, TRUE);
}

void App::setView(int v, bool keepSearch) {
    if (v == view) return;
    view = v;
    if (!keepSearch) search.clear();
    scope = Scope();
    backStack.clear();
    ShowWindow(btnBack, SW_HIDE);
    refreshList();
    relayout();
    markDirty();
}

void App::drill(const Scope& s) {
    backStack.push_back(scope);
    scope = s;
    search.clear();
    if (hwndSearch) SetWindowTextW(hwndSearch, L"");
    refreshList();
    ShowWindow(btnBack, SW_SHOW);
    updateStatusText();
}

void App::goBack() {
    if (backStack.empty()) { scope = Scope(); }
    else { scope = backStack.back(); backStack.pop_back(); }
    ShowWindow(btnBack, backStack.empty() ? SW_HIDE : SW_SHOW);
    refreshList();
    updateStatusText();
}

std::vector<uint32_t> App::rowTrackIds(const std::vector<size_t>& rowIndexes) const {
    std::vector<uint32_t> ids;
    for (size_t ri : rowIndexes) {
        if (ri >= rows.size()) continue;
        const Row& r = rows[ri];
        if (r.kind == ROW_TRACK) { ids.push_back(r.trackId); continue; }
        if (r.kind == ROW_ALBUM) for (uint32_t id : albums[r.groupIndex].trackIds) ids.push_back(id);
        else if (r.kind == ROW_ARTIST) for (uint32_t id : artists[r.groupIndex].trackIds) ids.push_back(id);
        else if (r.kind == ROW_FOLDER) for (uint32_t id : folders[r.groupIndex].trackIds) ids.push_back(id);
        else if (r.kind == ROW_PLAYLIST) {
            const Playlist* p = playlistById(r.playlistId);
            if (p) for (uint32_t id : p->trackIds) ids.push_back(id);
        }
    }
    return ids;
}

std::vector<size_t> App::selectedRows() const {
    std::vector<size_t> out;
    if (!hwndList) return out;
    int i = -1;
    while ((i = ListView_GetNextItem(hwndList, i, LVNI_SELECTED)) != -1) out.push_back((size_t)i);
    return out;
}

// ------------------------------------------------------------------ playback
void App::startQueueAt(int logicalIndex) {
    q().playTrackAt((size_t)logicalIndex);
    q().positionMs = 0;
    openCurrentAndPlay();
}

void App::playRowsFrom(size_t rowIndex) {
    std::vector<size_t> all;
    all.reserve(rows.size());
    for (size_t i = 0; i < rows.size(); ++i) all.push_back(i);
    std::vector<uint32_t> ids = rowTrackIds(all);
    if (ids.empty()) return;
    // the clicked row's first track decides the start position
    std::vector<uint32_t> clicked = rowTrackIds({rowIndex});
    q().clear();
    q().append(ids);
    int start = 0;
    if (!clicked.empty()) {
        for (size_t i = 0; i < ids.size(); ++i) if (ids[i] == clicked[0]) { start = (int)i; break; }
    }
    if (q().shuffle) q().setShuffle(false, 1);
    q().playTrackAt((size_t)start);
    openCurrentAndPlay();
    markDirty();
}

void App::addRowsToQueue(const std::vector<size_t>& rowIndexes, bool playNext) {
    std::vector<uint32_t> ids = rowTrackIds(rowIndexes);
    if (ids.empty()) return;
    if (playNext) q().insertAfterCurrent(ids);
    else q().append(ids);
    markDirty();
    if (view == VIEW_QUEUE) refreshList();
    updateStatusText();
}

void App::playTrackNow(uint32_t id) {
    int idx = queueIndexOfTrack(id);
    if (idx < 0) {
        q().append({id});
        idx = queueIndexOfTrack(id);
    }
    startQueueAt(idx);
}

void App::openCurrentAndPlay() {
    const Track* t = currentTrack();
    if (!t) {
        player.stopAndClose();
        playing = false;
        updateTransportUi();
        return;
    }
    if (!player.open(W(t->path), hwnd)) {
        SH_ERR("cannot open " + t->path + " : " + player.lastError());
        playError = "לא ניתן לנגן את " + fileNameOf(t->path) +
                    " - הפורמט אינו נתמך על ידי נגן המדיה של Windows";
        playing = false;
        lastPosMs = 0;
        updateTransportUi();
        updateStatusText();
        return;
    }
    playError.clear();
    player.setVolume(settings.mute ? 0 : settings.volume);
    player.play(q().positionMs);
    playing = true;
    lastPosMs = q().positionMs;
    updateTransportUi();
    updateNowArt(true);
    updateTitle();
    refreshList();
}

void App::togglePlay() {
    const Track* t = currentTrack();
    if (!t || !player.isOpen()) {
        if (q().currentIndex() < 0 && !q().tracks.empty()) q().playTrackAt(0);
        else if (q().tracks.empty()) {
            if (!rows.empty()) { playRowsFrom(0); return; }
            return;
        }
        openCurrentAndPlay();
        return;
    }
    if (playing) {
        q().positionMs = player.positionMs();
        player.pause();
        playing = false;
    } else {
        player.play(q().positionMs);
        playing = true;
    }
    updateTransportUi();
    markDirty();
}

void App::nextTrack(bool forward) {
    if (q().tracks.empty()) return;
    if (!forward && player.positionMs() > 3000) {   // "previous" restarts first
        seekTo(0);
        return;
    }
    bool ok = q().advance(forward);
    if (!ok) {
        player.stopAndClose();
        playing = false;
        q().positionMs = 0;
        updateTransportUi();
        markDirty();
        return;
    }
    openCurrentAndPlay();
    markDirty();
}

void App::seekTo(long long ms) {
    if (ms < 0) ms = 0;
    q().positionMs = ms;
    if (player.isOpen()) {
        player.play(ms);
        if (!playing) player.pause();   // reposition while staying paused
    }
    lastPosMs = ms;
    updateTransportUi();
    markDirty();
}

void App::setVolume(int pct) {
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    settings.volume = pct;
    settings.mute = false;
    if (!player.setVolume(pct)) {
        // device without per-stream volume: fall back to the system wave volume
        DWORD v = (DWORD)(pct * 655);
        waveOutSetVolume(0, (v << 16) | v);
    }
    markDirty();
    InvalidateRect(hwnd, &rcBottom, FALSE);
}

void App::applySleep(int minutes, bool endOfTrack) {
    sleepAtEnd = endOfTrack;
    sleepSecondsLeft = minutes * 60;
    if (hwnd) {
        if (minutes > 0 || endOfTrack) SetTimer(hwnd, TMR_SLEEP, 1000, nullptr);
        else KillTimer(hwnd, TMR_SLEEP);
    }
    updateStatusText();
}

// ------------------------------------------------------------------ scanning
static std::map<std::string, size_t> g_scanIndex;
static std::vector<char> g_scanSeen;
static std::vector<std::string> g_scanRoots;

void App::startScan(bool rescan) {
    if (scanning) return;
    if (settings.musicFolders.empty() && !rescan) return;
    scanning = true;
    scannedTracks = 0;
    g_scanIndex.clear();
    g_scanSeen.assign(library.size(), 0);
    g_scanRoots = settings.musicFolders;
    for (size_t i = 0; i < library.size(); ++i) g_scanIndex[foldLower(library.tracks()[i].path)] = i;
    SH_LOG("scan start roots=" + std::to_string(g_scanRoots.size()));
    scannerStart(g_scanRoots, hwnd, WM_SHOSO_BATCH, WM_SHOSO_SCANDONE);
    updateStatusText();
}

void App::onScanBatch(std::vector<Track>* batch) {
    if (!batch) return;
    for (Track& t : *batch) {
        std::string key = foldLower(t.path);
        auto it = g_scanIndex.find(key);
        if (it != g_scanIndex.end() && it->second < library.size()) {
            Track& ex = library.tracks()[it->second];
            g_scanSeen[it->second] = 1;
            if (ex.mtime != t.mtime || ex.fileSize != t.fileSize) {
                uint32_t id = ex.id;
                t.id = id;
                ex = t;
                artDropTrack(id);
            }
        } else {
            uint32_t id = library.addTrack(t);
            g_scanIndex[key] = library.size() - 1;
            g_scanSeen.push_back(1);
            (void)id;
        }
        ++scannedTracks;
    }
    delete batch;
    updateStatusText();
    if (view == VIEW_FOLDERS || view == VIEW_ALBUMS || view == VIEW_ARTISTS) refreshList();
}

void App::onScanDone(ScanStats* st) {
    scanning = false;
    bool cancelled = false;
    if (st) {
        cancelled = st->cancelled;
        SH_LOG("scan done: files=" + std::to_string(st->filesSeen) +
               " tracks=" + std::to_string(st->tracksFound) +
               " errors=" + std::to_string(st->errors) +
               " secs=" + std::to_string((int)st->seconds) +
               (st->cancelled ? " (cancelled)" : ""));
        delete st;
    }
    // drop tracks inside scanned roots that were not seen (deleted/moved files)
    // (never prune after a cancelled scan - unseen simply means "not scanned yet")
    if (!cancelled && !g_scanRoots.empty()) {
        std::vector<Track>& tracks = library.tracks();
        std::vector<uint32_t> removed;
        for (size_t i = 0; i < tracks.size() && i < g_scanSeen.size(); ++i) {
            if (g_scanSeen[i]) continue;
            bool underRoot = false;
            std::string folder = foldLower(tracks[i].folder());
            for (const std::string& r : g_scanRoots) {
                std::string rf = foldLower(r);
                while (!rf.empty() && (rf.back() == '\\' || rf.back() == '/')) rf.pop_back();
                if (folder.rfind(rf, 0) == 0) { underRoot = true; break; }
            }
            if (underRoot) removed.push_back(tracks[i].id);
        }
        if (!removed.empty()) {
            std::unordered_set<uint32_t> drop(removed.begin(), removed.end());
            std::vector<Track> kept;
            kept.reserve(tracks.size());
            for (size_t i = 0; i < tracks.size(); ++i) {
                if (drop.find(tracks[i].id) == drop.end()) kept.push_back(tracks[i]);
            }
            tracks = kept;
            library.rebuildIndex();
            for (Playlist& p : playlists) {
                for (uint32_t id : removed) p.removeTrack(id);
            }
            for (Queue& qu : queues) {
                for (uint32_t id : removed) {
                    int idx = -1;
                    for (size_t i = 0; i < qu.tracks.size(); ++i) if (qu.tracks[i] == id) { idx = (int)i; break; }
                    if (idx >= 0) qu.removeAt((size_t)idx);
                }
            }
        }
    }
    g_scanIndex.clear();
    g_scanSeen.clear();
    library.rebuildIndex();
    refreshList();
    markDirty();
    updateStatusText();
}

void App::addFolderToLibrary(const std::string& folderUtf8) {
    if (folderUtf8.empty()) return;
    std::string norm = normalizePath(folderUtf8);
    while (!norm.empty() && (norm.back() == '\\' || norm.back() == '/')) norm.pop_back();
    for (const std::string& f : settings.musicFolders) {
        if (iequals(normalizePath(f), norm)) return;
    }
    settings.musicFolders.push_back(norm);
    markDirty();
    startScan(false);
}

void App::openFiles(const std::vector<std::string>& paths) {
    std::vector<uint32_t> toQueue;
    for (const std::string& p : paths) {
        DWORD attr = GetFileAttributesW(W(p).c_str());
        if (attr == INVALID_FILE_ATTRIBUTES) continue;
        if (attr & FILE_ATTRIBUTE_DIRECTORY) { addFolderToLibrary(p); continue; }
        if (!isAudioExt(extLowerOf(p))) continue;
        if (!library.hasPath(p)) {
            Track t;
            t.path = p;
            unsigned long long size = 0, mt = 0;
            fileStatUtf8(p, size, mt);
            std::vector<uint8_t> head, tail;
            if (readHeadTail(p, head, 512 * 1024, tail, 512)) {
                AudioTags tags = parseAudioTags(extLowerOf(p), head.data(), head.size(), size, tail.data(), tail.size());
                t.title = tags.title; t.artist = tags.artist; t.album = tags.album;
                t.albumArtist = tags.albumArtist; t.genre = tags.genre; t.year = tags.year;
                t.trackNo = tags.trackNo; t.discNo = tags.discNo;
                t.durationMs = tags.durationMs; t.bitrate = tags.bitrateKbps;
                t.sampleRate = tags.sampleRateHz; t.hasArt = tags.cover.valid();
            }
            t.fileSize = size; t.mtime = mt;
            if (t.title.empty()) {
                std::string fa, ft;
                tagsFromFilename(stripExt(fileNameOf(p)), fa, ft);
                t.title = ft; t.artist = fa;
            }
            library.addTrack(t);
            markDirty();
        }
        const Track* existing = nullptr;
        for (const Track& tr : library.tracks()) if (iequals(tr.path, p)) { existing = &tr; break; }
        if (existing) toQueue.push_back(existing->id);
    }
    if (!toQueue.empty()) {
        bool wasEmpty = q().tracks.empty();
        q().append(toQueue);
        markDirty();
        if (!playing || wasEmpty) startQueueAt(queueIndexOfTrack(toQueue[0]));
        if (view == VIEW_QUEUE) refreshList();
    }
}

} // namespace shoso
