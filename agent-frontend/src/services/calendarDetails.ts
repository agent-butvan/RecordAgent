import { fetchDailyDay, formatLocalDate } from './dailyEvents';
import { fetchFinanceDayTransactions } from './financeApi';
import { fetchRecords } from './recordApi';
import { fetchStudySessions, fetchStudyStatistics } from './studyApi';

/** 各领域独立失败，避免一个数据源阻断整天的预览。 */
export async function fetchCalendarDetails(date: Date) {
  const key = formatLocalDate(date);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [daily, assets, records, sessions, study] = await Promise.allSettled([
    fetchDailyDay(date),
    fetchFinanceDayTransactions(key),
    fetchRecords(key, key),
    fetchStudySessions(key, key, timezone),
    fetchStudyStatistics(key, key, timezone),
  ]);
  return { daily, assets, records, sessions, study };
}
