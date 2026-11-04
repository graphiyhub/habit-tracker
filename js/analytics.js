import { addDays, dayStats, habitStreak, localDate, longestStreak, weekDates, weeklyStats, weekStart, weekKey } from "./tracking.js";

let charts = [];

function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue("--accent").trim(),
    green: styles.getPropertyValue("--green").trim(),
    missed: styles.getPropertyValue("--orange").trim(),
    muted: styles.getPropertyValue("--muted").trim(),
    border: styles.getPropertyValue("--border").trim(),
    surface: styles.getPropertyValue("--surface").trim()
  };
}

function monthlyHabits(state, habit, date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  let due = 0;
  let done = 0;
  for (let cursor = start; cursor <= end && cursor <= new Date(); cursor = addDays(cursor, 1)) {
    const key = localDate(cursor);
    if (!habit.days.includes(cursor.getDay()) || (habit.startDate && key < habit.startDate)) continue;
    due++;
    if ((state.completions[key] || []).includes(habit.id)) done++;
  }
  return { due, done, percent: due ? Math.round(done / due * 100) : 0 };
}

export function analyticsSummary(state, date, startOfWeek) {
  const habits = state.habits;
  const weekly = weeklyStats(state, date, startOfWeek, habits);
  const monthHabits = habits.map(habit => ({ habit, ...monthlyHabits(state, habit, date) }));
  const total = monthHabits.reduce((sum, item) => sum + item.due, 0);
  const complete = monthHabits.reduce((sum, item) => sum + item.done, 0);
  const monthDays = Array.from({ length: date.getDate() }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1, 12));
  const trend = monthDays.map(day => ({ label: day.toLocaleDateString(undefined, { day: "numeric" }), ...dayStats(state, localDate(day), habits) }));
  const weeks = [];
  let cursor = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  while (cursor.getMonth() === date.getMonth()) {
    const summary = weeklyStats(state, cursor, startOfWeek, habits);
    if (summary.due) weeks.push(summary.percent);
    cursor = addDays(cursor, 7);
  }
  return {
    weekly,
    monthPercent: total ? Math.round(complete / total * 100) : 0,
    monthlyDone: complete,
    monthHabits: monthHabits.filter(item => item.due).sort((a, b) => b.percent - a.percent),
    trend,
    bestWeek: weeks.length ? Math.max(...weeks) : 0,
    habitMetrics: habits.map(habit => {
      const completed = Object.entries(state.completions)
        .filter(([key, ids]) => ids.includes(habit.id))
        .map(([key]) => key).sort();
      const firstDate = habit.startDate || completed[0] || localDate();
      const firstWeek = weekKey(new Date(`${firstDate}T12:00:00`), startOfWeek);
      const lastWeek = weekKey(date, startOfWeek);
      const totalWeeks = Math.max(1, Math.round((Date.parse(`${lastWeek}T12:00:00`) - Date.parse(`${firstWeek}T12:00:00`)) / 604800000) + 1);
      return {
        habit,
        total: completed.length,
        streak: habitStreak(state, habit),
        longest: longestStreak(state, habit),
        weeklyAverage: completed.length / totalWeeks,
        monthly: monthlyHabits(state, habit, date)
      };
    })
  };
}

export function renderAnalyticsCharts(state, date, startOfWeek, selectedHabitId = "") {
  charts.forEach(chart => chart.destroy());
  charts = [];
  if (!window.Chart) return;
  const colors = chartColors();
  Chart.defaults.color = colors.muted;
  Chart.defaults.font.family = '"DM Sans", sans-serif';
  Chart.defaults.font.size = 13;
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false, labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 16, font: { size: 13 } } },
      tooltip: { titleFont: { size: 14, weight: "600" }, bodyFont: { size: 13 }, padding: 12, displayColors: true }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { padding: 8 } },
      y: { beginAtZero: true, grid: { color: colors.border + "88" }, border: { display: false }, ticks: { precision: 0, padding: 8 } }
    }
  };
  const week = weeklyStats(state, date, startOfWeek, state.habits);
  const weekCanvas = document.getElementById("weeklyTrendChart");
  if (weekCanvas) charts.push(new Chart(weekCanvas, {
    type: "line",
    data: { labels: week.dates.map(day => day.toLocaleDateString(undefined, { weekday: "short" })), datasets: [{
      label: "Completion", data: week.dates.map(day => dayStats(state, localDate(day), state.habits).percent),
      borderColor: colors.accent, backgroundColor: colors.accent + "22", fill: true, tension: .35, pointRadius: 3
    }] },
    options: { ...options, plugins: { ...options.plugins, legend: { ...options.plugins.legend, display: true, position: "bottom" } }, scales: { ...options.scales, y: { ...options.scales.y, max: 100, ticks: { padding: 8, callback: value => `${value}%` } } } }
  }));
  const breakdownCanvas = document.getElementById("weeklyBreakdownChart");
  if (breakdownCanvas) {
    const daily = week.dates.map(day => {
      const key = localDate(day);
      const stats = dayStats(state, key, state.habits);
      return { stats, past: key < localDate() };
    });
    charts.push(new Chart(breakdownCanvas, {
      type: "bar",
      data: {
        labels: week.dates.map(day => day.toLocaleDateString(undefined, { weekday: "short" })),
        datasets: [
          { label: "Completed", data: daily.map(item => item.stats.done), backgroundColor: colors.green, borderRadius: 4 },
          { label: "Missed", data: daily.map(item => item.past ? item.stats.due - item.stats.done : 0), backgroundColor: colors.missed, borderRadius: 5 }
        ]
      },
      options: { ...options, plugins: { ...options.plugins, legend: { ...options.plugins.legend, display: true, position: "bottom" } }, datasets: { bar: { categoryPercentage: .72, barPercentage: .8 } } }
    }));
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  const weeklyBuckets = [];
  for (let cursor = monthStart; cursor <= monthEnd && cursor <= new Date(); cursor = addDays(cursor, 1)) {
    const start = weekStart(cursor, startOfWeek);
    let bucket = weeklyBuckets.find(item => localDate(item.start) === localDate(start));
    if (!bucket) { bucket = { start, done: 0, due: 0 }; weeklyBuckets.push(bucket); }
    const stats = dayStats(state, localDate(cursor), state.habits);
    bucket.done += stats.done;
    bucket.due += stats.due;
  }
  const monthCanvas = document.getElementById("monthlyTrendChart");
  if (monthCanvas) charts.push(new Chart(monthCanvas, {
    type: "bar",
    data: { labels: weeklyBuckets.map((item, index) => `Week ${index + 1}`), datasets: [
      { label: "Completed", data: weeklyBuckets.map(item => item.done), backgroundColor: colors.green, borderRadius: 4 },
      { label: "Missed", data: weeklyBuckets.map(item => Math.max(0, item.due - item.done)), backgroundColor: colors.missed, borderRadius: 5 }
    ] },
    options: { ...options, plugins: { ...options.plugins, legend: { ...options.plugins.legend, display: true, position: "bottom" } }, datasets: { bar: { categoryPercentage: .72, barPercentage: .8 } } }
  }));
  const habitCanvas = document.getElementById("habitTrendChart");
  if (habitCanvas) {
    const metrics = analyticsSummary(state, date, startOfWeek).habitMetrics.slice(0, 6);
    charts.push(new Chart(habitCanvas, {
      type: "bar",
      data: { labels: metrics.map(item => item.habit.name), datasets: [{
        data: metrics.map(item => item.monthly.percent), backgroundColor: colors.accent, borderRadius: 5
      }] },
      options: { ...options, indexAxis: "y", scales: { x: { ...options.scales.x, max: 100, ticks: { padding: 8, callback: value => `${value}%` } }, y: { ...options.scales.y, grid: { display: false } } } }
    }));
  }
  const historyCanvas = document.getElementById("habitHistoryChart");
  if (historyCanvas) {
    const habit = state.habits.find(item => item.id === selectedHabitId) || state.habits[0];
    const dates = Array.from({ length: 14 }, (_, index) => addDays(new Date(), index - 13));
    charts.push(new Chart(historyCanvas, {
      type: "line",
      data: {
        labels: dates.map(day => day.toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        datasets: [{
          label: habit?.name || "Completion",
          data: dates.map(day => (state.completions[localDate(day)] || []).includes(habit?.id) ? 1 : 0),
          borderColor: colors.accent, backgroundColor: colors.accent + "22", fill: true, tension: .3, pointRadius: 3
        }]
      },
      options: { ...options, scales: { ...options.scales, y: { ...options.scales.y, min: 0, max: 1, ticks: { stepSize: 1, callback: value => value ? "Done" : "Missed" } } } }
    }));
  }
}
