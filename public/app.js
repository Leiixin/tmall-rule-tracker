const categoryLabels = {
  effectivePeriod: "效期",
  shopExperienceScore: "店铺体验分",
  shippingTimeliness: "发货时效",
  shippingViolationPenalty: "发货违规及处罚"
};

const statusBar = document.getElementById("statusBar");
const conclusionCards = document.getElementById("conclusionCards");
const dashboardCards = document.getElementById("dashboardCards");
const tableBody = document.getElementById("ruleTableBody");
const filterSelect = document.getElementById("categoryFilter");
const refreshBtn = document.getElementById("refreshBtn");
const presentationUpdated = document.getElementById("presentationUpdated");
const presentationMeta = document.getElementById("presentationMeta");
const experienceTableHead = document.getElementById("experienceTableHead");
const experienceTableBody = document.getElementById("experienceTableBody");
const timelinessTableHead = document.getElementById("timelinessTableHead");
const timelinessTableBody = document.getElementById("timelinessTableBody");
const violationTableHead = document.getElementById("violationTableHead");
const violationTableBody = document.getElementById("violationTableBody");

function formatDate(value) {
  if (!value || value === "-") {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatus(status, dashboard) {
  const lastRun = status?.scheduler?.timestamp
    ? formatDate(status.scheduler.timestamp)
    : "暂无";

  statusBar.textContent = `最近抓取: ${lastRun} | 本地规则条数: ${dashboard.totalRules}`;
}

function renderTableHead(container, columns) {
  if (!container) {
    return;
  }
  container.innerHTML = `<tr>${(columns || []).map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>`;
}

function renderTableRows(container, rows, fields, emptyHint) {
  if (!container) {
    return;
  }

  if (!rows || !rows.length) {
    container.innerHTML = `<tr><td colspan="${fields.length}">${escapeHtml(emptyHint)}</td></tr>`;
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const cells = fields
        .map((field) => `<td>${escapeHtml(row?.[field] || "-")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
}

function renderPresentation(payload) {
  const experience = payload?.experience || {};
  const shipping = payload?.shipping || {};

  presentationUpdated.textContent = `整理更新时间: ${formatDate(payload?.updatedAt)}`;
  presentationMeta.textContent =
    `体验分依据: ${experience.sourceRule || "-"}（${formatDate(experience.sourcePublishedAt)}） | ` +
    `发货&赔付依据: ${shipping.sourceRule || "-"}（${formatDate(shipping.sourcePublishedAt)}）`;

  renderTableHead(experienceTableHead, experience.columns || []);
  renderTableRows(
    experienceTableBody,
    experience.rows || [],
    ["scoreModel", "dimension", "metric", "formula", "scoreLogic", "notes"],
    "暂无体验分规则整理结果。"
  );

  renderTableHead(timelinessTableHead, shipping.timelinessColumns || []);
  renderTableRows(
    timelinessTableBody,
    shipping.timelinessRows || [],
    ["deliveryTime", "setup", "standard", "extra", "tool"],
    "暂无发货时效整理结果。"
  );

  renderTableHead(violationTableHead, shipping.violationColumns || []);
  renderTableRows(
    violationTableBody,
    shipping.violationRows || [],
    ["type", "scene", "penalty"],
    "暂无违规赔付整理结果。"
  );
}

function renderConclusionCards(sections) {
  conclusionCards.innerHTML = sections
    .map((section) => {
      const findings = (section.findings || [])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const actions = (section.actions || [])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const latestRules = (section.latestRules || [])
        .map(
          (rule) =>
            `<li>${escapeHtml(rule.title)} <span class="muted">(${formatDate(rule.publishedAt)})</span></li>`
        )
        .join("");

      return `
      <article class="insight-card">
        <h3>${escapeHtml(section.label)}</h3>
        <div class="meta">最近更新: ${formatDate(section.latestPublishedAt)} | 命中规则: ${section.ruleCount || 0}</div>
        <div class="block-title">结论</div>
        <ul>${findings}</ul>
        <div class="block-title">建议动作</div>
        <ul>${actions}</ul>
        <div class="block-title">近期依据</div>
        <ul>${latestRules}</ul>
      </article>
      `;
    })
    .join("");
}

function renderCards(cards) {
  dashboardCards.innerHTML = cards
    .map(
      (card) => `
      <article class="card">
        <h3>${escapeHtml(card.label)}</h3>
        <div class="meta">${formatDate(card.publishedAt)} | ${escapeHtml(card.source || "-")}</div>
        <p>${escapeHtml(card.detail)}</p>
      </article>
    `
    )
    .join("");
}

function renderRules(items) {
  if (!items.length) {
    tableBody.innerHTML = `<tr><td colspan="4">暂无数据，点击“立即抓取”尝试同步天猫规则。</td></tr>`;
    return;
  }

  tableBody.innerHTML = items
    .map((item) => {
      const tags = (item.tags || [])
        .map((tag) => `<span class="tag">${categoryLabels[tag] || tag}</span>`)
        .join("");

      return `
      <tr>
        <td>${formatDate(item.publishedAt)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.source || "-")}</td>
        <td>${tags || "-"}</td>
      </tr>
      `;
    })
    .join("");
}

async function loadRules() {
  const category = filterSelect.value;
  const response = await fetch(`/api/rules?limit=80&category=${encodeURIComponent(category)}`);
  const data = await response.json();
  renderRules(data.items || []);
}

async function loadOverview() {
  const [statusRes, dashboardRes, conclusionRes] = await Promise.all([
    fetch("/api/status"),
    fetch("/api/dashboard"),
    fetch("/api/conclusions")
  ]);

  const status = await statusRes.json();
  const dashboard = await dashboardRes.json();
  const conclusions = await conclusionRes.json();

  renderStatus(status, dashboard);
  renderCards(dashboard.cards || []);
  renderConclusionCards(conclusions.sections || []);
}

async function loadPresentation() {
  const response = await fetch("/api/presentation");
  const payload = await response.json();
  renderPresentation(payload);
}

async function initialize() {
  await Promise.all([loadOverview(), loadRules(), loadPresentation()]);
}

filterSelect.addEventListener("change", async () => {
  await loadRules();
});

refreshBtn.addEventListener("click", async () => {
  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "抓取中...";

    const response = await fetch("/api/crawl", { method: "POST" });
    const result = await response.json();

    statusBar.textContent = `抓取完成: 新抓取 ${result.fetched} 条, 当前共 ${result.stored} 条`;

    await Promise.all([loadOverview(), loadRules(), loadPresentation()]);
  } catch {
    statusBar.textContent = "抓取失败：请检查网络或稍后重试。";
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "立即抓取";
  }
});

initialize().catch(() => {
  statusBar.textContent = "初始化失败：请检查服务是否已启动。";
});
