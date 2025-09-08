export type LogLevel = "debug" | "info" | "warn" | "error";

function jsonLog(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => jsonLog("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => jsonLog("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => jsonLog("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => jsonLog("error", msg, extra),
};

