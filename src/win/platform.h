// SHOSO Music - Windows platform services (files, dialogs, shell, dpi)
#pragma once
#include "win_inc.h"
#include "../core/store.h"

namespace shoso {

std::string appDataDirUtf8();          // %APPDATA%\SHOSO (created)
std::string moduleDirUtf8();           // folder of the running exe
bool ensureDirUtf8(const std::string& dirUtf8);

struct WinFileIO : FileIO {
    bool readText(const std::string& pathUtf8, std::string& out) override;
    bool writeTextAtomic(const std::string& pathUtf8, const std::string& data) override;
    bool fileExists(const std::string& pathUtf8) override;
};

bool fileStatUtf8(const std::string& pathUtf8, unsigned long long& size, unsigned long long& mtime);
bool readFileBytes(const std::string& pathUtf8, std::vector<uint8_t>& out, size_t maxBytes);

// Reads the beginning and the end of a media file (tags live there).
// headLen/tailLen are IN/OUT: requested sizes on input, actual sizes on output.
bool readHeadTail(const std::string& pathUtf8,
                  std::vector<uint8_t>& head, size_t headWant,
                  std::vector<uint8_t>& tail, size_t tailWant);

void openInExplorerSelect(const std::string& pathUtf8);
void shellOpenDefault(const std::string& pathUtf8);
std::string pickFolderDialog(HWND owner, const std::string& titleUtf8);
unsigned long long nowEpochSec();

int  dpiOf(HWND hwnd);
int  scale(int valueAt96, int dpi);
void msgBox(HWND owner, const std::string& textUtf8, const std::string& titleUtf8, UINT flags = MB_OK | MB_ICONINFORMATION);
int  msgBoxYesNo(HWND owner, const std::string& textUtf8, const std::string& titleUtf8);
void copyToClipboard(HWND owner, const std::string& textUtf8);

} // namespace shoso
