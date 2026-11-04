export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function weekStart(date, startOfWeek = 1) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (result.getDay() - startOfWeek + 7) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

export function weekDates(date, startOfWeek = 1) {
  const start = weekStart(date, startOfWeek);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function weekKey(date, startOfWeek = 1) {
  return localDate(weekStart(date, startOfWeek));
}

export function activeHabits(state, date = localDate()) {
  return state.habits.filter(habit => habit.status === "active" && (!habit.startDate || habit.startDate <= date));
}

export function scheduled(habit, date) {
  return habit.days.includes(parseDate(date).getDay()) && (!habit.startDate || habit.startDate <= date);
}

export function completionsFor(state, date) {
  return state.completions[date] || [];
}

export function isComplete(state, habitId, date) {
  return completionsFor(state, date).includes(habitId);
}

export function toggleCompletion(state, habitId, date) {
  const entries = new Set(completionsFor(state, date));
  if (entries.has(habitId)) entries.delete(habitId);
  else entries.add(habitId);
  if (entries.size) state.completions[date] = [...entries];
  else delete state.completions[date];
}

export function dayStats(state, date, habits = activeHabits(state, date)) {
  const due = habits.filter(habit => scheduled(habit, date));
  const done = due.filter(habit => isComplete(state, habit.id, date)).length;
  return { due: due.length, done, percent: due.length ? Math.round(done / due.length * 100) : 0 };
}

export function weeklyStats(state, date, startOfWeek = 1, habits = activeHabits(state)) {
  const dates = weekDates(date, startOfWeek);
  let due = 0;
  let done = 0;
  const perHabit = habits.map(habit => {
    const scheduledDates = dates.filter(day => scheduled(habit, localDate(day)));
    const completed = scheduledDates.filter(day => isComplete(state, habit.id, localDate(day))).length;
    due += scheduledDates.length;
    done += completed;
    return { habit, due: scheduledDates.length, done: completed, target: habit.weeklyTarget };
  });
  return { due, done, percent: due ? Math.round(done / due * 100) : 0, perHabit, dates };
}

export function habitStreak(state, habit, today = localDate()) {
  let cursor = parseDate(today);
  let streak = 0;
  const firstCompletion = Object.entries(state.completions)
    .filter(([, ids]) => ids.includes(habit.id))
    .map(([date]) => date).sort()[0];
  const firstDate = habit.startDate || firstCompletion;
  if (!firstDate || today < firstDate) return 0;
  if (scheduled(habit, today) && !isComplete(state, habit.id, today)) cursor = addDays(cursor, -1);
  while (localDate(cursor) >= firstDate) {
    const key = localDate(cursor);
    if (!scheduled(habit, key)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!isComplete(state, habit.id, key)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(state, habit, endDate = localDate()) {
  const dates = Object.keys(state.completions).filter(date => date <= endDate).sort();
  if (!dates.length) return 0;
  const start = parseDate(habit.startDate && habit.startDate < dates[0] ? habit.startDate : dates[0]);
  const end = parseDate(endDate);
  let best = 0;
  let current = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const key = localDate(cursor);
    if (!scheduled(habit, key)) continue;
    if (isComplete(state, habit.id, key)) {
      current++;
      best = Math.max(best, current);
    } else current = 0;
  }
  return best;
}

export function overallStreak(state, today = localDate(), startOfWeek = 1) {
  let cursor = parseDate(today);
  const habits = activeHabits(state, today);
  const completionDates = Object.entries(state.completions)
    .filter(([, ids]) => habits.some(habit => ids.includes(habit.id)))
    .map(([date]) => date).sort();
  const habitStarts = habits.map(habit => habit.startDate).filter(Boolean).sort();
  const firstDate = [completionDates[0], habitStarts[0]].filter(Boolean).sort()[0];
  if (!firstDate || today < firstDate) return 0;
  const todayKey = localDate(cursor);
  const dueToday = habits.filter(habit => scheduled(habit, todayKey));
  if (dueToday.length && dueToday.some(habit => !isComplete(state, habit.id, todayKey))) cursor = addDays(cursor, -1);
  let count = 0;
  while (localDate(cursor) >= firstDate) {
    const key = localDate(cursor);
    const due = habits.filter(habit => scheduled(habit, key));
    if (!due.length) { cursor = addDays(cursor, -1); continue; }
    if (!due.every(habit => isComplete(state, habit.id, key))) break;
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function formatDate(date, options = { month: "short", day: "numeric" }) {
  return date.toLocaleDateString(undefined, options);
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
