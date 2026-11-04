import { dayStats, localDate, parseDate, weekDates, weeklyStats, weekKey } from "./tracking.js";

export function reviewSummary(state, date, startOfWeek = 1) {
  const stats = weeklyStats(state, date, startOfWeek, state.habits);
  const previous = weeklyStats(state, new Date(parseDate(weekKey(date, startOfWeek)).getTime() - 7 * 86400000), startOfWeek, state.habits);
  const ranked = stats.perHabit.filter(item => item.due).sort((a, b) => b.done / b.due - a.done / a.due);
  const achieved = stats.perHabit.filter(item => item.done >= item.habit.weeklyTarget).length;
  const active = state.habits;
  const hasCompletions = stats.perHabit.some(item => item.done > 0);
  return {
    ...stats,
    previous,
    change: stats.percent - previous.percent,
    achieved,
    habitsCompleted: stats.perHabit.filter(item => item.done > 0).length,
    best: hasCompletions ? ranked[0]?.habit.name || "—" : "—",
    least: hasCompletions ? ranked.at(-1)?.habit.name || "—" : "—",
    activeCount: active.length,
    daily: weekDates(date, startOfWeek).map(day => {
      const key = localDate(day);
      return { date: day, ...dayStats(state, key, state.habits) };
    })
  };
}
