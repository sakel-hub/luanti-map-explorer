/**
 * Formatting utilities for time durations, sizes, and telemetry values.
 */

/**
 * Formats a duration in seconds into a clean, human-readable string.
 *
 * Examples:
 * - < 60s: "45s"
 * - < 1h: "5m 12s" (or "5m" if remaining seconds is 0)
 * - >= 1h: "2h 15m" (or "2h" if remaining minutes is 0)
 */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) {
    return '0s';
  }

  const totalSecs = Math.round(seconds);
  if (totalSecs < 60) {
    return `${totalSecs}s`;
  }

  if (totalSecs < 3600) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  const hours = Math.floor(totalSecs / 3600);
  const remainingSecs = totalSecs % 3600;
  const mins = Math.floor(remainingSecs / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
