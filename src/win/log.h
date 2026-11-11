// SHOSO Music - logging and self diagnostics (helps debug on user machines)
#pragma once
#include <string>

namespace shoso {

void logInit(const std::string& logPathUtf8, bool echoConsole);
void logLine(const char* level, const std::string& msg);
void logClose();

#define SH_LOG(msg)  ::shoso::logLine("INFO ", msg)
#define SH_WARN(msg) ::shoso::logLine("WARN ", msg)
#define SH_ERR(msg)  ::shoso::logLine("ERROR", msg)

std::string winErrorText(unsigned long code);
unsigned long lastWinError();

} // namespace shoso
