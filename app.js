const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  items: [],
  categories: {},
  category: "all",
  search: "",
  sort: "priority",
  savedOnly: false,
  visible: 8,
  saved: new Set(readStore("daily-intel:saved", [])),
  read: new Set(readStore("daily-intel:read", [])),
  actions: new Set(readStore("daily-intel:actions", []))
};

const elements = {
  feed: $("#news-feed"),
  resultCount: $("#result-count"),
  feedTitle: $("#feed-title"),
  search: $("#search-input"),
  sort: $("#sort-select"),
  loadMore: $("#load-more"),
  dialog: $("#detail-dialog"),
  dialogContent: $("#dialog-content"),
  toast: $("#toast")
};

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify([...value]));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch { return "#"; }
}

function renderIcons() {
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true", "stroke-width": 1.8 } });
}

function relativeTime(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.max(0, Math.floor(diff / 36e5));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} 天前` : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(dateString));
}

function formatUpdated(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "更新时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function filteredItems() {
  const search = state.search.toLowerCase().trim();
  return state.items
    .filter(item => state.category === "all" || item.category === state.category)
    .filter(item => !state.savedOnly || state.saved.has(item.id))
    .filter(item => !search || [item.title, item.summary, item.source, ...(item.tags || [])].join(" ").toLowerCase().includes(search))
    .sort((a, b) => {
      if (state.sort === "latest") return new Date(b.publishedAt) - new Date(a.publishedAt);
      if (state.sort === "opportunity") return b.opportunity - a.opportunity;
      if (state.sort === "trust") return b.trust - a.trust;
      return b.priority - a.priority;
    });
}

function itemCard(item) {
  const saved = state.saved.has(item.id);
  const read = state.read.has(item.id);
  const tags = (item.tags || []).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="news-card${read ? " is-read" : ""}" data-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category)}">
      <span class="category-bar" aria-hidden="true"></span>
      <div class="card-body">
        <div class="card-meta">
          <span class="category-name">${escapeHtml(state.categories[item.category] || item.category)}</span>
          <span class="meta-sep">·</span><span>${escapeHtml(item.source)}</span>${item.kind === "guide" ? '<span class="guide-badge">指南</span>' : ""}${item.aiAnalysis ? '<span class="ai-badge"><i data-lucide="sparkles"></i>AI 分析</span>' : ""}
          <span class="meta-sep">·</span><time datetime="${escapeHtml(item.publishedAt)}">${relativeTime(item.publishedAt)}</time>
        </div>
        <h3><button class="open-detail" type="button">${escapeHtml(item.title)}</button></h3>
        <p class="summary">${escapeHtml(item.summary)}</p>
        <div class="card-footer">
          <span class="score-pill opportunity"><i data-lucide="trending-up"></i>机会 ${item.opportunity}</span>
          <span class="score-pill"><i data-lucide="shield-check"></i>可信 ${item.trust}</span>
          <div class="tags">${tags}</div>
        </div>
      </div>
      <button class="save-icon${saved ? " saved" : ""}" type="button" aria-label="${saved ? "取消收藏" : "收藏"}"><i data-lucide="bookmark"></i></button>
    </article>`;
}

function renderFeed() {
  const items = filteredItems();
  const visibleItems = items.slice(0, state.visible);
  const categoryLabel = state.category === "all" ? "情报流" : state.categories[state.category];
  elements.feedTitle.textContent = state.savedOnly ? "我的收藏" : categoryLabel;
  elements.resultCount.textContent = `${items.length} 条`;
  elements.feed.innerHTML = visibleItems.length ? visibleItems.map(itemCard).join("") : `
    <div class="empty-state"><i data-lucide="search-x"></i><h3>没有找到匹配资讯</h3><p>试试更换关键词或分类。</p></div>`;
  elements.loadMore.hidden = state.visible >= items.length;
  $("#saved-count").textContent = state.saved.size;
  renderIcons();
}

function renderCounts() {
  const counts = { all: state.items.length };
  state.items.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
  Object.entries(counts).forEach(([key, value]) => {
    const node = $(`#count-${key}`);
    if (node) node.textContent = value;
  });
}

function renderActions() {
  const candidates = [...state.items]
    .sort((a, b) => b.priority - a.priority)
    .filter((item, index, all) => all.findIndex(other => other.category === item.category) === index)
    .slice(0, 5);
  $("#action-list").innerHTML = candidates.map(item => {
    const actionId = `${item.id}:0`;
    const done = state.actions.has(actionId);
    return `<div class="action-item${done ? " done" : ""}" data-action-id="${escapeHtml(actionId)}">
      <button class="action-check" type="button" aria-label="${done ? "标记为未完成" : "标记为完成"}">${done ? `<i data-lucide="check"></i>` : ""}</button>
      <p>${escapeHtml(item.actionSteps[0])}<small>${escapeHtml(state.categories[item.category])} · ${escapeHtml(item.title.slice(0, 18))}${item.title.length > 18 ? "…" : ""}</small></p>
    </div>`;
  }).join("");
  $("#metric-actions").textContent = candidates.length;
  renderIcons();
}

function renderSummary(data) {
  const top = [...state.items].sort((a, b) => b.priority - a.priority)[0];
  $("#strong-signal").textContent = top ? `${top.title}。建议先完成：${top.actionSteps[0]}。` : "暂无足够数据生成今日信号。";
  $("#metric-items").textContent = state.items.length;
  $("#metric-sources").textContent = new Set(state.items.map(item => item.source)).size;
  const updated = formatUpdated(data.generatedAt);
  $("#last-updated").textContent = updated;
  $("#sidebar-updated").textContent = `${updated} 已同步`;
  if (["ok", "cached", "partial"].includes(data.ai?.status)) {
    $("#sync-label").textContent = "AI 增强已开启";
  } else if (data.ai?.status === "error") {
    $("#sync-label").textContent = "AI 分析已回退";
  }
  const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  $("#today-label").textContent = today;
  if (data.status === "partial") $(".status-dot").style.background = "#e7a83a";
}

function setCategory(category) {
  state.category = category;
  state.savedOnly = false;
  state.visible = 8;
  $("#saved-filter").classList.remove("active");
  $$('[data-category]').forEach(button => button.classList.toggle("active", button.dataset.category === category));
  document.body.classList.remove("menu-open");
  $("#menu-button").setAttribute("aria-expanded", "false");
  renderFeed();
}

function toggleSaved(id) {
  state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
  writeStore("daily-intel:saved", state.saved);
  showToast(state.saved.has(id) ? "已收藏" : "已取消收藏");
  renderFeed();
}

function openDetail(id) {
  const item = state.items.find(entry => entry.id === id);
  if (!item) return;
  state.read.add(id);
  writeStore("daily-intel:read", state.read);
  elements.dialogContent.innerHTML = `<div class="detail-inner">
    <p class="detail-eyebrow">${escapeHtml(state.categories[item.category])}</p>
    <h2>${escapeHtml(item.title)}</h2>
    <div class="detail-source">${escapeHtml(item.source)} · ${relativeTime(item.publishedAt)}</div>
    <p class="detail-summary">${escapeHtml(item.summary)}</p>
    ${item.aiAnalysis?.whyItMatters ? `<section class="analysis-block"><h3><i data-lucide="sparkles"></i>为什么值得关注</h3><p>${escapeHtml(item.aiAnalysis.whyItMatters)}</p></section>` : ""}
    ${item.aiAnalysis?.riskNotes ? `<section class="risk-block"><h3><i data-lucide="triangle-alert"></i>风险与证据边界</h3><p>${escapeHtml(item.aiAnalysis.riskNotes)}</p></section>` : ""}
    <h3>把信息变成行动</h3>
    <ol class="detail-steps">${item.actionSteps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    <div class="detail-scores">
      <span><b>${item.priority}</b><small>综合价值</small></span>
      <span><b>${item.opportunity}</b><small>机会指数</small></span>
      <span><b>${item.trust}</b><small>信源可信度</small></span>
    </div>
    ${item.link ? `<a class="source-link" href="${escapeHtml(safeUrl(item.link))}" target="_blank" rel="noopener noreferrer">阅读原文<i data-lucide="external-link"></i></a>` : '<span class="editorial-note">本条为工作台内置实操手册</span>'}
  </div>`;
  elements.dialog.showModal();
  renderIcons();
  renderFeed();
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

async function loadData() {
  try {
    const response = await fetch(`data/news.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.items = Array.isArray(data.items) ? data.items : [];
    state.categories = data.categories || {};
    renderCounts();
    renderSummary(data);
    renderActions();
    renderFeed();
  } catch (error) {
    console.error(error);
    elements.feed.innerHTML = `<div class="empty-state"><i data-lucide="cloud-off"></i><h3>暂时无法读取资讯</h3><p>请确认 data/news.json 已生成，然后刷新页面。</p></div>`;
    renderIcons();
  }
}

$("#category-nav").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (button) setCategory(button.dataset.category);
});

$("#filter-chips").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (button) setCategory(button.dataset.category);
});

elements.feed.addEventListener("click", event => {
  const card = event.target.closest(".news-card");
  if (!card) return;
  if (event.target.closest(".save-icon")) toggleSaved(card.dataset.id);
  else if (event.target.closest(".open-detail")) openDetail(card.dataset.id);
});

$("#action-list").addEventListener("click", event => {
  const item = event.target.closest(".action-item");
  if (!item || !event.target.closest(".action-check")) return;
  state.actions.has(item.dataset.actionId) ? state.actions.delete(item.dataset.actionId) : state.actions.add(item.dataset.actionId);
  writeStore("daily-intel:actions", state.actions);
  renderActions();
});

elements.search.addEventListener("input", event => { state.search = event.target.value; state.visible = 8; renderFeed(); });
elements.sort.addEventListener("change", event => { state.sort = event.target.value; renderFeed(); });
elements.loadMore.addEventListener("click", () => { state.visible += 8; renderFeed(); });

$("#saved-filter").addEventListener("click", () => {
  state.savedOnly = !state.savedOnly;
  state.category = "all";
  state.visible = 8;
  $("#saved-filter").classList.toggle("active", state.savedOnly);
  $$('[data-category]').forEach(button => button.classList.toggle("active", !state.savedOnly && button.dataset.category === "all"));
  renderFeed();
});

$("#theme-button").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("daily-intel:theme", dark ? "dark" : "light");
  $("#theme-button").innerHTML = `<i data-lucide="${dark ? "sun" : "moon"}"></i>`;
  $("#theme-button").setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
  renderIcons();
});

$("#menu-button").addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  $("#menu-button").setAttribute("aria-expanded", String(open));
});
$("#mobile-overlay").addEventListener("click", () => document.body.classList.remove("menu-open"));
$("#dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });
document.addEventListener("keydown", event => { if (event.key === "/" && document.activeElement !== elements.search) { event.preventDefault(); elements.search.focus(); } });

const savedTheme = localStorage.getItem("daily-intel:theme");
if (savedTheme === "dark" || (!savedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.dataset.theme = "dark";
  $("#theme-button").innerHTML = '<i data-lucide="sun"></i>';
  $("#theme-button").setAttribute("aria-label", "切换浅色模式");
}

window.addEventListener("DOMContentLoaded", renderIcons);
loadData();
