# Codex Reminder

## What's this

When an OpenAI Codex main-thread response finishes in VS Code, or when Codex asks
the user a question through `request_user_input`, this extension displays a numeric
unread badge on the current VS Code icon in the Windows taskbar.

The unread count is cleared when you open the corresponding Codex conversation,
the VS Code window regains focus, or you click `Codex N` in the status bar.

### How it works

- Monitors only local Codex JSONL events under `CODEX_HOME/sessions`.
- Counts only main threads with `originator=codex_vscode` and
  `thread_source=user`, excluding approval reviewers and other sub-agent threads.
- Filters events by workspace path to prevent duplicate counts across multiple
  VS Code windows.
- Uses `Codex.log` from the current VS Code Extension Host to determine which
  thread is being viewed.
- Uses Windows `ITaskbarList3.SetOverlayIcon` to render a true numeric taskbar
  badge.
- Does not access the network or read, store, or upload response content.

### Installation

The project has no third-party npm dependencies.

```powershell
npm run check
npm run test:taskbar
npm run package:vsix
code --install-extension .\dist\codex-reminder-0.1.0.vsix --force
```

After installation, run `Developer: Reload Window`.

For development and debugging, you can also open this directory directly in
VS Code and press `F5`.

### Commands

- `Codex Reminder: Open Codex and Mark Read`
- `Codex Reminder: Clear Unread Count`
- `Codex Reminder: Test Taskbar Badge`
- `Codex Reminder: Show Diagnostic Output`

The `Codex N` status bar item is clickable. It opens Codex and marks the current
count as read.

### Settings

- `codexReminder.enabled`
- `codexReminder.showStatusBar`
- `codexReminder.clearActiveThreadOnFocus`
- `codexReminder.pollIntervalMs`
- `codexReminder.maxTaskbarCount`
- `codexReminder.codexHome`

### Compatibility

The extension is implemented for Windows, VS Code 1.130, and the local event
format used by OpenAI Codex extension `openai.chatgpt-26.721.41059`.

VS Code does not provide a public API for monitoring replies in another
extension's Webview, and Codex IDE does not expose a public reply-event API.
This extension therefore uses Codex's local session and diagnostic events. If
Codex changes these local formats in the future, the diagnostic output will log
ignored files and parsing errors to help with troubleshooting and updates.

If the taskbar badge does not appear:

1. Run `Codex Reminder: Test Taskbar Badge`.
2. Open `Output > Codex Reminder`.
3. Make sure the extension is installed in the local UI Extension Host, not in a
   remote SSH/WSL environment.
4. When using multiple windows, make sure the current workspace name appears in
   the VS Code window title.

## 是什么

当 VS Code 中的 OpenAI Codex 主线程回复完成，或通过 `request_user_input`
询问用户时，在 Windows 任务栏的当前 VS Code 图标上显示未读数字角标。

打开对应 Codex 会话、让该 VS Code 窗口重新获得焦点，或点击状态栏中的
`Codex N` 后，已读计数会被清除。

### 工作方式

- 仅监听本机 `CODEX_HOME/sessions` 下的 Codex JSONL 事件。
- 只接受 `originator=codex_vscode`、`thread_source=user` 的主线程，
  会排除审批 reviewer 和其他子代理线程。
- 用工作区路径过滤事件，避免多个 VS Code 窗口重复计数。
- 从当前 VS Code Extension Host 的 `Codex.log` 判断正在查看的线程。
- 通过 Windows `ITaskbarList3.SetOverlayIcon` 绘制真正的数字任务栏角标。
- 不访问网络，也不读取、保存或上传回复正文。

### 安装

项目不依赖第三方 npm 包。

```powershell
npm run check
npm run test:taskbar
npm run package:vsix
code --install-extension .\dist\codex-reminder-0.1.0.vsix --force
```

安装后执行 `Developer: Reload Window`。

开发调试时，也可以直接在 VS Code 打开本目录并按 `F5`。

### 命令

- `Codex Reminder: Open Codex and Mark Read`
- `Codex Reminder: Clear Unread Count`
- `Codex Reminder: Test Taskbar Badge`
- `Codex Reminder: Show Diagnostic Output`

状态栏的 `Codex N` 可点击：它会打开 Codex 并将当前计数标记为已读。

### 设置

- `codexReminder.enabled`
- `codexReminder.showStatusBar`
- `codexReminder.clearActiveThreadOnFocus`
- `codexReminder.pollIntervalMs`
- `codexReminder.maxTaskbarCount`
- `codexReminder.codexHome`

### 兼容性

已针对 Windows、VS Code 1.130 和 OpenAI Codex 扩展
`openai.chatgpt-26.721.41059` 的本地事件格式实现。

VS Code 没有公开用于监听其他扩展 Webview 回复的 API，Codex IDE 也没有公开的
回复事件 API。因此本扩展使用 Codex 的本地会话与诊断事件；如果未来 Codex 修改
这些本地格式，诊断输出会记录被忽略的文件或解析错误，便于调整。

如果任务栏没有出现角标：

1. 运行 `Codex Reminder: Test Taskbar Badge`。
2. 查看 `Output > Codex Reminder`。
3. 确认插件安装在本地 UI Extension Host，而不是 SSH/WSL 远端。
4. 多窗口场景下，确认当前工作区名称出现在 VS Code 窗口标题中。
