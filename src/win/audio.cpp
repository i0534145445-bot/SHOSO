#include "audio.h"
#include "log.h"
#include "platform.h"

namespace shoso {

static std::string mciErrorText(MCIERROR e) {
    wchar_t buf[256] = {0};
    mciGetErrorStringW(e, buf, 255);
    return wideToUtf8(buf);
}

MciPlayer::~MciPlayer() { stopAndClose(); }

MCIERROR MciPlayer::send(const std::wstring& cmd, wchar_t* out, DWORD outChars) const {
    MCIERROR err = mciSendStringW(cmd.c_str(), out, outChars, nullptr);
    if (err) lastError_ = mciErrorText(err) + " [" + std::to_string((unsigned)err) + "] cmd=" + wideToUtf8(cmd);
    return err;
}

bool MciPlayer::open(const std::wstring& path, HWND) {
    stopAndClose();
    std::wstring safe = path;
    // MCI parses quotes itself: strip them, then re-quote
    std::wstring clean;
    for (wchar_t c : safe) if (c != L'"') clean.push_back(c);
    // use the 8.3 short path when the name contains characters MCI dislikes
    if (clean.find_first_of(L"\"'`^&") != std::wstring::npos) {
        wchar_t shortPath[MAX_PATH + 1] = {0};
        DWORD n = GetShortPathNameW(clean.c_str(), shortPath, MAX_PATH);
        if (n > 0 && n <= MAX_PATH) clean = shortPath;
    }
    std::wstring quoted = L"\"" + clean + L"\"";

    // NOTE: the MCI "notify" flag requires an hwnd callback, which mciSendStringW
    // does not get here; track end is detected by a position timer instead.
    MCIERROR err = send(L"open " + quoted + L" alias " + alias_);
    if (err) err = send(L"open " + quoted + L" type mpegvideo alias " + alias_);
    if (err) err = send(L"open " + quoted + L" type waveaudio alias " + alias_);
    if (err) {
        SH_ERR("MCI open failed: " + lastError_);
        return false;
    }
    open_ = true;
    path_ = path;
    send(L"set " + alias_ + L" time format milliseconds");
    // probe volume support once per file
    volumeOk_ = (send(L"setaudio " + alias_ + L" volume to 500") == 0);
    return true;
}

void MciPlayer::play(long long fromMs) {
    if (!open_) return;
    std::wstring cmd = L"play " + alias_;
    if (fromMs > 0) cmd += L" from " + std::to_wstring((long long)fromMs);
    MCIERROR err = send(cmd);
    if (err) SH_WARN("MCI play failed: " + lastError_);
}

void MciPlayer::pause() {
    if (!open_) return;
    MCIERROR err = send(L"pause " + alias_);
    if (err) send(L"stop " + alias_);
}

void MciPlayer::stopAndClose() {
    if (!open_) { open_ = false; return; }
    send(L"stop " + alias_);
    send(L"close " + alias_);
    open_ = false;
    path_.clear();
}

long long MciPlayer::positionMs() const {
    if (!open_) return 0;
    wchar_t buf[64] = {0};
    if (send(L"status " + alias_ + L" position", buf, 64)) return 0;
    return _wtoi(buf);
}

long long MciPlayer::lengthMs() const {
    if (!open_) return 0;
    wchar_t buf[64] = {0};
    if (send(L"status " + alias_ + L" length", buf, 64)) return 0;
    return _wtoi(buf);
}

bool MciPlayer::setVolume(int percent) {
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    if (!open_ || !volumeOk_) return false;
    long v = percent * 10;    // MCI volume is 0..1000
    MCIERROR err = send(L"setaudio " + alias_ + L" volume to " + std::to_wstring(v));
    if (err) { volumeOk_ = false; return false; }
    return true;
}

} // namespace shoso
