'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  CodexLogMonitor,
  CodexSessionMonitor,
  TailState,
  Utf8LineAccumulator,
  readNewLines,
  recentDayDirectories
} = require('../src/session-monitor');

test('UTF-8 line accumulator preserves split multibyte characters', () => {
  const accumulator = new Utf8LineAccumulator();
  const bytes = Buffer.from('{"text":"完成"}\n{"next":1}\n', 'utf8');
  const split = bytes.indexOf(Buffer.from('完')) + 1;

  assert.deepEqual(accumulator.push(bytes.subarray(0, split)), []);
  assert.deepEqual(accumulator.push(bytes.subarray(split)), [
    '{"text":"完成"}',
    '{"next":1}'
  ]);
});

test('line accumulator drops oversized lines and resumes', () => {
  const accumulator = new Utf8LineAccumulator(5);
  assert.deepEqual(accumulator.push(Buffer.from('123456')), []);
  assert.deepEqual(accumulator.push(Buffer.from('789\nok\n')), ['ok']);
});

test('readNewLines preserves a truncated JSONL record until completed', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-reminder-lines-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'session.jsonl');
  const state = new TailState(file);
  const lines = [];

  await fs.writeFile(file, '{"partial":');
  await readNewLines(state, (line) => lines.push(line));
  assert.deepEqual(lines, []);

  await fs.appendFile(file, 'true}\n');
  await readNewLines(state, (line) => lines.push(line));
  assert.deepEqual(lines, ['{"partial":true}']);
});

test('readNewLines resets after file truncation or rotation', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-reminder-rotate-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'session.jsonl');
  const state = new TailState(file);
  const lines = [];

  await fs.writeFile(file, 'first-long-record\n');
  await readNewLines(state, (line) => lines.push(line));
  await fs.writeFile(file, 'new\n');
  await readNewLines(state, (line) => lines.push(line));
  assert.deepEqual(lines, ['first-long-record', 'new']);
});

test('readNewLines tolerates a missing file', async () => {
  const state = new TailState(path.join(os.tmpdir(), 'codex-reminder-file-that-does-not-exist'));
  let called = false;
  await readNewLines(state, () => {
    called = true;
  });
  assert.equal(called, false);
});

test('session monitor ignores malformed JSON and deduplicates attention events', () => {
  const events = [];
  const monitor = new CodexSessionMonitor({
    codexHome: path.resolve('test-fixtures', 'codex-home'),
    onAttention: (event) => events.push(event)
  });
  const state = { threadId: 'thread-1' };
  const event = JSON.stringify({
    type: 'event_msg',
    payload: { type: 'task_complete', turn_id: 'turn-1' }
  });

  monitor._handleLine(state, '{malformed');
  monitor._handleLine(state, event);
  monitor._handleLine(state, event);
  assert.deepEqual(events, [
    { threadId: 'thread-1', kind: 'reply', eventId: 'turn:turn-1' }
  ]);
});

test('Codex log monitor tracks visible and read thread state', () => {
  const visible = [];
  const read = [];
  const monitor = new CodexLogMonitor({
    logPath: path.resolve('test-fixtures', 'Codex.log'),
    onThreadVisible: (threadId) => visible.push(threadId),
    onThreadRead: (threadId) => read.push(threadId)
  });
  const threadId = '12345678-1234-1234-1234-123456789abc';

  monitor._handleLine(
    `thread_stream_view_activity_changed active=true conversationId=${threadId}`
  );
  monitor._handleLine('method=thread-read-state-changed');
  monitor._handleLine(
    `thread_stream_view_activity_changed active=false conversationId=${threadId}`
  );

  assert.deepEqual(visible, [threadId]);
  assert.deepEqual(read, [threadId]);
  assert.equal(monitor.activeThreadId, undefined);
});

test('recent day directory list has the requested size', () => {
  const directories = recentDayDirectories(path.resolve('sessions'), 3);
  assert.equal(directories.length, 3);
  assert.equal(new Set(directories).size, 3);
});

test('session polling detects new async questions once without replaying history', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-reminder-async-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const day = recentDayDirectories(path.join(directory, 'sessions'), 1)[0];
  await fs.mkdir(day, { recursive: true });
  const file = path.join(day, 'session.jsonl');
  const question = (callId) => ({
    type: 'response_item',
    payload: { type: 'function_call', name: 'request_user_input_async', id: 'item-' + callId, call_id: callId }
  });
  const jsonl = (records) => records.map((record) => JSON.stringify(record) + '\n').join('');
  await fs.writeFile(file, jsonl([
    { type: 'session_meta', payload: {
      id: 'thread-1', originator: 'codex_vscode', source: 'vscode', thread_source: 'user', cwd: directory
    } },
    question('historical')
  ]));
  const events = [];
  const monitor = new CodexSessionMonitor({
    codexHome: directory, workspaceRoots: [directory],
    onAttention: (event) => events.push(event)
  });
  t.after(() => monitor.dispose());
  await monitor.start();
  monitor.dispose();
  await monitor._poll();
  assert.deepEqual(events, []);

  await fs.appendFile(file, jsonl([
    question('call-1'),
    { type: 'event_msg', payload: { type: 'request_user_input_async', call_id: 'call-1' } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call-1', output: '{}' } },
    question('call-2')
  ]));
  await monitor._poll();
  await monitor._poll();
  assert.deepEqual(events, [
    { threadId: 'thread-1', kind: 'question', eventId: 'question:call-1' },
    { threadId: 'thread-1', kind: 'question', eventId: 'question:call-2' }
  ]);
});
