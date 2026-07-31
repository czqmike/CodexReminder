'use strict';

const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');
const { normalizeConfig } = require('./config');
const { getDisplayState } = require('./display-state');
const { UnreadCounter } = require('./event-classifier');
const { CodexLogMonitor, CodexSessionMonitor } = require('./session-monitor');
const { TaskbarBadge } = require('./taskbar-badge');

const CONFIG_SECTION = 'codexReminder';
const STATE_KEY = 'unreadByThread';

let activeController;

async function activate(context) {
  const output = vscode.window.createOutputChannel('Codex Reminder');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
  statusBar.command = 'codexReminder.openCodex';
  statusBar.name = 'Codex Reminder';

  const controller = new ReminderController(context, output, statusBar);
  activeController = controller;

  context.subscriptions.push(
    output,
    statusBar,
    controller,
    vscode.commands.registerCommand('codexReminder.openCodex', () =>
      controller.openCodexAndClear()
    ),
    vscode.commands.registerCommand('codexReminder.clear', () =>
      controller.clearAll('clear command')
    ),
    vscode.commands.registerCommand('codexReminder.test', () =>
      controller.addTestUnread()
    ),
    vscode.commands.registerCommand('codexReminder.showOutput', () => output.show(true)),
    vscode.window.onDidChangeWindowState((state) => controller.onWindowStateChanged(state)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        void controller.onConfigurationChanged();
      }
    })
  );

  await controller.start();
}

async function deactivate() {
  if (activeController) {
    await activeController.dispose();
    activeController = undefined;
  }
}

class ReminderController {
  constructor(context, output, statusBar) {
    this.context = context;
    this.output = output;
    this.statusBar = statusBar;
    this.counter = new UnreadCounter(context.workspaceState.get(STATE_KEY, {}));
    this.sessionMonitor = undefined;
    this.logMonitor = undefined;
    this.disposed = false;

    const badgeScript = vscode.Uri.joinPath(
      context.extensionUri,
      'scripts',
      'set-taskbar-badge.ps1'
    ).fsPath;
    this.badge = new TaskbarBadge({
      scriptPath: badgeScript,
      workspaceName: getWorkspaceName(),
      maxCount: getConfig().maxTaskbarCount,
      output
    });
  }

  async start() {
    this.output.appendLine('Codex Reminder activated.');
    if (process.platform !== 'win32') {
      this.output.appendLine('Taskbar overlays are available only on Windows.');
    }
    await this._restartMonitors();
    await this._render();
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this._stopMonitors();
    this.statusBar.hide();
    await this.badge.dispose();
  }

  async onConfigurationChanged() {
    const cfg = getConfig();
    this.badge.maxCount = cfg.maxTaskbarCount;
    await this._restartMonitors();
    await this._render();
  }

  onWindowStateChanged(state) {
    if (!state.focused || !getConfig().clearActiveThreadOnFocus) {
      return;
    }
    const activeThreadId = this.logMonitor?.activeThreadId;
    if (activeThreadId) {
      void this.clearThread(activeThreadId, 'VS Code focused with Codex thread visible');
    }
  }

  async openCodexAndClear() {
    try {
      await vscode.commands.executeCommand('chatgpt.openSidebar');
    } finally {
      await this.clearAll('Codex opened from reminder');
    }
  }

  async addTestUnread() {
    this.counter.increment('__codex_reminder_test__');
    this.output.appendLine('Added one test unread item.');
    await this._commit();
  }

  async clearThread(threadId, reason) {
    if (this.counter.clearThread(threadId)) {
      this.output.appendLine(`Marked thread ${shortId(threadId)} read: ${reason}.`);
      await this._commit();
    }
  }

  async clearAll(reason) {
    if (this.counter.clearAll()) {
      this.output.appendLine(`Cleared all unread items: ${reason}.`);
    }
    await this._commit();
  }

  async _onAttention(event) {
    const cfg = getConfig();
    if (!cfg.enabled) {
      return;
    }

    if (
      vscode.window.state.focused &&
      this.logMonitor?.activeThreadId === event.threadId
    ) {
      this.output.appendLine(
        `Codex ${event.kind} was already visible in thread ${shortId(event.threadId)}.`
      );
      return;
    }

    this.counter.increment(event.threadId);
    this.output.appendLine(
      `Unread Codex ${event.kind} detected in thread ${shortId(event.threadId)}.`
    );
    await this._commit();
  }

  async _restartMonitors() {
    this._stopMonitors();
    const cfg = getConfig();
    if (!cfg.enabled || this.disposed) {
      return;
    }

    const codexHome =
      expandHome(cfg.codexHome) ||
      process.env.CODEX_HOME ||
      path.join(os.homedir(), '.codex');
    const workspaceRoots =
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) || [];

    this.sessionMonitor = new CodexSessionMonitor({
      codexHome,
      workspaceRoots,
      pollIntervalMs: cfg.pollIntervalMs,
      onAttention: (event) => void this._onAttention(event),
      output: this.output
    });

    const codexLogPath = path.join(
      path.dirname(this.context.logUri.fsPath),
      'openai.chatgpt',
      'Codex.log'
    );
    this.logMonitor = new CodexLogMonitor({
      logPath: codexLogPath,
      pollIntervalMs: cfg.pollIntervalMs,
      onThreadVisible: (threadId) => {
        if (vscode.window.state.focused) {
          void this.clearThread(threadId, 'Codex thread became visible');
        }
      },
      onThreadRead: (threadId) => {
        if (threadId && vscode.window.state.focused) {
          void this.clearThread(threadId, 'Codex reported the thread as read');
        }
      },
      output: this.output
    });

    try {
      await Promise.all([this.sessionMonitor.start(), this.logMonitor.start()]);
    } catch (error) {
      this.output.appendLine(`Unable to start a monitor: ${formatError(error)}`);
    }
  }

  _stopMonitors() {
    this.sessionMonitor?.dispose();
    this.logMonitor?.dispose();
    this.sessionMonitor = undefined;
    this.logMonitor = undefined;
  }

  async _commit() {
    await this.context.workspaceState.update(STATE_KEY, this.counter.toJSON());
    await this._render();
  }

  async _render() {
    const cfg = getConfig();
    const display = getDisplayState({
      enabled: cfg.enabled,
      showStatusBar: cfg.showStatusBar,
      count: this.counter.total
    });
    void this.badge.setCount(display.badgeCount);

    if (!display.statusVisible) {
      this.statusBar.hide();
      return;
    }

    this.statusBar.text = display.statusText;
    this.statusBar.tooltip = display.statusTooltip;
    this.statusBar.show();
  }
}

function getConfig() {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return normalizeConfig({
    enabled: config.get('enabled'),
    showStatusBar: config.get('showStatusBar'),
    clearActiveThreadOnFocus: config.get('clearActiveThreadOnFocus'),
    pollIntervalMs: config.get('pollIntervalMs'),
    maxTaskbarCount: config.get('maxTaskbarCount'),
    codexHome: config.get('codexHome')
  });
}

function getWorkspaceName() {
  return (
    vscode.workspace.name ||
    vscode.workspace.workspaceFolders?.[0]?.name ||
    ''
  );
}

function expandHome(value) {
  if (!value) {
    return '';
  }
  if (value === '~') {
    return os.homedir();
  }
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function shortId(value) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  activate,
  deactivate
};
