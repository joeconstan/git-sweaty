const DEFAULT_COLORS = ["#1f2937", "#1f2937", "#1f2937", "#1f2937", "#1f2937"];
const TYPE_COLORS = {
  Run: ["#1f2937", "#1f2937", "#1f2937", "#1f2937", "#01cdfe"],
  Ride: ["#1f2937", "#1f2937", "#1f2937", "#1f2937", "#05ffa1"],
  WeightTraining: ["#1f2937", "#1f2937", "#1f2937", "#1f2937", "#ff71ce"],
};
const MULTI_TYPE_COLOR = "#b967ff";
const STAT_HEAT_COLOR = "#05ffa1";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const typeButtons = document.getElementById("typeButtons");
const yearButtons = document.getElementById("yearButtons");
const typeSelect = document.getElementById("typeSelect");
const yearSelect = document.getElementById("yearSelect");
const heatmaps = document.getElementById("heatmaps");
const stats = document.getElementById("stats");
const tooltip = document.getElementById("tooltip");
const summary = document.getElementById("summary");
const updated = document.getElementById("updated");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const isStatsPage = Boolean(stats) && !heatmaps;

function readCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLayout() {
  return {
    cell: readCssVar("--cell", 12),
    gap: readCssVar("--gap", 2),
    gridPadTop: readCssVar("--grid-pad-top", 6),
    gridPadLeft: readCssVar("--grid-pad-left", 6),
  };
}

function sundayOnOrBefore(d) {
  const day = d.getDay();
  const offset = day % 7; // Sunday=0
  const result = new Date(d);
  result.setDate(d.getDate() - offset);
  return result;
}

function saturdayOnOrAfter(d) {
  const day = d.getDay();
  const offset = (6 - day + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() + offset);
  return result;
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function heatColor(hex, value, max) {
  if (max <= 0) return DEFAULT_COLORS[0];
  if (value <= 0) return "#0f172a";
  const rgb = hexToRgb(hex);
  const base = hexToRgb("#0f172a");
  if (!rgb || !base) return hex;
  const intensity = Math.pow(Math.min(value / max, 1), 0.75);
  const r = Math.round(base.r + (rgb.r - base.r) * intensity);
  const g = Math.round(base.g + (rgb.g - base.g) * intensity);
  const b = Math.round(base.b + (rgb.b - base.b) * intensity);
  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function positionTooltip(x, y) {
  const padding = 12;
  const rect = tooltip.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - padding;
  const maxY = window.innerHeight - rect.height - padding;
  const left = clamp(x + 12, padding, maxX);
  const top = clamp(y + 12, padding, maxY);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.bottom = "auto";
}

function showTooltip(text, x, y) {
  tooltip.textContent = text;
  if (isTouch) {
    tooltip.classList.add("touch");
    tooltip.style.transform = "none";
  } else {
    tooltip.classList.remove("touch");
    tooltip.style.transform = "translateY(-8px)";
  }
  tooltip.classList.add("visible");
  requestAnimationFrame(() => positionTooltip(x, y));
}

function hideTooltip() {
  tooltip.classList.remove("visible");
}

function attachTooltip(cell, text) {
  if (!text) return;
  if (!isTouch) {
    cell.addEventListener("mouseenter", (event) => {
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mousemove", (event) => {
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mouseleave", hideTooltip);
    return;
  }
  cell.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    if (cell.classList.contains("active")) {
      cell.classList.remove("active");
      hideTooltip();
      return;
    }
    const active = document.querySelector(".cell.active");
    if (active) active.classList.remove("active");
    cell.classList.add("active");
    showTooltip(text, event.clientX, event.clientY);
  });
}

function getColors(type) {
  return TYPE_COLORS[type] || DEFAULT_COLORS;
}

function displayType(type) {
  if (type === "WeightTraining") return "Weight Training";
  return type;
}

function formatNumber(value, fractionDigits) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(value);
}

function formatDistance(meters, units) {
  if (units.distance === "km") {
    return `${formatNumber(meters / 1000, 1)} km`;
  }
  return `${formatNumber(meters / 1609.344, 1)} mi`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

function formatElevation(meters, units) {
  if (units.elevation === "m") {
    return `${formatNumber(Math.round(meters), 0)} m`;
  }
  return `${formatNumber(Math.round(meters * 3.28084), 0)} ft`;
}

function formatHourLabel(hour) {
  const suffix = hour < 12 ? "a" : "p";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${suffix}`;
}

function buildSummary(payload, types, years, showTypeBreakdown, showActiveDays, hideDistanceElevation) {
  summary.innerHTML = "";

  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
  };
  const typeTotals = {};
  const activeDays = new Set();

  Object.entries(payload.aggregates || {}).forEach(([year, yearData]) => {
    if (!years.includes(Number(year))) return;
    Object.entries(yearData || {}).forEach(([type, entries]) => {
      if (!types.includes(type)) return;
      if (!typeTotals[type]) {
        typeTotals[type] = { count: 0 };
      }
      Object.entries(entries || {}).forEach(([dateStr, entry]) => {
        if ((entry.count || 0) > 0) {
          activeDays.add(dateStr);
        }
        totals.count += entry.count || 0;
        totals.distance += entry.distance || 0;
        totals.moving_time += entry.moving_time || 0;
        totals.elevation += entry.elevation_gain || 0;
        typeTotals[type].count += entry.count || 0;
      });
    });
  });

  const cards = [
    { title: "Total Workouts", value: totals.count.toLocaleString() },
  ];
  if (!hideDistanceElevation) {
    cards.push({
      title: "Total Distance",
      value: formatDistance(totals.distance, payload.units || { distance: "mi" }),
    });
    cards.push({
      title: "Total Elevation",
      value: formatElevation(totals.elevation, payload.units || { elevation: "ft" }),
    });
  }
  cards.push({ title: "Total Time", value: formatDuration(totals.moving_time) });
  if (showActiveDays) {
    cards.push({ title: "Active Days", value: activeDays.size.toLocaleString() });
  }

  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "summary-card";
    const title = document.createElement("div");
    title.className = "summary-title";
    title.textContent = card.title;
    const value = document.createElement("div");
    value.className = "summary-value";
    value.textContent = card.value;
    el.appendChild(title);
    el.appendChild(value);
    summary.appendChild(el);
  });

  if (showTypeBreakdown) {
    types.forEach((type) => {
      const typeCard = document.createElement("div");
      typeCard.className = "summary-card";
      const title = document.createElement("div");
      title.className = "summary-title";
      title.textContent = `${displayType(type)} Workouts`;
    const value = document.createElement("div");
    value.className = "summary-type";
    const dot = document.createElement("span");
    dot.className = "summary-dot";
    dot.style.background = getColors(type)[4];
    const text = document.createElement("span");
    text.textContent = (typeTotals[type]?.count || 0).toLocaleString();
    value.appendChild(dot);
    value.appendChild(text);
      typeCard.appendChild(title);
      typeCard.appendChild(value);
      summary.appendChild(typeCard);
    });
  }
}

function buildHeatmapArea(aggregates, year, units, colors, type, layout, options = {}) {
  const heatmapArea = document.createElement("div");
  heatmapArea.className = "heatmap-area";

  const monthRow = document.createElement("div");
  monthRow.className = "month-row";
  monthRow.style.paddingLeft = `${layout.gridPadLeft}px`;
  heatmapArea.appendChild(monthRow);

  const dayCol = document.createElement("div");
  dayCol.className = "day-col";
  dayCol.style.paddingTop = `${layout.gridPadTop}px`;
  dayCol.style.gap = `${layout.gap}px`;
  DAYS.forEach((label) => {
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = label;
    dayLabel.style.height = `${layout.cell}px`;
    dayLabel.style.lineHeight = `${layout.cell}px`;
    dayCol.appendChild(dayLabel);
  });
  heatmapArea.appendChild(dayCol);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = sundayOnOrBefore(yearStart);
  const end = saturdayOnOrAfter(yearEnd);

  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(year, month, 1);
    const weekIndex = Math.floor((monthStart - start) / (1000 * 60 * 60 * 24 * 7));
    const monthLabel = document.createElement("div");
    monthLabel.className = "month-label";
    monthLabel.textContent = MONTHS[month];
    monthLabel.style.left = `${weekIndex * (layout.cell + layout.gap)}px`;
    monthRow.appendChild(monthLabel);
  }

  const grid = document.createElement("div");
  grid.className = "grid";

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const dateStr = day.toISOString().slice(0, 10);
    const inYear = day.getFullYear() === year;
    const entry = (aggregates && aggregates[dateStr]) || {
      count: 0,
      distance: 0,
      moving_time: 0,
      elevation_gain: 0,
      activity_ids: [],
    };

    const weekIndex = Math.floor((day - start) / (1000 * 60 * 60 * 24 * 7));
    const row = day.getDay(); // Sunday=0

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = weekIndex + 1;
    cell.style.gridRow = row + 1;

    if (!inYear) {
      cell.classList.add("outside");
      grid.appendChild(cell);
      continue;
    }

    const filled = (entry.count || 0) > 0;
    if (filled && typeof options.colorForEntry === "function") {
      cell.style.background = options.colorForEntry(entry);
    } else {
      cell.style.background = filled ? colors[4] : colors[0];
    }

    const durationMinutes = Math.round((entry.moving_time || 0) / 60);
    const duration = durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
      : `${durationMinutes}m`;

    const lines = [
      dateStr,
      `${entry.count} workout${entry.count === 1 ? "" : "s"}`,
    ];

    const showDistanceElevation = (() => {
      if (type === "WeightTraining") return false;
      if (type === "all") {
        if (entry.types && entry.types.length === 1 && entry.types[0] === "WeightTraining") {
          return false;
        }
      }
      return true;
    })();

    if (type === "all" && entry.types && entry.types.length) {
      lines.push(`Types: ${entry.types.map(displayType).join(", ")}`);
    }

    if (showDistanceElevation) {
      const distance = units.distance === "km"
        ? `${(entry.distance / 1000).toFixed(2)} km`
        : `${(entry.distance / 1609.344).toFixed(2)} mi`;
      const elevation = units.elevation === "m"
        ? `${Math.round(entry.elevation_gain)} m`
        : `${Math.round(entry.elevation_gain * 3.28084)} ft`;
      lines.push(`Distance: ${distance}`);
      lines.push(`Elevation: ${elevation}`);
    }

    lines.push(`Duration: ${duration}`);
    const tooltipText = lines.join("\n");
    if (!isTouch) {
      cell.addEventListener("mouseenter", (event) => {
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener("mousemove", (event) => {
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener("mouseleave", hideTooltip);
    } else {
      cell.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        event.preventDefault();
        if (cell.classList.contains("active")) {
          cell.classList.remove("active");
          hideTooltip();
          return;
        }
        const active = grid.querySelector(".cell.active");
        if (active) active.classList.remove("active");
        cell.classList.add("active");
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
    }

    grid.appendChild(cell);
  }

  heatmapArea.appendChild(grid);
  return heatmapArea;
}

function buildCard(type, year, aggregates, units, options = {}) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = String(year);
  card.appendChild(title);

  const body = document.createElement("div");
  body.className = "card-body";

  const colors = type === "all" ? DEFAULT_COLORS : getColors(type);
  const layout = getLayout();
  const heatmapArea = buildHeatmapArea(aggregates, year, units, colors, type, layout, options);
  body.appendChild(heatmapArea);

  const stats = document.createElement("div");
  stats.className = "card-stats";
  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
  };
  Object.entries(aggregates || {}).forEach(([, entry]) => {
    totals.count += entry.count || 0;
    totals.distance += entry.distance || 0;
    totals.moving_time += entry.moving_time || 0;
    totals.elevation += entry.elevation_gain || 0;
  });

  const statItems = [
    { label: "Total Workouts", value: totals.count.toLocaleString() },
    { label: "Total Time", value: formatDuration(totals.moving_time) },
  ];

  const hideDistanceElevation = type === "WeightTraining";
  if (!hideDistanceElevation) {
    statItems.splice(1, 0, {
      label: "Total Distance",
      value: formatDistance(totals.distance, units || { distance: "mi" }),
    });
    statItems.push({
      label: "Total Elevation",
      value: formatElevation(totals.elevation, units || { elevation: "ft" }),
    });
  }

  statItems.forEach((item) => {
    const stat = document.createElement("div");
    stat.className = "card-stat";
    const label = document.createElement("div");
    label.className = "card-stat-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "card-stat-value";
    value.textContent = item.value;
    stat.appendChild(label);
    stat.appendChild(value);
    stats.appendChild(stat);
  });

  body.appendChild(stats);
  card.appendChild(body);
  return card;
}

function combineYearAggregates(yearData, types) {
  const combined = {};
  types.forEach((type) => {
    const entries = yearData?.[type] || {};
    Object.entries(entries).forEach(([dateStr, entry]) => {
      if (!combined[dateStr]) {
        combined[dateStr] = {
          count: 0,
          distance: 0,
          moving_time: 0,
          elevation_gain: 0,
          types: new Set(),
        };
      }
      combined[dateStr].count += entry.count || 0;
      combined[dateStr].distance += entry.distance || 0;
      combined[dateStr].moving_time += entry.moving_time || 0;
      combined[dateStr].elevation_gain += entry.elevation_gain || 0;
      if ((entry.count || 0) > 0) {
        combined[dateStr].types.add(type);
      }
    });
  });

  const result = {};
  Object.entries(combined).forEach(([dateStr, entry]) => {
    result[dateStr] = {
      count: entry.count,
      distance: entry.distance,
      moving_time: entry.moving_time,
      elevation_gain: entry.elevation_gain,
      types: Array.from(entry.types),
    };
  });
  return result;
}

function combineAggregatesByDate(payload, types, years) {
  const combined = {};
  years.forEach((year) => {
    const yearData = payload.aggregates?.[String(year)] || {};
    types.forEach((type) => {
      const entries = yearData?.[type] || {};
      Object.entries(entries).forEach(([dateStr, entry]) => {
        if (!combined[dateStr]) {
          combined[dateStr] = {
            count: 0,
            distance: 0,
            moving_time: 0,
            elevation_gain: 0,
          };
        }
        combined[dateStr].count += entry.count || 0;
        combined[dateStr].distance += entry.distance || 0;
        combined[dateStr].moving_time += entry.moving_time || 0;
        combined[dateStr].elevation_gain += entry.elevation_gain || 0;
      });
    });
  });
  return combined;
}

function getFilteredActivities(payload, types, years) {
  const activities = payload.activities || [];
  if (!activities.length) return [];
  const yearSet = new Set(years.map(Number));
  const typeSet = new Set(types);
  return activities.filter((activity) => (
    typeSet.has(activity.type) && yearSet.has(Number(activity.year))
  ));
}

function buildStatCard(title, subtitle) {
  const card = document.createElement("div");
  card.className = "card";
  const titleEl = document.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = title;
  card.appendChild(titleEl);
  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "stat-subtitle";
    subtitleEl.textContent = subtitle;
    card.appendChild(subtitleEl);
  }
  const body = document.createElement("div");
  body.className = "stat-body";
  card.appendChild(body);
  return { card, body };
}

function buildHeatmapRow(labels, values, colors, tooltipFormatter, tooltipLabels) {
  const container = document.createElement("div");
  container.className = "stat-row";

  const labelRow = document.createElement("div");
  labelRow.className = "stat-labels";
  labelRow.style.gridTemplateColumns = `repeat(${labels.length}, var(--cell))`;

  labels.forEach((label) => {
    const el = document.createElement("div");
    el.className = "stat-label";
    el.textContent = label;
    labelRow.appendChild(el);
  });

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.style.gridTemplateColumns = `repeat(${labels.length}, var(--cell))`;
  grid.style.gridTemplateRows = "repeat(1, var(--cell))";

  const max = values.reduce((acc, value) => Math.max(acc, value), 0);
  const tooltipNames = tooltipLabels || labels;
  values.forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.background = heatColor(colors[4], value, max);
    const tooltipText = tooltipFormatter ? tooltipFormatter(tooltipNames[index], value) : null;
    attachTooltip(cell, tooltipText);
    grid.appendChild(cell);
  });

  container.appendChild(labelRow);
  container.appendChild(grid);
  return container;
}

function buildHeatmapMatrix(monthLabels, dayLabels, matrixValues, colors) {
  const container = document.createElement("div");
  container.className = "stat-matrix";

  const monthRow = document.createElement("div");
  monthRow.className = "month-row";
  monthRow.style.paddingLeft = `${getLayout().gridPadLeft}px`;
  container.appendChild(monthRow);

  monthLabels.forEach((label, index) => {
    const x = index * (getLayout().cell + getLayout().gap);
    const el = document.createElement("div");
    el.className = "month-label";
    el.textContent = label;
    el.style.left = `${x}px`;
    monthRow.appendChild(el);
  });

  const dayCol = document.createElement("div");
  dayCol.className = "day-col";
  dayCol.style.paddingTop = `${getLayout().gridPadTop}px`;
  dayCol.style.gap = `${getLayout().gap}px`;
  dayLabels.forEach((label) => {
    const el = document.createElement("div");
    el.className = "day-label";
    el.textContent = label;
    el.style.height = `${getLayout().cell}px`;
    el.style.lineHeight = `${getLayout().cell}px`;
    dayCol.appendChild(el);
  });
  container.appendChild(dayCol);

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.style.gridTemplateColumns = `repeat(${monthLabels.length}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${dayLabels.length}, var(--cell))`;

  const max = matrixValues.reduce(
    (acc, row) => Math.max(acc, ...row),
    0,
  );

  dayLabels.forEach((dayLabel, row) => {
    monthLabels.forEach((monthLabel, col) => {
      const value = matrixValues[row][col] || 0;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.background = heatColor(colors[4], value, max);
      cell.style.gridColumn = col + 1;
      cell.style.gridRow = row + 1;
      attachTooltip(cell, `${dayLabel} · ${monthLabel}\n${value} workout${value === 1 ? "" : "s"}`);
      grid.appendChild(cell);
    });
  });

  container.appendChild(grid);
  return container;
}

function buildYearMatrix(years, colLabels, matrixValues, color, options = {}) {
  const container = document.createElement("div");
  container.className = "stat-matrix";

  const layout = getLayout();
  const labelRow = document.createElement("div");
  labelRow.className = "month-row";
  if (options.rotateLabels) {
    labelRow.classList.add("rotate-labels");
  }
  labelRow.style.paddingLeft = `${layout.gridPadLeft}px`;
  colLabels.forEach((label, index) => {
    if (!label) return;
    const el = document.createElement("div");
    el.className = "month-label";
    if (options.rotateLabels) {
      el.classList.add("diagonal");
    }
    el.textContent = label;
    el.style.left = `${index * (layout.cell + layout.gap)}px`;
    labelRow.appendChild(el);
  });
  container.appendChild(labelRow);

  const yearCol = document.createElement("div");
  yearCol.className = "day-col year-col";
  yearCol.style.paddingTop = `${layout.gridPadTop}px`;
  yearCol.style.gap = `${layout.gap}px`;
  years.forEach((year) => {
    const el = document.createElement("div");
    el.className = "day-label";
    el.textContent = String(year);
    el.style.height = `${layout.cell}px`;
    el.style.lineHeight = `${layout.cell}px`;
    yearCol.appendChild(el);
  });
  container.appendChild(yearCol);

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.style.gridTemplateColumns = `repeat(${colLabels.length}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${years.length}, var(--cell))`;

  const max = matrixValues.reduce(
    (acc, row) => Math.max(acc, ...row),
    0,
  );
  const tooltipLabels = options.tooltipLabels || colLabels;

  years.forEach((year, row) => {
    colLabels.forEach((_, col) => {
      const value = matrixValues[row]?.[col] || 0;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.gridColumn = col + 1;
      cell.style.gridRow = row + 1;
      cell.style.background = heatColor(color, value, max);
      if (options.tooltipFormatter) {
        const label = tooltipLabels[col];
        const tooltipText = options.tooltipFormatter(year, label, value);
        attachTooltip(cell, tooltipText);
      }
      grid.appendChild(cell);
    });
  });

  container.appendChild(grid);
  return container;
}

function calculateStreaks(activeDates) {
  if (!activeDates.length) {
    return { longest: 0, latest: 0 };
  }
  const sorted = activeDates.slice().sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const curr = new Date(`${sorted[i]}T00:00:00`);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current += 1;
    } else {
      longest = Math.max(longest, current);
      current = 1;
    }
  }
  longest = Math.max(longest, current);
  return { longest, latest: current };
}

function renderStats(payload, types, years, selectedType) {
  if (!stats) return;
  stats.innerHTML = "";

  const color = STAT_HEAT_COLOR;
  const yearsDesc = years.slice().sort((a, b) => b - a);
  const yearIndex = new Map();
  yearsDesc.forEach((year, index) => {
    yearIndex.set(Number(year), index);
  });

  const perYearAggregates = {};
  yearsDesc.forEach((year) => {
    const yearData = payload.aggregates?.[String(year)] || {};
    perYearAggregates[year] = combineYearAggregates(yearData, types);
  });

  const dayMatrix = yearsDesc.map((year) => {
    const counts = new Array(7).fill(0);
    Object.entries(perYearAggregates[year]).forEach(([dateStr, entry]) => {
      const count = entry.count || 0;
      if (count <= 0) return;
      const date = new Date(`${dateStr}T00:00:00`);
      counts[date.getDay()] += count;
    });
    return counts;
  });
  const dayTotals = dayMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(7).fill(0),
  );
  const bestDayIndex = dayTotals.reduce((best, value, index) => (
    value > dayTotals[best] ? index : best
  ), 0);
  const bestDayLabel = `${DAYS[bestDayIndex]} (${dayTotals[bestDayIndex]} workout${dayTotals[bestDayIndex] === 1 ? "" : "s"})`;

  const dayCard = buildStatCard("Workout Frequency by Day of Week", `Most active: ${bestDayLabel}`);
  dayCard.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      DAYS,
      dayMatrix,
      color,
      {
        rotateLabels: true,
        tooltipFormatter: (year, label, value) => (
          `${year} · ${label}\n${value} workout${value === 1 ? "" : "s"}`
        ),
      },
    ),
  );
  stats.appendChild(dayCard.card);

  const monthMatrix = yearsDesc.map((year) => {
    const counts = new Array(12).fill(0);
    Object.entries(perYearAggregates[year]).forEach(([dateStr, entry]) => {
      const count = entry.count || 0;
      if (count <= 0) return;
      const date = new Date(`${dateStr}T00:00:00`);
      counts[date.getMonth()] += count;
    });
    return counts;
  });
  const monthTotals = monthMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(12).fill(0),
  );
  const bestMonthIndex = monthTotals.reduce((best, value, index) => (
    value > monthTotals[best] ? index : best
  ), 0);
  const bestMonthLabel = `${MONTHS[bestMonthIndex]} (${monthTotals[bestMonthIndex]} workout${monthTotals[bestMonthIndex] === 1 ? "" : "s"})`;

  const monthCard = buildStatCard("Workout Frequency by Month", `Busiest month: ${bestMonthLabel}`);
  monthCard.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      MONTHS,
      monthMatrix,
      color,
      {
        rotateLabels: true,
        tooltipFormatter: (year, label, value) => (
          `${year} · ${label}\n${value} workout${value === 1 ? "" : "s"}`
        ),
      },
    ),
  );
  stats.appendChild(monthCard.card);

  const hourMatrix = yearsDesc.map(() => new Array(24).fill(0));
  const activities = getFilteredActivities(payload, types, yearsDesc);
  activities.forEach((activity) => {
    const row = yearIndex.get(Number(activity.year));
    if (row === undefined) return;
    const hour = Number(activity.hour);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      hourMatrix[row][hour] += 1;
    }
  });

  const hourTotals = hourMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(24).fill(0),
  );
  const bestHourIndex = hourTotals.reduce((best, value, index) => (
    value > hourTotals[best] ? index : best
  ), 0);
  const hourLabels = hourTotals.map((_, hour) => (hour % 3 === 0 ? formatHourLabel(hour) : ""));
  const hourTooltipLabels = hourTotals.map((_, hour) => `${formatHourLabel(hour)} (${hour}:00)`);
  const hourSubtitle = activities.length
    ? `Peak hour: ${formatHourLabel(bestHourIndex)} (${hourTotals[bestHourIndex]} workout${hourTotals[bestHourIndex] === 1 ? "" : "s"})`
    : "Peak hour: not enough time data yet";

  const hourCard = buildStatCard("Workout Frequency by Time of Day", hourSubtitle);
  if (activities.length) {
    hourCard.body.appendChild(
      buildYearMatrix(
        yearsDesc,
        hourLabels,
        hourMatrix,
        color,
        {
          tooltipLabels: hourTooltipLabels,
          tooltipFormatter: (year, label, value) => (
            `${year} · ${label}\n${value} workout${value === 1 ? "" : "s"}`
          ),
        },
      ),
    );
  } else {
    const fallback = document.createElement("div");
    fallback.className = "stat-subtitle";
    fallback.textContent = "Time-of-day stats require activity timestamps.";
    hourCard.body.appendChild(fallback);
  }
  stats.appendChild(hourCard.card);

  const weekendMatrix = yearsDesc.map((year) => {
    const counts = [0, 0];
    Object.entries(perYearAggregates[year]).forEach(([dateStr, entry]) => {
      const count = entry.count || 0;
      if (count <= 0) return;
      const date = new Date(`${dateStr}T00:00:00`);
      const dayIndex = date.getDay();
      if (dayIndex === 0 || dayIndex === 6) {
        counts[1] += count;
      } else {
        counts[0] += count;
      }
    });
    return counts;
  });
  const weekendTotals = weekendMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    [0, 0],
  );
  const weekendSubtitle = `Weekdays: ${weekendTotals[0]} · Weekends: ${weekendTotals[1]} · Left = Weekday, Right = Weekend`;

  const weekendCard = buildStatCard("Weekday vs Weekend Mix", weekendSubtitle);
  weekendCard.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      ["", ""],
      weekendMatrix,
      color,
      {
        tooltipLabels: ["Weekday", "Weekend"],
        tooltipFormatter: (year, label, value) => (
          `${year} · ${label}\n${value} workout${value === 1 ? "" : "s"}`
        ),
      },
    ),
  );
  stats.appendChild(weekendCard.card);
}

async function init() {
  const resp = await fetch("data.json");
  const payload = await resp.json();

  if (payload.generated_at) {
    const updatedAt = new Date(payload.generated_at);
    if (!Number.isNaN(updatedAt.getTime())) {
      updated.textContent = `Last updated: ${updatedAt.toLocaleString()}`;
    }
  }

  const typeOptions = [
    { value: "all", label: "All Workouts" },
    ...payload.types.map((type) => ({ value: type, label: displayType(type) })),
  ];

  const yearOptions = [
    { value: "all", label: "All Years" },
    ...payload.years.slice().reverse().map((year) => ({ value: String(year), label: String(year) })),
  ];

  function renderButtons(container, options, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.addEventListener("click", () => onSelect(option.value));
      container.appendChild(button);
    });
  }

  function renderSelect(select, options) {
    if (!select) return;
    select.innerHTML = "";
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
  }

  let resizeTimer = null;

  let selectedType = "all";
  let selectedYear = "all";

  function updateButtonState(container, value) {
    if (!container) return;
    container.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === value);
    });
  }

  function update() {
    const types = selectedType === "all" ? payload.types : [selectedType];
    const years = isStatsPage
      ? payload.years.slice()
      : (selectedYear === "all" ? payload.years : [Number(selectedYear)]);
    years.sort((a, b) => b - a);

    updateButtonState(typeButtons, selectedType);
    updateButtonState(yearButtons, selectedYear);
    if (typeSelect) typeSelect.value = selectedType;
    if (yearSelect) yearSelect.value = selectedYear;

    if (heatmaps) {
      heatmaps.innerHTML = "";
      if (selectedType === "all") {
        const section = document.createElement("div");
        section.className = "type-section";
        const header = document.createElement("div");
        header.className = "type-header";
        header.textContent = "All Workouts";
        section.appendChild(header);

        const list = document.createElement("div");
        list.className = "type-list";
        years.forEach((year) => {
          const yearData = payload.aggregates?.[String(year)] || {};
          const aggregates = combineYearAggregates(yearData, types);
          const colorForEntry = (entry) => {
            if (!entry.types || entry.types.length === 0) {
              return DEFAULT_COLORS[0];
            }
            if (entry.types.length === 1) {
              return getColors(entry.types[0])[4];
            }
            return MULTI_TYPE_COLOR;
          };
          const card = buildCard(
            "all",
            year,
            aggregates,
            payload.units || { distance: "mi", elevation: "ft" },
            { colorForEntry },
          );
          list.appendChild(card);
        });
        section.appendChild(list);
        heatmaps.appendChild(section);
      } else {
        types.forEach((type) => {
          const section = document.createElement("div");
          section.className = "type-section";
          const header = document.createElement("div");
          header.className = "type-header";
          header.textContent = displayType(type);
          section.appendChild(header);

          const list = document.createElement("div");
          list.className = "type-list";
          years.forEach((year) => {
            const aggregates = payload.aggregates?.[String(year)]?.[type] || {};
            const card = buildCard(type, year, aggregates, payload.units || { distance: "mi", elevation: "ft" });
            list.appendChild(card);
          });
          if (!list.childElementCount) {
            return;
          }
          section.appendChild(list);
          heatmaps.appendChild(section);
        });
      }
    }

    renderStats(payload, types, years, selectedType);

    const showTypeBreakdown = selectedType === "all";
    const showActiveDays = selectedType === "all" && Boolean(heatmaps);
    const hideDistanceElevation = selectedType === "WeightTraining";
    buildSummary(payload, types, years, showTypeBreakdown, showActiveDays, hideDistanceElevation);
  }

  renderButtons(typeButtons, typeOptions, (value) => {
    selectedType = value;
    update();
  });
  renderButtons(yearButtons, yearOptions, (value) => {
    selectedYear = value;
    update();
  });
  renderSelect(typeSelect, typeOptions);
  renderSelect(yearSelect, yearOptions);

  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      selectedType = typeSelect.value;
      update();
    });
  }
  if (yearSelect) {
    yearSelect.addEventListener("change", () => {
      selectedYear = yearSelect.value;
      update();
    });
  }
  update();

  window.addEventListener("resize", () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      update();
    }, 150);
  });

  if (isTouch) {
    document.addEventListener("pointerdown", (event) => {
      if (!tooltip.classList.contains("visible")) return;
      const target = event.target;
      if (tooltip.contains(target)) {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
        return;
      }
      if (!target.classList.contains("cell")) {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
      }
    });

    window.addEventListener(
      "scroll",
      () => {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
      },
      { passive: true },
    );
  }
}

init().catch((error) => {
  console.error(error);
});
