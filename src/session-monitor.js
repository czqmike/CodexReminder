'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');
const {
  classifyRecord,
  getThreadId,
  isUserVscodeSession
} = require('./event-classifier');

const READ_CHUNK_BYTES = 64 * 1024;
const MAX_JSONL_LINE_CHARS = 4 * 1024 * 1024;
const MAX_META_BYTES = 4 * 1024 * 1024;

class Utf8LineAccumulator {
  constructor(maxLineChars = MAX_JSONL_LINE_CHARS) {
    this.maxLineChars = maxLineChars;
    this.decoder = new StringDecoder('utf8');
    this.buffer = '';
    this.droppingLongLine = false;
  }

  reset() {
    this.decoder = new StringDecoder('utf8');
    this.buffer = '';
    this.droppingLongLine = false;
  }

  push(bytes) {
    let text = this.decoder.write(bytes);
    const lines = [];

    if (this.droppingLongLine) {
      const newline = text.indexOf('\n');
      if (newline < 0) {
        return lines;
      }
      text = text.slice(newline + 1);
      this.droppingLongLine = false;
    }

    const combined = this.buffer + text;
    let start = 0;
    let newline = combined.indexOf('\n', start);
    while (newline >= 0) {
      let line = combined.slice(start, newline);
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      if (line.length <= this.maxLineChars) {
        lines.push(line);
      }
      start = newline + 1;
      newline = combined.indexOf('\n', start);
    }

    this.buffer = combined.slice(start);
    if (this.buffer.length > this.maxLineChars) {
      this.buffer = '';
      this.droppingLongLine = true;
    }

    return lines;
  }
}

class TailState {
  constructor(filePath, offset = 0) {
    this.filePath = filePath;
    this.offset = offset;
    this.lines = new Utf8LineAccumulator();
  }

  reset() {
    this.offset = 0;
    this.lines.reset();
  }
}

async function readNewLines(state, onLine) {
  let stat;
  try {
    stat = await fs.stat(state.filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  if (stat.size < state.offset) {
    state.reset();
  }
  if (stat.size === state.offset) {
    return;
  }

  const handle = await fs.open(state.filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    while (state.offset < stat.size) {
      const wanted = Math.min(buffer.length, stat.size - state.offset);
      const { bytesRead } = await handle.read(buffer, 0, wanted, state.offset);
      if (bytesRead <= 0) {
        break;
      }
      state.offset += bytesRead;
      const lines = state.lines.push(buffer.subarray(0, bytesRead));
      for (const line of lines) {
        onLine(line);
      }
    }
  } finally {
    await handle.close();
  }
}

async function readFirstJsonLine(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const chunks = [];
    let total = 0;
    let position = 0;
    while (total < MAX_META_BYTES) {
      const buffer = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, MAX_META_BYTES - total));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead <= 0) {
        break;
      }
      const chunk = buffer.subarray(0, bytesRead);
      const newline = chunk.indexOf(0x0a);
      if (newline >= 0) {
        chunks.push(chunk.subarray(0, newline));
        break;
      }
      chunks.push(chunk);
      total += bytesRead;
      position += bytesRead;
    }
    const line = Buffer.concat(chunks).toString('utf8').replace(/\r$/, '');
    return line ? JSON.parse(line) : undefined;
  } finally {
    await handle.close();
  }
}

class CodexSessionMonitor {
  constructor(options) {
    this.sessionsRoot = path.join(options.codexHome, 'sessions');
    this.workspaceRoots = options.workspaceRoots || [];
    this.pollIntervalMs = options.pollIntervalMs || 1000;
    this.onAttention = options.onAttention;
    this.output = options.output;
    this.files = new Map();
    this.seenEvents = new Set();
    this.started = false;
    this.polling = false;
    this.timer = undefined;
  }

  async start() {
    await this._scan(true);
    this.started = true;
    this.timer = setInterval(() => void this._poll(), this.pollIntervalMs);
    this.output?.appendLine(`Watching Codex sessions in ${this.sessionsRoot}`);
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async _poll() {
    if (this.polling) {
      return;
    }
    this.polling = true;
    try {
      await this._scan(false);
      for (const state of this.files.values()) {
        await readNewLines(state, (line) => this._handleLine(state, line));
      }
    } catch (error) {
      this.output?.appendLine(`Session polling failed: ${formatError(error)}`);
    } finally {
      this.polling = false;
    }
  }

  async _scan(initializeOnly) {
    for (const dayDirectory of recentDayDirectories(this.sessionsRoot, initializeOnly ? 90 : 3)) {
      let entries;
      try {
        entries = await fs.readdir(dayDirectory, { withFileTypes: true });
      } catch (error) {
        if (error?.code === 'ENOENT') {
          continue;
        }
        throw error;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
          continue;
        }
        const filePath = path.join(dayDirectory, entry.name);
        if (!this.files.has(filePath)) {
          await this._register(filePath, initializeOnly);
        }
      }
    }
  }

  async _register(filePath, initializeOnly) {
    try {
      const meta = await readFirstJsonLine(filePath);
      if (!isUserVscodeSession(meta, this.workspaceRoots)) {
        return;
      }
      const threadId = getThreadId(meta);
      if (!threadId) {
        return;
      }
      const offset = initializeOnly ? (await fs.stat(filePath)).size : 0;
      const state = new TailState(filePath, offset);
      state.threadId = threadId;
      this.files.set(filePath, state);
      this.output?.appendLine(
        `Tracking Codex thread ${shortId(threadId)} (${path.basename(filePath)})`
      );
    } catch (error) {
      this.output?.appendLine(
        `Ignored unreadable Codex session ${path.basename(filePath)}: ${formatError(error)}`
      );
    }
  }

  _handleLine(state, line) {
    if (!line) {
      return;
    }

    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return;
    }

    const attention = classifyRecord(record);
    if (!attention) {
      return;
    }

    const dedupeKey = `${state.threadId}:${attention.eventId}`;
    if (this.seenEvents.has(dedupeKey)) {
      return;
    }
    this.seenEvents.add(dedupeKey);
    if (this.seenEvents.size > 2000) {
      const oldest = this.seenEvents.values().next().value;
      this.seenEvents.delete(oldest);
    }

    this.onAttention?.({
      threadId: state.threadId,
      kind: attention.kind,
      eventId: attention.eventId
    });
  }
}

class CodexLogMonitor {
  constructor(options) {
    this.logPath = options.logPath;
    this.pollIntervalMs = options.pollIntervalMs || 1000;
    this.onThreadVisible = options.onThreadVisible;
    this.onThreadRead = options.onThreadRead;
    this.output = options.output;
    this.state = new TailState(this.logPath, 0);
    this.activeThreadId = undefined;
    this.timer = undefined;
    this.polling = false;
    this.initialized = false;
  }

  async start() {
    try {
      this.state.offset = (await fs.stat(this.logPath)).size;
      this.initialized = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    this.timer = setInterval(() => void this._poll(), this.pollIntervalMs);
    this.output?.appendLine(`Watching Codex view state in ${this.logPath}`);
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async _poll() {
    if (this.polling) {
      return;
    }
    this.polling = true;
    try {
      if (!this.initialized) {
        try {
          await fs.stat(this.logPath);
          this.initialized = true;
        } catch (error) {
          if (error?.code === 'ENOENT') {
            return;
          }
          throw error;
        }
      }
      await readNewLines(this.state, (line) => this._handleLine(line));
    } catch (error) {
      this.output?.appendLine(`Codex view-state polling failed: ${formatError(error)}`);
    } finally {
      this.polling = false;
    }
  }

  _handleLine(line) {
    const activity = line.match(
      /thread_stream_view_activity_changed active=(true|false) conversationId=([0-9a-f-]+)/
    );
    if (activity) {
      const active = activity[1] === 'true';
      const threadId = activity[2];
      if (active) {
        this.activeThreadId = threadId;
        this.onThreadVisible?.(threadId);
      } else if (this.activeThreadId === threadId) {
        this.activeThreadId = undefined;
      }
      return;
    }

    const resumed = line.match(
      /maybe_resume_started conversationId=([0-9a-f-]+).*documentVisibilityState=visible/
    );
    if (resumed) {
      this.activeThreadId = resumed[1];
      this.onThreadVisible?.(resumed[1]);
      return;
    }

    if (line.includes('method=thread-read-state-changed')) {
      this.onThreadRead?.(this.activeThreadId);
    }
  }
}

function recentDayDirectories(root, count) {
  const directories = [];
  const now = new Date();
  for (let index = 0; index < count; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    directories.push(
      path.join(
        root,
        String(date.getFullYear()),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      )
    );
  }
  return directories;
}

function shortId(value) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  CodexLogMonitor,
  CodexSessionMonitor,
  TailState,
  Utf8LineAccumulator,
  readNewLines,
  recentDayDirectories
};
