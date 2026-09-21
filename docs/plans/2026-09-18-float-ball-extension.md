# 悬浮球浏览器扩展 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个 Chrome/Edge MV3 扩展：所有网页右下角出现可拖拽悬浮球，点击展开面板，含「添加投递信息」「详情」两个按钮（本期仅 UI）。

**Architecture:** 单一 content script 注入 Shadow DOM 宿主元素，球体与面板全部渲染在 closed shadow root 内实现样式双向隔离；位置记忆用 localStorage（按站点）；无 background、无 popup、无网络权限。

**Tech Stack:** 原生 HTML/CSS/JS（Manifest V3）。零依赖：不用 npm、不用 pip、无构建步骤。

**Git:** 客户自行管理版本，本计划不含任何 git 步骤。

**Spec:** `docs/superpowers/specs/2026-09-18-float-ball-extension-design.md`

---

## 文件结构

```
D:\recorded\float-ball-extension\
├── manifest.json    # MV3 清单（Task 1）
├── content.css      # 宿主元素定位样式（Task 2）
├── content.js       # 悬浮球全部逻辑（Task 3）
└── README.md        # 安装与使用说明（Task 4）
```

单文件单职责：manifest 只管声明，content.css 只管宿主定位（球体样式在 Shadow DOM 内，由 content.js 注入），content.js 只管交互逻辑。

**注意：本项目无自动化测试框架（客户明确要求零依赖），每个 Task 的验证步骤为语法校验 + 浏览器手工验收，替代 TDD 红绿循环。**

---

### Task 1: 目录与 manifest.json

**Files:**
- Create: `D:\recorded\float-ball-extension\manifest.json`

- [ ] **Step 1: 创建目录并写入 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "悬浮球 - 投递助手",
  "version": "0.1.0",
  "description": "在所有网页显示悬浮球，提供『添加投递信息』『详情』入口（当前版本仅按钮 UI）",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "all_frames": false,
      "run_at": "document_idle"
    }
  ]
}
```

要点：不声明 `icons`（用浏览器默认拼图图标）；不声明 `permissions` / `host_permissions`（本期无存储、无网络需求，localStorage 是页面自身能力）。

- [ ] **Step 2: 校验 JSON 合法性**

Run: `python -m json.tool D:\recorded\float-ball-extension\manifest.json`
Expected: 原样打印 JSON，退出码 0，无报错。

---

### Task 2: content.css（宿主定位）

**Files:**
- Create: `D:\recorded\float-ball-extension\content.css`

- [ ] **Step 1: 写入宿主元素样式**

```css
/* 悬浮球宿主元素：仅负责定位与层级，球体/面板样式在 Shadow DOM 内（content.js 注入） */
#__float_ball_host__ {
  position: fixed;
  z-index: 2147483647;
  line-height: 0;
  /* left/top 由 content.js 设置 */
}
```

- [ ] **Step 2: 目视检查**：文件仅含上述一个选择器，无其他规则（避免污染宿主页面）。

---

### Task 3: content.js（核心逻辑）

**Files:**
- Create: `D:\recorded\float-ball-extension\content.js`

- [ ] **Step 1: 写入完整实现**

```js
// content.js — 悬浮球注入逻辑（IIFE，避免污染页面全局作用域）
(() => {
  'use strict';

  const BALL_SIZE = 48;        // 球体直径 px
  const EDGE_GAP = 24;         // 默认/吸附时距边缘 px
  const DRAG_THRESHOLD = 5;    // 位移超过该值视为拖拽，否则视为点击
  const STORAGE_KEY = '__float_ball_pos__';
  const HOST_ID = '__float_ball_host__';

  // ===== 后续功能预留接口（本期仅占位） =====
  function onAddDeliveryInfo() {
    // TODO(下一期): 解析当前网页公司名称并录入投递信息
    console.log('[float-ball] 点击了「添加投递信息」（功能待实现）');
  }
  function onShowDetail() {
    // TODO(下一期): 展示投递详情
    console.log('[float-ball] 点击了「详情」（功能待实现）');
  }

  // ===== 位置持久化（localStorage 按站点记忆，失败静默降级） =====
  function loadPos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const pos = JSON.parse(raw);
      return Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null;
    } catch (_) { return null; }
  }
  function savePos(x, y) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })); } catch (_) {}
  }
  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function init() {
    try {
      if (window.top !== window.self) return;                    // 双保险：iframe 不注入
      if (document.getElementById(HOST_ID)) return;              // 防重复注入

      // ---- 宿主 + closed Shadow DOM（样式双向隔离） ----
      const host = document.createElement('div');
      host.id = HOST_ID;
      const shadow = host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        .ball {
          width: ${BALL_SIZE}px; height: ${BALL_SIZE}px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f8cff 0%, #2b5cd9 100%);
          box-shadow: 0 4px 14px rgba(43, 92, 217, .45);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; line-height: 1; cursor: grab;
          user-select: none; -webkit-user-select: none;
          touch-action: none;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .ball:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(43,92,217,.55); }
        .ball:active { cursor: grabbing; }
        .panel {
          position: absolute; bottom: calc(100% + 12px);
          display: none; flex-direction: column; gap: 8px;
          padding: 10px;
          background: #ffffff; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(0,0,0,.18);
          min-width: 148px;
        }
        .panel.open { display: flex; }
        .panel.align-right { right: 0; }
        .panel.align-left { left: 0; }
        .panel button {
          all: unset;
          box-sizing: border-box;
          display: block; width: 100%;
          padding: 9px 14px;
          font: 14px/1.4 system-ui, "Microsoft YaHei", sans-serif;
          color: #2b5cd9; text-align: center;
          background: #eef3ff; border-radius: 8px;
          cursor: pointer;
        }
        .panel button:hover { background: #dde8ff; }
        .panel button:active { background: #cddcff; }
      `;

      const panel = document.createElement('div');
      panel.className = 'panel';
      const btnAdd = document.createElement('button');
      btnAdd.textContent = '添加投递信息';
      btnAdd.addEventListener('click', onAddDeliveryInfo);
      const btnDetail = document.createElement('button');
      btnDetail.textContent = '详情';
      btnDetail.addEventListener('click', onShowDetail);
      panel.append(btnAdd, btnDetail);

      const ball = document.createElement('div');
      ball.className = 'ball';
      ball.textContent = '💼';
      ball.setAttribute('title', '投递助手');

      shadow.append(style, panel, ball);

      // ---- 初始位置：记忆值或默认右下角，钳制在视口内 ----
      const pos = loadPos() || {
        x: window.innerWidth - BALL_SIZE - EDGE_GAP,
        y: window.innerHeight - BALL_SIZE - EDGE_GAP,
      };
      host.style.left = clamp(pos.x, 0, Math.max(0, window.innerWidth - BALL_SIZE)) + 'px';
      host.style.top = clamp(pos.y, 0, Math.max(0, window.innerHeight - BALL_SIZE)) + 'px';

      // ---- 面板开合 ----
      function openPanel() {
        const onRightHalf = host.offsetLeft + BALL_SIZE / 2 > window.innerWidth / 2;
        panel.classList.toggle('align-right', onRightHalf);
        panel.classList.toggle('align-left', !onRightHalf);
        panel.classList.add('open');
      }
      function closePanel() { panel.classList.remove('open'); }
      function togglePanel() { panel.classList.contains('open') ? closePanel() : openPanel(); }

      // ---- 拖拽 + 点击判定（Pointer Events，鼠标/触屏通吃） ----
      let dragging = false, moved = false;
      let startX = 0, startY = 0, originX = 0, originY = 0;

      ball.addEventListener('pointerdown', (e) => {
        dragging = true; moved = false;
        startX = e.clientX; startY = e.clientY;
        originX = host.offsetLeft; originY = host.offsetTop;
        ball.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      ball.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        closePanel();
        host.style.left = clamp(originX + dx, 0, Math.max(0, window.innerWidth - BALL_SIZE)) + 'px';
        host.style.top = clamp(originY + dy, 0, Math.max(0, window.innerHeight - BALL_SIZE)) + 'px';
      });
      ball.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        if (moved) {
          // 吸附至最近左/右边缘并记忆
          const snapX = (host.offsetLeft + BALL_SIZE / 2 < window.innerWidth / 2)
            ? EDGE_GAP
            : Math.max(0, window.innerWidth - BALL_SIZE - EDGE_GAP);
          host.style.left = snapX + 'px';
          savePos(snapX, host.offsetTop);
        } else {
          togglePanel();
        }
      });

      // ---- 点击外部收起（closed shadow 下事件目标会重定向为 host） ----
      document.addEventListener('pointerdown', (e) => {
        if (!host.contains(e.target)) closePanel();
      }, true);

      // ---- 视口变化时钳制回可视区 ----
      window.addEventListener('resize', () => {
        host.style.left = clamp(host.offsetLeft, 0, Math.max(0, window.innerWidth - BALL_SIZE)) + 'px';
        host.style.top = clamp(host.offsetTop, 0, Math.max(0, window.innerHeight - BALL_SIZE)) + 'px';
      });

      (document.head || document.documentElement).appendChild(host);
    } catch (err) {
      console.warn('[float-ball] 初始化失败（不影响宿主页面）:', err);
    }
  }

  init();
})();
```

- [ ] **Step 2: 语法校验**

Run: `node --check D:\recorded\float-ball-extension\content.js`
Expected: 无输出，退出码 0。

---

### Task 4: README.md

**Files:**
- Create: `D:\recorded\float-ball-extension\README.md`

- [ ] **Step 1: 写入安装使用说明**

````markdown
# 悬浮球 - 投递助手（v0.1.0）

Chrome / Edge 通用扩展：所有网页右下角显示可拖拽悬浮球，点击展开面板，含「添加投递信息」「详情」两个按钮。
**当前版本按钮仅 UI，功能待后续迭代。**

## 安装（Chrome 与 Edge 步骤相同）

1. 地址栏打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展」，选择本目录（`float-ball-extension`）
4. 打开任意普通网页（如 https://www.bing.com ），右下角出现 💼 悬浮球即成功

## 使用

- **拖拽**：按住球拖动，松手自动吸附左/右边缘，位置按站点记忆
- **点击**：展开/收起功能面板
- **收起**：再次点击球，或点击页面其他区域

## 已知边界

- `chrome://`、`edge://`、扩展商店等浏览器内部页面不显示（浏览器安全限制）
- iframe 内不显示，每个标签页仅一个球

## 目录结构

| 文件 | 职责 |
|---|---|
| manifest.json | MV3 清单，声明 content script |
| content.css | 宿主元素定位样式 |
| content.js | 悬浮球全部逻辑（Shadow DOM 隔离） |
````

- [ ] **Step 2: 目视检查**：Markdown 渲染正常，无占位符。

---

### Task 5: 浏览器手工验收（Chrome + Edge 各跑一遍）

**Files:** 无新增，验收 Spec 第 4 节 7 条标准。

- [ ] **Step 1: 加载扩展**：按 README 步骤在 Chrome `chrome://extensions` 加载 `D:\recorded\float-ball-extension`，确认无红色错误。
- [ ] **Step 2: 验收清单**（Chrome）：

| # | 操作 | 预期 |
|---|---|---|
| 1 | 打开 https://www.bing.com | 右下角出现 💼 悬浮球 |
| 2 | 拖球到屏幕中部松手 | 自动吸附到最近侧边缘 |
| 3 | 刷新页面 | 球出现在刚才吸附的位置 |
| 4 | 点击球 | 上方展开面板，含「添加投递信息」「详情」两按钮 |
| 5 | 点击任一按钮 | 页面无变化；F12 控制台出现 `[float-ball]` 占位 log |
| 6 | 再次点球 / 点页面空白 | 面板收起 |
| 7 | 打开含 iframe 的页面（如新闻站） | 仅一个球 |
| 8 | 打开 `chrome://extensions` | 无球（预期行为），扩展无报错 |

- [ ] **Step 3: Edge 重复 Step 1-2**（`edge://extensions`）。
- [ ] **Step 4: 样式隔离抽查**：在一个重样式网站（如知乎/微博）确认球体外观不变形、页面布局无异常。

**全部通过 → 交付。任何一条不符 → 记录现象，回到对应 Task 修复后重跑本 Task。**
