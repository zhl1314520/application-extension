# 悬浮球浏览器扩展 — 设计文档

日期：2026-09-18
状态：已确认（客户拍板）
项目目录：`D:\recorded\float-ball-extension`

## 1. 背景与目标

客户需要一个 Windows 桌面浏览器（Chrome / Edge）个人工具：浏览器中任何网页上出现一个悬浮球，点击悬浮球展开面板，面板内含两个功能按钮：

1. **添加投递信息**
2. **详情**

**本阶段范围：只做按钮 UI，按钮的具体功能不实现**（点击仅预留占位回调，输出 console log）。

后续迭代方向（本期不做，仅记录）：点击「添加投递信息」时解析当前网页所指的公司名称；Python 3.10 可作为后续本地后端（如 FastAPI）候选技术。

## 2. 已对齐的关键口径

| 决策点 | 结论 |
|---|---|
| 载体形态 | 浏览器扩展（Manifest V3），content script 注入悬浮球 |
| 显示范围 | 所有网页（`<all_urls>`，仅顶层 frame） |
| 依赖 | 纯前端零依赖：原生 HTML/CSS/JS，无 npm、无 pip、无构建 |
| 本机环境 | Python 3.10.10（本期不用）、Node v22.21.0（本期不用） |
| 浏览器 | Chrome 与 Edge 共用同一份代码（均为 MV3） |

## 3. 架构设计

```
float-ball-extension/
├── manifest.json    # MV3 清单：仅声明 content_scripts，无 background/popup
├── content.js       # 注入逻辑：Shadow DOM 宿主 + 悬浮球 + 面板 + 拖拽
├── content.css      # （备用）宿主元素定位样式；球与面板样式内置于 Shadow DOM
└── README.md        # 安装与使用说明
```

### 3.1 manifest.json 要点

- `manifest_version: 3`
- `content_scripts`：`matches: ["<all_urls>"]`，`js: ["content.js"]`，`css: ["content.css"]`，`all_frames: false`，`run_at: "document_idle"`
- 不声明 `icons`（使用浏览器默认拼图图标），不声明 host_permissions（本期无网络/存储需求）

### 3.2 悬浮球（content.js）

- 创建一个 `<div>` 宿主，`position: fixed`，挂到 `document.documentElement`，`z-index: 2147483647`
- 宿主内使用 **Shadow DOM（closed）** 渲染球体与面板，实现与宿主页面 CSS 双向隔离
- 球体：圆形（约 48px），默认停靠**右下角**（距边缘 24px），带图标/文字标识
- **可拖拽**：鼠标按下拖动改变位置，松手吸附至最近的左/右边缘；位置存入 `localStorage`（按站点记忆，纯前端便利项，失败静默降级到默认右下角）
- 区分「点击」与「拖拽」：位移小于阈值（约 5px）视为点击

### 3.3 面板

- 点击球体 → 在球的上方展开小面板，含两个按钮：**「添加投递信息」**、**「详情」**
- 收起方式：再次点击球体，或点击面板/球体以外的区域
- 按钮本期行为：仅 `console.log` 占位 + 预留 `onAddDeliveryInfo()` / `onShowDetail()` 空函数作为后续接口挂点

### 3.4 边界与错误处理

- `chrome://`、`edge://`、扩展商店页等浏览器内部页面无法注入（浏览器安全限制，属预期行为）
- iframe 不注入（`all_frames: false`），一个标签页只出现一个球
- `localStorage` 不可用时（隐私模式等）静默降级，不影响球体功能
- content.js 全程 try/catch 包裹初始化，注入失败不阻塞宿主页面

## 4. 安装与验收

**安装**：`chrome://extensions`（或 `edge://extensions`）→ 开启「开发者模式」→「加载已解压的扩展」→ 选择 `float-ball-extension` 目录。

**验收标准（本期）**：

1. 任意普通网页（如 https://www.bing.com）右下角出现悬浮球
2. 球可拖拽，松手吸附边缘；刷新后位置保留
3. 点击球展开面板，面板内可见「添加投递信息」「详情」两个按钮
4. 点击按钮无业务动作，控制台出现占位 log
5. 再次点击球或点击页面空白处，面板收起
6. 宿主页面样式不影响球体外观（Shadow DOM 隔离生效）
7. Chrome 与 Edge 均通过上述 1–6

## 5. 测试策略

零依赖项目，无自动化测试框架。采用**手工验收清单**（即第 4 节验收标准），在 Chrome 与 Edge 各跑一遍。代码层面保证 content.js 单文件 < 300 行、职责单一，便于后续迭代。
