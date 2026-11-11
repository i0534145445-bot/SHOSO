// SHOSO Music - playback engine (Windows MCI: mp3/wav/wma/m4a/flac via system codecs)
#pragma once
#include "win_inc.h"

namespace shoso {

class MciPlayer {
public:
    ~MciPlayer();

    bool open(const std::wstring& path, HWND notifyHwnd = nullptr);
    void play(long long fromMs);        // starts or resumes from a position
    void pause();
    void stopAndClose();
    long long positionMs() const;
    long long lengthMs() const;
    bool isOpen() const { return open_; }
    bool setVolume(int percent);        // 0..100
    bool volumeSupported() const { return volumeOk_; }
    std::wstring currentPath() const { return path_; }
    std::string lastError() const { return lastError_; }

private:
    MCIERROR send(const std::wstring& cmd, wchar_t* out = nullptr, DWORD outChars = 0) const;
    std::wstring alias_ = L"shoso_player";
    std::wstring path_;
    bool open_ = false;
    bool volumeOk_ = true;
    mutable std::string lastError_;
};

} // namespace shoso
