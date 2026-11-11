// SHOSO Music - list view plumbing, buttons, menus, playback events
#include "app.h"

namespace shoso {

// ---------------------------------------------------------------- activation
static void activateRow(App& a, size_t i) {
    if (i >= a.rows.size()) return;
    const Row& r = a.rows[i];
    switch (r.kind) {
        case ROW_TRACK: {
            if (a.view == VIEW_QUEUE) {
                int idx = a.queueIndexOfTrack(r.trackId);
                if (idx >= 0) a.startQueueAt(idx);
            } else {
                a.playRowsFrom(i);
            }
            break;
        }
        case ROW_ALBUM: {
            const AlbumGroup& g = a.albums[r.groupIndex];
            Scope s; s.type = 1; s.key = g.key; s.label = g.album + " - " + g.artist;
            a.drill(s);
            break;
        }
        case ROW_ARTIST: {
            const ArtistGroup& g = a.artists[r.groupIndex];
            Scope s; s.type = 2; s.key = g.artist; s.label = g.artist;
            a.drill(s);
            break;
        }
        case ROW_FOLDER: {
            const FolderGroup& g = a.folders[r.groupIndex];
            Scope s; s.type = 3; s.key = g.folder; s.label = g.name;
            a.drill(s);
            break;
        }
        case ROW_PLAYLIST: {
            const Playlist* p = a.playlistById(r.playlistId);
            if (!p) return;
            Scope s; s.type = 4; s.playlistId = p->id; s.label = p->name;
            a.drill(s);
            break;
        }
        default: break;
    }
}

// ------------------------------------------------------------------- notify
LRESULT onNotify(App& a, HWND h, NMHDR* nm) {
    // -------- trackbar dark custom draw --------
    if (nm->code == NM_CUSTOMDRAW && (nm->hwndFrom == a.hwndSeek || nm->hwndFrom == a.hwndVol)) {
        LPNMCUSTOMDRAW cd = (LPNMCUSTOMDRAW)nm;
        const Theme& th = theme();
        bool isSeek = (nm->hwndFrom == a.hwndSeek);
        if (cd->dwDrawStage == CDDS_PREPAINT) return CDRF_NOTIFYITEMDRAW;
        if (cd->dwDrawStage == CDDS_ITEMPREPAINT) {
            if (cd->dwItemSpec == TBCD_CHANNEL) {
                RECT rc = cd->rc;
                int hh = rc.bottom - rc.top;
                fillSolid(cd->hdc, rc, th.barBg);
                RECT ch = rc;
                ch.top += hh / 3; ch.bottom -= hh / 3;
                roundRectFill(cd->hdc, ch, (ch.bottom - ch.top) / 2, th.trackBg);
                long long frac1000 = 0;
                if (isSeek) {
                    const Track* t = a.currentTrack();
                    long long dur = a.player.isOpen() ? a.player.lengthMs() : (t ? t->durationMs : 0);
                    long long pos = a.seekDragging ? a.seekDragMs : a.lastPosMs;
                    if (dur > 0) frac1000 = pos * 1000 / dur;
                } else {
                    frac1000 = (long long)a.settings.volume * 10;
                }
                if (frac1000 > 8) {
                    int wdt = (int)(((ch.right - ch.left) * frac1000) / 1000);
                    RECT pr = ch;
                    pr.left = ch.right - wdt;
                    roundRectFill(cd->hdc, pr, (ch.bottom - ch.top) / 2, th.trackFill);
                }
                return CDRF_SKIPDEFAULT;
            }
            if (cd->dwItemSpec == TBCD_THUMB) {
                RECT rc = cd->rc;
                int cx = (rc.left + rc.right) / 2;
                int tw = scale(5, a.dpi);
                RECT t2 = {cx - tw, rc.top, cx + tw, rc.bottom};
                roundRectFill(cd->hdc, t2, tw, a.settings.mute ? th.textFaint : th.text);
                return CDRF_SKIPDEFAULT;
            }
            return CDRF_SKIPDEFAULT;
        }
        return CDRF_DODEFAULT;
    }

    if (nm->hwndFrom != a.hwndList) return 0;
    switch (nm->code) {
        case LVN_GETDISPINFOW: {
            NMLVDISPINFOW* di = (NMLVDISPINFOW*)nm;
            if (di->item.mask & LVIF_TEXT && di->item.pszText && di->item.cchTextMax > 0) {
                static wchar_t buf[768];
                std::string t = di->item.iItem < 0 ? std::string()
                                    : a.rowText((size_t)di->item.iItem, di->item.iSubItem);
                std::wstring w = W(t);
                int cap = di->item.cchTextMax - 1;
                if (cap > 767) cap = 767;
                if (cap < 0) cap = 0;
                if ((int)w.size() > cap) w.resize((size_t)cap);
                memcpy(buf, w.c_str(), (w.size() + 1) * sizeof(wchar_t));
                di->item.pszText = buf;
            }
            return 0;
        }
        case LVN_ODFINDITEMW: {
            NMLVFINDITEMW* fi = (NMLVFINDITEMW*)nm;
            if (!(fi->lvfi.flags & LVFI_STRING) || !fi->lvfi.psz) return -1;
            std::string needle = foldLower(U(fi->lvfi.psz));
            size_t n = a.rows.size();
            if (n == 0) return -1;
            for (size_t k = 0; k < n; ++k) {
                size_t i = ((size_t)fi->iStart + k) % n;
                int main = (int)a.cols.size() - 1;
                if (containsFold(a.rowText(i, main), needle)) return (LRESULT)i;
            }
            return -1;
        }
        case NM_DBLCLK:
        case NM_RETURN: {
            NMITEMACTIVATE* ia = (NMITEMACTIVATE*)nm;
            if (ia->iItem >= 0) activateRow(a, (size_t)ia->iItem);
            return 0;
        }
        case NM_RCLICK: {
            POINT pt;
            GetCursorPos(&pt);
            showListContextMenu(pt);
            return 0;
        }
        case NM_CLICK:
            return 0;
        case NM_CUSTOMDRAW: {
            LPNMLVCUSTOMDRAW cd = (LPNMLVCUSTOMDRAW)nm;
            const Theme& th = theme();
            switch (cd->nmcd.dwDrawStage) {
                case CDDS_PREPAINT:
                    return CDRF_NOTIFYITEMDRAW;
                case CDDS_ITEMPREPAINT: {
                    size_t row = (size_t)cd->nmcd.dwItemSpec;
                    bool sel = (ListView_GetItemState(a.hwndList, (int)row, LVIS_SELECTED) & LVIS_SELECTED) != 0;
                    bool cur = false;
                    if (row < a.rows.size() && a.rows[row].kind == ROW_TRACK &&
                        a.rows[row].trackId == a.q().currentId()) cur = true;
                    cd->clrTextBk = sel ? th.selectedBg : ((row % 2) ? th.listAlt : th.listBg);
                    cd->clrText = sel ? th.text : (cur ? th.playing : th.text);
                    return CDRF_NOTIFYSUBITEMDRAW | CDRF_NEWFONT;
                }
                case CDDS_ITEMPREPAINT | CDDS_SUBITEM: {
                    size_t row = (size_t)cd->nmcd.dwItemSpec;
                    bool sel = (ListView_GetItemState(a.hwndList, (int)row, LVIS_SELECTED) & LVIS_SELECTED) != 0;
                    bool cur = false;
                    if (row < a.rows.size() && a.rows[row].kind == ROW_TRACK &&
                        a.rows[row].trackId == a.q().currentId()) cur = true;
                    cd->clrTextBk = sel ? th.selectedBg : ((row % 2) ? th.listAlt : th.listBg);
                    int sub = cd->iSubItem;
                    int main = (int)a.cols.size() - 1;
                    if (sub == main && cur && !sel) cd->clrText = th.playing;
                    else if (sub == main) cd->clrText = sel ? th.text : th.text;
                    else cd->clrText = sel ? th.text : th.textDim;
                    return CDRF_NEWFONT;
                }
            }
            return CDRF_DODEFAULT;
        }
    }
    return 0;
}

// ------------------------------------------------------------------ buttons
static void popupAtButton(App& a, HWND btn, HMENU menu) {
    RECT r;
    GetWindowRect(btn, &r);
    TrackPopupMenu(menu, TPM_TOPALIGN | TPM_RIGHTALIGN | TPM_LAYOUTRTL, r.left, r.bottom, 0, a.hwnd, nullptr);
    DestroyMenu(menu);
}

static HMENU buildSortMenu(App& a) {
    HMENU m = CreatePopupMenu();
    int cur = a.settings.songsSort;
    for (int i = 0; i <= 7; ++i) {
        AppendMenuW(m, MF_STRING | (i == cur ? MF_CHECKED : 0), CMD_SORT_FIRST + i,
                    W(sortModeNameHe(sortModeFromInt(i))).c_str());
    }
    return m;
}

static HMENU buildSleepMenu(App& a) {
    HMENU m = CreatePopupMenu();
    AppendMenuW(m, MF_STRING | (a.sleepSecondsLeft == 0 && !a.sleepAtEnd ? MF_CHECKED : 0), CMD_SLEEP_OFF, L"כבוי");
    AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
    struct Opt { int cmd; const wchar_t* label; int min; };
    static const Opt opts[] = {
        {CMD_SLEEP_15, L"בעוד 15 דקות", 15}, {CMD_SLEEP_30, L"בעוד 30 דקות", 30},
        {CMD_SLEEP_45, L"בעוד 45 דקות", 45}, {CMD_SLEEP_60, L"בעוד שעה", 60},
        {CMD_SLEEP_90, L"בעוד שעה וחצי", 90}};
    for (const Opt& o : opts) {
        bool on = a.sleepSecondsLeft > 0 && (a.sleepSecondsLeft + 59) / 60 == o.min;
        AppendMenuW(m, MF_STRING | (on ? MF_CHECKED : 0), o.cmd, o.label);
    }
    AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(m, MF_STRING | (a.sleepAtEnd ? MF_CHECKED : 0), CMD_SLEEP_END, L"בסוף השיר הנוכחי");
    return m;
}

static HMENU buildQueueMenu(App& a) {
    HMENU m = CreatePopupMenu();
    for (size_t i = 0; i < a.queues.size(); ++i) {
        std::wstring label = W(a.queues[i].name);
        label += L"  (" + std::to_wstring(a.queues[i].size()) + L")";
        AppendMenuW(m, MF_STRING | ((int)i == a.activeQueue ? MF_CHECKED : 0),
                    (UINT_PTR)(CMD_QUEUE_FIRST + i), label.c_str());
    }
    return m;
}

void onButton(App& a, int id) {
    if (id >= IDC_TAB0 && id < IDC_TAB0 + 6) { a.setView(id - IDC_TAB0); return; }
    switch (id) {
        case IDC_MENU: {
            HMENU m = CreatePopupMenu();
            AppendMenuW(m, MF_STRING, CMD_ADD_FOLDER, L"הוספת תיקייה לספרייה...");
            AppendMenuW(m, MF_STRING, CMD_RESCAN, L"סריקה מחדש");
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(m, MF_STRING, CMD_NEW_PLAYLIST, L"פלייליסט חדש...");
            AppendMenuW(m, MF_POPUP, (UINT_PTR)buildSortMenu(a), L"מיון שירים");
            AppendMenuW(m, MF_POPUP, (UINT_PTR)buildSleepMenu(a), L"טיימר שינה");
            AppendMenuW(m, MF_POPUP, (UINT_PTR)buildQueueMenu(a), L"תורי נגינה");
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(m, MF_STRING, CMD_SETTINGS, L"הגדרות...");
            AppendMenuW(m, MF_STRING, CMD_DIAG, L"יצירת דוח אבחון...");
            AppendMenuW(m, MF_STRING, CMD_ABOUT, L"אודות SHOSO מיוזיק");
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(m, MF_STRING, CMD_EXIT, L"יציאה");
            popupAtButton(a, a.btnMenu, m);
            return;
        }
        case IDC_QUEUE: {
            HMENU m = buildQueueMenu(a);
            popupAtButton(a, a.btnQueue, m);
            return;
        }
        case IDC_SORT: {
            HMENU m = buildSortMenu(a);
            popupAtButton(a, a.btnSort, m);
            return;
        }
        case IDC_BACK: a.goBack(); return;
        case IDC_PREV: a.nextTrack(false); SetFocus(a.hwndList); return;
        case IDC_NEXT: a.nextTrack(true); SetFocus(a.hwndList); return;
        case IDC_PLAY: a.togglePlay(); SetFocus(a.hwndList); return;
        case IDC_SHUFFLE: {
            a.q().setShuffle(!a.q().shuffle, (uint32_t)GetTickCount());
            a.markDirty();
            InvalidateRect(a.btnShuffle, nullptr, TRUE);
            if (a.view == VIEW_QUEUE) a.refreshList();
            return;
        }
        case IDC_REPEAT: {
            RepeatMode r = a.q().repeat;
            r = (r == RepeatMode::Off) ? RepeatMode::All : (r == RepeatMode::All ? RepeatMode::One : RepeatMode::Off);
            a.q().repeat = r;
            a.markDirty();
            InvalidateRect(a.btnRepeat, nullptr, TRUE);
            return;
        }
        case IDC_FAV: {
            const Track* t = a.currentTrack();
            if (t) a.toggleFavorite(t->id);
            return;
        }
        case IDC_SLEEP: openSleepDialog(); return;
        case IDC_ADDFOLDER:
        case IDC_EMPTY: {
            std::string dir = pickFolderDialog(a.hwnd, "בחרו תיקיית מוזיקה");
            if (!dir.empty()) a.addFolderToLibrary(dir);
            return;
        }
    }
}

// ------------------------------------------------------------------- menus
void showAddToPlaylistMenu(POINT pt, const std::vector<uint32_t>& ids) {
    App& a = app();
    (void)pt; (void)ids;
    (void)a;
}

static void addToPlaylistByIndex(App& a, size_t playlistIndex, const std::vector<uint32_t>& ids) {
    if (playlistIndex >= a.playlistOrder.size()) return;
    Playlist* p = a.playlistById(a.playlistOrder[playlistIndex]);
    if (!p) return;
    size_t before = p->trackIds.size();
    for (uint32_t id : ids) p->addTrack(id);
    p->modified = nowEpochSec();
    a.markDirty();
    std::string msg = "נוספו " + std::to_string(p->trackIds.size() - before) + " שירים לפלייליסט \"" + p->name + "\"";
    a.flash(msg);
}

void showListContextMenu(POINT pt) {
    App& a = app();
    std::vector<size_t> sel = a.selectedRows();
    if (sel.empty()) {
        POINT cp = pt;
        ScreenToClient(a.hwndList, &cp);
        LVHITTESTINFO ht{};
        ht.pt = cp;
        if (ListView_SubItemHitTest(a.hwndList, &ht) != -1 && ht.iItem >= 0) {
            ListView_SetItemState(a.hwndList, ht.iItem, LVIS_SELECTED | LVIS_FOCUSED,
                                  LVIS_SELECTED | LVIS_FOCUSED);
            sel.push_back((size_t)ht.iItem);
        }
    }
    HMENU m = CreatePopupMenu();
    if (sel.empty()) {
        AppendMenuW(m, MF_STRING, CMD_ADD_FOLDER, L"הוספת תיקייה לספרייה...");
        AppendMenuW(m, MF_STRING, CMD_RESCAN, L"סריקה מחדש");
        AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
        AppendMenuW(m, MF_STRING, CMD_NEW_PLAYLIST, L"פלייליסט חדש...");
        AppendMenuW(m, MF_STRING, CMD_SETTINGS, L"הגדרות...");
    } else {
        const Row& r = a.rows[sel[0]];
        bool isPlaylistRow = (r.kind == ROW_PLAYLIST);
        const Playlist* pl = isPlaylistRow ? a.playlistById(r.playlistId) : nullptr;
        if (isPlaylistRow && pl) {
            AppendMenuW(m, MF_STRING | MF_DEFAULT, CMD_ROW_OPEN_PLAYLIST, L"פתיחה");
            AppendMenuW(m, MF_STRING, CMD_ROW_PLAY_PLAYLIST, L"נגינת הפלייליסט");
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            if (!pl->system) {
                AppendMenuW(m, MF_STRING, CMD_ROW_RENAME_PLAYLIST, L"שינוי שם...");
                AppendMenuW(m, MF_STRING, CMD_ROW_DELETE_PLAYLIST, L"מחיקת פלייליסט");
                AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            }
            AppendMenuW(m, MF_STRING, CMD_NEW_PLAYLIST, L"פלייליסט חדש...");
        } else {
            AppendMenuW(m, MF_STRING | MF_DEFAULT, CMD_ROW_PLAY, L"נגינה עכשיו");
            AppendMenuW(m, MF_STRING, CMD_ROW_QUEUE, L"הוספה לסוף התור");
            AppendMenuW(m, MF_STRING, CMD_ROW_NEXTQ, L"נגן כשיר הבא");
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            HMENU sub = CreatePopupMenu();
            for (size_t i = 0; i < a.playlistOrder.size(); ++i) {
                const Playlist* p = a.playlistById(a.playlistOrder[i]);
                if (!p) continue;
                AppendMenuW(sub, MF_STRING, CMD_PLAY_ADD_FIRST + (UINT_PTR)i, W(p->name).c_str());
            }
            AppendMenuW(sub, MF_SEPARATOR, 0, nullptr);
            AppendMenuW(sub, MF_STRING, CMD_NEW_PLAYLIST, L"פלייליסט חדש...");
            AppendMenuW(m, MF_POPUP, (UINT_PTR)sub, L"הוספה לפלייליסט");
            if (r.kind == ROW_TRACK) {
                bool fav = a.isFavorite(r.trackId);
                AppendMenuW(m, MF_STRING, CMD_ROW_FAV, fav ? L"הסרה מהמועדפים" : L"הוספה למועדפים");
            }
            if (a.view == VIEW_QUEUE) {
                AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
                AppendMenuW(m, MF_STRING, CMD_ROW_REMOVE_QUEUE, L"הסרה מהתור");
            }
            AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
            if (r.kind == ROW_TRACK) AppendMenuW(m, MF_STRING, CMD_ROW_LOCATE, L"פתיחת מיקום הקובץ");
            if (r.kind == ROW_FOLDER) AppendMenuW(m, MF_STRING, CMD_ROW_LOCATE, L"פתיחת התיקייה");
            AppendMenuW(m, MF_STRING, CMD_ROW_PROPS, L"מאפיינים");
        }
    }
    TrackPopupMenu(m, TPM_RIGHTBUTTON | TPM_LAYOUTRTL | TPM_RIGHTALIGN, pt.x, pt.y, 0, a.hwnd, nullptr);
    DestroyMenu(m);
}

void onMenuCommand(App& a, int id) {
    if (id >= CMD_SORT_FIRST && id < CMD_SORT_FIRST + 8) {
        a.settings.songsSort = id - CMD_SORT_FIRST;
        a.markDirty();
        a.refreshList();
        return;
    }
    if (id >= CMD_QUEUE_FIRST && id < CMD_QUEUE_FIRST + 16) {
        int qi = id - CMD_QUEUE_FIRST;
        if (qi >= 0 && qi < (int)a.queues.size() && qi != a.activeQueue) {
            // persist current position before switching
            if (a.playing && a.player.isOpen()) a.q().positionMs = a.player.positionMs();
            a.q().wasPlaying = a.playing;
            a.activeQueue = qi;
            a.player.stopAndClose();
            a.playing = false;
            if (a.q().wasPlaying && !a.q().tracks.empty()) {
                if (a.q().currentIndex() < 0) a.q().playTrackAt(0);
                a.openCurrentAndPlay();
            }
            a.markDirty();
            a.updateTransportUi();
            a.updateNowArt(true);
            if (a.view == VIEW_QUEUE) a.refreshList();
            a.updateStatusText();
        }
        return;
    }
    if (id >= CMD_PLAY_ADD_FIRST && id < CMD_PLAY_ADD_FIRST + 64) {
        std::vector<uint32_t> ids = a.rowTrackIds(a.selectedRows());
        addToPlaylistByIndex(a, (size_t)(id - CMD_PLAY_ADD_FIRST), ids);
        return;
    }
    switch (id) {
        case CMD_ADD_FOLDER: {
            std::string dir = pickFolderDialog(a.hwnd, "בחרו תיקיית מוזיקה");
            if (!dir.empty()) a.addFolderToLibrary(dir);
            return;
        }
        case CMD_RESCAN: a.startScan(true); return;
        case CMD_CLEAR_LIB:
            if (msgBoxYesNo(a.hwnd, "לנקות את הספרייה? הקבצים עצמם לא יימחקו.", kAppNameHe) == IDYES) {
                a.library.clear();
                a.refreshList();
                a.markDirty();
            }
            return;
        case CMD_NEW_PLAYLIST: openNamePlaylistDialog(0); return;
        case CMD_SLEEP_OFF: a.applySleep(0, false); return;
        case CMD_SLEEP_15: a.applySleep(15, false); return;
        case CMD_SLEEP_30: a.applySleep(30, false); return;
        case CMD_SLEEP_45: a.applySleep(45, false); return;
        case CMD_SLEEP_60: a.applySleep(60, false); return;
        case CMD_SLEEP_90: a.applySleep(90, false); return;
        case CMD_SLEEP_END: a.applySleep(0, true); return;
        case CMD_SETTINGS: openSettingsDialog(); return;
        case CMD_DIAG: {
            std::string path = appDataDirUtf8() + "\\diagnostics.txt";
            if (a.io && a.io->writeTextAtomic(path, buildDiagnostics())) shellOpenDefault(path);
            return;
        }
        case CMD_ABOUT: openAboutDialog(); return;
        case CMD_EXIT: a.saveNow(); DestroyWindow(a.hwnd); return;
        case CMD_ROW_PLAY: {
            std::vector<size_t> sel = a.selectedRows();
            if (!sel.empty()) activateRow(a, sel[0]);
            return;
        }
        case CMD_ROW_QUEUE:
            a.addRowsToQueue(a.selectedRows(), false);
            return;
        case CMD_ROW_NEXTQ:
            a.addRowsToQueue(a.selectedRows(), true);
            return;
        case CMD_ROW_FAV: {
            std::vector<uint32_t> ids = a.rowTrackIds(a.selectedRows());
            for (uint32_t t : ids) {
                if (!a.isFavorite(t)) a.toggleFavorite(t);
            }
            return;
        }
        case CMD_ROW_LOCATE: {
            std::vector<size_t> sel = a.selectedRows();
            if (sel.empty()) return;
            const Row& r = a.rows[sel[0]];
            if (r.kind == ROW_TRACK) {
                const Track* t = a.library.byId(r.trackId);
                if (t) openInExplorerSelect(t->path);
            } else if (r.kind == ROW_FOLDER) {
                shellOpenDefault(a.folders[r.groupIndex].folder);
            }
            return;
        }
        case CMD_ROW_PROPS: {
            std::vector<size_t> sel = a.selectedRows();
            if (sel.empty()) return;
            const Row& r = a.rows[sel[0]];
            if (r.kind == ROW_TRACK) openPropertiesDialog(r.trackId);
            return;
        }
        case CMD_ROW_REMOVE_QUEUE: {
            std::vector<size_t> sel = a.selectedRows();
            std::vector<uint32_t> ids = a.rowTrackIds(sel);
            for (uint32_t tid : ids) {
                int idx = a.queueIndexOfTrack(tid);
                if (idx >= 0) a.q().removeAt((size_t)idx);
            }
            a.markDirty();
            a.refreshList();
            a.updateTransportUi();
            return;
        }
        case CMD_ROW_DELETE_PLAYLIST: {
            std::vector<size_t> sel = a.selectedRows();
            if (sel.empty()) return;
            const Row& r = a.rows[sel[0]];
            Playlist* p = a.playlistById(r.playlistId);
            if (!p || p->system) return;
            if (msgBoxYesNo(a.hwnd, "למחוק את הפלייליסט \"" + p->name + "\"?", kAppNameHe) == IDYES) {
                for (auto it = a.playlists.begin(); it != a.playlists.end(); ++it) {
                    if (it->id == p->id) { a.playlists.erase(it); break; }
                }
                a.markDirty();
                a.refreshList();
            }
            return;
        }
        case CMD_ROW_RENAME_PLAYLIST: {
            std::vector<size_t> sel = a.selectedRows();
            if (sel.empty()) return;
            openNamePlaylistDialog(a.rows[sel[0]].playlistId);
            return;
        }
        case CMD_ROW_OPEN_PLAYLIST: {
            std::vector<size_t> sel = a.selectedRows();
            if (!sel.empty()) activateRow(a, sel[0]);
            return;
        }
        case CMD_ROW_PLAY_PLAYLIST: {
            std::vector<size_t> sel = a.selectedRows();
            if (sel.empty()) return;
            std::vector<uint32_t> ids = a.rowTrackIds(sel);
            if (ids.empty()) return;
            a.q().clear();
            a.q().append(ids);
            a.startQueueAt(0);
            return;
        }
    }
}

// --------------------------------------------------------------- track end
void onTrackEnded(App& a) {
    uint32_t curId = a.q().currentId();
    unsigned long now = GetTickCount();
    if (curId != 0 && a.endedGuardId == curId &&
        (unsigned long)(now - a.endedGuardTick) < 1500ul) return;
    if (curId != 0) { a.endedGuardId = curId; a.endedGuardTick = now; }
    if (a.sleepAtEnd) {
        a.sleepAtEnd = false;
        a.sleepSecondsLeft = 0;
        KillTimer(a.hwnd, TMR_SLEEP);
        a.player.stopAndClose();
        a.playing = false;
        a.updateTransportUi();
        a.updateStatusText();
        return;
    }
    if (a.q().repeat == RepeatMode::One) {
        a.q().positionMs = 0;
        a.openCurrentAndPlay();
        return;
    }
    a.nextTrack(true);
}

} // namespace shoso
