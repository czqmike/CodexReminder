# Codex Reminder

## What's this

A VS Code extension that lets you know when Codex has finished its work. Similar
to Cursor, it displays a small numeric badge on the taskbar when a task completes
or Codex needs your input, so you can quickly follow up on the changes and give
your next instruction.

The count is cleared when you open the corresponding Codex conversation,
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

### Installation and deployment

Make sure the VS Code `code` command is available in `PATH`.

#### Install from GitHub Release (recommended)

Choose the commands for your operating system. They download the `.vsix` from the
[latest GitHub Release](https://github.com/czqmike/CodexReminder/releases/latest)
and install it.

##### Windows (PowerShell)

```powershell
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/czqmike/CodexReminder/releases/latest'
$asset = $release.assets | Where-Object { $_.name -like '*.vsix' } | Select-Object -First 1
$vsixPath = Join-Path $env:TEMP $asset.name
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $vsixPath
code --install-extension $vsixPath --force
```

##### Linux / macOS (bash or zsh)

```sh
curl -fL \
  'https://github.com/czqmike/CodexReminder/releases/latest/download/codex-reminder-0.1.0.vsix' \
  -o /tmp/codex-reminder-0.1.0.vsix
code --install-extension /tmp/codex-reminder-0.1.0.vsix --force
```

On Linux and macOS, the unread count is available in the VS Code status bar.
The numeric system taskbar badge is currently supported on Windows only.

#### Build and install from source (Windows)

The project has no third-party npm dependencies.

```powershell
git clone https://github.com/czqmike/CodexReminder.git
Set-Location .\CodexReminder
npm run check
npm run test:taskbar
npm run package:vsix
code --install-extension .\dist\codex-reminder-0.1.0.vsix --force
```

After installation, run `Developer: Reload Window`.

For development and debugging, you can also open the cloned directory directly
in VS Code and press `F5`.

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

一个用来提醒你 Codex 干完活的 VSCode 插件，表现类似于 Cursor，当任务完成后或 Codex 需要提问时，会在任务栏界面出现一个小计数角标。
使你可以继续跟进修改，做出下一步指令。
打开对应 Codex 会话、让该 VS Code 窗口重新获得焦点，或点击状态栏中的
`Codex N` 后，计数会被清除。

### 工作方式

- 仅监听本机 `CODEX_HOME/sessions` 下的 Codex JSONL 事件。
- 只接受 `originator=codex_vscode`、`thread_source=user` 的主线程，
  会排除审批 reviewer 和其他子代理线程。
- 用工作区路径过滤事件，避免多个 VS Code 窗口重复计数。
- 从当前 VS Code Extension Host 的 `Codex.log` 判断正在查看的线程。
- 通过 Windows `ITaskbarList3.SetOverlayIcon` 绘制真正的数字任务栏角标。
- 不访问网络，也不读取、保存或上传回复正文。

### 安装与部署

请先确保 VS Code 的 `code` 命令已加入 `PATH`。

#### 从 GitHub Release 安装（推荐）

请根据操作系统选择命令。命令会从
[最新 GitHub Release](https://github.com/czqmike/CodexReminder/releases/latest)
下载 `.vsix` 并安装。

##### Windows（PowerShell）

```powershell
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/czqmike/CodexReminder/releases/latest'
$asset = $release.assets | Where-Object { $_.name -like '*.vsix' } | Select-Object -First 1
$vsixPath = Join-Path $env:TEMP $asset.name
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $vsixPath
code --install-extension $vsixPath --force
```

##### Linux / macOS（bash 或 zsh）

```sh
curl -fL \
  'https://github.com/czqmike/CodexReminder/releases/latest/download/codex-reminder-0.1.0.vsix' \
  -o /tmp/codex-reminder-0.1.0.vsix
code --install-extension /tmp/codex-reminder-0.1.0.vsix --force
```

在 Linux 和 macOS 上，未读计数会显示在 VS Code 状态栏中；系统任务栏的
数字角标目前仅支持 Windows。

#### 从源码构建并安装（Windows）

项目不依赖第三方 npm 包。

```powershell
git clone https://github.com/czqmike/CodexReminder.git
Set-Location .\CodexReminder
npm run check
npm run test:taskbar
npm run package:vsix
code --install-extension .\dist\codex-reminder-0.1.0.vsix --force
```

安装后执行 `Developer: Reload Window`。

开发调试时，也可以直接在 VS Code 中打开克隆后的目录并按 `F5`。

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
