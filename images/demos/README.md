# Demo assets

## Generated taskbar illustration

`../taskbar-badge-flow-en.png` and `../taskbar-badge-flow-zh.png` were created with the built-in ImageGen tool. The English README uses the English illustration; the Chinese section uses the Chinese illustration. It illustrates the VS Code Windows taskbar overlay changing from 1 to 3 unread items, then disappearing after clearing. It is a generated feature illustration, not a screenshot, and contains no user data. The Chinese generation prompt is saved in `taskbar-badge-flow.prompt.txt`; the English prompt is saved in `taskbar-badge-flow-en.prompt.txt`.

## Retained real recording

`unread-count.gif` is a real capture of VS Code 1.138 on Windows. An isolated VS Code profile loads the unmodified Codex Reminder 1.0.2 source through a local demonstration harness. A completed reply and another question are fed as local sample JSONL events into a separate Codex home, increasing the count from 1 to 3. No live Codex requests are sent.

The clip is nine seconds, 1120 by 674 pixels, and loops automatically. Only the demonstration window interior is captured. No desktop, taskbar, account, private conversation, project source, or local file path is shown. A small unrelated tooltip area in the lower left is masked. GIF metadata is stripped.

The other two GIFs have been removed. Temporary profiles, raw footage, and the local driver stay in the ignored dist directory and are not included in the extension package.
