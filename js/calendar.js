import { addDays, dayStats, localDate, monthKey, parseDate, weekDates } from "./tracking.js";

export function calendarCells(monthDate, startOfWeek = 1) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const offset = (first.getDay() - startOfWeek + 7) % 7;
  const gridStart = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function monthStats(state, monthDate, habits) {
  const month = monthKey(monthDate);
  let due = 0;
  let done = 0;
  for (const day of calendarCells(monthDate)) {
    const date = localDate(day);
    if (!date.startsWith(month) || date > localDate()) continue;
    const stats = dayStats(state, date, habits);
    due += stats.due;
    done += stats.done;
  }
  return { due, done, percent: due ? Math.round(done / due * 100) : 0 };
}

export function selectedDayDetails(state, date, habits) {
  const stats = dayStats(state, date, habits);
  return {
    ...stats,
    habits: habits.filter(habit => habit.startDate <= date || !habit.startDate)
      .filter(habit => habit.days.includes(parseDate(date).getDay()))
      .map(habit => ({ habit, complete: (state.completions[date] || []).includes(habit.id) }))
  };
}

export function monthWeekDates(date, startOfWeek = 1) {
  return weekDates(date, startOfWeek);
}
