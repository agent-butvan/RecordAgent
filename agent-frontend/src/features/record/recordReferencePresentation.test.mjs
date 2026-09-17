import assert from 'node:assert/strict';
import test from 'node:test';
import { RECORD_REFERENCE_PRESENTATIONS } from './recordReferencePresentation.ts';

test('所有资料类型都声明独立的名称、图标和颜色', () => {
  assert.deepEqual(Object.keys(RECORD_REFERENCE_PRESENTATIONS).sort(), [
    'journal', 'learning', 'quick', 'reading', 'weekly_review',
  ]);
  Object.values(RECORD_REFERENCE_PRESENTATIONS).forEach((presentation) => {
    assert.ok(presentation.label);
    assert.ok(presentation.icon);
    assert.match(presentation.color, /^#[0-9a-f]{6}$/i);
    assert.match(presentation.borderColor, /^#[0-9a-f]{6}$/i);
    assert.match(presentation.backgroundColor, /^#[0-9a-f]{6}$/i);
  });
});
