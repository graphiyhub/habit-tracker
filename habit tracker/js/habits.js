import { localDate } from "./tracking.js";

export const CATEGORIES = ["Health & Fitness", "Learning", "Career & Work", "Personal Development", "Lifestyle", "Other"];
export const ICONS = ["🏃", "📚", "💻", "🧘", "💧", "✍️", "🎯", "🌱", "🎨", "💪", "🧠", "☀️", "📝", "🚴", "🎸"];

export function createHabit(state, values) {
  const habit = {
    ...values,
    id: crypto.randomUUID ? crypto.randomUUID() : `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: values.name.trim(),
    description: values.description.trim(),
    startDate: values.startDate || localDate(),
    days: [...new Set(values.days)].sort((a, b) => a - b),
    status: "active",
    createdAt: new Date().toISOString()
  };
  state.habits.push(habit);
  return habit;
}

export function updateHabit(state, id, values) {
  const index = state.habits.findIndex(habit => habit.id === id);
  if (index < 0) throw new Error("This habit no longer exists.");
  state.habits[index] = {
    ...state.habits[index],
    ...values,
    name: values.name.trim(),
    description: values.description.trim(),
    days: [...new Set(values.days)].sort((a, b) => a - b)
  };
}

export function archiveHabit(state, id) {
  const habit = state.habits.find(item => item.id === id);
  if (habit) habit.status = habit.status === "archived" ? "active" : "archived";
}

export function deleteHabit(state, id) {
  state.habits = state.habits.filter(habit => habit.id !== id);
  for (const [date, entries] of Object.entries(state.completions)) {
    const remaining = entries.filter(entry => entry !== id);
    if (remaining.length) state.completions[date] = remaining;
    else delete state.completions[date];
  }
}
