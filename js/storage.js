const STORAGE_KEY = "habitflow.data.v1";
const BACKUP_KEY = "habitflow.corrupt-backup";

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day, 12);
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day;
}

const starterHabits = [
  { name: "Morning movement", description: "Start the day with a little movement.", category: "Health & Fitness", icon: "🏃", color: "#5b8def", weeklyTarget: 5, days: [1, 2, 3, 4, 5], startDate: "", reminder: "", status: "active" },
  { name: "Read a few pages", description: "Make time for a good book.", category: "Learning", icon: "📚", color: "#9b7bea", weeklyTarget: 4, days: [1, 2, 3, 4, 5, 6, 0], startDate: "", reminder: "", status: "active" },
  { name: "Plan tomorrow", description: "Close the day with a clear plan.", category: "Personal Development", icon: "📝", color: "#e5a84b", weeklyTarget: 5, days: [0, 1, 2, 3, 4, 5, 6], startDate: "", reminder: "", status: "active" }
];

function isValidState(value) {
  return value && value.version === 1 && Array.isArray(value.habits) &&
    value.habits.every(h => h && typeof h.id === "string" && h.id.length > 0 &&
      typeof h.name === "string" && h.name.trim().length > 0 &&
      typeof h.category === "string" && typeof h.icon === "string" &&
      typeof h.color === "string" && /^#[0-9a-f]{6}$/i.test(h.color) &&
      Number.isInteger(h.weeklyTarget) && h.weeklyTarget >= 1 && h.weeklyTarget <= 7 &&
      Array.isArray(h.days) && h.days.length > 0 &&
      h.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
      ["active", "archived"].includes(h.status) &&
      (typeof h.startDate === "string" && (!h.startDate || validDate(h.startDate))) &&
      typeof h.description === "string" && typeof h.reminder === "string" &&
      (!h.reminder || /^([01]\d|2[0-3]):[0-5]\d$/.test(h.reminder))) &&
    new Set(value.habits.map(h => h.id)).size === value.habits.length &&
    value.completions && typeof value.completions === "object" && !Array.isArray(value.completions) &&
    Object.entries(value.completions).every(([date, entries]) => validDate(date) && Array.isArray(entries) &&
      new Set(entries).size === entries.length && entries.every(id => typeof id === "string" && value.habits.some(habit => habit.id === id))) &&
    value.reviews && typeof value.reviews === "object" && !Array.isArray(value.reviews) &&
    Object.values(value.reviews).every(review => review && typeof review === "object" &&
      ["wentWell", "didntGoWell", "improve"].every(field => review[field] === undefined || typeof review[field] === "string")) &&
    value.settings && typeof value.settings === "object" && !Array.isArray(value.settings) &&
    (value.settings.theme === undefined || ["light", "dark"].includes(value.settings.theme)) &&
    (value.settings.startOfWeek === undefined || [0, 1].includes(value.settings.startOfWeek)) &&
    (value.settings.defaultView === undefined || ["dashboard", "habits", "goals", "calendar", "analytics", "review"].includes(value.settings.defaultView)) &&
    (value.settings.notifications === undefined || typeof value.settings.notifications === "boolean") &&
    (value.settings.confirmDestructive === undefined || typeof value.settings.confirmDestructive === "boolean");
}

function freshState() {
  return {
    version: 1,
    habits: starterHabits.map((habit, index) => ({
      ...habit,
      id: `starter-${index + 1}`,
      days: [...habit.days],
      createdAt: new Date().toISOString()
    })),
    completions: {},
    reviews: {},
    settings: { theme: "light", startOfWeek: 1, defaultView: "dashboard", notifications: false, confirmDestructive: true }
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const state = freshState();
    saveState(state);
    return state;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) throw new Error("Stored data has an unsupported structure.");
    parsed.settings = { ...freshState().settings, ...parsed.settings };
    return parsed;
  } catch (error) {
    try { localStorage.setItem(BACKUP_KEY, raw); } catch { /* Storage may be unavailable. */ }
    console.error("HabitFlow could not read saved data. A copy was kept when possible.", error);
    const state = freshState();
    saveState(state);
    return state;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("HabitFlow could not save changes.", error);
    throw new Error("Your browser could not save this change. Check available storage space.");
  }
}

export function validateImport(value) {
  if (!isValidState(value)) return false;
  if (!["light", "dark"].includes(value.settings.theme) ||
      ![0, 1].includes(value.settings.startOfWeek) ||
      !["dashboard", "habits", "goals", "calendar", "analytics", "review"].includes(value.settings.defaultView) ||
      typeof value.settings.notifications !== "boolean" ||
      typeof value.settings.confirmDestructive !== "boolean") return false;
  const ids = new Set(value.habits.map(habit => habit.id));
  if (ids.size !== value.habits.length) return false;
  for (const [date, entries] of Object.entries(value.completions)) {
    if (!validDate(date) || !Array.isArray(entries) || entries.some(id => typeof id !== "string" || !ids.has(id))) return false;
    if (new Set(entries).size !== entries.length) return false;
  }
  return Object.values(value.habits).every(habit =>
    typeof habit.name === "string" && habit.name.trim().length > 0 &&
    Array.isArray(habit.days) && habit.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
    Number.isInteger(habit.weeklyTarget) && habit.weeklyTarget >= 1 && habit.weeklyTarget <= 7 &&
    ["active", "archived"].includes(habit.status)
  );
}

export function exportJson(state) {
  downloadFile(`habitflow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
}

export function exportCsv(state) {
  const rows = [["Date", "Habit", "Category", "Completed"]];
  for (const [date, completedIds] of Object.entries(state.completions).sort(([a], [b]) => a.localeCompare(b))) {
    for (const habit of state.habits) {
      rows.push([date, habit.name, habit.category, completedIds.includes(habit.id) ? "Yes" : "No"]);
    }
  }
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  downloadFile(`habitflow-history-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
}

export function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
