type Level = "INFO" | "WARN" | "ERROR";

interface Entry {
  ts: string;
  level: Level;
  module: string;
  msg: string;
}

const MAX = 500;
const buffer: Entry[] = [];

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function push(level: Level, module: string, msg: string) {
  buffer.push({ ts: now(), level, module, msg });
  if (buffer.length > MAX) buffer.shift();
  if (level === "ERROR") {
    console.error(`[${module}] ${msg}`);
  }
}

export const log = {
  info(module: string, msg: string) {
    push("INFO", module, msg);
  },
  warn(module: string, msg: string) {
    push("WARN", module, msg);
  },
  error(module: string, msg: string, err?: unknown) {
    const detail = err instanceof Error ? err.message : String(err ?? "");
    push("ERROR", module, detail ? `${msg}: ${detail}` : msg);
  },
  getEntries(): Entry[] {
    return [...buffer];
  },
  export(): string {
    return buffer
      .map((e) => `[${e.ts}] ${e.level} [${e.module}] ${e.msg}`)
      .join("\n");
  },
  clear() {
    buffer.length = 0;
  },
};
