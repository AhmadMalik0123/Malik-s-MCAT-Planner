const TOTALS = {
  uworld: { "UWorld C/P": 1192, "UWorld B/B": 875, "UWorld CARS": 463, "UWorld P/S": 289 },
  aamc: { "AAMC Biology/Biochem.": 340, "AAMC C/P": 340, "AAMC Independent": 150, "AAMC CARS": 575 }
};
const COLORS = {
  "UWorld C/P": "var(--uw-cp)", "UWorld B/B": "var(--uw-bb)", "UWorld CARS": "var(--uw-cars)", "UWorld P/S": "var(--uw-ps)",
  "AAMC Biology/Biochem.": "var(--aamc-bio)", "AAMC C/P": "var(--aamc-cp)", "AAMC Independent": "var(--aamc-independent)", "AAMC CARS": "var(--aamc-cars)",
  "Jack Westin": "var(--jw)", "Anki Flashcards": "var(--anki)", "Re-Review UWorld Questions": "var(--rereview)",
  "Content B/B": "var(--content-bb)", "Content C/P": "var(--content-cp)", "Content P/S": "var(--content-ps)"
};
const LEGEND = [
  ["UWorld C/P", "UWorld C/P"], ["UWorld B/B", "UWorld B/B"], ["UWorld P/S", "UWorld P/S"], ["CARS", "UWorld CARS"],
  ["AAMC Bio/Biochem", "AAMC Biology/Biochem."], ["AAMC C/P", "AAMC C/P"], ["AAMC Independent", "AAMC Independent"],
  ["Content B/B", "Content B/B"], ["Content C/P", "Content C/P"], ["Content P/S", "Content P/S"],
  ["Jack Westin", "Jack Westin"], ["Anki", "Anki Flashcards"], ["Re-Review", "Re-Review UWorld Questions"]
];
function colorFor(task) { return task.custom ? "var(--custom)" : COLORS[task.section] || "var(--muted)"; }
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STORAGE_KEY = "mcat-prep-plan-v1";
let state = loadState();
let currentView = "today";
let displayedMonth = firstOfMonth(new Date());
state.fullLengthScores ||= {};
state.fullLengthSectionScores ||= {};
state.reviews ||= [];
state.customTasks ||= {};
state.content ||= { schedule: true, pace: "auto", resources: [] };
state.contentDone ||= {};
(state.content.resources || []).forEach(resource => {
  const isKhanVideos = /khan/i.test(resource.title || "") && /video/i.test(resource.title || "");
  if (!isKhanVideos) return;
  if (resource.section === "ps") {
    if (resource.kit !== "khan-ps" || resource.unitLabel !== "Video" || [12, 291].includes(Number(resource.count))) { resource.kit = "khan-ps"; resource.unitLabel = "Video"; resource.count = 259; resource.effort ||= 0.065; }
  } else if (!resource.kit) { resource.kit = "khan"; resource.unitLabel = "Video"; }
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const exam = new Date(); exam.setDate(exam.getDate() + 100);
  return { examDate: iso(exam), fullLengthDay: "Saturday", breaks: [], unavailable: "", targets: {}, completed: {}, tasks: {}, fullLengths: {}, fullLengthScores: {}, fullLengthSectionScores: {}, reviews: [], customTasks: {} };
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function exportPlan() { const exportData = { exportedAt: new Date().toISOString(), setup: { examDate: state.examDate, fullLengthDay: state.fullLengthDay, breaks: state.breaks, unavailable: state.unavailable, targets: state.targets, content: state.content }, calendar: { fullLengths: state.fullLengths, tasks: state.tasks, customTasks: state.customTasks }, progress: { completed: state.completed, fullLengthScores: state.fullLengthScores, fullLengthSectionScores: state.fullLengthSectionScores, reviews: state.reviews, contentDone: state.contentDone } }; const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "mcat-calendar-progress.json"; link.click(); URL.revokeObjectURL(link.href); showToast("Calendar and progress exported."); }
const EXPORT_COLORS = {
  "UWorld C/P": "#2563eb", "UWorld B/B": "#059669", "UWorld CARS": "#c2410c", "UWorld P/S": "#7c3aed",
  "AAMC Biology/Biochem.": "#0d9488", "AAMC C/P": "#dc2626", "AAMC Independent": "#d97706", "AAMC CARS": "#c2410c",
  "Content B/B": "#65a30d", "Content C/P": "#0891b2", "Content P/S": "#c026d3"
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>MCAT Planner Export</title><style>${EXPORT_CSS}</style></head><body>
    <header class="print-head"><h1>MCAT Planner</h1><p>Exported ${formatDate(new Date())} &mdash; calendar and progress through ${formatDate(exam)}</p><button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button></header>
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
    let chips = tasks.map(task => `<div class="chip" style="border-left-color:${task.custom ? "#7c3aed" : task.section === "Jack Westin" ? "#475569" : (EXPORT_COLORS[task.section] || "#94a3b8")}">${esc(displayLabel(task))}</div>`).join("");
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
function importPlan(file) { const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); state = imported.setup ? { ...state, ...imported.setup, fullLengths: imported.calendar?.fullLengths || {}, tasks: imported.calendar?.tasks || {}, customTasks: imported.calendar?.customTasks || {}, completed: imported.progress?.completed || {}, fullLengthScores: imported.progress?.fullLengthScores || {}, fullLengthSectionScores: imported.progress?.fullLengthSectionScores || {}, reviews: imported.progress?.reviews || [], contentDone: imported.progress?.contentDone || {} } : imported; state.content ||= { schedule: true, pace: "auto", resources: [] }; state.contentDone ||= {}; state.fullLengthScores ||= {}; state.fullLengthSectionScores ||= {}; state.reviews ||= []; state.customTasks ||= {}; defaultTargets(); saveState(); render(); showToast("Plan imported."); } catch { showToast("That file is not a valid MCAT plan."); } }; reader.readAsText(file); }
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
let toastTimer = null;
function showToast(message) { const toast = document.querySelector("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200); }
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

function render(forceEnter = false) {
  normalizeFullLengthLabels();
  prunePostExamTasks();
  // Only build the view that's on screen. Hidden views are emptied so stale inputs (e.g. old setup values) can never be read back.
  document.querySelectorAll(".view").forEach(view => { const active = view.id === currentView; view.classList.toggle("hidden", !active); if (!active) view.innerHTML = ""; });
  document.querySelectorAll("nav button").forEach(button => button.classList.toggle("active", button.dataset.view === currentView));
  const entering = forceEnter || currentView !== lastRenderedView;
  lastRenderedView = currentView;
  if (entering && currentView === "today") lastRingPct = 0;
  VIEW_RENDERERS[currentView]?.();
  moveNavIndicator();
  if (entering) playEntrance(document.getElementById(currentView));
}
let lastRenderedView = null;
let enterTimer = null;
let lastRingPct = 0;
let justToggled = null;
// Tag elements for a staggered entrance, count numbers up, then drop the class so later partial re-renders stay still.
function playEntrance(view) {
  if (!view) return;
  let i = 0, d = 0;
  view.querySelectorAll(".stat, .card, .steps li, .task-row, .review-item, .review-filters, .day").forEach(el => {
    el.classList.add("anim");
    el.style.setProperty("--i", el.classList.contains("day") ? d++ : i++);
  });
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => view.classList.remove("enter"), 1500);
  view.querySelectorAll(".stat strong, .hero-value, .score-stats strong").forEach(countUp);
}
function countUp(el) {
  const node = el.firstChild;
  if (!node || node.nodeType !== 3 || !/^\d[\d,]*$/.test(node.textContent.trim())) return;
  const target = Number(node.textContent.replace(/,/g, ""));
  if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now(), duration = 900;
  const step = now => { const t = Math.min(1, (now - start) / duration); node.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))).toLocaleString(); if (t < 1) requestAnimationFrame(step); };
  node.textContent = "0";
  requestAnimationFrame(step);
}
function moveNavIndicator() {
  const indicator = document.querySelector(".nav-indicator");
  const active = document.querySelector("nav button.active");
  if (!indicator || !active) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener("resize", moveNavIndicator);
document.fonts?.ready.then(moveNavIndicator);
const VIEW_RENDERERS = {
  today: renderToday,
  setup: () => { renderSetup(); enhanceUnavailablePicker(); },
  calendar: renderCalendar,
  progress: () => { renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); },
  review: renderReview
};
function hasPlan() { return Object.keys(state.tasks).length > 0; }
function greetingText() { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }
function prunePostExamTasks() { const exam = parseDate(state.examDate); if (!exam) return; const examKey = dateKey(exam); let changed = false; Object.keys(state.tasks).forEach(key => { if (key >= examKey) { delete state.tasks[key]; changed = true; } }); Object.keys(state.customTasks).forEach(key => { if (key >= examKey) { delete state.customTasks[key]; changed = true; } }); if (changed) saveState(); }
function tasksForDate(key) { return [...(state.tasks[key] || []), ...(state.customTasks[key] || [])]; }
function renderToday() {
  const today = new Date(); const exam = parseDate(state.examDate); const days = exam ? Math.max(0, Math.ceil((exam - today) / 86400000)) : 0;
  const tasks = tasksForDate(dateKey(today));
  const questions = tasks.reduce((sum, task) => sum + (task.detail.match(/^(\d+) questions$/)?.[1] ? Number(task.detail.match(/^(\d+) questions$/)[1]) : 0), 0);
  const passages = tasks.reduce((sum, task) => sum + (task.detail.match(/^(\d+) passages$/)?.[1] ? Number(task.detail.match(/^(\d+) passages$/)[1]) : 0), 0);
  const questionSources = [...new Set(tasks.filter(task => /^\d+ questions$/.test(task.detail || "")).map(task => task.section.split(" ")[0]))];
  const resources = questionSources.length ? questionSources.join(" + ") : tasks.some(task => task.contentId !== undefined) ? "Content review day" : "No question sets today";
  const streak = computeStreak();
  const doneCount = tasks.filter(task => task.done).length;
  const donePct = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  const ringLabel = tasks.length ? (doneCount === tasks.length ? "All done!" : `${doneCount} of ${tasks.length} done`) : "Rest day";
  const emptyState = hasPlan()
    ? '<div class="empty-state"><div class="empty-icon">☕</div><strong>No assignments today</strong><p class="muted">Enjoy the break or add a personal study block from the Calendar.</p></div>'
    : '<div class="empty-state"><div class="empty-icon">🚀</div><strong>Let\'s build your plan</strong><p class="muted">Set your exam date and targets, then generate your calendar.</p><button class="btn primary" data-view="setup">Go to Setup →</button></div>';
  const checklist = tasks.length ? tasks.map(task => taskMarkup(task, true)).join("") : emptyState;
  document.querySelector("#today").innerHTML = `
    <div class="page-head"><div><div class="page-kicker">${esc(formatDate(today))}</div><h1 class="greeting">${greetingText()}, <span class="gradient-text">Future Doctor</span></h1><p class="muted">${tasks.length ? "Here's what's on deck today." : "Nothing scheduled today."}</p></div>${hasPlan() ? '<button class="btn primary" data-action="update" title="Log completed work and rebalance the remaining schedule">↻ Update Calendar</button>' : ""}</div>
    <section class="stat-row">
      <div class="stat stat-exam"><span class="stat-label">MCAT exam</span><strong>${exam ? days : "--"}<small> days</small></strong><span class="stat-sub">${exam ? formatDate(exam) : "Choose an exam date"}</span></div>
      <div class="stat"><span class="stat-label">Questions today</span><strong>${questions}</strong><span class="stat-sub">${esc(resources)}</span></div>
      <div class="stat"><span class="stat-label">Passages today</span><strong>${passages}</strong><span class="stat-sub">CARS practice</span></div>
      <div class="stat"><span class="stat-label">Streak</span><strong>${streak}<small> ${streak === 1 ? "day" : "days"}</small></strong><span class="stat-sub">${streak ? "Keep it going 🔥" : "Finish today to start one"}</span></div>
    </section>
    <div class="dashboard">
      <section class="card"><div class="card-head"><h2>Today's checklist</h2>${tasks.length ? `<span class="pill">${doneCount}/${tasks.length}</span>` : ""}</div><div class="stack today-list">${checklist}</div></section>
      <aside class="right-panel stack"><section class="card countdown"><div class="ring ${donePct === 100 ? "complete" : ""}" style="--pct:${donePct};--from:${lastRingPct}"><div class="ring-value"><strong>${donePct}%</strong><small>${ringLabel}</small></div>${donePct === 100 && lastRingPct < 100 && tasks.length ? burstMarkup() : ""}</div></section>${krillionCard()}<section class="card"><h2>Question progress</h2>${progressMarkup("UWorld", TOTALS.uworld)}${progressMarkup("AAMC", TOTALS.aamc)}</section></aside>
    </div>`;
  lastRingPct = donePct;
  justToggled = null;
}
function contentKicker(task) {
  if (task.contentId === undefined) return "";
  const resource = state.content.resources.find(r => r.id === task.contentId);
  const section = CONTENT_SECTIONS.find(c => c.short === task.section.replace("Content ", ""))?.label || "";
  const kind = { Video: "videos", Lesson: "lessons", Page: "reading", Chapter: "reading" }[resource?.unitLabel] || "content";
  return `${section} ${kind}`.trim();
}
// Short label for calendar cells and the export, matching the Today checklist wording:
// "Psych/Soc videos: Processing the environment · 1–12 of 80", "Bio/Biochem reading: Kaplan Biology Review · Ch. 1".
// Content detail without the repeated resource name, for kit resources like Khan videos:
// "Processing the environment › Sensory perception · Videos 1–6 of 10".
function contentDetail(task) {
  const resource = state.content.resources.find(r => r.id === task.contentId);
  const detail = task.detail || "";
  return resource?.kit && resource.title && detail.startsWith(resource.title + " · ") ? detail.slice(resource.title.length + 3) : detail;
}
function displayLabel(task) {
  if (task.contentId === undefined) return task.label;
  return `${contentKicker(task)}: ${contentDetail(task).replace(/\bVideos? (?=\d)/, "").replace(/^[^·›]+ › /, "")}`;
}
// "Sensory perception" from a Khan topic task, for the watch button.
function contentTopic(task) { const m = contentDetail(task).match(/› (.+?) · /); return m ? m[1] : ""; }
function krillionCard() {
  return `<a class="krillion-card" href="https://mcatkrillion.netlify.app" target="_blank" rel="noopener">
    <span class="kc-atom" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
    <span class="kc-body"><span class="kc-kicker">Study break</span><strong>MCAT Krillion</strong><span class="kc-sub">7 rounds of “name a ___”, then every answer as a flashcard.</span></span>
    <span class="kc-play">Play <span aria-hidden="true">↗</span></span>
  </a>`;
}
function burstMarkup() {
  const colors = ["var(--cyan)", "var(--violet)", "var(--uw-bb)", "var(--anki)", "var(--aamc-independent)", "var(--uw-cp)"];
  return `<div class="burst" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => { const angle = i / 22 * Math.PI * 2; const dist = 95 + (i % 4) * 18; return `<i style="--c:${colors[i % colors.length]};--x:${Math.round(Math.cos(angle) * dist)}px;--y:${Math.round(Math.sin(angle) * dist)}px;animation-delay:${(i % 5) * 25 + 350}ms"></i>`; }).join("")}</div>`;
}
function taskMarkup(task, checkbox) {
  const resource = task.section === "Jack Westin" ? '<button type="button" class="task-resource" data-link="https://jackwestin.com/#daily-passages">Open daily passage ↗</button>'
    : task.link ? `<span class="task-actions"><button type="button" class="task-resource" data-link="${esc(task.link)}">▶ ${contentTopic(task) ? `Watch ${esc(contentTopic(task))}` : "Watch on YouTube"} ↗</button>${task.minutes ? `<span class="task-time">≈ ${task.minutes >= 90 ? `${Math.round(task.minutes / 6) / 10} hrs` : `${task.minutes} min`}</span>` : ""}</span>`
    : task.minutes ? `<span class="task-time">≈ ${task.minutes >= 90 ? `${Math.round(task.minutes / 6) / 10} hrs` : `${task.minutes} min`}</span>` : "";
  const identifier = task.custom ? `data-custom-task-date="${task.date}" data-custom-task-id="${task.id}"` : `data-task-date="${task.date}" data-task-index="${task.index}"`;
  const deleteButton = task.custom ? `<button type="button" class="task-delete" data-delete-task-date="${task.date}" data-delete-task-id="${task.id}" aria-label="Remove task">&times;</button>` : "";
  return `<div class="task-row"><label class="task ${task.done ? "done" : ""} ${task.done && justToggled === (task.custom ? `c:${task.id}` : `t:${task.date}:${task.index}`) ? "just-done" : ""}" style="--c:${colorFor(task)}"><input type="checkbox" ${task.done ? "checked" : ""} ${identifier}><span class="task-body"><span class="task-section">${esc(contentKicker(task) || task.section)}</span><strong>${esc(task.contentId !== undefined ? contentDetail(task) : task.detail || (task.custom ? "Personal study block" : task.label))}</strong>${resource}</span></label>${deleteButton}</div>`;
}
function progressMarkup(title, group) { return `<div class="section-title" style="margin-top:16px"><strong>${title}</strong></div>${Object.entries(group).map(([section, total]) => { const done = completedFor(section); const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0; return `<div class="progress-row"><div class="progress-head"><span style="color:${COLORS[section]}">${esc(section.replace("UWorld ", "").replace("AAMC ", ""))}</span><span>${done} / ${total}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${COLORS[section]}"></div></div></div>`; }).join("")}`; }

function renderSetup() {
  const select = (section, total) => { const savedPercent = total ? Math.round(targetFor(section) / total * 100) : 0; return `<select>${[0, 25, 50, 75, 100].map(value => `<option value="${value}" ${value === savedPercent ? "selected" : ""}>${value}%</option>`).join("")}</select>`; };
  const targetRows = (group, key) => Object.entries(group).map(([section, total]) => `<div class="target-row"><strong style="color:${COLORS[section]}">${section}</strong><small>${total} questions</small>${select(section, total)}</div>`).join("");
  document.querySelector("#setup").innerHTML = `<div class="page-head"><div><div class="page-kicker">Plan with intention</div><h1>Build your MCAT plan</h1><p class="muted">Pick your exam date, set your targets, add your content review, then generate. We spread it all across your time.</p></div><div class="head-actions"><span class="save-status">● Saved automatically</span><button class="btn primary" data-action="generate">⚡ Generate Calendar</button></div></div>
    <ol class="steps"><li><span>1</span>Exam date &amp; breaks</li><li><span>2</span>UWorld &amp; AAMC targets</li><li class="step-link" data-scroll="content-setup"><span>3</span>Content review</li><li><span>4</span>Generate calendar</li></ol>
    <div class="grid setup-grid"><section class="card setup-card setup-main" style="--accent:var(--teal)"><h2 class="section-title">Exam and schedule</h2><p class="muted setup-lead">Your anchor date controls every full length, break, and workload deadline.</p><div class="form-grid"><label>Exam date<input id="exam-date" type="date" value="${state.examDate}"></label><label>Full-length weekday<select id="fl-day" class="full-length-control">${DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map(day => `<option ${day === state.fullLengthDay ? "selected" : ""}>${day}</option>`).join("")}</select></label></div><div class="exam-date-card"><div><div class="muted">Selected MCAT exam date</div><strong>${state.examDate ? formatDate(parseDate(state.examDate)) : "Choose an exam date"}</strong></div></div><div class="setup-note">The day before the MCAT is automatically protected as a break.</div><h3 style="margin-top:18px">Weekly break days</h3><div class="checks">${DAY_NAMES.map(day => `<label><input type="checkbox" data-break="${day}" ${state.breaks.includes(day) ? "checked" : ""}>${day.slice(0, 3)}</label>`).join("")}</div><label style="margin-top:16px">Unavailable dates, comma-separated<textarea id="unavailable" rows="3" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:5px">${esc(state.unavailable)}</textarea></label></section>
    <section class="card setup-card setup-secondary" style="--accent:var(--uw-cp)"><h2 class="section-title">UWorld targets</h2>${targetRows(TOTALS.uworld, "uworld")}<button class="btn link" data-link="https://www.uworld.com/?srsltid=AU7gw4V3fQJIo5Tajbd8fYy4dEsrb_l3rlcHE4yjxfZssxWl5L95cHku">Open UWorld MCAT ↗</button><p class="setup-note">UWorld CARS defaults to 100%. AAMC CARS is scheduled separately as 3 passages per day.</p></section><section class="card setup-card setup-secondary" style="--accent:var(--aamc-cp)"><h2 class="section-title">AAMC targets</h2>${targetRows(Object.fromEntries(Object.entries(TOTALS.aamc).filter(([section]) => section !== "AAMC CARS")), "aamc")}<button class="btn link" data-link="https://students-residents.aamc.org/prepare-mcat-exam/aamc-mcat-official-prep-updates">Open AAMC Prep Hub ↗</button><p class="setup-note">AAMC CARS includes all 575 questions and is displayed as passages.</p></section></div>${contentSetupMarkup()}`;
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
function generatePlan() { readSetup(); const exam = parseDate(state.examDate); if (!exam || exam <= new Date()) return showToast("Choose a future exam date."); state.fullLengths = {}; const dayNumber = DAY_NAMES.indexOf(state.fullLengthDay); for (let i = 0; i < 7; i++) { let date = addDays(exam, -(49 - i * 7)); while (date.getDay() !== dayNumber) date = addDays(date, -1); if (date > new Date()) state.fullLengths[dateKey(date)] = ["Unscored", "FL 1", "FL 2", "FL 3", "FL 4", "FL 5", "FL 6"][i]; } state.fullLengths[state.examDate] = "MCAT EXAM"; state.tasks = buildTasks(exam); saveState(); displayedMonth = firstOfMonth(new Date()); currentView = "today"; render(true); showToast("Calendar generated."); }
function availableDays(exam) { const days = []; const start = new Date(); start.setHours(12, 0, 0, 0); const unavailable = state.unavailable.split(",").map(value => value.trim()).filter(Boolean); for (let date = start; date < exam; date = addDays(date, 1)) { const key = dateKey(date); const preExam = key === dateKey(addDays(exam, -1)); if (!unavailable.includes(key) && !state.breaks.includes(DAY_NAMES[date.getDay()]) && !preExam && !state.fullLengths[key]) days.push(date); } return days; }
function firstFullLengthDate() { const dates = Object.entries(state.fullLengths).filter(([, label]) => label !== "MCAT EXAM").map(([key]) => key).sort(); return dates.length ? parseDate(dates[0]) : null; }
// Effort per content unit, in "study days" (a textbook chapter ≈ a day of content work).
const UNIT_EFFORT = { Chapter: 0.8, Lesson: 0.4, Video: 0.1, Page: 0.05 };
const EFFORT_HOURS = 3.75; // 1 effort ≈ 3.75 study hours (a Kaplan chapter ≈ 3 hrs)
const UNIT_MINUTES = { Video: 6, Page: 10 };
const unitEffort = resource => resource.effort ?? UNIT_EFFORT[resource.unitLabel] ?? 0.8;
const UWORLD_PER_DAY = 50, AAMC_PER_DAY = 35, IDEAL_UWORLD_DAYS = 45;
// Weight for each day in [start, end): ramps up over rampIn days and down over rampOut days, so phases hand off gradually.
function phaseWeights(start, end, rampIn, rampOut) {
  const weights = new Map();
  for (let i = start; i < end; i++) {
    let w = 1;
    if (rampIn > 0) w = Math.min(w, (i - start + 1) / (rampIn + 1));
    if (rampOut > 0) w = Math.min(w, (end - i) / (rampOut + 1));
    weights.set(i, w);
  }
  return weights;
}
// Split a phase's question totals across its days: a few sections per day (smooth weighted round-robin),
// each section's exact total spread over its days in proportion to that day's weight.
function scheduleQuestionPhase(perDay, remainingBySection, weights) {
  const sections = [...remainingBySection.keys()].filter(section => remainingBySection.get(section) > 0);
  if (!sections.length || !weights.size) return;
  const grand = sections.reduce((sum, section) => sum + remainingBySection.get(section), 0);
  const weightSum = [...weights.values()].reduce((sum, w) => sum + w, 0);
  const current = new Map(sections.map(section => [section, 0]));
  const slots = new Map(sections.map(section => [section, []]));
  for (const [day, w] of weights) {
    const expected = grand * w / weightSum;
    const picks = Math.min(sections.length, expected >= 70 ? 3 : expected >= 35 ? 2 : 1);
    const today = new Set();
    for (let p = 0; p < picks; p++) {
      let best = null;
      sections.forEach(section => { if (today.has(section)) return; current.set(section, current.get(section) + remainingBySection.get(section)); if (!best || current.get(section) > current.get(best)) best = section; });
      current.set(best, current.get(best) - grand);
      today.add(best);
      slots.get(best).push({ day, share: w / picks });
    }
  }
  sections.forEach(section => {
    const list = slots.get(section); const total = remainingBySection.get(section);
    if (!list.length) return;
    const shareSum = list.reduce((sum, slot) => sum + slot.share, 0);
    const raw = list.map(slot => total * slot.share / shareSum);
    const amounts = raw.map(Math.floor);
    let left = total - amounts.reduce((sum, n) => sum + n, 0);
    raw.map((value, i) => [value - Math.floor(value), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (left > 0) { amounts[i]++; left--; } });
    list.forEach((slot, i) => { if (amounts[i] > 0) (perDay[slot.day] ||= []).push([section, `${amounts[i]} questions`, {}]); });
  });
}
function buildTasks(exam) {
  const tasks = {};
  const days = availableDays(exam);
  const N = days.length;
  if (!N) return tasks;
  const flStart = firstFullLengthDate();
  const remaining = section => Math.max(0, targetFor(section) - completedFor(section));

  // ---- workload in each phase ----
  const contentSlots = [];
  (state.content?.resources || []).forEach(resource => {
    const done = contentDoneSet(resource.id);
    const units = [...Array(resourceCount(resource)).keys()].filter(i => !done.has(i));
    units.forEach((unit, n) => contentSlots.push({ resource, unit, position: (n + 0.5) / units.length }));
  });
  contentSlots.sort((a, b) => a.position - b.position || CONTENT_SECTIONS.findIndex(s => s.key === a.resource.section) - CONTENT_SECTIONS.findIndex(s => s.key === b.resource.section));
  const uworld = new Map(["UWorld B/B", "UWorld C/P", "UWorld P/S", "UWorld CARS"].map(section => [section, remaining(section)]));
  const aamc = new Map(Object.keys(TOTALS.aamc).filter(section => section !== "AAMC CARS").map(section => [section, remaining(section)]));
  const sum = map => [...map.values()].reduce((total, n) => total + n, 0);
  const effort = {
    content: contentSlots.reduce((total, slot) => total + unitEffort(slot.resource), 0),
    uworld: sum(uworld) / UWORLD_PER_DAY,
    aamc: sum(aamc) / AAMC_PER_DAY
  };
  const order = ["content", "uworld", "aamc"].filter(phase => effort[phase] > 0);
  const totalEffort = order.reduce((total, phase) => total + effort[phase], 0);

  // ---- lay phases end to end across ALL available days, sized by workload, overlapping at each handoff ----
  const ranges = {};
  if (order.length) {
    // Content must be finished before the first full length (but never more than 3 units a day);
    // UWorld then AAMC share whatever time is left, in proportion to their workload.
    const firstFL = flStart ? days.filter(date => date < flStart).length : N;
    const minContentDays = Math.ceil(effort.content / 2.4); // at most ~9 hrs of content a day
    let contentEnd = order.includes("content") ? N * effort.content / totalEffort : 0;
    if (order.includes("content") && order.length > 1) contentEnd = Math.min(contentEnd, Math.max(firstFL, minContentDays));
    contentEnd = Math.min(N, contentEnd);
    const practice = order.filter(phase => phase !== "content");
    const practiceEffort = practice.reduce((total, phase) => total + effort[phase], 0);
    let cursor = contentEnd;
    const bounds = [
      ...(order.includes("content") ? [{ phase: "content", start: 0, end: contentEnd }] : []),
      ...practice.map(phase => { const start = cursor; cursor += (N - contentEnd) * effort[phase] / practiceEffort; return { phase, start, end: cursor }; })
    ];
    const overlap = Math.max(2, Math.min(21, Math.round(N * 0.12)));
    bounds.forEach((bound, i) => {
      const prev = bounds[i - 1], next = bounds[i + 1];
      const inLen = prev ? Math.min(overlap, (bound.end - bound.start) / 2, (prev.end - prev.start) / 2) : 0;
      const outLen = next ? Math.min(overlap, (bound.end - bound.start) / 2, (next.end - next.start) / 2) : 0;
      // content never spills past its end; the next phase ramps in earlier instead
      const start = Math.max(0, Math.floor(bound.start - (prev?.phase === "content" ? inLen : inLen / 2)));
      const end = Math.min(N, bound.phase === "content" ? Math.ceil(bound.end) : Math.ceil(bound.end + outLen / 2));
      ranges[bound.phase] = { start, end, weights: phaseWeights(start, end, Math.round(inLen), Math.round(outLen)) };
    });
  }
  const perDay = {};
  // content: walk the cumulative day weights so each unit lands where its share of the phase falls
  if (ranges.content && contentSlots.length) {
    const entries = [...ranges.content.weights];
    const totalW = entries.reduce((total, [, w]) => total + w, 0);
    const marks = []; let run = 0;
    contentSlots.forEach(slot => { const e = unitEffort(slot.resource); marks.push((run + e / 2) / effort.content); run += e; });
    let cumulative = 0, k = 0;
    entries.forEach(([day, w], index) => {
      cumulative += w;
      const byResource = new Map();
      while (k < contentSlots.length && (marks[k] <= cumulative / totalW || index === entries.length - 1)) {
        const { resource, unit } = contentSlots[k++];
        if (!byResource.has(resource)) byResource.set(resource, []);
        byResource.get(resource).push(unit);
      }
      byResource.forEach((units, resource) => {
        units.sort((a, b) => a - b);
        let group = [units[0]];
        const flush = () => (perDay[day] ||= []).push([`Content ${sectionShort(resource.section)}`, `${resourceTitle(resource)} · ${unitRange(resource, group)}`, contentTaskExtra(resource, group)]);
        units.slice(1).forEach(unit => { if (unit === group.at(-1) + 1 && segmentOf(resource, unit)?.segment === segmentOf(resource, group[0])?.segment) group.push(unit); else { flush(); group = [unit]; } });
        flush();
      });
    });
  }
  if (ranges.uworld) scheduleQuestionPhase(perDay, uworld, ranges.uworld.weights);
  if (ranges.aamc) scheduleQuestionPhase(perDay, aamc, ranges.aamc.weights);
  days.forEach((date, i) => (perDay[i] || []).forEach(([section, detail, extra]) => addTask(tasks, date, section, detail, extra)));

  // ---- AAMC CARS: 3 passages a day in the final stretch ----
  const aamcCars = Math.ceil(575 / 9);
  const carsDays = Math.min(N, Math.ceil(aamcCars / 3));
  const carsRate = carsDays < Math.ceil(aamcCars / 3) ? Math.ceil(aamcCars / carsDays) : 3;
  let remainingCars = aamcCars;
  for (let i = N - 1; i >= Math.max(0, N - carsDays); i--) {
    const count = Math.min(carsRate, remainingCars);
    if (count > 0) addTask(tasks, days[i], "AAMC CARS", `${count} passages`);
    remainingCars -= count;
  }
  // ---- once UWorld wraps up, keep re-reviewing missed questions until exam week ----
  const uworldSections = ["UWorld B/B", "UWorld C/P", "UWorld P/S"];
  if (ranges.uworld && uworldSections.some(section => targetFor(section) > 0)) {
    const reviewAmount = Math.max(10, Math.round(uworldSections.reduce((total, section) => total + targetFor(section), 0) / IDEAL_UWORLD_DAYS));
    const reviewCutoff = addDays(exam, -7);
    days.forEach((date, index) => { if (index >= ranges.uworld.end && date < reviewCutoff) addTask(tasks, date, "Re-Review UWorld Questions", `${reviewAmount} questions`); });
  }
  days.forEach((date, index) => {
    if (!(tasks[dateKey(date)] || []).some(task => task.section === "AAMC CARS")) addTask(tasks, date, "Jack Westin", `${index === 0 ? 2 : 3} passages`);
  });
  const ankiCutoff = addDays(exam, -7);
  days.forEach(date => { if (date < ankiCutoff) addTask(tasks, date, "Anki Flashcards", "Daily review"); });
  return tasks;
}
// Phase summary for the timeline: first/last date of each kind of work.
function planPhases() {
  const kinds = [["Content review", task => task.contentId !== undefined, "var(--content-bb)"], ["UWorld", task => /^UWorld /.test(task.section), "var(--uw-cp)"], ["AAMC", task => /^AAMC /.test(task.section) && task.section !== "AAMC CARS", "var(--aamc-cp)"]];
  const phases = kinds.map(([name, test, color]) => { const dates = Object.entries(state.tasks).filter(([, list]) => list.some(test)).map(([key]) => key).sort(); return dates.length ? { name, color, start: dates[0], end: dates.at(-1) } : null; }).filter(Boolean);
  const fls = Object.entries(state.fullLengths).filter(([, label]) => label !== "MCAT EXAM").map(([key]) => key).sort();
  if (fls.length) phases.push({ name: "Full lengths", color: "var(--fl)", start: fls[0], end: fls.at(-1) });
  return phases;
}
function timelineMarkup() {
  if (!hasPlan()) return "";
  const phases = planPhases();
  const today = dateKey(new Date());
  const startKey = [today, ...phases.map(p => p.start)].sort()[0];
  const startTime = parseDate(startKey).getTime(), endTime = parseDate(state.examDate).getTime();
  const span = Math.max(1, endTime - startTime);
  const pos = key => Math.max(0, Math.min(100, (parseDate(key).getTime() - startTime) / span * 100));
  const short = key => parseDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const rows = phases.map(p => `<div class="tl-row"><span class="tl-name">${p.name}</span><div class="tl-track"><div class="tl-bar" style="left:${pos(p.start)}%;width:${Math.max(1.5, pos(p.end) - pos(p.start))}%;--c:${p.color}"></div></div><span class="tl-dates">${short(p.start)} – ${short(p.end)}</span></div>`).join("");
  const perDay = Object.values(state.tasks).map(list => ({ q: list.filter(t => /^(UWorld|AAMC) /.test(t.section) && /questions$/.test(t.detail)).reduce((n, t) => n + Number(t.detail.match(/\d+/)[0]), 0), c: list.filter(t => t.contentId !== undefined).reduce((n, t) => { const r = state.content.resources.find(x => x.id === t.contentId); return n + (r ? unitEffort(r) * (t.units?.length || 1) : 0); }, 0) }));
  const peakQ = Math.max(0, ...perDay.map(d => d.q)), peakC = Math.max(0, ...perDay.map(d => d.c));
  const heavy = peakQ > 110 || peakC > 2.5 ? `<div class="tl-warn">⚠️ Heavy plan: up to ${peakQ} questions${peakC > 2.5 ? ` and about ${Math.round(peakC * EFFORT_HOURS)} hrs of content` : ""} on your busiest days. Lowering targets or adding time will lighten it.</div>` : `<div class="tl-ok">✓ Busiest day: about ${peakQ} questions${peakC ? ` + about ${Math.max(1, Math.round(peakC * EFFORT_HOURS * 2) / 2)} hrs of content review` : ""}.</div>`;
  return `<section class="card timeline anim"><div class="card-head"><h2>Your study timeline</h2><span class="muted">${short(startKey)} → 🎯 ${short(state.examDate)}</span></div>${rows}${heavy}<p class="muted tl-note">Everything is spread across the time you have: content first, easing into UWorld, then AAMC, then full lengths.</p></section>`;
}
function addTask(tasks, date, section, detail, extra = {}) { const key = dateKey(date); if (!tasks[key]) tasks[key] = []; tasks[key].push({ date: key, section, label: `${section}: ${detail}`, detail, done: false, index: tasks[key].length, ...extra }); }
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

function renderCalendar() { const container = document.querySelector("#calendar"); const monthName = displayedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" }); const first = firstOfMonth(displayedMonth); const start = addDays(first, -((first.getDay() + 6) % 7)); const exam = parseDate(state.examDate); const todayKey = dateKey(new Date()); const examKey = exam ? dateKey(exam) : ""; const preExamKey = exam ? dateKey(addDays(exam, -1)) : ""; let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `<div class="weekday">${day}</div>`).join(""); for (let i = 0; i < 42; i++) { const date = addDays(start, i); const key = dateKey(date); const outside = date.getMonth() !== displayedMonth.getMonth(); const special = state.fullLengths[key]; const tasks = tasksForDate(key); let body = tasks.map(task => `<div class="day-task ${task.done ? "done" : ""}" style="--c:${colorFor(task)}" title="${esc(displayLabel(task))}">${esc(displayLabel(task))}</div>`).join(""); if (special) body = `<div class="day-special ${key === examKey ? "exam" : "fl"}">${key === examKey ? "🎯 " : "📝 "}${esc(special)}</div>`; if (key === preExamKey) body = `<div class="day-special rest">😌 Break</div>`; cells += `<div class="day ${outside ? "outside" : ""} ${key === todayKey ? "is-today" : ""} ${key === examKey ? "is-exam" : ""}"><div class="day-number">${date.getDate()}${key === todayKey ? '<span class="today-tag">Today</span>' : ""}</div>${body}</div>`; } const legend = LEGEND.map(([label, section]) => `<span style="--c:${COLORS[section]}">${esc(label)}</span>`).join("") + '<span style="--c:var(--custom)">Personal</span><span style="--c:var(--fl)">Full length</span>'; container.innerHTML = `<div class="page-head"><div><div class="page-kicker">Your schedule</div><h1>Study calendar</h1><p class="muted">${exam ? `${Math.max(0, Math.ceil((exam - new Date()) / 86400000))} days until exam` : "Generate a plan first"}</p></div>${hasPlan() ? '<button class="btn primary" data-action="update">↻ Update Calendar</button>' : '<button class="btn primary" data-view="setup">Go to Setup →</button>'}</div><section class="card custom-task-card"><h2 class="section-title">Add a personal study block</h2><p class="muted">Block time for outside resources like Kaplan, Blueprint, Anki, or tutoring. These stick around even when you regenerate your calendar.</p><div class="custom-task-form"><label>Date<input id="custom-task-date" type="date" value="${dateKey(new Date())}"></label><label>Title<input id="custom-task-title" placeholder="Kaplan"></label><label>Details<input id="custom-task-detail" placeholder="2 hours, Chapter 4"></label><button type="button" class="btn primary" data-add-custom-task>Add to calendar</button></div>${customTaskList()}</section><section class="card"><div class="calendar-head"><h2>${monthName}</h2><div class="month-nav"><button class="btn icon" data-month="-1" aria-label="Previous month">&larr;</button><button class="btn small" data-month="today">Today</button><button class="btn icon" data-month="1" aria-label="Next month">&rarr;</button></div></div><div class="legend">${legend}</div><div class="month-grid">${cells}</div></section>`; }
function renderProgress() { const container = document.querySelector("#progress"); const completed = allSections().reduce((sum, section) => sum + completedFor(section), 0); const total = allSections().reduce((sum, section) => sum + (TOTALS.uworld[section] || TOTALS.aamc[section] || 0), 0); const pct = total ? Math.round(completed / total * 100) : 0; container.innerHTML = `<div class="page-head"><div><div class="page-kicker">Keep the momentum visible</div><h1>Progress dashboard</h1><p class="muted">Track question completion first, then review full-length performance.</p></div><div class="head-actions"><span class="completion-chip">${completed.toLocaleString()} / ${total.toLocaleString()} complete</span>${hasPlan() ? '<button class="btn primary" data-action="update">↻ Update Calendar</button>' : ""}</div></div><section class="card hero-card"><div class="hero-row"><div><div class="page-kicker">Overall completion</div><div class="hero-value">${pct}<small>%</small></div></div><div class="hero-note">Questions completed across<br>UWorld and AAMC.</div></div><div class="progress-track big"><div class="progress-fill glow" style="width:${pct}%"></div></div></section><div class="progress-sections"><div class="grid two">${progressCard("UWorld", TOTALS.uworld, "var(--uw-cp)")}${progressCard("AAMC", TOTALS.aamc, "var(--aamc-cp)")}</div><section class="card progress-card full-length-card" style="--accent:var(--fl)">${fullLengthProgressMarkup()}</section></div>`; }
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
function updateCalendar() { if (!state.examDate || !Object.keys(state.tasks).length) return showToast("Generate a calendar first."); recordCompletedTasks(); saveState(); generatePlan(); showToast("Calendar updated from completed work."); }

document.addEventListener("click", event => { const view = event.target.closest("[data-view]"); if (view) { currentView = view.dataset.view; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; } const link = event.target.closest("[data-link]"); if (link) window.open(link.dataset.link, "_blank", "noopener"); const action = event.target.closest("[data-action]"); if (action?.dataset.action === "generate") generatePlan(); if (action?.dataset.action === "update") updateCalendar(); if (action?.dataset.action === "export") exportPlan(); if (action?.dataset.action === "export-calendar") exportCombinedReport(); const filter = event.target.closest("[data-review-filter]"); if (filter) { reviewFilter = filter.dataset.reviewFilter; renderReview(); } const month = event.target.closest("[data-month]"); if (month) { const before = displayedMonth; displayedMonth = month.dataset.month === "today" ? firstOfMonth(new Date()) : new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + Number(month.dataset.month), 1, 12); renderCalendar(); if (displayedMonth.getTime() !== before.getTime()) document.querySelector(".month-grid")?.classList.add(displayedMonth > before ? "slide-next" : "slide-prev"); } const addCustom = event.target.closest("[data-add-custom-task]"); if (addCustom) addCustomTask(); const deleteTask = event.target.closest("[data-delete-task-date]"); if (deleteTask) deleteCustomTask(deleteTask.dataset.deleteTaskDate, deleteTask.dataset.deleteTaskId); });
document.addEventListener("change", event => { if (event.target.matches("[data-task-date]")) { const task = state.tasks[event.target.dataset.taskDate]?.[Number(event.target.dataset.taskIndex)]; if (task) { task.done = event.target.checked; justToggled = `t:${task.date}:${task.index}`; if (task.contentId !== undefined) (task.units || [task.unit]).forEach(unit => setContentDone(task.contentId, unit, task.done)); saveState(); if (currentView === "today") renderToday(); showToast(event.target.checked ? "Task marked complete ✓" : "Task reopened."); } } });
document.addEventListener("change", event => { if (event.target.matches("[data-custom-task-date]")) { const task = state.customTasks[event.target.dataset.customTaskDate]?.find(item => String(item.id) === event.target.dataset.customTaskId); if (task) { task.done = event.target.checked; justToggled = `c:${task.id}`; saveState(); if (currentView === "today") renderToday(); showToast(event.target.checked ? "Task marked complete ✓" : "Task reopened."); } } });
document.addEventListener("change", event => { if (event.target.matches("[data-completed]")) { state.completed[event.target.dataset.completed] = Math.max(0, Math.min(Number(event.target.max), Number(event.target.value) || 0)); saveState(); } });
document.addEventListener("change", event => { if (event.target.matches("[data-score-date]")) { const score = Number(event.target.value); if (event.target.value === "") delete state.fullLengthScores[event.target.dataset.scoreDate]; else state.fullLengthScores[event.target.dataset.scoreDate] = Math.max(0, Math.min(528, score || 0)); saveState(); renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); showToast("Full-length score saved."); } });
document.addEventListener("change", event => { if (event.target.matches("[data-section-score-date]")) { const date = event.target.dataset.sectionScoreDate; const key = event.target.dataset.sectionScore; state.fullLengthSectionScores[date] ||= {}; if (event.target.value === "") delete state.fullLengthSectionScores[date][key]; else state.fullLengthSectionScores[date][key] = Math.max(0, Math.min(132, Number(event.target.value) || 0)); saveState(); renderProgress(); enhanceSubsectionScores(); enhanceMainScoreGraph(); showToast("Section score saved."); } });
document.addEventListener("click", event => { const tab = event.target.closest("[data-section-tab]"); if (!tab) return; const block = tab.closest(".subsection-score-block"); block.querySelectorAll("[data-section-tab]").forEach(button => button.classList.toggle("active", button === tab)); block.querySelectorAll("[data-section-graph]").forEach(graph => graph.classList.toggle("active", graph.dataset.sectionGraph === tab.dataset.sectionTab)); });
document.addEventListener("click", event => { const tab = event.target.closest("[data-full-graph-tab]"); if (!tab) return; const area = tab.closest(".full-graph-area"); area.querySelectorAll("[data-full-graph-tab]").forEach(button => button.classList.toggle("active", button === tab)); area.querySelectorAll("[data-full-graph]").forEach(graph => graph.classList.toggle("active", graph.dataset.fullGraph === tab.dataset.fullGraphTab)); });
document.addEventListener("click", event => { const add = event.target.closest("[data-add-review]"); if (add) { const source = document.querySelector("#review-source").value.trim(); const question = document.querySelector("#review-question").value.trim(); if (!source || !question) return showToast("Add the exam or QPack and question number first."); state.reviews.unshift({ id: Date.now(), source, question, chosen: document.querySelector("#review-chosen").value.trim() || "--", correct: document.querySelector("#review-correct").value.trim() || "--", whyChosen: document.querySelector("#review-why").value.trim() || "Not recorded", reason: document.querySelector("#review-reason").value, explanation: document.querySelector("#review-explanation").value.trim() || "Not recorded" }); saveState(); render(); showToast("Question review saved."); } const remove = event.target.closest("[data-delete-review]"); if (remove) { state.reviews = state.reviews.filter(review => String(review.id) !== remove.dataset.deleteReview); saveState(); render(); showToast("Question review deleted."); } });
document.addEventListener("change", event => { if (event.target.closest("#setup") && !event.target.closest("#content-setup")) { readSetup(); saveState(); showToast("Setup saved automatically."); } });
document.addEventListener("input", event => { if (event.target.closest("#setup") && !event.target.closest("#content-setup")) { readSetup(); saveState(); } });
document.addEventListener("change", event => { if (event.target.matches("#import-data") && event.target.files[0]) importPlan(event.target.files[0]); });
document.addEventListener("click", event => { const add = event.target.closest("[data-add-unavailable]"); if (add) { const input = document.querySelector("#unavailable-date"); if (!input.value) return; state.unavailable = [...new Set([...unavailableDates(), input.value])].sort().join(", "); saveState(); render(); showToast("Unavailable date added."); } const remove = event.target.closest("[data-remove-unavailable]"); if (remove) { state.unavailable = unavailableDates().filter(date => date !== remove.dataset.removeUnavailable).join(", "); saveState(); render(); showToast("Unavailable date removed."); } });

/* ============================================================
   Content review (lives in Setup): pick a resource per section,
   say how many chapters/videos, and the calendar assigns them day by day.
   ============================================================ */
const CONTENT_SECTIONS = [
  { key: "bb", label: "Bio/Biochem", short: "B/B", color: "var(--content-bb)" },
  { key: "cp", label: "Chem/Phys", short: "C/P", color: "var(--content-cp)" },
  { key: "ps", label: "Psych/Soc", short: "P/S", color: "var(--content-ps)" }
];
// Kaplan counts are editable defaults: editions differ.
// [name, unit, default count, effort per unit]. Khan video counts are the MCAT playlists' totals (editable);
// a Khan video is ~6 min, so it counts as a small fraction of a textbook chapter.
const CONTENT_OPTIONS = {
  bb: [["Kaplan Biology Review", "Chapter", 12], ["Kaplan Biochemistry Review", "Chapter", 12], ["Khan Academy Bio/Biochem videos", "Video", 368, 0.065, "khan"], ["Blueprint", "Chapter"], ["Princeton Review", "Chapter"]],
  cp: [["Kaplan General Chemistry Review", "Chapter", 12], ["Kaplan Organic Chemistry Review", "Chapter", 12], ["Kaplan Physics & Math Review", "Chapter", 12], ["Khan Academy Chem/Phys videos", "Video", 456, 0.065, "khan"], ["Blueprint", "Chapter"], ["Princeton Review", "Chapter"]],
  ps: [["Khan Academy Psych/Soc videos (recommended)", "Video", 259, 0.065, "khan-ps"], ["Khan Academy 300-page Psych/Soc document", "Page", 300, 0.05], ["Kaplan Behavioral Sciences Review", "Chapter", 12], ["Blueprint", "Chapter"], ["Princeton Review", "Chapter"]]
};
const RECOMMENDED_SET = { bb: [0, 1], cp: [0, 1, 2], ps: [0] };
const optionName = name => name.replace(" (recommended)", "");
// Khan Academy MCAT videos live on the @KhanAcademyMCATprep YouTube channel. P/S is five playlists, in course order.
const KHAN_CHANNEL = "https://www.youtube.com/@KhanAcademyMCATprep";
const khanSearch = topic => `${KHAN_CHANNEL}/search?query=${encodeURIComponent(topic)}`;
// Khan Academy's MCAT Psych/Soc course, topic by topic: [unit, topic, videos, minutes]. 259 videos, ~27.7 hrs.
const KHAN_PS_TOPICS = [
  ["Processing the environment", "Sensory perception", 10, 65], ["Processing the environment", "Sight (vision)", 7, 51], ["Processing the environment", "Sound (audition)", 4, 22],
  ["Processing the environment", "Somatosensation", 5, 28], ["Processing the environment", "Taste and smell", 3, 34], ["Processing the environment", "Sleep and consciousness", 7, 40],
  ["Processing the environment", "Drug dependence", 9, 48], ["Processing the environment", "Attention", 3, 19], ["Processing the environment", "Memory", 9, 40],
  ["Processing the environment", "Cognition", 6, 33], ["Processing the environment", "Language", 3, 15], ["Processing the environment", "Emotion", 5, 48], ["Processing the environment", "Stress", 6, 45],
  ["Behavior", "Nervous system", 20, 159], ["Behavior", "Endocrine system", 2, 18], ["Behavior", "Behavior and genetics", 6, 52], ["Behavior", "Motivation and attitudes", 10, 60],
  ["Behavior", "Theories of personality", 7, 49], ["Behavior", "Psychological disorders", 6, 63], ["Behavior", "Social psychology", 12, 76],
  ["Behavior", "Normative and non-normative behavior", 3, 21], ["Behavior", "Learning", 8, 54], ["Behavior", "Attitude and behavior change", 7, 44],
  ["Individuals and society", "Self-identity", 10, 98], ["Individuals and society", "Perception, prejudice, and bias", 10, 59], ["Individuals and society", "Social behavior", 8, 42],
  ["Individuals and society", "Social interactions", 15, 65], ["Individuals and society", "Self-presentation", 5, 31], ["Individuals and society", "Social behavior in animals", 3, 12],
  ["Individuals and society", "Discrimination", 3, 14],
  ["Society and culture", "Social structures", 13, 69], ["Society and culture", "Demographics", 12, 84], ["Society and culture", "Culture", 8, 32],
  ["Social inequality", "Social inequality", 14, 70]
];
const KHAN_PS_TOTAL = KHAN_PS_TOPICS.reduce((sum, t) => sum + t[2], 0);
const RESOURCE_KITS = { "khan-ps": { link: KHAN_CHANNEL + "/playlists", minutes: 6.4, segments: KHAN_PS_TOPICS.map(([unit, name, count, minutes]) => ({ unit, name, count, minutes, link: khanSearch(`MCAT ${name}`) })) }, khan: { link: KHAN_CHANNEL + "/playlists", minutes: 6 } };
const kitFor = resource => RESOURCE_KITS[resource.kit] || {};
// Which playlist a unit falls in (for segmented resources like Khan P/S), and its number within it.
function segmentOf(resource, unit) {
  const segments = kitFor(resource).segments;
  if (!segments) return null;
  let start = 0;
  for (const segment of segments) { if (unit < start + segment.count) return { segment, local: unit - start }; start += segment.count; }
  return null;
}
function resourceCount(resource) { return Number(resource.count) || 0; }
function unitName(resource, i) { return resource.unitLabel === "Chapter" ? `Ch. ${i + 1}` : `${resource.unitLabel} ${i + 1}`; }
function unitRange(resource, units) {
  const seg = segmentOf(resource, units[0]);
  const first = (seg ? seg.local : units[0]) + 1, last = first + units.length - 1;
  const label = resource.unitLabel === "Chapter" ? (first === last ? `Ch. ${first}` : `Ch. ${first}–${last}`) : first === last ? `${resource.unitLabel} ${first}` : `${resource.unitLabel}s ${first}–${last}`;
  return seg ? `${seg.segment.unit && seg.segment.unit !== seg.segment.name ? `${seg.segment.unit} › ` : ""}${seg.segment.name} · ${label} of ${seg.segment.count}` : label;
}
function contentTaskExtra(resource, units) {
  const kit = kitFor(resource); const seg = segmentOf(resource, units[0]);
  const perUnit = seg?.segment.minutes ? seg.segment.minutes / seg.segment.count : kit.minutes ?? UNIT_MINUTES[resource.unitLabel];
  return { contentId: resource.id, units, ...(seg?.segment.link || kit.link ? { link: seg?.segment.link || kit.link } : {}), ...(perUnit ? { minutes: Math.round(perUnit * units.length) } : {}) };
}
function contentDoneSet(id) { return new Set(state.contentDone[id] || []); }
function setContentDone(id, unit, done) {
  const set = contentDoneSet(id);
  if (done) set.add(unit); else set.delete(unit);
  state.contentDone[id] = [...set].sort((a, b) => a - b);
}
function sectionShort(key) { return CONTENT_SECTIONS.find(section => section.key === key)?.short || key; }
function newResource(section, title, unitLabel, count, effort, kit) { return { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, section, source: "", title, unitLabel, count, ...(effort ? { effort } : {}), ...(kit ? { kit } : {}) }; }
function resourceTitle(resource) { return [resource.source, resource.title].filter(Boolean).join(" "); }

let contentAddSection = null;
function contentSetupMarkup() {
  const plan = state.content;
  const sections = CONTENT_SECTIONS.map(section => {
    const rows = plan.resources.filter(r => r.section === section.key).map(resource => {
      const done = contentDoneSet(resource.id).size;
      return `<div class="content-row">
        <span class="content-name">${esc(resourceTitle(resource))}</span>
        <label class="content-count"><input type="number" min="1" max="2000" value="${resourceCount(resource)}" data-resource-count="${resource.id}" aria-label="How many ${esc(resource.unitLabel.toLowerCase())}s">${esc(resource.unitLabel.toLowerCase())}s</label>
        <span class="content-done">${done ? `${done} done` : ""}</span>
        <button type="button" class="task-delete" data-remove-resource="${resource.id}" aria-label="Remove ${esc(resourceTitle(resource))}">&times;</button>
      </div>`;
    }).join("");
    const options = CONTENT_OPTIONS[section.key];
    const adding = contentAddSection === section.key;
    const addForm = adding ? `<div class="content-add" data-add-form="${section.key}">
        <select data-pick aria-label="Resource">${options.map(([name], i) => `<option value="${i}">${esc(name)}</option>`).join("")}<option value="other">Something else…</option></select>
        <input data-other class="hidden" placeholder="Name it (e.g. my notes)" aria-label="Resource name">
        <input data-count type="number" min="1" max="2000" value="${options[0][2] ?? ""}" placeholder="How many?" aria-label="How many">
        <select data-unit aria-label="Unit type"><option value="Chapter">chapters</option><option value="Video">videos</option><option value="Lesson">lessons</option><option value="Page">pages</option></select>
        <button type="button" class="btn primary small" data-save-resource="${section.key}">Add</button>
        <button type="button" class="btn ghost small" data-cancel-resource>Cancel</button>
      </div>` : `<button type="button" class="btn link add-link" data-open-add="${section.key}">+ Add ${rows ? "another" : "a resource"}</button>`;
    return `<div class="content-section" style="--accent:${section.color}">
      <div class="content-section-label"><span class="sec-dot"></span>${section.label}</div>
      <div class="content-section-body">${rows}${addForm}</div>
    </div>`;
  }).join("");
  const kaplanButton = plan.resources.length ? "" : `<button type="button" class="btn kaplan-btn" data-content-kaplan><span>Use the recommended setup</span><span class="muted">Kaplan books for B/B and C/P · Khan Academy videos for P/S</span></button>`;
  return `<section class="card setup-card content-setup" id="content-setup" style="--accent:var(--content-bb)">
    <h2 class="section-title">Content review</h2>
    <p class="muted setup-lead">Add what you're studying from — mix resources however you like. Your calendar starts with content review and gradually shifts into practice, spread across all the time you have.</p>
    ${kaplanButton}
    <div class="content-sections">${sections}</div>
    <p class="setup-note">Counts are pre-filled (Kaplan books at 12 chapters, Khan Academy at the full playlist) — change any number to match yours. Leave a section empty if you don't need content review for it.</p>
  </section>
  ${timelineMarkup()}
  <div class="setup-footer"><span class="muted">All set? Your calendar is built from everything above.</span>${hasPlan() ? '<button class="btn primary" data-action="update">↻ Update Calendar</button>' : '<button class="btn primary" data-action="generate">⚡ Generate Calendar</button>'}</div>`;
}
function refreshSetup(message) { saveState(); renderSetup(); enhanceUnavailablePicker(); if (message) showToast(message); }
document.addEventListener("click", event => {
  const scroll = event.target.closest("[data-scroll]");
  if (scroll) { document.getElementById(scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (event.target.closest("[data-content-kaplan]")) {
    Object.entries(RECOMMENDED_SET).forEach(([section, picks]) => picks.forEach(i => { const [name, unit, count, effort, kit] = CONTENT_OPTIONS[section][i]; state.content.resources.push(newResource(section, optionName(name), unit, count, effort, kit)); }));
    refreshSetup("Recommended setup added."); return;
  }
  const open = event.target.closest("[data-open-add]");
  if (open) { contentAddSection = open.dataset.openAdd; refreshSetup(); document.querySelector("[data-add-form] [data-pick]")?.focus(); return; }
  if (event.target.closest("[data-cancel-resource]")) { contentAddSection = null; refreshSetup(); return; }
  const save = event.target.closest("[data-save-resource]");
  if (save) {
    const form = save.closest("[data-add-form]"); const section = save.dataset.saveResource;
    const pick = form.querySelector("[data-pick]").value;
    const option = pick === "other" ? null : CONTENT_OPTIONS[section][Number(pick)];
    const name = option ? optionName(option[0]) : form.querySelector("[data-other]").value.trim();
    const count = Math.min(2000, Number(form.querySelector("[data-count]").value) || 0);
    if (!name) return showToast("Give it a name.");
    if (count < 1) return showToast("Enter how many there are.");
    const unit = form.querySelector("[data-unit]").value;
    state.content.resources.push(newResource(section, name, unit, count, option && option[1] === unit ? option[3] : undefined, option && option[1] === unit ? option[4] : undefined));
    contentAddSection = null; refreshSetup(`Added ${name}.`); return;
  }
  const remove = event.target.closest("[data-remove-resource]");
  if (remove) { const id = remove.dataset.removeResource; state.content.resources = state.content.resources.filter(r => r.id !== id); delete state.contentDone[id]; Object.keys(state.tasks).forEach(key => { state.tasks[key] = state.tasks[key].filter(task => task.contentId !== id).map((task, index) => ({ ...task, index })); if (!state.tasks[key].length) delete state.tasks[key]; }); refreshSetup("Removed."); }
});
document.addEventListener("change", event => {
  const pick = event.target.closest("[data-pick]");
  if (pick) {
    const form = pick.closest("[data-add-form]"); const option = CONTENT_OPTIONS[form.dataset.addForm][Number(pick.value)];
    form.querySelector("[data-other]").classList.toggle("hidden", pick.value !== "other");
    form.querySelector("[data-count]").value = option?.[2] ?? "";
    form.querySelector("[data-unit]").value = option?.[1] || "Chapter";
    (pick.value === "other" ? form.querySelector("[data-other]") : form.querySelector("[data-count]")).focus();
    return;
  }
  if (event.target.matches("[data-resource-count]")) { const resource = state.content.resources.find(r => r.id === event.target.dataset.resourceCount); if (!resource) return; resource.count = Math.max(1, Math.min(2000, Number(event.target.value) || 1)); state.contentDone[resource.id] = (state.contentDone[resource.id] || []).filter(i => i < resource.count); saveState(); }
});

render();
