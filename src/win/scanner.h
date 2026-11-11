// SHOSO Music - background media folder scanner
#pragma once
#include "win_inc.h"
#include "../core/library.h"

namespace shoso {

struct ScanStats {
    int filesSeen = 0;
    int tracksFound = 0;
    int errors = 0;
    double seconds = 0.0;
    bool cancelled = false;
};

// Posts msgBatch with a heap allocated std::vector<Track>* (UI thread owns & frees)
// and finally msgDone with a heap allocated ScanStats*.
void scannerStart(const std::vector<std::string>& rootsUtf8, HWND hwnd, UINT msgBatch, UINT msgDone);
bool scannerRunning();
void scannerCancel();

} // namespace shoso
