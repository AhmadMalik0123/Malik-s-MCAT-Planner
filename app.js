const TOTALS = {
  uworld: { "UWorld C/P": 1192, "UWorld B/B": 875, "UWorld CARS": 463, "UWorld P/S": 289 },
  aamc: { "AAMC Biology/Biochem.": 340, "AAMC C/P": 340, "AAMC Independent": 150, "AAMC CARS": 575 }
};
const COLORS = {
  "UWorld C/P": "var(--uw-cp)", "UWorld B/B": "var(--uw-bb)", "UWorld CARS": "var(--uw-cars)", "UWorld P/S": "var(--uw-ps)",
  "AAMC Biology/Biochem.": "var(--aamc-bio)", "AAMC C/P": "var(--aamc-cp)", "AAMC Independent": "var(--aamc-independent)", "AAMC CARS": "var(--aamc-cars)"
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STORAGE_KEY = "mcat-prep-plan-v1";
let state = loadState();
let currentView = "today";
let displayedMonth = firstOfMonth(new Date());
state.fullLengthScores ||= {};
state.fullLengthSectionScores ||= {};
state.reviews ||= [];
state.customTasks ||= {};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const exam = new Date(); exam.setDate(exam.getDate() + 100);
  return { examDate: iso(exam), fullLengthDay: "Saturday", breaks: [], unavailable: "", targets: {}, completed: {}, tasks: {}, fullLengths: {}, fullLengthScores: {}, fullLengthSectionScores: {}, reviews: [], customTasks: {} };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function exportPlan() { const exportData = { exportedAt: new Date().toISOString(), setup: { examDate: state.examDate, fullLengthDay: state.fullLengthDay, breaks: state.breaks, unavailable: state.unavailable, targets: state.targets }, calendar: { fullLengths: state.fullLengths, tasks: state.tasks, customTasks: state.customTasks }, progress: { completed: state.completed, fullLengthScores: state.fullLengthScores, fullLengthSectionScores: state.fullLengthSectionScores, reviews: state.reviews } }; const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "mcat-calendar-progress.json"; link.click(); URL.revokeObjectURL(link.href); showToast("Calendar and progress exported."); }
const EXPORT_COLORS = {
  "UWorld C/P": "#2563eb", "UWorld B/B": "#059669", "UWorld CARS": "#c2410c", "UWorld P/S": "#7c3aed",
  "AAMC Biology/Biochem.": "#0d9488", "AAMC C/P": "#dc2626", "AAMC Independent": "#d97706", "AAMC CARS": "#c2410c"
};
function exportCombinedReport() {
  const exam = parseDate(state.examDate);
  const allDates = [...new Set([...Object.keys(state.tasks), ...Object.keys(state.fullLengths)])].sort();
  if (!exam || !allDates.length) return showToast("Generate a calendar first.");
  const firstMonth = firstOfMonth(parseDate(allDates[0]));
  const lastMonth = firstOfMonth(exam);
  const months = [];
  for (let cursor = firstMonth; cursor <= lastMonth; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)) months.push(cursor);
  const legendChips = [...Object.entries(EXPORT_COLORS), ["Full-length exam", "#4f46e5"], ["Break / unavailable", "#64748b"]]
    .map(([label, color]) => `<span class="legend-chip"><span class="legend-dot" style="background:${color}"></span>${esc(label)}</span>`).join("");
  const monthsHtml = months.map(month => calendarMonthBlock(month, exam)).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Malik and Carolina's MCAT Planner Export</title><style>${EXPORT_CSS}</style></head><body>
    <header class="print-head"><h1>Malik and Carolina's MCAT Planner</h1><p>Exported ${formatDate(new Date())} &mdash; calendar and progress through ${formatDate(exam)}</p><button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button></header>
    <h2 class="export-h2">Study calendar</h2>
    <div class="legend">${legendChips}</div>
    ${monthsHtml}
    <h2 class="export-h2">Progress</h2>
    ${buildProgressExportSection()}
  </body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "mcat-planner-export.html";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Calendar and progress exported.");
}
function calendarMonthBlock(month, exam) {
  const first = firstOfMonth(month);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `<div class="wk">${day}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    const key = dateKey(date);
    const outside = date.getMonth() !== month.getMonth();
    const special = state.fullLengths[key];
    const tasks = tasksForDate(key);
    let chips = tasks.map(task => `<div class="chip" style="border-left-color:${task.custom ? "#7c3aed" : task.section === "Jack Westin" ? "#475569" : (EXPORT_COLORS[task.section] || "#94a3b8")}">${esc(task.label)}</div>`).join("");
    if (special) chips = `<div class="chip special">${esc(special)}</div>`;
    if (exam && key === dateKey(addDays(exam, -1))) chips = `<div class="chip break">Break</div>`;
    cells += `<div class="cell ${outside ? "outside" : ""} ${key === dateKey(exam) ? "examday" : ""}"><div class="num">${date.getDate()}</div>${chips}</div>`;
  }
  return `<section class="month"><h2>${esc(month.toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</h2><div class="grid">${cells}</div></section>`;
}
function buildProgressExportSection() {
  const completed = allSections().reduce((sum, section) => sum + completedFor(section), 0);
  const total = allSections().reduce((sum, section) => sum + (TOTALS.uworld[section] || TOTALS.aamc[section] || 0), 0);
  const pct = total ? Math.round(completed / total * 100) : 0;
  const uworldRows = exportProgressRows(TOTALS.uworld);
  const aamcRows = exportProgressRows(TOTALS.aamc);
  const sections = [["C/P", "cp"], ["CARS", "cars"], ["B/B", "bb"], ["P/S", "ps"]];
  const entries = fullLengthEntries();
  const subsectionCharts = sections.map(([label, key]) => `<div class="export-card"><h3>${esc(label)} section score trend</h3>${sectionScoreGraph(entries, key, label)}</div>`).join("");
  return `
    <div class="export-card"><h3>Overall question completion: ${pct}%</h3><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:#4f46e5"></div></div></div>
    <div class="export-grid-2"><div class="export-card"><h3>UWorld</h3>${uworldRows}</div><div class="export-card"><h3>AAMC</h3>${aamcRows}</div></div>
    <div class="export-card">${buildFullLengthExportChart()}</div>
    <div class="export-grid-2">${subsectionCharts}</div>
  `;
}
function exportProgressRows(group) {
  return Object.entries(group).map(([section, total]) => {
    const done = completedFor(section); const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    const color = EXPORT_COLORS[section] || "#64748b";
    return `<div class="progress-row"><div class="progress-head"><span style="color:${color}">${esc(section)}</span><span>${done} / ${total}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  }).join("");
}
function buildFullLengthExportChart() {
  const entries = fullLengthEntries();
  const scoredEntries = entries.filter(([date]) => Number(fullLengthScores()[date]) >= 472);
  const scores = scoredEntries.map(([date]) => Number(fullLengthScores()[date]));
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : "--";
  const highest = scores.length ? Math.max(...scores) : "--";
  const latest = scores.length ? scores.at(-1) : "--";
  const chartWidth = 680, chartHeight = 220;
  const chartMin = scores.length ? Math.max(472, Math.min(520, Math.floor((Math.min(...scores) - 4) / 2) * 2)) : 472;
  const chartMax = scores.length ? Math.min(528, Math.max(chartMin + 8, Math.ceil((Math.max(...scores) + 4) / 2) * 2)) : 528;
  const chartRange = chartMax - chartMin;
  const points = entries.map(([date], index) => { const score = Number(fullLengthScores()[date]); return { x: 52 + index * (chartWidth - 72) / Math.max(entries.length - 1, 1), y: score >= 472 ? 202 - (Math.min(chartMax, score) - chartMin) / chartRange * 180 : null, score }; });
  const bars = points.filter(point => point.y !== null).map(point => `<rect x="${point.x - 14}" y="${point.y}" width="28" height="${202 - point.y}" rx="4" class="score-bar"/>`).join("");
  const line = points.filter(point => point.y !== null).map(point => `${point.x},${point.y}`).join(" ");
  const dots = points.map((point, index) => point.y === null ? `<circle cx="${point.x}" cy="202" r="4" class="score-dot empty"/>` : `<circle cx="${point.x}" cy="${point.y}" r="6" class="score-dot"><title>${esc(entries[index][1])}: ${point.score}</title></circle>`).join("");
  const labels = entries.map(([date, label], index) => `<text x="${points[index].x}" y="218" class="score-axis-label" text-anchor="middle">${esc(label)}</text>`).join("");
  const grid = [0, 1, 2, 3, 4].map(index => { const score = Math.round(chartMin + chartRange * index / 4); const y = 202 - (score - chartMin) / chartRange * 180; return `<line x1="52" y1="${y}" x2="${chartWidth}" y2="${y}" class="score-grid-line"/><text x="44" y="${y + 4}" class="score-axis-value" text-anchor="end">${score}</text>`; }).join("");
  const chart = `<svg class="score-chart" viewBox="0 0 ${chartWidth} ${chartHeight}"><g>${grid}<line x1="52" y1="22" x2="52" y2="202" class="score-axis-line"/><line x1="52" y1="202" x2="${chartWidth}" y2="202" class="score-axis-line"/>${bars}${line ? `<polyline points="${line}" class="score-trend-line"/>` : ""}${dots}${labels}</g></svg>`;
  const table = entries.map(([date, label]) => `<tr><th scope="row">${esc(label)}</th><td>${formatDate(parseDate(date))}</td><td>${fullLengthScores()[date] >= 472 ? fullLengthScores()[date] : "--"}</td></tr>`).join("");
  return `<h3>Full-length scores</h3><div class="score-stats"><span><strong>${scores.length}</strong><small>entered</small></span><span><strong>${average}</strong><small>average</small></span><span><strong>${highest}</strong><small>highest</small></span><span><strong>${latest}</strong><small>latest</small></span></div>${chart}<table class="score-table"><thead><tr><th>Exam</th><th>Date</th><th>Score</th></tr></thead><tbody>${table}</tbody></table>`;
}
const EXPORT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f4f7fb; color: #111827; font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .print-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .print-head h1 { margin: 0; font-size: 22px; color: #142033; }
  .print-head p { margin: 2px 0 0; color: #64748b; font-size: 12px; }
  .print-btn { border: 0; border-radius: 7px; padding: 10px 16px; background: #4f46e5; color: white; font-weight: 700; cursor: pointer; }
  .export-h2 { margin: 26px 0 14px; font-size: 19px; color: #142033; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 18px; padding: 10px 14px; background: white; border: 1px solid #dce4ec; border-radius: 8px; }
  .legend-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #334155; }
  .legend-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .month { background: white; border: 1px solid #dce4ec; border-radius: 10px; padding: 16px; margin-bottom: 22px; page-break-inside: avoid; }
  .month h2 { margin: 0 0 12px; font-size: 17px; color: #142033; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .wk { text-align: center; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; padding-bottom: 4px; }
  .cell { min-height: 92px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; background: #fbfdff; }
  .cell.outside { background: #f1f5f9; opacity: .55; }
  .cell.examday { border: 2px solid #4f46e5; }
  .num { font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 3px; }
  .chip { font-size: 9.5px; font-weight: 700; color: #1f2937; background: #eef2ff; border-left: 3px solid #94a3b8; border-radius: 3px; padding: 2px 4px; margin-bottom: 3px; }
  .chip.special { border-left-color: #4f46e5; background: #e0e7ff; color: #312e81; }
  .chip.break { border-left-color: #64748b; background: #f1f5f9; color: #334155; }
  .export-card { background: white; border: 1px solid #dce4ec; border-radius: 10px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .export-card h3 { margin: 0 0 10px; font-size: 15px; color: #142033; }
  .export-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .progress-row { margin-bottom: 10px; }
  .progress-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .progress-track { height: 8px; border-radius: 5px; background: #e2e8f0; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 5px; }
  .score-stats { display: flex; gap: 18px; margin-bottom: 10px; }
  .score-stats strong { display: block; font-size: 18px; color: #142033; }
  .score-stats small { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .score-chart, .subsection-chart { display: block; width: 100%; height: auto; overflow: visible; }
  .score-grid-line, .subsection-grid-line { stroke: #dce4ec; stroke-width: 1; stroke-dasharray: 3 4; }
  .score-axis-line { stroke: #94a3b8; stroke-width: 1.2; }
  .score-axis-value, .score-axis-label { fill: #64748b; font-size: 10px; font-weight: 700; }
  .score-bar { fill: rgba(79, 70, 229, .2); stroke: rgba(79, 70, 229, .45); stroke-width: 1; }
  .score-trend-line { fill: none; stroke: #e11d48; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .score-dot { fill: #fff; stroke: #e11d48; stroke-width: 3; }
  .score-dot.empty { fill: #cbd5e1; stroke: #94a3b8; stroke-width: 2; }
  .subsection-bar { fill: rgba(14, 116, 144, .18); stroke: rgba(14, 116, 144, .5); stroke-width: 1; }
  .subsection-trend-line { fill: none; stroke: #0e7490; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .subsection-dot { fill: white; stroke: #0e7490; stroke-width: 3; }
  .score-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  .score-table th, .score-table td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #edf1f5; }
  @media print {
    body { background: white; padding: 0; }
    .no-print { display: none; }
    .month, .export-card { page-break-inside: avoid; }
  }
`;
function importPlan(file) { const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); state = imported.setup ? { ...state, ...imported.setup, fullLengths: imported.calendar?.fullLengths || {}, tasks: imported.calendar?.tasks || {}, customTasks: imported.calendar?.customTasks || {}, completed: imported.progress?.completed || {}, fullLengthScores: imported.progress?.fullLengthScores || {}, fullLengthSectionScores: imported.progress?.fullLengthSectionScores || {}, reviews: imported.progress?.reviews || [] } : imported; state.fullLengthScores ||= {}; state.fullLengthSectionScores ||= {}; state.reviews ||= []; state.customTasks ||= {}; defaultTargets(); saveState(); render(); showToast("Plan imported."); } catch { showToast("That file is not a valid MCAT plan."); } }; reader.readAsText(file); }
function normalizeFullLengthLabels() { let changed = false; Object.keys(state.fullLengths).forEach(key => { const label = state.fullLengths[key]; if (/^FL \d+$/.test(label)) { state.fullLengths[key] = label.replace("FL ", "FL"); changed = true; } }); if (changed) saveState(); }
function fullLengthEntries() { const entries = Object.entries(state.fullLengths).filter(([, label]) => label !== "MCAT EXAM" && label !== "Unscored"); const byLabel = new Map(entries.map(entry => [entry[1], entry])); const exam = parseDate(state.examDate); if (exam) { const dayNumber = DAY_NAMES.indexOf(state.fullLengthDay); for (let i = 1; i <= 6; i++) { const label = `FL${i}`; if (byLabel.has(label)) continue; let date = addDays(exam, -(49 - i * 7)); while (date.getDay() !== dayNumber) date = addDays(date, -1); byLabel.set(label, [dateKey(date), label]); } } return [...byLabel.values()].sort(([first], [second]) => first.localeCompare(second)); }
function sectionScoreGraph(entries, key, label) { const width = 620; const height = 180; const MIN_SCORE = 118; const MAX_SCORE = 132; const scoreToY = score => 150 - (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE) * 110; const points = entries.map(([date, exam], index) => { const score = Number(state.fullLengthSectionScores[date]?.[key]); return { x: 42 + index * (width - 62) / Math.max(entries.length - 1, 1), y: score > 0 ? scoreToY(score) : null, score, exam }; }); const bars = points.filter(point => point.y !== null).map(point => `<rect x="${point.x - 13}" y="${point.y}" width="26" height="${150 - point.y}" rx="4" class="subsection-bar"/>`).join(""); const line = points.filter(point => point.y !== null).map(point => `${point.x},${point.y}`).join(" "); const dots = points.map(point => point.y === null ? `<circle cx="${point.x}" cy="150" r="4" class="score-dot empty"/>` : `<circle cx="${point.x}" cy="${point.y}" r="5" class="subsection-dot"><title>${point.exam}: ${point.score}</title></circle>`).join(""); const labels = points.map(point => `<text x="${point.x}" y="169" class="score-axis-label" text-anchor="middle">${point.exam}</text>`).join(""); const grid = [118, 122, 126, 130, 132].map(score => { const y = scoreToY(score); return `<line x1="42" y1="${y}" x2="${width}" y2="${y}" class="score-grid-line"/><text x="34" y="${y + 4}" class="score-axis-value" text-anchor="end">${score}</text>`; }).join(""); return `<svg class="subsection-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label} subsection score trend"><g>${grid}<line x1="42" y1="40" x2="42" y2="150" class="score-axis-line"/><line x1="42" y1="150" x2="${width}" y2="150" class="score-axis-line"/>${bars}${line ? `<polyline points="${line}" class="subsection-trend-line"/>` : ""}${dots}${labels}</g></svg>`; }
function enhanceSubsectionScores() { const card = document.querySelector(".full-length-card"); if (!card || card.dataset.subsectionsEnhanced) return; card.dataset.subsectionsEnhanced = "true"; const sections = [["C/P", "cp"], ["CARS", "cars"], ["B/B", "bb"], ["P/S", "ps"]]; const entries = fullLengthEntries(); const averages = sections.map(([label, key]) => { const values = entries.map(([date]) => Number(state.fullLengthSectionScores[date]?.[key])).filter(score => score > 0); const average = values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length) : "--"; return `<span><strong>${average}</strong><small>${label} avg</small></span>`; }).join(""); const inputs = entries.map(([date, label]) => `<div class="subsection-score-row"><strong>${label}</strong>${sections.map(([section, key]) => `<label>${section}<input type="number" min="0" max="132" value="${state.fullLengthSectionScores[date]?.[key] ?? ""}" data-section-score-date="${date}" data-section-score="${key}"></label>`).join("")}</div>`).join(""); const tabs = sections.map(([label, key], index) => `<button type="button" class="section-score-tab ${index === 0 ? "active" : ""}" data-section-tab="${key}">${label}</button>`).join(""); const graphs = sections.map(([label, key], index) => `<div class="subsection-graph-panel ${index === 0 ? "active" : ""}" data-section-graph="${key}">${sectionScoreGraph(entries, key, label)}</div>`).join(""); card.querySelector(".score-table-wrap").insertAdjacentHTML("afterend", `<div class="subsection-score-block"><h3>Section scores</h3><p class="muted">Enter each section score from 0 to 132.</p><div class="score-stats subsection-stats">${averages}</div><div class="section-score-tabs">${tabs}</div>${graphs}<div class="subsection-score-grid">${inputs}</div></div>`); }
function enhanceMainScoreGraph() { const card = document.querySelector(".full-length-card"); const chart = card?.querySelector(".score-chart"); if (!card || !chart || card.dataset.mainGraphEnhanced) return; card.dataset.mainGraphEnhanced = "true"; const entries = fullLengthEntries(); const sections = [["C/P", "cp"], ["CARS", "cars"], ["B/B", "bb"], ["P/S", "ps"]]; const tabs = `<button type="button" class="section-score-tab active" data-full-graph-tab="overall">Overall MCAT</button>${sections.map(([label, key]) => `<button type="button" class="section-score-tab" data-full-graph-tab="${key}">${label}</button>`).join("")}`; const graphs = `<div class="full-graph-panel active" data-full-graph="overall"></div>${sections.map(([label, key]) => `<div class="full-graph-panel" data-full-graph="${key}">${sectionScoreGraph(entries, key, label)}</div>`).join("")}`; chart.insertAdjacentHTML("beforebegin", `<div class="full-graph-area"><div class="section-score-tabs">${tabs}</div>${graphs}</div>`); card.querySelector('[data-full-graph="overall"]').appendChild(chart); card.querySelectorAll(".subsection-score-block .section-score-tabs, .subsection-score-block .subsection-graph-panel").forEach(element => element.remove()); }
let reviewFilter = "All";
function renderReview() {
  const review = document.querySelector("#review");
  if (!review) return;
  const reasons = ["Content gap", "Misread the question", "Careless mistake", "Fatigue", "Timing pressure", "Knowledge application", "Other"];
  const counts = reasons.map(reason => [reason, state.reviews.filter(item => item.reason === reason).length]).filter(([, count]) => count > 0);
  const statChips = [["All", state.reviews.length], ...counts].map(([label, count]) => `<button type="button" class="review-filter-chip ${reviewFilter === label ? "active" : ""}" data-review-filter="${esc(label)}">${esc(label)} <strong>${count}</strong></button>`).join("");
  const visibleReviews = reviewFilter === "All" ? state.reviews : state.reviews.filter(item => item.reason === reviewFilter);
  const reviews = visibleReviews.map(review => `<article class="review-item"><div><strong>${esc(review.source)}</strong><span>Question ${esc(review.question)}</span></div><div class="review-meta"><span>Chosen: ${esc(review.chosen)}</span><span>Correct: ${esc(review.correct)}</span><span>${esc(review.reason)}</span></div><p><strong>Why I chose it:</strong> ${esc(review.whyChosen)}</p><p><strong>Explanation:</strong> ${esc(review.explanation)}</p><button type="button" class="btn link" data-delete-review="${review.id}">Delete review</button></article>`).join("");
  review.innerHTML = `<div class="page-head"><div><div class="page-kicker">Review</div><h1>Question review</h1></div></div><section class="card review-card"><p class="muted">Capture the reasoning behind missed or uncertain questions so the same pattern is easier to fix.</p><div class="review-form"><label>Exam or QPack<input id="review-source" placeholder="AAMC FL1, UWorld C/P, Biology QPack"></label><label>Question #<input id="review-question" placeholder="42"></label><label>Chosen answer<input id="review-chosen" placeholder="B"></label><label>Correct answer<input id="review-correct" placeholder="D"></label><label class="review-wide">Why did you choose it?<textarea id="review-why" rows="2"></textarea></label><label>Why do you think you got it wrong?<select id="review-reason"><option>Content gap</option><option>Misread the question</option><option>Careless mistake</option><option>Fatigue</option><option>Timing pressure</option><option>Knowledge application</option><option>Other</option></select></label><label class="review-wide">Explanation to review later<textarea id="review-explanation" rows="3"></textarea></label><button type="button" class="btn primary" data-add-review>Add review</button></div></section>${state.reviews.length ? `<div class="review-filters">${statChips}</div>` : ""}<div class="review-list">${reviews || '<p class="muted">No question reviews saved yet.</p>'}</div>`;
}
function iso(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function parseDate(value) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function firstOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1, 12); }
function dateKey(date) { return iso(date); }
function addDays(date, amount) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; }
function computeStreak() { let streak = 0; for (let i = 1; i <= 400; i++) { const tasks = state.tasks[dateKey(addDays(new Date(), -i))]; if (!tasks || !tasks.length) continue; if (tasks.every(task => task.done)) streak++; else break; } return streak; }
function esc(value) { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function showToast(message) { const toast = document.querySelector("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); }
function sectionClass(section) { return section.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""); }
function targetFor(section) { return state.targets[section] ?? 0; }
function completedFor(section) { return state.completed[section] ?? 0; }
function allSections() { return [...Object.keys(TOTALS.uworld), ...Object.keys(TOTALS.aamc)]; }
function fullLengthScores() { return state.fullLengthScores ?? {}; }
function defaultTargets() {
  for (const [section, total] of Object.entries(TOTALS.uworld)) if (state.targets[section] === undefined) state.targets[section] = section === "UWorld CARS" ? total : 0;
  for (const [section, total] of Object.entries(TOTALS.aamc)) if (state.targets[section] === undefined) state.targets[section] = section === "AAMC CARS" ? total : 0;
}
defaultTargets();

function render() {
  normalizeFullLengthLabels();
  prunePostExamTasks();
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("hidden", view.id !== currentView));
  document.querySelectorAll("nav button").forEach(button => button.classList.toggle("active", button.dataset.view === currentView));
  renderToday(); renderSetup(); enhanceUnavailablePicker(); renderCalendar(); renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); renderReview();
}
function prunePostExamTasks() { const exam = parseDate(state.examDate); if (!exam) return; const examKey = dateKey(exam); let changed = false; Object.keys(state.tasks).forEach(key => { if (key >= examKey) { delete state.tasks[key]; changed = true; } }); Object.keys(state.customTasks).forEach(key => { if (key >= examKey) { delete state.customTasks[key]; changed = true; } }); if (changed) saveState(); }
function tasksForDate(key) { return [...(state.tasks[key] || []), ...(state.customTasks[key] || [])]; }
function renderToday() {
  const today = new Date(); const exam = parseDate(state.examDate); const days = exam ? Math.max(0, Math.ceil((exam - today) / 86400000)) : 0;
  const tasks = tasksForDate(dateKey(today));
  const checklist = tasks.length ? tasks.map(task => taskMarkup(task, true)).join("") : '<p class="muted">No assignments for today.</p>';
  const questions = tasks.reduce((sum, task) => sum + (task.detail.match(/^(\d+) questions$/)?.[1] ? Number(task.detail.match(/^(\d+) questions$/)[1]) : 0), 0);
  const passages = tasks.reduce((sum, task) => sum + (task.detail.match(/^(\d+) passages$/)?.[1] ? Number(task.detail.match(/^(\d+) passages$/)[1]) : 0), 0);
  const resources = [...new Set(tasks.map(task => task.section.split(" ")[0]))].join(" + ") || "No resources";
  const streak = computeStreak();
  const totalDays = exam ? Math.max(1, Math.ceil((exam - today) / 86400000)) : 1;
  const slice = Math.min(360, Math.max(0, Math.round(days / Math.max(totalDays, 1) * 360)));
  document.querySelector("#today").innerHTML = `
    <div class="page-head"><div><div class="greeting">Hello Future Doctor!</div><p class="greeting-sub">Good luck with today's assignment.</p></div><button class="btn dark" data-action="update">Update Calendar</button></div>
    <div class="exam-date-card"><div><div class="muted">MCAT exam date</div><strong>${exam ? formatDate(exam) : "Choose an exam date"}</strong></div><span class="muted">${days} days remaining</span></div>
    <section class="daily-summary"><div><strong>${questions}</strong><span>questions today</span></div><div><strong>${passages}</strong><span>passages today</span></div><div><strong>${resources}</strong><span>resources</span></div><div><strong>${streak}</strong><span>day streak</span></div></section>
    <div class="dashboard">
      <section class="card"><div class="section-title"><h2>Today's checklist</h2><p class="muted">${formatDate(today)}</p></div><div class="stack today-list">${checklist}</div></section>
      <aside class="right-panel stack"><section class="card countdown"><div class="donut" style="--slice:${slice}deg"><div class="donut-value">${days}<small> days left</small></div></div></section><section class="card"><h2>Question progress</h2>${progressMarkup("UWorld", TOTALS.uworld)}${progressMarkup("AAMC", TOTALS.aamc)}</section></aside>
    </div>`;
}
function taskMarkup(task, checkbox) {
  const resource = task.section === "Jack Westin" ? '<button type="button" class="task-resource" data-link="https://jackwestin.com/#daily-passages">Open daily passage</button>' : "";
  const identifier = task.custom ? `data-custom-task-date="${task.date}" data-custom-task-id="${task.id}"` : `data-task-date="${task.date}" data-task-index="${task.index}"`;
  const deleteButton = task.custom ? `<button type="button" class="task-delete" data-delete-task-date="${task.date}" data-delete-task-id="${task.id}" aria-label="Remove task">&times;</button>` : "";
  return `<div class="task-row"><label class="task ${task.custom ? "custom" : sectionClass(task.section)}"><input type="checkbox" ${task.done ? "checked" : ""} ${identifier}><span><strong>${esc(task.label)}</strong>${resource}</span></label>${deleteButton}</div>`;
}
function progressMarkup(title, group) { return `<div class="section-title" style="margin-top:16px"><strong>${title}</strong></div>${Object.entries(group).map(([section, total]) => { const done = completedFor(section); const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0; return `<div class="progress-row"><div class="progress-head"><span style="color:${COLORS[section]}">${esc(section.replace("UWorld ", "").replace("AAMC ", ""))}</span><span>${done} / ${total}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${COLORS[section]}"></div></div></div>`; }).join("")}`; }

function renderSetup() {
  const select = (section, total) => { const savedPercent = total ? Math.round(targetFor(section) / total * 100) : 0; return `<select>${[0, 25, 50, 75, 100].map(value => `<option value="${value}" ${value === savedPercent ? "selected" : ""}>${value}%</option>`).join("")}</select>`; };
  const targetRows = (group, key) => Object.entries(group).map(([section, total]) => `<div class="target-row"><strong style="color:${COLORS[section]}">${section}</strong><small>${total} questions</small>${select(section, total)}</div>`).join("");
  document.querySelector("#setup").innerHTML = `<div class="page-head"><div><div class="page-kicker">Plan with intention</div><h1>Build your MCAT plan</h1><p class="muted">Set targets, protected days, and your full-length weekday.</p></div><div class="head-actions"><span class="save-status">Saved automatically</span><button class="btn primary" data-action="generate">Generate Calendar</button></div></div>
    <div class="grid setup-grid"><section class="card setup-card setup-main" style="--accent:var(--teal)"><h2 class="section-title">Exam and schedule</h2><p class="muted setup-lead">Your anchor date controls every full length, break, and workload deadline.</p><div class="form-grid"><label>Exam date<input id="exam-date" type="date" value="${state.examDate}"></label><label>Full-length weekday<select id="fl-day" class="full-length-control">${DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map(day => `<option ${day === state.fullLengthDay ? "selected" : ""}>${day}</option>`).join("")}</select></label></div><div class="exam-date-card"><div><div class="muted">Selected MCAT exam date</div><strong>${state.examDate ? formatDate(parseDate(state.examDate)) : "Choose an exam date"}</strong></div></div><div class="setup-note">The day before the MCAT is automatically protected as a break.</div><h3 style="margin-top:18px">Weekly break days</h3><div class="checks">${DAY_NAMES.map(day => `<label><input type="checkbox" data-break="${day}" ${state.breaks.includes(day) ? "checked" : ""}>${day.slice(0, 3)}</label>`).join("")}</div><label style="margin-top:16px">Unavailable dates, comma-separated<textarea id="unavailable" rows="3" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:5px">${esc(state.unavailable)}</textarea></label></section>
    <section class="card setup-card setup-secondary" style="--accent:var(--uw-cp)"><h2 class="section-title">UWorld targets</h2>${targetRows(TOTALS.uworld, "uworld")}<button class="btn link" data-link="https://www.uworld.com/?srsltid=AU7gw4V3fQJIo5Tajbd8fYy4dEsrb_l3rlcHE4yjxfZssxWl5L95cHku">Open UWorld MCAT ↗</button><p class="setup-note">UWorld CARS defaults to 100%. AAMC CARS is scheduled separately as 3 passages per day.</p></section><section class="card setup-card setup-secondary" style="--accent:var(--aamc-cp)"><h2 class="section-title">AAMC targets</h2>${targetRows(Object.fromEntries(Object.entries(TOTALS.aamc).filter(([section]) => section !== "AAMC CARS")), "aamc")}<button class="btn link" data-link="https://students-residents.aamc.org/prepare-mcat-exam/aamc-mcat-official-prep-updates">Open AAMC Prep Hub ↗</button><p class="setup-note">AAMC CARS includes all 575 questions and is displayed as passages.</p></section></div>`;
}

function unavailableDates() { return state.unavailable.split(",").map(value => value.trim()).filter(Boolean).sort(); }
function enhanceUnavailablePicker() { const textarea = document.querySelector("#unavailable"); if (!textarea || textarea.dataset.enhanced) return; const label = textarea.closest("label"); textarea.dataset.enhanced = "true"; textarea.style.display = "none"; label.insertAdjacentHTML("beforeend", `<div class="unavailable-picker"><input id="unavailable-date" type="date"><button type="button" class="btn" data-add-unavailable>Add date</button></div><div class="unavailable-list">${unavailableDates().map(date => `<button type="button" class="unavailable-chip" data-remove-unavailable="${date}">${date} <span aria-hidden="true">&times;</span></button>`).join("") || '<span class="muted">No unavailable dates added.</span>'}</div><small class="muted">Use the date picker to add individual dates, or edit the saved list if needed.</small>`); }

function readSetup() {
  const examDate = document.querySelector("#exam-date");
  const fullLengthDay = document.querySelector("#fl-day");
  const unavailable = document.querySelector("#unavailable");
  if (!examDate || !fullLengthDay || !unavailable) return;
  state.examDate = examDate.value;
  state.fullLengthDay = fullLengthDay.value;
  state.unavailable = unavailable.value;
  state.breaks = [...document.querySelectorAll("[data-break]:checked")].map(input => input.dataset.break);
  const selects = document.querySelectorAll(".target-row select");
  const sections = [...document.querySelectorAll(".target-row strong")].map(el => el.textContent);
  selects.forEach((select, index) => { state.targets[sections[index]] = Math.round(TOTALS.uworld[sections[index]] || TOTALS.aamc[sections[index]] || 0) * Number(select.value) / 100; });
}
function generatePlan() { readSetup(); const exam = parseDate(state.examDate); if (!exam || exam <= new Date()) return showToast("Choose a future exam date."); state.fullLengths = {}; const dayNumber = DAY_NAMES.indexOf(state.fullLengthDay); for (let i = 0; i < 7; i++) { let date = addDays(exam, -(49 - i * 7)); while (date.getDay() !== dayNumber) date = addDays(date, -1); if (date > new Date()) state.fullLengths[dateKey(date)] = ["Unscored", "FL 1", "FL 2", "FL 3", "FL 4", "FL 5", "FL 6"][i]; } state.fullLengths[state.examDate] = "MCAT EXAM"; state.tasks = buildTasks(exam); saveState(); displayedMonth = firstOfMonth(new Date()); currentView = "today"; render(); showToast("Calendar generated."); }
function availableDays(exam) { const days = []; const start = new Date(); start.setHours(12, 0, 0, 0); const unavailable = state.unavailable.split(",").map(value => value.trim()).filter(Boolean); for (let date = start; date < exam; date = addDays(date, 1)) { const key = dateKey(date); const preExam = key === dateKey(addDays(exam, -1)); if (!unavailable.includes(key) && !state.breaks.includes(DAY_NAMES[date.getDay()]) && !preExam && !state.fullLengths[key]) days.push(date); } return days; }
function firstFullLengthDate() { const dates = Object.entries(state.fullLengths).filter(([, label]) => label !== "MCAT EXAM").map(([key]) => key).sort(); return dates.length ? parseDate(dates[0]) : null; }
function buildTasks(exam) {
  const tasks = {};
  const days = availableDays(exam);
  const aamcCars = Math.ceil(575 / 9);
  const carsDays = Math.min(days.length, Math.ceil(aamcCars / 3));
  const carsRate = carsDays < Math.ceil(aamcCars / 3) ? Math.ceil(aamcCars / carsDays) : 3;
  let remainingCars = aamcCars;

  const uworldSections = Object.keys(TOTALS.uworld).filter(section => section !== "UWorld CARS");
  const aamcSections = Object.keys(TOTALS.aamc).filter(section => section !== "AAMC CARS");
  const uworldRemaining = uworldSections.reduce((sum, section) => sum + Math.max(0, targetFor(section) - completedFor(section)), 0);
  // full-length exams mark the point where AAMC review should take over from UWorld
  const flStart = firstFullLengthDate();
  const preFLDays = flStart ? days.filter(date => date < flStart).length : days.length;
  const idealUworldDays = 45; // roughly a month and a half of dedicated UWorld time
  const uworldMinDays = uworldRemaining ? Math.max(1, Math.ceil(uworldRemaining / 75)) : 0;
  const uworldDays = uworldRemaining ? Math.min(days.length, Math.max(uworldMinDays, Math.min(idealUworldDays, Math.max(preFLDays, uworldMinDays)))) : 0;
  // delay UWorld's start so it wraps up right as full lengths begin instead of finishing early and leaving a gap
  const uworldStart = Math.max(0, Math.min(preFLDays, days.length) - uworldDays);
  const uworldEnd = uworldStart + uworldDays;
  const aamcStart = Math.min(days.length, Math.max(0, uworldEnd - 7));
  const aamcEnd = days.length;

  // each day is dedicated to one section only, rotating day-to-day so the biggest section (C/P) comes up most often
  const scheduleSections = (sections, start, end) => {
    const active = sections.filter(section => targetFor(section) > completedFor(section));
    if (!active.length) return;
    const scheduleEnd = Math.min(end, days.length);
    const window = Math.max(0, scheduleEnd - start);
    if (!window) return;
    const remainingBySection = new Map(active.map(section => [section, Math.max(0, targetFor(section) - completedFor(section))]));
    const totalRemaining = [...remainingBySection.values()].reduce((sum, value) => sum + value, 0);
    // largest remainder method: give every section at least one day, then split the rest by its share of the remaining work
    const rawShares = active.map(section => remainingBySection.get(section) / totalRemaining * window);
    const dayCounts = new Map(active.map((section, index) => [section, Math.max(1, Math.floor(rawShares[index]))]));
    let assignedDays = [...dayCounts.values()].reduce((sum, value) => sum + value, 0);
    const remainders = active.map((section, index) => ({ section, remainder: rawShares[index] - Math.floor(rawShares[index]) })).sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; assignedDays < window; i++, assignedDays++) dayCounts.set(remainders[i % remainders.length].section, dayCounts.get(remainders[i % remainders.length].section) + 1);
    // smooth weighted round-robin (nginx-style) picks a section for each day proportional to its remaining day count
    const currentWeight = new Map(active.map(section => [section, 0]));
    const daysLeftForSection = new Map(dayCounts);
    for (let i = start; i < scheduleEnd; i++) {
      let picked = null;
      active.forEach(section => {
        if (daysLeftForSection.get(section) <= 0) return;
        currentWeight.set(section, currentWeight.get(section) + dayCounts.get(section));
        if (!picked || currentWeight.get(section) > currentWeight.get(picked)) picked = section;
      });
      if (!picked) break;
      currentWeight.set(picked, currentWeight.get(picked) - window);
      const remaining = remainingBySection.get(picked);
      const amount = Math.max(1, Math.ceil(remaining / daysLeftForSection.get(picked)));
      addTask(tasks, days[i], picked, `${amount} questions`);
      remainingBySection.set(picked, remaining - amount);
      daysLeftForSection.set(picked, daysLeftForSection.get(picked) - 1);
    }
  };

  // P/S joins the same C/P + B/B rotation, but only becomes eligible partway through so it enters late in the cycle
  const psSection = "UWorld P/S";
  const primaryUworldSections = uworldSections.filter(section => section !== psSection);
  const psRemaining = Math.max(0, targetFor(psSection) - completedFor(psSection));
  const psPace = 45;
  const psActiveDays = psRemaining ? Math.max(1, Math.ceil(psRemaining / psPace)) : 0;
  const psEntry = psRemaining ? Math.max(uworldStart, uworldEnd - psActiveDays) : uworldEnd;
  const uworldParticipants = [
    ...primaryUworldSections.filter(section => targetFor(section) > completedFor(section)).map(section => ({ section, entry: uworldStart })),
    ...(psRemaining > 0 ? [{ section: psSection, entry: psEntry }] : [])
  ];
  if (uworldParticipants.length) {
    const remainingBySection = new Map(uworldParticipants.map(participant => [participant.section, Math.max(0, targetFor(participant.section) - completedFor(participant.section))]));
    const currentWeight = new Map(uworldParticipants.map(participant => [participant.section, 0]));
    for (let i = uworldStart; i < uworldEnd; i++) {
      const eligible = uworldParticipants.filter(participant => i >= participant.entry && remainingBySection.get(participant.section) > 0);
      if (!eligible.length) continue;
      let picked = null;
      eligible.forEach(participant => {
        currentWeight.set(participant.section, currentWeight.get(participant.section) + remainingBySection.get(participant.section));
        if (!picked || currentWeight.get(participant.section) > currentWeight.get(picked)) picked = participant.section;
      });
      const totalEligibleRemaining = eligible.reduce((sum, participant) => sum + remainingBySection.get(participant.section), 0);
      currentWeight.set(picked, currentWeight.get(picked) - totalEligibleRemaining);
      const remaining = remainingBySection.get(picked);
      const amount = Math.max(1, Math.ceil(remaining / (uworldEnd - i)));
      addTask(tasks, days[i], picked, `${amount} questions`);
      remainingBySection.set(picked, remaining - amount);
    }
  }
  scheduleSections(aamcSections, aamcStart, aamcEnd);
  for (let i = days.length - 1; i >= Math.max(0, days.length - carsDays); i--) {
    const count = Math.min(carsRate, remainingCars);
    addTask(tasks, days[i], "AAMC CARS", `${count} passages`);
    remainingCars -= count;
  }
  // once UWorld is done, re-review it (amount scaled to the target percentages) but stop ~3 weeks before the exam so the final stretch is AAMC/FL-only
  const uworldHasContent = uworldSections.some(section => targetFor(section) > 0);
  if (uworldHasContent) {
    const uworldTotalTarget = uworldSections.reduce((sum, section) => sum + targetFor(section), 0);
    const reviewAmount = Math.max(10, Math.round(uworldTotalTarget / idealUworldDays));
    const reviewCutoff = addDays(exam, -21);
    const reviewEnd = days.filter(date => date < reviewCutoff).length;
    days.forEach((date, index) => {
      if (index < uworldEnd || index >= reviewEnd) return;
      const key = dateKey(date);
      if ((tasks[key] || []).some(task => uworldSections.includes(task.section) || aamcSections.includes(task.section))) return;
      addTask(tasks, date, "Re-Review UWorld Questions", `${reviewAmount} questions`);
    });
  }
  days.forEach((date, index) => {
    if (!(tasks[dateKey(date)] || []).some(task => task.section === "AAMC CARS")) addTask(tasks, date, "Jack Westin", `${index === 0 ? 2 : 3} passages`);
  });
  return tasks;
}
function addTask(tasks, date, section, detail) { const key = dateKey(date); if (!tasks[key]) tasks[key] = []; tasks[key].push({ date: key, section, label: `${section}: ${detail}`, detail, done: false, index: tasks[key].length }); }
function addCustomTask() {
  const dateInput = document.querySelector("#custom-task-date");
  const titleInput = document.querySelector("#custom-task-title");
  const detailInput = document.querySelector("#custom-task-detail");
  if (!dateInput || !titleInput) return;
  const date = parseDate(dateInput.value);
  const title = titleInput.value.trim();
  const detail = detailInput.value.trim();
  if (!date || !title) return showToast("Add a date and a title first.");
  const key = dateKey(date);
  state.customTasks[key] ||= [];
  state.customTasks[key].push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: key, section: title, label: detail ? `${title}: ${detail}` : title, detail, done: false, custom: true });
  saveState();
  render();
  showToast("Added to your calendar.");
}
function deleteCustomTask(date, id) {
  if (!state.customTasks[date]) return;
  state.customTasks[date] = state.customTasks[date].filter(task => String(task.id) !== String(id));
  if (!state.customTasks[date].length) delete state.customTasks[date];
  saveState();
  render();
  showToast("Task removed.");
}
function customTaskList() {
  const entries = Object.values(state.customTasks).flat().sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return '<p class="muted" style="margin-top:12px">No personal study blocks added yet.</p>';
  return `<div class="custom-task-list">${entries.map(task => `<div class="custom-task-item"><div><strong>${esc(formatDate(parseDate(task.date)))}</strong><span>${esc(task.label)}</span></div><button type="button" class="task-delete" data-delete-task-date="${task.date}" data-delete-task-id="${task.id}" aria-label="Remove task">&times;</button></div>`).join("")}</div>`;
}
function formatDate(date) { return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); }

function renderCalendar() { const container = document.querySelector("#calendar"); const monthName = displayedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" }); const first = firstOfMonth(displayedMonth); const start = addDays(first, -((first.getDay() + 6) % 7)); const exam = parseDate(state.examDate); let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `<div class="weekday">${day}</div>`).join(""); for (let i = 0; i < 42; i++) { const date = addDays(start, i); const key = dateKey(date); const outside = date.getMonth() !== displayedMonth.getMonth(); const special = state.fullLengths[key]; const tasks = tasksForDate(key); let body = tasks.map(task => `<div class="day-task" style="color:${task.custom ? "#7c3aed" : task.section === "Jack Westin" ? "#475569" : COLORS[task.section] || "var(--muted)"}">${esc(task.label)}</div>`).join(""); if (special) body = `<div class="day special" style="color:#4f46e5">${esc(special)}</div>`; if (key === dateKey(addDays(exam, -1))) body = `<div class="day special" style="color:#64748b">BREAK</div>`; cells += `<div class="day ${outside ? "outside" : ""}"><div class="day-number">${date.getDate()}</div>${body || "<span class='muted'>No assignments</span>"}</div>`; } container.innerHTML = `<div class="page-head"><div><h1>Study calendar</h1><p class="muted">${exam ? `${Math.max(0, Math.ceil((exam - new Date()) / 86400000))} days until exam` : "Generate a plan first"}</p></div><button class="btn dark" data-action="update">Update Calendar</button></div><section class="card custom-task-card"><h2 class="section-title">Add a personal study block</h2><p class="muted">Block time for outside resources like Kaplan, Blueprint, Anki, or tutoring. These stick around even when you regenerate your calendar.</p><div class="custom-task-form"><label>Date<input id="custom-task-date" type="date" value="${dateKey(new Date())}"></label><label>Title<input id="custom-task-title" placeholder="Kaplan"></label><label>Details<input id="custom-task-detail" placeholder="2 hours, Chapter 4"></label><button type="button" class="btn primary" data-add-custom-task>Add to calendar</button></div>${customTaskList()}</section><section class="card"><div class="calendar-head"><button class="btn" data-month="-1">&larr;</button><h2>${monthName}</h2><button class="btn" data-month="1">&rarr;</button></div><div class="legend"><span class="blue">UWorld C/P</span><span class="green">UWorld B/B</span><span class="red">AAMC C/P / CARS</span><span class="orange">AAMC Independent</span><span style="color:#7c3aed;font-weight:800">Personal blocks</span></div><div class="month-grid">${cells}</div></section>`; }
function renderProgress() { const container = document.querySelector("#progress"); const completed = allSections().reduce((sum, section) => sum + completedFor(section), 0); const total = allSections().reduce((sum, section) => sum + (TOTALS.uworld[section] || TOTALS.aamc[section] || 0), 0); const pct = total ? Math.round(completed / total * 100) : 0; container.innerHTML = `<div class="page-head"><div><div class="page-kicker">Keep the momentum visible</div><h1>Progress dashboard</h1><p class="muted">Track question completion first, then review full-length performance.</p></div><div style="text-align:right"><span class="completion-chip">${completed.toLocaleString()} / ${total.toLocaleString()} complete</span><button class="btn dark" data-action="update" style="display:block;margin-top:9px">Update Calendar</button></div></div><section class="card" style="margin-bottom:16px;background:linear-gradient(110deg,#142033,#23415d);color:white"><div style="display:flex;justify-content:space-between;gap:14px;align-items:end"><div><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9fd5de;font-weight:800">Overall completion</div><div style="font-size:34px;font-weight:800;margin-top:4px">${pct}%</div></div><div style="text-align:right;color:#c9d7e5;font-size:12px">Questions completed across<br>UWorld and AAMC.</div></div><div class="progress-track" style="margin-top:16px;background:#36526e"><div class="progress-fill" style="width:${pct}%;background:#8ce1d6"></div></div></section><div class="progress-sections"><div class="grid two">${progressCard("UWorld", TOTALS.uworld, "var(--uw-cp)")}${progressCard("AAMC", TOTALS.aamc, "var(--aamc-cp)")}</div><section class="card progress-card full-length-card" style="--accent:#4f46e5">${fullLengthProgressMarkup()}</section></div>`; }
function fullLengthProgressMarkup() { const entries = Object.entries(state.fullLengths).filter(([, label]) => label !== "MCAT EXAM"); const scores = entries.map(([date]) => Number(fullLengthScores()[date])).filter(score => Number.isFinite(score) && score > 0); const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : "--"; const highest = scores.length ? Math.max(...scores) : "--"; const latest = scores.length ? scores.at(-1) : "--"; const chartWidth = 680; const chartHeight = 220; const points = entries.map(([date], index) => { const score = Number(fullLengthScores()[date]); return { x: 52 + index * (chartWidth - 72) / Math.max(entries.length - 1, 1), y: score > 0 ? 202 - score / 528 * 180 : null, score }; }); const line = points.filter(point => point.y !== null).map(point => `${point.x},${point.y}`).join(" "); const dots = points.map((point, index) => point.y === null ? `<circle cx="${point.x}" cy="202" r="4" class="score-dot empty"/>` : `<circle cx="${point.x}" cy="${point.y}" r="6" class="score-dot" tabindex="0"><title>${esc(entries[index][1])}: ${point.score}</title></circle>`).join(""); const labels = entries.map(([date, label], index) => `<text x="${points[index].x}" y="218" class="score-axis-label" text-anchor="middle">${esc(label.replace("Unscored", "US"))}</text>`).join(""); const grid = [0, 132, 264, 396, 528].map(score => { const y = 202 - score / 528 * 180; return `<line x1="52" y1="${y}" x2="${chartWidth}" y2="${y}" class="score-grid-line"/><text x="44" y="${y + 4}" class="score-axis-value" text-anchor="end">${score}</text>`; }).join(""); const chart = `<svg class="score-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Full-length score trend from 0 to 528"><g>${grid}<line x1="52" y1="22" x2="52" y2="202" class="score-axis-line"/><line x1="52" y1="202" x2="${chartWidth}" y2="202" class="score-axis-line"/>${line ? `<polyline points="${line}" class="score-trend-line"/>` : ""}${dots}${labels}</g></svg>`; const table = entries.map(([date, label]) => `<tr><th scope="row">${esc(label)}</th><td>${formatDate(parseDate(date))}</td><td>${fullLengthScores()[date] ?? "--"}</td></tr>`).join(""); return `<h2 class="section-title">Full-length scores</h2><p class="muted">Enter each practice score from 0 to 528.</p><div class="score-stats"><span><strong>${scores.length}</strong><small>entered</small></span><span><strong>${average}</strong><small>average</small></span><span><strong>${highest}</strong><small>highest</small></span><span><strong>${latest}</strong><small>latest</small></span></div>${chart}<div class="score-table-wrap"><table class="score-table"><thead><tr><th>Exam</th><th>Date</th><th>Score</th></tr></thead><tbody>${table}</tbody></table></div><div class="score-grid">${entries.length ? entries.map(([date, label]) => `<label class="score-input"><span>${esc(label)}<small>${formatDate(parseDate(date))}</small></span><input type="number" min="0" max="528" value="${fullLengthScores()[date] ?? ""}" data-score-date="${date}"></label>`).join("") : ""}</div>`; }
function fullLengthProgressMarkup() {
  const entries = fullLengthEntries();
  const scoredEntries = entries.filter(([date]) => Number(fullLengthScores()[date]) >= 472);
  const scores = scoredEntries.map(([date]) => Number(fullLengthScores()[date]));
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : "--"; 
  const highest = scores.length ? Math.max(...scores) : "--";
  const latest = scores.length ? scores.at(-1) : "--";
  const chartWidth = 680;
  const chartHeight = 220;
  const chartMin = scores.length ? Math.max(472, Math.min(520, Math.floor((Math.min(...scores) - 4) / 2) * 2)) : 472;
  const chartMax = scores.length ? Math.min(528, Math.max(chartMin + 8, Math.ceil((Math.max(...scores) + 4) / 2) * 2)) : 528;
  const chartRange = chartMax - chartMin;
    const points = entries.map(([date], index) => {
      const score = Number(fullLengthScores()[date]);
      return { x: 52 + index * (chartWidth - 72) / Math.max(entries.length - 1, 1), y: score >= 472 ? 202 - (Math.min(chartMax, score) - chartMin) / chartRange * 180 : null, score };
    });
  const bars = points.filter(point => point.y !== null).map(point => `<rect x="${point.x - 14}" y="${point.y}" width="28" height="${202 - point.y}" rx="4" class="score-bar"/>`).join("");
  const line = points.filter(point => point.y !== null).map(point => `${point.x},${point.y}`).join(" ");
  const dots = points.map((point, index) => point.y === null ? `<circle cx="${point.x}" cy="202" r="4" class="score-dot empty"/>` : `<circle cx="${point.x}" cy="${point.y}" r="6" class="score-dot" tabindex="0"><title>${esc(entries[index][1])}: ${point.score}</title></circle>`).join("");
  const labels = entries.map(([date, label], index) => `<text x="${points[index].x}" y="218" class="score-axis-label" text-anchor="middle">${esc(label)}</text>`).join("");
  const grid = [0, 1, 2, 3, 4].map(index => { const score = Math.round(chartMin + chartRange * index / 4); const y = 202 - (score - chartMin) / chartRange * 180; return `<line x1="52" y1="${y}" x2="${chartWidth}" y2="${y}" class="score-grid-line"/><text x="44" y="${y + 4}" class="score-axis-value" text-anchor="end">${score}</text>`; }).join("");
  const chart = `<svg class="score-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Full-length score trend from ${chartMin} to ${chartMax}"><g>${grid}<line x1="52" y1="22" x2="52" y2="202" class="score-axis-line"/><line x1="52" y1="202" x2="${chartWidth}" y2="202" class="score-axis-line"/>${bars}${line ? `<polyline points="${line}" class="score-trend-line"/>` : ""}${dots}${labels}</g></svg>`;
  const table = entries.map(([date, label]) => `<tr><th scope="row">${esc(label)}</th><td>${formatDate(parseDate(date))}</td><td>${fullLengthScores()[date] >= 472 ? fullLengthScores()[date] : "--"}</td></tr>`).join("");
  return `<h2 class="section-title">Full-length scores</h2><p class="muted">Enter each practice score from 472 to 528. Unscored remains part of your calendar but is excluded from statistics.</p><div class="score-stats"><span><strong>${scores.length}</strong><small>entered</small></span><span><strong>${average}</strong><small>average</small></span><span><strong>${highest}</strong><small>highest</small></span><span><strong>${latest}</strong><small>latest</small></span></div>${chart}<div class="score-table-wrap"><table class="score-table"><thead><tr><th>Exam</th><th>Date</th><th>Score</th></tr></thead><tbody>${table}</tbody></table></div><div class="score-grid">${entries.map(([date, label]) => `<label class="score-input"><span>${esc(label)}<small>${formatDate(parseDate(date))}</small></span><input type="number" min="472" max="528" value="${fullLengthScores()[date] ?? ""}" data-score-date="${date}"></label>`).join("")}</div>`;
}
function progressCard(title, group, accent) { const groupTotal = Object.values(group).reduce((sum, total) => sum + total, 0); const groupCompleted = Object.keys(group).reduce((sum, section) => sum + completedFor(section), 0); const groupPct = groupTotal ? Math.round(groupCompleted / groupTotal * 100) : 0; return `<section class="card progress-card" style="--accent:${accent}"><h2 class="section-title">${title} questions</h2><div class="question-stats"><strong>${groupCompleted.toLocaleString()} / ${groupTotal.toLocaleString()}</strong><span>${groupPct}% complete</span></div><p class="muted" style="margin-bottom:8px">Enter completed questions by subsection.</p>${Object.entries(group).map(([section, total]) => `<label class="progress-input"><span><span style="display:block;color:${COLORS[section]};font-weight:800">${esc(section)}</span><span class="muted">Target: ${total.toLocaleString()} questions</span></span><input type="number" min="0" max="${total}" value="${completedFor(section)}" data-completed="${esc(section)}"></label>`).join("")}</section>`; }
function recordCompletedTasks() { Object.values(state.tasks).flat().forEach(task => { if (!task.done || task.counted || !/^\d+ questions$/.test(task.detail)) return; const amount = Number(task.detail.match(/\d+/)[0]); const total = TOTALS.uworld[task.section] || TOTALS.aamc[task.section] || 0; state.completed[task.section] = Math.min(total, completedFor(task.section) + amount); task.counted = true; }); }
function updateCalendar() { if (!state.examDate || !Object.keys(state.tasks).length) return showToast("Generate a calendar first."); recordCompletedTasks(); document.querySelectorAll("[data-completed]").forEach(input => state.completed[input.dataset.completed] = Math.max(0, Math.min(Number(input.max), Number(input.value) || 0))); saveState(); generatePlan(); showToast("Calendar updated from completed work."); }

document.addEventListener("click", event => { const view = event.target.closest("[data-view]"); if (view) { currentView = view.dataset.view; render(); return; } const link = event.target.closest("[data-link]"); if (link) window.open(link.dataset.link, "_blank", "noopener"); const action = event.target.closest("[data-action]"); if (action?.dataset.action === "generate") generatePlan(); if (action?.dataset.action === "update") updateCalendar(); if (action?.dataset.action === "export") exportPlan(); if (action?.dataset.action === "export-calendar") exportCombinedReport(); const filter = event.target.closest("[data-review-filter]"); if (filter) { reviewFilter = filter.dataset.reviewFilter; renderReview(); } const month = event.target.closest("[data-month]"); if (month) { displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + Number(month.dataset.month), 1, 12); renderCalendar(); } const addCustom = event.target.closest("[data-add-custom-task]"); if (addCustom) addCustomTask(); const deleteTask = event.target.closest("[data-delete-task-date]"); if (deleteTask) deleteCustomTask(deleteTask.dataset.deleteTaskDate, deleteTask.dataset.deleteTaskId); });
document.addEventListener("change", event => { if (event.target.matches("[data-task-date]")) { const task = state.tasks[event.target.dataset.taskDate]?.[Number(event.target.dataset.taskIndex)]; if (task) { task.done = event.target.checked; saveState(); showToast(event.target.checked ? "Task marked complete." : "Task reopened."); } } });
document.addEventListener("change", event => { if (event.target.matches("[data-custom-task-date]")) { const task = state.customTasks[event.target.dataset.customTaskDate]?.find(item => String(item.id) === event.target.dataset.customTaskId); if (task) { task.done = event.target.checked; saveState(); showToast(event.target.checked ? "Task marked complete." : "Task reopened."); } } });
document.addEventListener("change", event => { if (event.target.matches("[data-completed]")) { state.completed[event.target.dataset.completed] = Math.max(0, Math.min(Number(event.target.max), Number(event.target.value) || 0)); saveState(); renderToday(); } });
document.addEventListener("change", event => { if (event.target.matches("[data-score-date]")) { const score = Number(event.target.value); if (event.target.value === "") delete state.fullLengthScores[event.target.dataset.scoreDate]; else state.fullLengthScores[event.target.dataset.scoreDate] = Math.max(0, Math.min(528, score || 0)); saveState(); renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); showToast("Full-length score saved."); } });
document.addEventListener("change", event => { if (event.target.matches("[data-section-score-date]")) { const date = event.target.dataset.sectionScoreDate; const key = event.target.dataset.sectionScore; state.fullLengthSectionScores[date] ||= {}; if (event.target.value === "") delete state.fullLengthSectionScores[date][key]; else state.fullLengthSectionScores[date][key] = Math.max(0, Math.min(132, Number(event.target.value) || 0)); saveState(); renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); showToast("Section score saved."); } });
document.addEventListener("click", event => { const tab = event.target.closest("[data-section-tab]"); if (!tab) return; const block = tab.closest(".subsection-score-block"); block.querySelectorAll("[data-section-tab]").forEach(button => button.classList.toggle("active", button === tab)); block.querySelectorAll("[data-section-graph]").forEach(graph => graph.classList.toggle("active", graph.dataset.sectionGraph === tab.dataset.sectionTab)); });
document.addEventListener("click", event => { const tab = event.target.closest("[data-full-graph-tab]"); if (!tab) return; const area = tab.closest(".full-graph-area"); area.querySelectorAll("[data-full-graph-tab]").forEach(button => button.classList.toggle("active", button === tab)); area.querySelectorAll("[data-full-graph]").forEach(graph => graph.classList.toggle("active", graph.dataset.fullGraph === tab.dataset.fullGraphTab)); });
document.addEventListener("click", event => { const add = event.target.closest("[data-add-review]"); if (add) { const source = document.querySelector("#review-source").value.trim(); const question = document.querySelector("#review-question").value.trim(); if (!source || !question) return showToast("Add the exam or QPack and question number first."); state.reviews.unshift({ id: Date.now(), source, question, chosen: document.querySelector("#review-chosen").value.trim() || "--", correct: document.querySelector("#review-correct").value.trim() || "--", whyChosen: document.querySelector("#review-why").value.trim() || "Not recorded", reason: document.querySelector("#review-reason").value, explanation: document.querySelector("#review-explanation").value.trim() || "Not recorded" }); saveState(); render(); showToast("Question review saved."); } const remove = event.target.closest("[data-delete-review]"); if (remove) { state.reviews = state.reviews.filter(review => String(review.id) !== remove.dataset.deleteReview); saveState(); render(); showToast("Question review deleted."); } });
document.addEventListener("change", event => { if (event.target.closest("#setup")) { readSetup(); saveState(); showToast("Setup saved automatically."); } });
document.addEventListener("input", event => { if (event.target.closest("#setup")) { readSetup(); saveState(); } });
document.addEventListener("change", event => { if (event.target.matches("#import-data") && event.target.files[0]) importPlan(event.target.files[0]); });
document.addEventListener("click", event => { const add = event.target.closest("[data-add-unavailable]"); if (add) { const input = document.querySelector("#unavailable-date"); if (!input.value) return; state.unavailable = [...new Set([...unavailableDates(), input.value])].sort().join(", "); saveState(); render(); showToast("Unavailable date added."); } const remove = event.target.closest("[data-remove-unavailable]"); if (remove) { state.unavailable = unavailableDates().filter(date => date !== remove.dataset.removeUnavailable).join(", "); saveState(); render(); showToast("Unavailable date removed."); } });
render();
