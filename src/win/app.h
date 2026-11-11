// SHOSO Music - application state shared by the UI modules
#pragma once
#include "win_inc.h"
#include "theme.h"
#include "audio.h"
#include "art.h"
#include "scanner.h"
#include "platform.h"
#include "log.h"
#include "../core/library.h"
#include "../core/queue.h"
#include "../core/store.h"

namespace shoso {

enum ViewKind { VIEW_SONGS = 0, VIEW_ALBUMS = 1, VIEW_ARTISTS = 2,
                VIEW_FOLDERS = 3, VIEW_PLAYLISTS = 4, VIEW_QUEUE = 5 };
enum RowKind { ROW_TRACK = 0, ROW_ALBUM, ROW_ARTIST, ROW_FOLDER, ROW_PLAYLIST, ROW_GENRE };

struct Scope {
    int type = 0;            // 0 none, 1 album, 2 artist, 3 folder, 4 playlist, 5 genre
    std::string key;         // album key / artist / folder path / genre
    uint32_t playlistId = 0;
    std::string label;
    bool valid() const { return type != 0; }
};

struct Row {
    int kind = ROW_TRACK;
    uint32_t trackId = 0;
    size_t groupIndex = 0;
    uint32_t playlistId = 0;
};

// control + timer ids
enum {
    IDC_SEARCH = 100, IDC_LIST = 101, IDC_SEEK = 102, IDC_VOLUME = 103,
    IDC_QDROP = 110, IDC_QCLEAR = 111, IDC_PLAYPAUSE = 112,
    IDC_BACK = 113, IDC_SORT = 114,
    IDC_NAV_FIRST = 120,       // .. +5 : queue, songs, folders, albums, artists, playlists
    IDC_NAV_NP = 126, IDC_NAV_MENU = 127,
    IDC_EMPTY = 140
};
enum { TMR_POS = 1, TMR_SLEEP = 2, TMR_SAVE = 3, TMR_SEARCH = 4 };
enum { WM_SHOSO_BATCH = WM_APP + 1, WM_SHOSO_SCANDONE, WM_SHOSO_OPENFILES, WM_SHOSO_TRAY = WM_APP + 20 };
enum { HK_MEDIA_PLAY = 900, HK_MEDIA_NEXT = 901, HK_MEDIA_PREV = 902, HK_MEDIA_STOP = 903 };

extern const char* kViewNamesHe[6];
extern const char* kAppNameHe;
extern const char* kAppNameEn;

struct App {
    // ------- data -------
    Settings settings;
    Library library;
    std::vector<Playlist> playlists;
    uint32_t nextPlaylistId = 1;
    std::vector<Queue> queues;
    int activeQueue = 0;

    std::unique_ptr<WinFileIO> io;
    std::unique_ptr<Store> store;

    // ------- playback -------
    MciPlayer player;
    bool playing = false;
    bool seekDragging = false;
    long long seekDragMs = 0;

    // ------- window -------
    HWND hwnd = nullptr;
    HINSTANCE hinst = nullptr;
    int dpi = 96;
    HWND hwndSearch = nullptr, hwndList = nullptr, hwndSeek = nullptr, hwndVol = nullptr;
    HWND hwndEmpty = nullptr;
    HWND btnQDrop = nullptr, btnQClear = nullptr, btnPlayPause = nullptr;
    HWND btnBack = nullptr, btnSort = nullptr;
    HWND btnNav[6] = {nullptr}, btnNavNp = nullptr, btnNavMenu = nullptr;

    // ------- ui model -------
    int view = VIEW_SONGS;
    Scope scope;
    std::vector<Scope> backStack;
    std::string search;
    std::string pendingSearch;
    std::vector<Row> rows;
    std::vector<AlbumGroup> albums;
    std::vector<ArtistGroup> artists;
    std::vector<FolderGroup> folders;
    std::vector<GenreGroup> genres;
    std::vector<uint32_t> playlistOrder;
    std::vector<std::string> cols;
    std::vector<int> colW;
    bool dirty = false;
    bool scanning = false;
    int scannedTracks = 0;
    int sleepSecondsLeft = 0;
    bool sleepAtEnd = false;
    HBITMAP nowArt = nullptr;
    int nowArtPixels = 0;
    uint32_t nowArtTrack = 0;
    long long lastPosMs = 0;
    std::string playError;        // shown in the status bar when a file cannot be played
    std::string flashMsg;         // short lived status bar message (action feedback)
    unsigned long flashUntil = 0;
    uint32_t endedGuardId = 0;
    unsigned long endedGuardTick = 0;

    RECT rcClient = {0}, rcList = {0}, rcBottom = {0};
    RECT rcQueueBar = {0}, rcRow2 = {0}, rcSearchRow = {0}, rcNav = {0}, rcNP = {0};
    RECT g_searchBox = {0};
    bool showNowPlaying = false;
    bool searchFocused = false;
    // "now playing" screen hit rects (painted by the parent, hit tested manually)
    RECT npBack = {0}, npCover = {0};
    RECT npHeart = {0}, npInfo = {0}, npAddQ = {0}, npSleep = {0}, npRepeat = {0}, npShuffle = {0};
    RECT npPrev = {0}, npPlay = {0}, npNext = {0};
    std::string g_statusRight, g_statusLeft;

    Queue& q() { return queues[activeQueue]; }
    const Queue& q() const { return queues[activeQueue]; }
    const Track* currentTrack() const;
    Playlist* favorites();
    Playlist* playlistById(uint32_t id);
    const Playlist* playlistById(uint32_t id) const;
    bool isFavorite(uint32_t trackId) const;
    void toggleFavorite(uint32_t trackId);
    int queueIndexOfTrack(uint32_t id) const;

    // ------- lifecycle -------
    void loadAll();
    void saveNow();
    void markDirty();

    // ------- ui model -------
    void rebuildRows();
    void refreshList();
    void setView(int v, bool keepSearch = true);
    void drill(const Scope& s);
    void goBack();
    std::string rowText(size_t row, int col) const;
    std::vector<uint32_t> rowTrackIds(const std::vector<size_t>& rowIndexes) const;
    std::vector<size_t> selectedRows() const;
    void setupColumns();

    // ------- actions -------
    void playRowsFrom(size_t rowIndex);
    void addRowsToQueue(const std::vector<size_t>& rowIndexes, bool playNext);
    void playTrackNow(uint32_t id);
    void startQueueAt(int logicalIndex);
    void openCurrentAndPlay();
    void togglePlay();
    void nextTrack(bool forward);
    void seekTo(long long ms);
    void setVolume(int pct);
    void applySleep(int minutes, bool endOfTrack);
    void startScan(bool rescan);
    void onScanBatch(std::vector<Track>* batch);
    void onScanDone(ScanStats* st);
    void openFiles(const std::vector<std::string>& paths);
    void addFolderToLibrary(const std::string& folderUtf8);

    // ------- ui refresh -------
    void relayout();
    void npLayout();
    void setNowPlaying(bool on);
    void updateTitle();
    void updateTransportUi();
    void updateNowArt(bool force);
    void updateStatusText();
    void flash(const std::string& msg, unsigned long ms = 5000);
};

App& app();

HWND createMainWindow(HINSTANCE hinst);

// menu command ids (shared)
enum {
    CMD_BASE = 1000,
    CMD_ADD_FOLDER, CMD_RESCAN, CMD_CLEAR_LIB, CMD_NEW_PLAYLIST,
    CMD_SORT_FIRST,                        // +0..7
    CMD_SLEEP_MENU = CMD_SORT_FIRST + 16,
    CMD_SLEEP_OFF, CMD_SLEEP_15, CMD_SLEEP_30, CMD_SLEEP_45, CMD_SLEEP_60, CMD_SLEEP_90, CMD_SLEEP_END,
    CMD_SETTINGS, CMD_DIAG, CMD_ABOUT, CMD_EXIT,
    CMD_QUEUE_FIRST = CMD_SLEEP_END + 16,  // 16 slots: +0..9 used for the queues
    CMD_ROW_PLAY = CMD_QUEUE_FIRST + 16,
    CMD_ROW_QUEUE, CMD_ROW_NEXTQ, CMD_ROW_FAV, CMD_ROW_LOCATE,
    CMD_ROW_PROPS, CMD_ROW_REMOVE_QUEUE, CMD_ROW_DELETE_PLAYLIST, CMD_ROW_RENAME_PLAYLIST,
    CMD_ROW_OPEN_PLAYLIST, CMD_ROW_PLAY_PLAYLIST,
    CMD_PLAY_ADD_FIRST = CMD_ROW_PLAY_PLAYLIST + 16   // 64 slots, one per playlist
};

// message routing helpers implemented in ui_lists.cpp
LRESULT onNotify(App& a, HWND h, NMHDR* nm);
void drawListRow(App& a, DRAWITEMSTRUCT* di);   // owner drawn Musicolet-style row
void onButton(App& a, int id);
void onMenuCommand(App& a, int id);
void onTrackEnded(App& a);

// menus & dialogs
void showListContextMenu(POINT pt);
void showMainMenu(POINT pt);
void showAddToPlaylistMenu(POINT pt, const std::vector<uint32_t>& ids);
void openSettingsDialog();
void openAboutDialog();
void openPropertiesDialog(uint32_t trackId);
void openNamePlaylistDialog(uint32_t existingId);
void openSleepDialog();
std::string buildDiagnostics();

} // namespace shoso
