'use strict';

const { spawn } = require('node:child_process');

class TaskbarBadge {
  constructor(options) {
    this.scriptPath = options.scriptPath;
    this.workspaceName = options.workspaceName || '';
    this.maxCount = options.maxCount || 99;
    this.output = options.output;
    this.platform = options.platform || process.platform;
    this.spawn = options.spawn || spawn;
    this.desiredCount = 0;
    this.appliedCount = undefined;
    this.running = undefined;
  }

  setCount(rawCount) {
    this.desiredCount = normalizeBadgeCount(rawCount, this.maxCount);
    if (!this.running) {
      this.running = this._drain().finally(() => {
        this.running = undefined;
        if (this.appliedCount !== this.desiredCount) {
          void this.setCount(this.desiredCount);
        }
      });
    }
    return this.running;
  }

  async dispose() {
    await this.setCount(0);
  }

  async _drain() {
    while (this.appliedCount !== this.desiredCount) {
      const target = this.desiredCount;
      try {
        await runPowerShellBadge({
          count: target,
          maxCount: this.maxCount,
          scriptPath: this.scriptPath,
          workspaceName: this.workspaceName,
          platform: this.platform,
          spawn: this.spawn
        });
      } catch (error) {
        this.output?.appendLine(`Unable to update taskbar badge: ${formatError(error)}`);
      }
      this.appliedCount = target;
    }
  }
}

function runPowerShellBadge(options) {
  if ((options.platform || process.platform) !== 'win32') {
    return Promise.resolve();
  }

  const args = buildPowerShellArgs(options);
  const spawnProcess = options.spawn || spawn;

  return new Promise((resolve, reject) => {
    const child = spawnProcess('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      }
    });
  });
}

function buildPowerShellArgs(options) {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-WindowStyle',
    'Hidden',
    '-File',
    options.scriptPath,
    '-Count',
    String(options.count),
    '-MaxCount',
    String(options.maxCount),
    '-ExtensionHostPid',
    String(process.pid)
  ];
  if (options.workspaceName) {
    args.push('-WorkspaceName', options.workspaceName);
  }
  return args;
}

function normalizeBadgeCount(rawCount, maxCount) {
  const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
  return Math.min(count, maxCount + 1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  buildPowerShellArgs,
  normalizeBadgeCount,
  TaskbarBadge,
  runPowerShellBadge
};
