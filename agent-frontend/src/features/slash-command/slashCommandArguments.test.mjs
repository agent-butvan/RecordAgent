import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOptionalDateArgument, parseQueryPeriod, queryPeriodRange } from './slashCommandArguments.ts';

const NOW = new Date(2026, 8, 11, 13);

test('日期参数支持空值、today 和严格自然日', () => {
  assert.equal(parseOptionalDateArgument('', NOW), '2026-09-11');
  assert.equal(parseOptionalDateArgument('today', NOW), '2026-09-11');
  assert.equal(parseOptionalDateArgument('2026-09-08', NOW), '2026-09-08');
  assert.throws(() => parseOptionalDateArgument('2026-02-30', NOW), /有效的自然日/);
});

test('范围参数只接受已声明值', () => {
  assert.equal(parseQueryPeriod('', 'week'), 'week');
  assert.equal(parseQueryPeriod('MONTH', 'week'), 'month');
  assert.throws(() => parseQueryPeriod('year', 'week'), /仅支持/);
});

test('周范围从周一开始，月范围从一号开始', () => {
  assert.deepEqual(queryPeriodRange('week', NOW), { from: '2026-09-07', to: '2026-09-11' });
  assert.deepEqual(queryPeriodRange('month', NOW), { from: '2026-09-01', to: '2026-09-11' });
});
