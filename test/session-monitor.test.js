'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Utf8LineAccumulator, recentDayDirectories } = require('../src/session-monitor');

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

test('recent day directory list has the requested size', () => {
  const directories = recentDayDirectories('C:\\sessions', 3);
  assert.equal(directories.length, 3);
  assert.equal(new Set(directories).size, 3);
});
