import { loadState, saveState, exportJson, exportCsv, validateImport } from "./storage.js";
import { CATEGORIES, ICONS, archiveHabit, createHabit, deleteHabit, updateHabit } from "./habits.js";
import { applySettings, setTheme } from "./settings.js";
import { renderAnalyticsCharts, analyticsSummary } from "./analytics.js";
import { calendarCells, selectedDayDetails } from "./calendar.js";
import { reviewSummary } from "./reviews.js";
import {
  DAY_LABELS, activeHabits, addDays, dayStats, formatDate, habitStreak, isComplete,
  localDate, overallStreak, parseDate, scheduled, toggleCompletion, weekDates, weekKey,
  weeklyStats
} from "./tracking.js";

let state = loadState();
let currentPage = state.settings.defaultView || "dashboard";
let weekOffset = 0;
let monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let selectedDate = localDate();
let habitFilter = "all";
let categoryFilter = "all";
let habitStatusFilter = "active";
const pageContent = document.getElementById("pageContent");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalCard = document.getElementById("modalCard");
const PAGE_LABELS = {
  dashboard: "Dashboard", habits: "My habits", goals: "Weekly goals",
  calendar: "Calendar & history", analytics: "Analytics", review: "Weekly review", settings: "Settings"
};
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const icon = (name, cls = "") => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ""}></i>`;
const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#6258e8";

applySettings(state);
document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function persist() {
  saveState(state);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function toast(message) {
  const region = document.getElementById("toastRegion");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 2800);
}

function scheduledCount(habit, dates) {
  return dates.filter(date => scheduled(habit, localDate(date))).length;
}

function weekRangeLabel(date) {
  const dates = weekDates(date, Number(state.settings.startOfWeek));
  return `${formatDate(dates[0])} – ${formatDate(dates[6], { month: "short", day: "numeric", year: dates[0].getFullYear() !== dates[6].getFullYear() ? "numeric" : undefined })}`;
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">HabitFlow</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function emptyState(title, message, actionLabel = "", action = "") {
  return `<div class="empty-state"><div class="empty-icon">${icon("sparkles")}</div><strong>${title}</strong><p>${message}</p>${actionLabel ? `<button class="button button-primary" data-action="${action}">${icon("plus")}${actionLabel}</button>` : ""}</div>`;
}

function statCard(label, value, note, iconName) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(iconName)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${note}</div></article>`;
}

function renderDashboard() {
  const nowKey = localDate();
  const habits = activeHabits(state, nowKey);
  const dueToday = habits.filter(habit => scheduled(habit, nowKey));
  const todayStats = dayStats(state, nowKey, habits);
  const viewingDate = addDays(new Date(), weekOffset * 7);
  const weekHabits = state.habits.filter(habit => habit.status === "active");
  const week = weeklyStats(state, viewingDate, Number(state.settings.startOfWeek), weekHabits);
  const weekDatesList = weekDates(viewingDate, Number(state.settings.startOfWeek));
  const doneCount = dueToday.filter(habit => isComplete(state, habit.id, nowKey)).length;
  const rows = dueToday.map(habit => {
    const weeklyDone = week.perHabit.find(item => item.habit.id === habit.id)?.done || 0;
    return `<div class="habit-row">
      <span class="habit-emoji" style="color:${safeColor(habit.color)}">${safe(habit.icon)}</span>
      <div class="habit-info"><strong>${safe(habit.name)}</strong><small>${safe(habit.category)} · ${habit.weeklyTarget}× weekly goal</small></div>
      <span class="habit-stats">${weeklyDone}/${habit.weeklyTarget} this week · ${habitStreak(state, habit)} day streak</span>
      <button class="small-icon" data-action="edit-habit" data-id="${safe(habit.id)}" aria-label="Edit ${safe(habit.name)}" title="Quick edit">${icon("pencil")}</button>
      <button class="check-button ${isComplete(state, habit.id, nowKey) ? "checked" : ""}" data-action="toggle-today" data-id="${safe(habit.id)}" aria-label="${isComplete(state, habit.id, nowKey) ? "Mark incomplete" : "Mark complete"}">${icon(isComplete(state, habit.id, nowKey) ? "check" : "plus")}</button>
    </div>`;
  }).join("");
  const weekDays = weekDatesList.map(date => {
    const key = localDate(date);
    const stats = dayStats(state, key, habits);
    const dots = weekHabits.filter(habit => scheduled(habit, key)).slice(0, 7).map(habit => `<i class="${isComplete(state, habit.id, key) ? "done" : ""}"></i>`).join("");
    return `<button class="week-day ${key === nowKey ? "today" : ""}" data-action="open-date" data-date="${key}">
      <div class="day-name">${date.toLocaleDateString(undefined, { weekday: "short" })}</div><div class="day-date">${date.getDate()}</div>
      <div class="day-score">${stats.due ? `${stats.percent}%` : "—"}</div><div class="day-dots">${dots}</div>
    </button>`;
  }).join("");
  const action = `<button class="button button-primary" data-action="add-habit">${icon("plus")}Add habit</button>`;
  pageContent.innerHTML = `${heading(`Good ${greeting()},`, "A little progress each day adds up to big results.", action)}
    <div class="grid stats-grid">
      ${statCard("Active habits", habits.length, "Ready when you are", "list-checks")}
      ${statCard("Completed today", `${doneCount}<span class="muted" style="font-size:14px"> / ${dueToday.length}</span>`, dueToday.length ? "Keep your momentum" : "Nothing scheduled today", "check-check")}
      ${statCard("Today's progress", `${todayStats.percent}%`, "Based on habits scheduled today", "chart-no-axes-column-increasing")}
      ${statCard("Overall streak", `${overallStreak(state, nowKey, Number(state.settings.startOfWeek))} <span class="muted" style="font-size:12px">days</span>`, "Days all scheduled habits were done", "flame")}
      ${statCard("Weekly completion", `${week.percent}%`, `${week.done} of ${week.due} scheduled sessions`, "calendar-check")}
    </div>
    <div class="grid dashboard-layout">
      <section class="card">
        <div class="card-header"><div><h2 class="card-title">Today's habits</h2><p class="card-subtitle">${formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" })} · ${doneCount} of ${dueToday.length} complete</p></div><button class="button button-quiet" data-page="habits">See all ${icon("arrow-up-right")}</button></div>
        <div class="habit-list">${rows || emptyState("No habits scheduled today", habits.length ? "Take a breather or adjust your schedule." : "Create your first habit to get started.", habits.length ? "" : "Create a habit", "add-habit")}</div>
      </section>
      <section class="card">
        <div class="card-header"><div><h2 class="card-title">Weekly overview</h2><p class="card-subtitle">${weekRangeLabel(viewingDate)}</p></div><div class="inline-actions"><button class="small-icon" data-action="week-back" aria-label="Previous week">${icon("chevron-left")}</button><span class="week-label">${weekOffset === 0 ? "This week" : weekRangeLabel(viewingDate)}</span><button class="small-icon" data-action="week-forward" aria-label="Next week">${icon("chevron-right")}</button></div></div>
        <div class="week-grid">${weekDays}</div>
        <div class="daily-progress"><div class="progress-label"><span>Weekly scheduled habits</span><strong>${week.percent}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${week.percent}%"></div></div></div>
        <div class="section-spacer"><button class="button" data-page="review">${icon("notebook-pen")}View weekly review</button></div>
      </section>
    </div>`;
  refreshIcons();
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function renderHabits() {
  const list = state.habits.filter(habit => habitStatusFilter === "all" || habit.status === habitStatusFilter);
  const cards = list.map(habit => `<article class="card habit-management-card">
    <div class="habit-card-top"><span class="habit-emoji" style="background:${safeColor(habit.color)}20;color:${safeColor(habit.color)}">${safe(habit.icon)}</span>
      <div class="habit-info"><strong>${safe(habit.name)}</strong><small>${safe(habit.category)} · ${habit.status === "active" ? `${habit.weeklyTarget} days / week` : "Archived"}</small></div>
      <span class="tag ${habit.status === "active" ? "green" : ""}">${habit.status}</span>
    </div>
    <p class="habit-description">${safe(habit.description || "No description added.")}</p>
    <div class="filter-row">${DAY_LABELS.map((day, index) => `<span class="tag ${habit.days.includes(index) ? "accent" : ""}">${day}</span>`).join("")}</div>
    <div class="habit-card-bottom"><span class="muted" style="font-size:10px">${icon("flame")} ${habitStreak(state, habit)} current · ${habit.weeklyTarget}× target</span>
      <div class="habit-card-actions">
        <button class="small-icon" data-action="edit-habit" data-id="${safe(habit.id)}" title="Edit habit">${icon("pencil")}</button>
        <button class="small-icon" data-action="archive-habit" data-id="${safe(habit.id)}" title="${habit.status === "active" ? "Archive habit" : "Restore habit"}">${icon(habit.status === "active" ? "archive" : "archive-restore")}</button>
        <button class="small-icon button-danger" data-action="delete-habit" data-id="${safe(habit.id)}" title="Delete habit">${icon("trash-2")}</button>
      </div>
    </div>
  </article>`).join("");
  pageContent.innerHTML = `${heading("My habits", "Build routines that fit the life you want to live.", `<button class="button button-primary" data-action="add-habit">${icon("plus")}New habit</button>`)}
    <section class="card" style="margin-bottom:16px"><div class="card-header"><div><h2 class="card-title">Your routines</h2><p class="card-subtitle">${state.habits.filter(item => item.status === "active").length} active · ${state.habits.length} total</p></div>
      <select class="select" style="width:auto" id="statusFilter" aria-label="Filter habits"><option value="active" ${habitStatusFilter === "active" ? "selected" : ""}>Active habits</option><option value="archived" ${habitStatusFilter === "archived" ? "selected" : ""}>Archived habits</option><option value="all" ${habitStatusFilter === "all" ? "selected" : ""}>All habits</option></select>
    </div><div class="grid habit-cards">${cards || emptyState(habitStatusFilter === "archived" ? "No archived habits" : "No habits yet", "Habits you create will live here.", "Create your first habit", "add-habit")}</div></section>`;
  refreshIcons();
}

function renderGoals() {
  const date = addDays(new Date(), weekOffset * 7);
  const habits = state.habits.filter(habit => habit.status === "active");
  const week = weeklyStats(state, date, Number(state.settings.startOfWeek), habits);
  const goals = week.perHabit.filter(item => item.due || item.habit.status === "active").map(item => {
    const done = week.perHabit.find(entry => entry.habit.id === item.habit.id)?.done || 0;
    const target = item.habit.weeklyTarget;
    const achieved = done >= target;
    const pct = Math.min(100, Math.round(done / target * 100));
    return `<div class="goal-row"><div class="goal-main"><div class="goal-name"><span class="habit-emoji">${safe(item.habit.icon)}</span>${safe(item.habit.name)}</div><span class="goal-count">${done} / ${target} sessions</span></div>
      <div class="progress-track"><div class="progress-fill ${achieved ? "green" : ""}" style="width:${pct}%"></div></div>
      <div class="goal-foot"><span>${item.due} scheduled ${item.due === 1 ? "day" : "days"} · ${Math.max(0, target - done)} remaining</span><span class="${achieved ? "goal-achieved" : ""}">${achieved ? `${icon("circle-check")} Goal achieved` : `${pct}%`}</span></div></div>`;
  }).join("");
  const achievedCount = week.perHabit.filter(item => item.done >= item.habit.weeklyTarget).length;
  pageContent.innerHTML = `${heading("Weekly goals", "Measure what matters, and celebrate every session.", `<div class="inline-actions"><button class="button" data-action="week-back">${icon("chevron-left")}Previous</button><span class="week-label">${weekRangeLabel(date)}</span><button class="button" data-action="week-forward">Next${icon("chevron-right")}</button></div>`)}
    <div class="metric-strip">
      <div class="mini-metric"><span>Weekly completion</span><strong>${week.percent}%</strong></div>
      <div class="mini-metric"><span>Sessions completed</span><strong>${week.done}<span class="muted" style="font-size:12px"> / ${week.due}</span></strong></div>
      <div class="mini-metric"><span>Goals achieved</span><strong>${achievedCount}<span class="muted" style="font-size:12px"> / ${week.perHabit.length}</span></strong></div>
    </div>
    <section class="card"><div class="card-header"><div><h2 class="card-title">Your weekly targets</h2><p class="card-subtitle">Targets are measured against completed sessions. Scheduled days define expected opportunities.</p></div><button class="button" data-page="habits">${icon("settings-2")}Manage habits</button></div>
    ${goals || emptyState("No goals to show", "Add a habit and set its weekly target.", "Create a habit", "add-habit")}</section>`;
  refreshIcons();
}

function filteredHabits() {
  return state.habits.filter(habit =>
    (habitFilter === "all" || habit.id === habitFilter) &&
    (categoryFilter === "all" || habit.category === categoryFilter)
  );
}

function renderCalendar() {
  const allActive = activeHabits(state);
  const habits = filteredHabits();
  const cells = calendarCells(monthCursor, Number(state.settings.startOfWeek));
  const headers = Array.from({ length: 7 }, (_, index) => {
    const day = (Number(state.settings.startOfWeek) + index) % 7;
    return `<div class="month-heading">${DAY_LABELS[day]}</div>`;
  }).join("");
  const cellHtml = cells.map(date => {
    const key = localDate(date);
    const inMonth = date.getMonth() === monthCursor.getMonth();
    const stats = dayStats(state, key, habits);
    const level = stats.percent ? Math.min(4, Math.ceil(stats.percent / 25)) : 0;
    return `<button class="calendar-cell ${inMonth ? "" : "outside"} ${key === localDate() ? "today" : ""} ${key === selectedDate ? "selected" : ""} ${level ? `heat-${level}` : ""}" data-action="select-date" data-date="${key}">
      <span class="date-number">${date.getDate()}</span>${stats.due ? `<span class="cell-score">${stats.done}/${stats.due}</span>` : ""}
    </button>`;
  }).join("");
  const day = selectedDayDetails(state, selectedDate, habits);
  const futureDate = selectedDate > localDate();
  const details = day.habits.map(item => `<div class="history-item"><span class="habit-emoji">${safe(item.habit.icon)}</span><span>${safe(item.habit.name)} <small class="muted">· ${safe(item.habit.category)}</small></span>${futureDate ? `<span class="tag">Upcoming</span>` : `<button class="check-button ${item.complete ? "checked" : ""}" data-action="toggle-date" data-id="${safe(item.habit.id)}" data-date="${selectedDate}" aria-label="${item.complete ? "Mark incomplete" : "Mark complete"}">${icon(item.complete ? "check" : "plus")}</button>`}</div>`).join("");
  const categoryOptions = ["all", ...new Set(allActive.map(habit => habit.category))].map(category => `<option value="${safe(category)}" ${categoryFilter === category ? "selected" : ""}>${category === "all" ? "All categories" : safe(category)}</option>`).join("");
  const habitOptions = [`<option value="all">All habits</option>`, ...allActive.map(habit => `<option value="${safe(habit.id)}" ${habitFilter === habit.id ? "selected" : ""}>${safe(habit.name)}</option>`)].join("");
  pageContent.innerHTML = `${heading("Calendar & history", "Your progress, day by day. Past entries can be corrected any time.", `<button class="button" data-action="month-back">${icon("chevron-left")}Previous month</button><button class="button" data-action="month-forward">Next month${icon("chevron-right")}</button>`)}
    <div class="grid dashboard-layout">
      <section class="card"><div class="calendar-toolbar"><button class="small-icon" data-action="month-back" aria-label="Previous month">${icon("chevron-left")}</button><div class="calendar-month">${monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div><button class="small-icon" data-action="month-forward" aria-label="Next month">${icon("chevron-right")}</button></div>
        <div class="filter-row" style="margin-bottom:10px"><select class="select" id="calendarHabitFilter">${habitOptions}</select><select class="select" id="calendarCategoryFilter">${categoryOptions}</select></div>
        <div class="month-grid">${headers}${cellHtml}</div><p class="card-subtitle" style="margin-top:12px">Cell values show completed / scheduled habits. Green shading indicates completion rate.</p>
      </section>
      <section class="card"><div class="card-header"><div><h2 class="card-title">${formatDate(parseDate(selectedDate), { weekday: "long", month: "long", day: "numeric" })}</h2><p class="card-subtitle">${day.done} of ${day.due} scheduled habits complete · ${day.percent}%</p></div></div>
        <div class="history-list">${details || `<p class="muted" style="font-size:11px">${allActive.length ? "No habits were scheduled for this date." : "Create habits to begin tracking your history."}</p>`}</div>
      </section>
    </div>`;
  refreshIcons();
}

function renderAnalytics() {
  const summary = analyticsSummary(state, new Date(), Number(state.settings.startOfWeek));
  const ordered = summary.monthHabits;
  const month = new Date().toLocaleDateString(undefined, { month: "long" });
  pageContent.innerHTML = `${heading("Analytics", "Understand your patterns and the consistency behind your progress.", `<button class="button" data-page="review">${icon("notebook-pen")}Weekly review</button>`)}
    <div class="metric-strip">
      <div class="mini-metric"><span>This week's completion</span><strong>${summary.weekly.percent}%</strong></div>
      <div class="mini-metric"><span>Weekly targets achieved</span><strong>${summary.weekly.perHabit.filter(item => item.done >= item.habit.weeklyTarget).length}/${summary.weekly.perHabit.length}</strong></div>
      <div class="mini-metric"><span>${month} consistency</span><strong>${summary.monthPercent}%</strong></div>
      <div class="mini-metric"><span>Sessions this month</span><strong>${summary.monthlyDone}</strong></div>
    </div>
    <div class="grid analytics-grid">
      <section class="card chart-card"><div class="card-header"><div><h2 class="card-title">Weekly completion</h2><p class="card-subtitle">Daily scheduled completion percentage</p></div></div><div class="chart-wrap"><canvas id="weeklyTrendChart" aria-label="Weekly completion trend"></canvas></div></section>
      <section class="card chart-card"><div class="card-header"><div><h2 class="card-title">Completed vs. missed</h2><p class="card-subtitle">Scheduled sessions completed or missed each day this week</p></div></div><div class="chart-wrap"><canvas id="weeklyBreakdownChart" aria-label="Weekly completed and missed habits"></canvas></div></section>
      <section class="card chart-card"><div class="card-header"><div><h2 class="card-title">Monthly sessions</h2><p class="card-subtitle">Completed versus missed scheduled habits by week</p></div></div><div class="chart-wrap"><canvas id="monthlyTrendChart" aria-label="Monthly habit completion"></canvas></div></section>
      <section class="card chart-card"><div class="card-header"><div><h2 class="card-title">Habit consistency</h2><p class="card-subtitle">Completion rate for habits with scheduled time this month</p></div></div><div class="chart-wrap"><canvas id="habitTrendChart" aria-label="Habit completion rates"></canvas></div></section>
      <section class="card"><div class="card-header"><div><h2 class="card-title">Consistency highlights</h2><p class="card-subtitle">Based on saved records in ${month}</p></div></div>
        ${ordered.length ? `<div class="summary-list"><div class="summary-line"><span>Most consistent habit</span><strong>${summary.monthlyDone ? `${safe(ordered[0].habit.name)} · ${ordered[0].percent}%` : "—"}</strong></div><div class="summary-line"><span>Needs a little attention</span><strong>${summary.monthlyDone ? `${safe(ordered[ordered.length - 1].habit.name)} · ${ordered[ordered.length - 1].percent}%` : "—"}</strong></div><div class="summary-line"><span>Best weekly completion this month</span><strong>${summary.bestWeek}%</strong></div></div><div class="section-spacer">${summary.habitMetrics.map(item => `<div class="goal-row"><div class="goal-main"><div class="goal-name"><span class="habit-emoji">${safe(item.habit.icon)}</span>${safe(item.habit.name)}${item.habit.status === "archived" ? `<span class="tag">archived</span>` : ""}</div><span class="goal-count">${item.total} total · ${item.streak} current · ${item.longest} longest</span></div><div class="progress-track"><div class="progress-fill" style="width:${item.monthly.percent}%"></div></div><div class="goal-foot"><span>${item.monthly.done}/${item.monthly.due} this month · ${item.weeklyAverage.toFixed(1)} avg / week</span><span>${item.monthly.percent}%</span></div></div>`).join("")}</div>` : emptyState("Not enough data yet", "Complete a scheduled habit and your real analytics will appear.")}</section>
      <section class="card chart-card"><div class="card-header"><div><h2 class="card-title">Habit history</h2><p class="card-subtitle">Daily completion history for the selected habit</p></div><select class="select" id="analyticsHabitFilter" aria-label="Select habit for history">${state.habits.map(habit => `<option value="${safe(habit.id)}">${safe(habit.name)}</option>`).join("")}</select></div><div class="chart-wrap"><canvas id="habitHistoryChart" aria-label="Habit historical progress"></canvas></div></section>
    </div>`;
  refreshIcons();
  renderAnalyticsCharts(state, new Date(), Number(state.settings.startOfWeek), state.habits[0]?.id || "");
}

function renderReview() {
  const date = addDays(new Date(), weekOffset * 7);
  const key = weekKey(date, Number(state.settings.startOfWeek));
  const review = state.reviews[key] || {};
  const summary = reviewSummary(state, date, Number(state.settings.startOfWeek));
  const changeText = summary.change > 0 ? `↑ ${summary.change}% from last week` : summary.change < 0 ? `↓ ${Math.abs(summary.change)}% from last week` : "Same as last week";
  pageContent.innerHTML = `${heading("Weekly review", "Reflect, reset, and make next week a little better.", `<div class="inline-actions"><button class="button" data-action="week-back">${icon("chevron-left")}Previous</button><span class="week-label">${weekRangeLabel(date)}</span><button class="button" data-action="week-forward">Next${icon("chevron-right")}</button></div>`)}
    <div class="grid dashboard-layout">
      <section class="card"><div class="card-header"><div><h2 class="card-title">Your week at a glance</h2><p class="card-subtitle">${changeText}</p></div><span class="tag accent">${key}</span></div>
        <div class="metric-strip"><div class="mini-metric"><span>Completion</span><strong>${summary.percent}%</strong></div><div class="mini-metric"><span>Habits completed</span><strong>${summary.habitsCompleted}</strong></div><div class="mini-metric"><span>Goals achieved</span><strong>${summary.achieved}</strong></div></div>
        <div class="summary-list"><div class="summary-line"><span>Best-performing habit</span><strong>${safe(summary.best)}</strong></div><div class="summary-line"><span>Least-consistent habit</span><strong>${safe(summary.least)}</strong></div><div class="summary-line"><span>Previous week</span><strong>${summary.previous.percent}%</strong></div></div>
        <div class="section-spacer"><h3 class="card-title" style="margin-bottom:11px">Daily performance</h3>${summary.daily.map(item => {
          const upcoming = localDate(item.date) > localDate();
          return `<div class="goal-row"><div class="goal-main"><span class="goal-name">${item.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><span class="goal-count">${upcoming ? `Upcoming · ${item.due} scheduled` : `${item.done}/${item.due}`}</span></div><div class="progress-track"><div class="progress-fill ${item.percent === 100 && item.due ? "green" : ""}" style="width:${upcoming ? 0 : item.percent}%"></div></div></div>`;
        }).join("")}</div>
      </section>
      <section class="card"><div class="card-header"><div><h2 class="card-title">Your reflection</h2><p class="card-subtitle">Saved permanently for this week.</p></div></div>
        <form id="reviewForm" data-week="${key}">
          <div class="review-field"><label for="wentWell">What went well?</label><textarea class="textarea" id="wentWell" name="wentWell" placeholder="Celebrate the things you showed up for...">${safe(review.wentWell || "")}</textarea></div>
          <div class="review-field"><label for="didntGoWell">What didn't go well?</label><textarea class="textarea" id="didntGoWell" name="didntGoWell" placeholder="Notice what got in the way, without judgment...">${safe(review.didntGoWell || "")}</textarea></div>
          <div class="review-field"><label for="improve">What should I improve next week?</label><textarea class="textarea" id="improve" name="improve" placeholder="Choose one small, practical adjustment...">${safe(review.improve || "")}</textarea></div>
          <div class="modal-footer"><button class="button button-primary" type="submit">${icon("save")}Save reflection</button></div>
        </form>
      </section>
    </div>`;
  refreshIcons();
}

function renderSettings() {
  pageContent.innerHTML = `${heading("Settings", "Make HabitFlow work the way you do.", "")}
    <div class="grid settings-layout">
      <section class="card"><div class="card-header"><div><h2 class="card-title">Preferences</h2><p class="card-subtitle">Personalize your tracking experience.</p></div></div>
        <div class="settings-group"><div class="settings-copy"><strong>Appearance</strong><small>Choose light or dark mode.</small></div><button class="button" data-action="toggle-theme">${icon(state.settings.theme === "dark" ? "moon" : "sun")}${state.settings.theme === "dark" ? "Dark" : "Light"} mode</button></div>
        <div class="settings-group"><div class="settings-copy"><strong>Start of week</strong><small>Used for weekly goals, review, and calendar.</small></div><select class="select" id="startOfWeek"><option value="1" ${Number(state.settings.startOfWeek) === 1 ? "selected" : ""}>Monday</option><option value="0" ${Number(state.settings.startOfWeek) === 0 ? "selected" : ""}>Sunday</option></select></div>
        <div class="settings-group"><div class="settings-copy"><strong>Default dashboard view</strong><small>Open this page when HabitFlow starts.</small></div><select class="select" id="defaultView">${Object.entries(PAGE_LABELS).filter(([id]) => id !== "settings").map(([id, name]) => `<option value="${id}" ${state.settings.defaultView === id ? "selected" : ""}>${name}</option>`).join("")}</select></div>
        <div class="settings-group"><div class="settings-copy"><strong>Browser notifications</strong><small>Allow reminder notifications while this page is open.</small></div><button class="switch ${state.settings.notifications ? "on" : ""}" data-action="notifications" role="switch" aria-checked="${state.settings.notifications}" aria-label="Browser notifications"></button></div>
        <div class="settings-group"><div class="settings-copy"><strong>Confirm destructive actions</strong><small>Ask before deleting habits or clearing data.</small></div><button class="switch ${state.settings.confirmDestructive ? "on" : ""}" data-action="confirm-toggle" role="switch" aria-checked="${state.settings.confirmDestructive}" aria-label="Confirm destructive actions"></button></div>
      </section>
      <div class="grid">
        <section class="card"><div class="card-header"><div><h2 class="card-title">Backup &amp; restore</h2><p class="card-subtitle">Your information stays in this browser.</p></div></div>
          <div class="settings-group"><div class="settings-copy"><strong>Export all data</strong><small>Download habits, history, reviews, and preferences as JSON.</small></div><button class="button" data-action="export-json">${icon("download")}Export JSON</button></div>
          <div class="settings-group"><div class="settings-copy"><strong>Export completion history</strong><small>Download completion records as a CSV spreadsheet.</small></div><button class="button" data-action="export-csv">${icon("file-spreadsheet")}Export CSV</button></div>
          <div class="settings-group"><div class="settings-copy"><strong>Import backup</strong><small>Validate a HabitFlow JSON file before replacing data.</small></div><button class="button" data-action="import-json">${icon("upload")}Choose file</button><input id="importFile" class="hidden-input" type="file" accept=".json,application/json"></div>
        </section>
        <section class="card danger-zone"><div class="card-header"><div><h2 class="card-title">Clear all data</h2><p class="card-subtitle">Permanently remove habits, history, and reflections from this browser.</p></div></div><button class="button button-danger" data-action="clear-data">${icon("trash-2")}Clear all data</button></section>
      </div>
    </div>`;
  refreshIcons();
}

function render() {
  document.querySelectorAll(".nav-link[data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === currentPage));
  document.getElementById("pageCrumb").textContent = PAGE_LABELS[currentPage] || "Dashboard";
  document.getElementById("themeToggle").innerHTML = icon(state.settings.theme === "dark" ? "sun" : "moon");
  const renderers = { dashboard: renderDashboard, habits: renderHabits, goals: renderGoals, calendar: renderCalendar, analytics: renderAnalytics, review: renderReview, settings: renderSettings };
  (renderers[currentPage] || renderDashboard)();
}

function openModal(content) {
  modalCard.innerHTML = content;
  modalBackdrop.hidden = false;
  refreshIcons();
  const first = modalCard.querySelector("input,select,textarea,button");
  first?.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalCard.innerHTML = "";
}

function habitModal(habit = null) {
  const isEdit = Boolean(habit);
  const target = habit || { name: "", description: "", category: CATEGORIES[0], icon: ICONS[0], color: "#6258e8", weeklyTarget: 5, days: [1, 2, 3, 4, 5], startDate: localDate(), reminder: "" };
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  openModal(`<div class="modal-head"><div><h2 id="modalTitle">${isEdit ? "Edit habit" : "Create a habit"}</h2><p>Set a rhythm that feels realistic for you.</p></div><button type="button" class="small-icon" data-action="close-modal" aria-label="Close">${icon("x")}</button></div>
    <form id="habitForm" data-id="${isEdit ? safe(habit.id) : ""}">
      <div class="form-grid">
        <div class="field full"><label for="habitName">Habit name</label><input class="input" id="habitName" name="name" maxlength="60" required value="${safe(target.name)}" placeholder="e.g. Go for a run"></div>
        <div class="field"><label for="habitCategory">Category</label><select class="select" id="habitCategory" name="category">${CATEGORIES.map(category => `<option ${target.category === category ? "selected" : ""}>${category}</option>`).join("")}</select></div>
        <div class="field"><label for="habitIcon">Icon</label><select class="select" id="habitIcon" name="icon">${ICONS.map(item => `<option ${item === target.icon ? "selected" : ""}>${item}</option>`).join("")}</select></div>
        <div class="field"><label for="habitTarget">Weekly target</label><select class="select" id="habitTarget" name="weeklyTarget">${Array.from({ length: 7 }, (_, index) => index + 1).map(value => `<option value="${value}" ${Number(target.weeklyTarget) === value ? "selected" : ""}>${value} ${value === 1 ? "day" : "days"} / week</option>`).join("")}</select></div>
        <div class="field"><label for="habitColor">Accent colour</label><input class="color-input" type="color" id="habitColor" name="color" value="${safe(target.color)}"></div>
        <div class="field full"><label>Scheduled days</label><div class="day-selector">${days.map((day, index) => `<label class="day-chip"><input type="checkbox" name="days" value="${index}" ${target.days.includes(index) ? "checked" : ""}><span>${day}</span></label>`).join("")}</div><small class="field-hint">Choose at least one day. Your weekly goal can be lower or higher than the schedule.</small></div>
        <div class="field"><label for="habitStart">Start date</label><input class="input" type="date" id="habitStart" name="startDate" required value="${safe(target.startDate || localDate())}"></div>
        <div class="field"><label for="habitReminder">Reminder (optional)</label><input class="input" type="time" id="habitReminder" name="reminder" value="${safe(target.reminder)}"></div>
        <div class="field full"><label for="habitDescription">Description <span class="muted">(optional)</span></label><textarea class="textarea" id="habitDescription" name="description" maxlength="240" placeholder="A short note to keep you motivated...">${safe(target.description)}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${icon("check")} ${isEdit ? "Save changes" : "Create habit"}</button></div>
    </form>`);
}

function confirmAction(message) {
  return !state.settings.confirmDestructive || window.confirm(message);
}

function changePage(page) {
  if (!PAGE_LABELS[page]) return;
  currentPage = page;
  document.getElementById("sidebar").classList.remove("open");
  render();
}

function toggleDate(habitId, date) {
  if (date > localDate()) {
    toast("Future habits can't be marked complete yet.");
    return;
  }
  const habit = state.habits.find(item => item.id === habitId);
  if (!habit || !scheduled(habit, date)) {
    toast("This habit isn't scheduled for that date.");
    return;
  }
  toggleCompletion(state, habitId, date);
  persist();
  render();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) { changePage(pageButton.dataset.page); return; }
  const pageLink = event.target.closest("[data-page-link]");
  if (pageLink) { event.preventDefault(); changePage(pageLink.dataset.pageLink); return; }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id, date } = actionButton.dataset;
  switch (action) {
    case "add-habit": habitModal(); break;
    case "edit-habit": habitModal(state.habits.find(habit => habit.id === id)); break;
    case "close-modal": closeModal(); break;
    case "toggle-today": toggleDate(id, localDate()); toast(isComplete(state, id, localDate()) ? "Nice work — habit completed!" : "Completion updated."); break;
    case "toggle-date": toggleDate(id, date); break;
    case "open-date": selectedDate = date; currentPage = "calendar"; monthCursor = new Date(parseDate(date).getFullYear(), parseDate(date).getMonth(), 1, 12); render(); break;
    case "select-date": selectedDate = date; renderCalendar(); break;
    case "week-back": weekOffset--; render(); break;
    case "week-forward": weekOffset++; render(); break;
    case "month-back": monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1, 12); selectedDate = localDate(monthCursor); renderCalendar(); break;
    case "month-forward": monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1, 12); selectedDate = localDate(monthCursor); renderCalendar(); break;
    case "archive-habit":
      archiveHabit(state, id); persist(); render(); toast("Habit status updated."); break;
    case "delete-habit": {
      const target = state.habits.find(habit => habit.id === id);
      if (target && confirmAction(`Delete "${target.name}" and its completion records? This cannot be undone.`)) {
        deleteHabit(state, id); persist(); render(); toast("Habit deleted.");
      }
      break;
    }
    case "toggle-theme":
      state.settings.theme = setTheme(state.settings.theme === "dark" ? "light" : "dark");
      persist(); render(); break;
    case "notifications": toggleNotifications(); break;
    case "confirm-toggle": state.settings.confirmDestructive = !state.settings.confirmDestructive; persist(); renderSettings(); break;
    case "export-json": exportJson(state); toast("Backup downloaded."); break;
    case "export-csv": exportCsv(state); toast("Completion history downloaded."); break;
    case "import-json": document.getElementById("importFile")?.click(); break;
    case "clear-data": clearAllData(); break;
  }
});

document.addEventListener("submit", event => {
  if (event.target.id === "habitForm") {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const days = data.getAll("days").map(Number);
    const name = String(data.get("name") || "").trim();
    if (!name || !days.length) { toast("Add a name and choose at least one scheduled day."); return; }
    const values = {
      name, description: String(data.get("description") || ""), category: String(data.get("category")),
      icon: String(data.get("icon")), color: String(data.get("color")), weeklyTarget: Number(data.get("weeklyTarget")),
      days, startDate: String(data.get("startDate")), reminder: String(data.get("reminder") || "")
    };
    try {
      if (form.dataset.id) updateHabit(state, form.dataset.id, values);
      else createHabit(state, values);
      persist(); closeModal(); render(); toast(form.dataset.id ? "Habit updated." : "Habit created.");
    } catch (error) { toast(error.message); }
  }
  if (event.target.id === "reviewForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const key = event.target.dataset.week;
    state.reviews[key] = { wentWell: String(form.get("wentWell") || ""), didntGoWell: String(form.get("didntGoWell") || ""), improve: String(form.get("improve") || ""), updatedAt: new Date().toISOString() };
    persist(); toast("Your reflection is saved.");
  }
});

document.addEventListener("change", async event => {
  const target = event.target;
  if (target.id === "statusFilter") { habitStatusFilter = target.value; renderHabits(); }
  if (target.id === "calendarHabitFilter") { habitFilter = target.value; renderCalendar(); }
  if (target.id === "calendarCategoryFilter") { categoryFilter = target.value; renderCalendar(); }
  if (target.id === "startOfWeek") { state.settings.startOfWeek = Number(target.value); persist(); renderSettings(); }
  if (target.id === "defaultView") { state.settings.defaultView = target.value; persist(); toast("Default view saved."); }
  if (target.id === "analyticsHabitFilter") renderAnalyticsCharts(state, new Date(), Number(state.settings.startOfWeek), target.value);
  if (target.id === "importFile" && target.files?.[0]) await importBackup(target.files[0]);
});

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!validateImport(parsed)) throw new Error("This file is not a valid HabitFlow backup.");
    if (!confirmAction("Importing replaces all current HabitFlow data. Continue?")) return;
    state = parsed;
    persist();
    applySettings(state);
    currentPage = "dashboard";
    render();
    toast("Backup imported successfully.");
  } catch (error) {
    toast(error instanceof SyntaxError ? "The selected file is not valid JSON." : error.message);
  } finally {
    const input = document.getElementById("importFile");
    if (input) input.value = "";
  }
}

function clearAllData() {
  if (!confirmAction("Permanently clear all habits, completion history, and weekly reflections?")) return;
  state = { version: 1, habits: [], completions: {}, reviews: {}, settings: { ...state.settings } };
  persist();
  currentPage = "dashboard";
  render();
  toast("All HabitFlow data was cleared.");
}

async function toggleNotifications() {
  if (!("Notification" in window)) { toast("Browser notifications are not supported here."); return; }
  try {
    if (!state.settings.notifications && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast("Notification permission was not granted."); return; }
    }
    if (!state.settings.notifications && Notification.permission !== "granted") {
      toast("Enable notifications in your browser settings first."); return;
    }
    state.settings.notifications = !state.settings.notifications;
    persist(); renderSettings();
    toast(state.settings.notifications ? "Habit reminders enabled while HabitFlow is open." : "Habit reminders disabled.");
  } catch (error) {
    console.error("Could not update notification preferences.", error);
    toast("Notification preferences could not be updated.");
  }
}

function checkReminders() {
  if (!state.settings.notifications || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const today = localDate(now);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (const habit of activeHabits(state, today)) {
    if (!habit.reminder || habit.reminder !== time || !scheduled(habit, today)) continue;
    const key = `habitflow.reminder.${today}.${habit.id}`;
    if (localStorage.getItem(key)) continue;
    new Notification(`HabitFlow · ${habit.name}`, { body: habit.description || "A small step is waiting for you.", tag: key });
    localStorage.setItem(key, "sent");
  }
}

document.getElementById("themeToggle").addEventListener("click", () => {
  state.settings.theme = setTheme(state.settings.theme === "dark" ? "light" : "dark");
  persist(); render();
});
document.getElementById("topAddHabit").addEventListener("click", () => habitModal());
document.getElementById("menuToggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
modalBackdrop.addEventListener("click", event => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !modalBackdrop.hidden) closeModal(); });

setInterval(checkReminders, 30000);
render();
