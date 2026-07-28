'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  UnreadCounter,
  classifyRecord,
  isPathInside,
  isUserVscodeSession
} = require('../src/event-classifier');

function meta(overrides = {}) {
  return {
    type: 'session_meta',
    payload: {
      originator: 'codex_vscode',
      thread_source: 'user',
      source: 'vscode',
      cwd: 'D:\\Code\\demo',
      id: 'thread-1',
      ...overrides
    }
  };
}

test('accepts a user VS Code session in the current workspace', () => {
  assert.equal(isUserVscodeSession(meta(), ['D:\\Code\\demo']), true);
  assert.equal(isUserVscodeSession(meta(), ['D:\\Code']), true);
});

test('rejects subagent, CLI, and other-workspace sessions', () => {
  assert.equal(
    isUserVscodeSession(meta({ thread_source: 'subagent' }), ['D:\\Code\\demo']),
    false
  );
  assert.equal(
    isUserVscodeSession(meta({ source: 'cli' }), ['D:\\Code\\demo']),
    false
  );
  assert.equal(
    isUserVscodeSession(meta(), ['D:\\Code\\different']),
    false
  );
});

test('classifies task completion as a reply', () => {
  assert.deepEqual(
    classifyRecord({
      type: 'event_msg',
      payload: { type: 'task_complete', turn_id: 'turn-1' }
    }),
    { kind: 'reply', eventId: 'turn:turn-1' }
  );
});

test('classifies request_user_input calls as questions', () => {
  assert.deepEqual(
    classifyRecord({
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        name: 'request_user_input',
        call_id: 'call-1'
      }
    }),
    { kind: 'question', eventId: 'question:call-1' }
  );
  assert.deepEqual(
    classifyRecord({
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'request_user_input',
        id: 'call-2'
      }
    }),
    { kind: 'question', eventId: 'question:call-2' }
  );
});

test('ignores commentary and unrelated tool calls', () => {
  assert.equal(
    classifyRecord({
      type: 'response_item',
      payload: { type: 'message', role: 'assistant', phase: 'commentary' }
    }),
    undefined
  );
  assert.equal(
    classifyRecord({
      type: 'response_item',
      payload: { type: 'custom_tool_call', name: 'apply_patch', id: 'call-3' }
    }),
    undefined
  );
});

test('unread counter tracks threads and serializes state', () => {
  const counter = new UnreadCounter({ old: 2, invalid: 0 });
  counter.increment('new');
  counter.increment('new');
  assert.equal(counter.total, 4);
  assert.equal(counter.getThreadCount('new'), 2);
  assert.equal(counter.clearThread('old'), true);
  assert.deepEqual(counter.toJSON(), { new: 2 });
  assert.equal(counter.clearAll(), true);
  assert.equal(counter.total, 0);
});

test('path containment handles exact and nested paths', () => {
  assert.equal(isPathInside('D:\\Code', 'D:\\Code\\demo'), true);
  assert.equal(isPathInside('D:\\Code', 'D:\\Other'), false);
});
