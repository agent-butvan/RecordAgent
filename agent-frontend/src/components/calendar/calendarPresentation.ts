/** 将后端统计的秒数格式化为紧凑学习时长。 */
export function formatStudyDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}小时${minutes % 60}分`
    : minutes
      ? `${minutes}分钟`
      : seconds > 0
        ? '不足1分钟'
        : '0分钟';
}
