/** Convert bucket message count to comments per minute. */

export function commentsPerMinute(count: number, bucketSec: number): number {
  if (bucketSec <= 0) {
    return 0;
  }
  return count * (60 / bucketSec);
}

export function formatRatePerMin(rate: number): string {
  return `${rate.toFixed(1)} 件/分`;
}

export function formatCommentsPerMinute(count: number, bucketSec: number): string {
  return formatRatePerMin(commentsPerMinute(count, bucketSec));
}
