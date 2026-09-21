// content.js — 悬浮球注入逻辑（IIFE，避免污染页面全局作用域）
(() => {
  'use strict';

  const BALL_SIZE = 48;        // 球体直径 px
  const EDGE_GAP = 24;         // 默认/吸附时距边缘 px
  const DRAG_THRESHOLD = 5;    // 位移超过该值视为拖拽，否则视为点击
  const STORAGE_KEY = '__float_ball_pos__';
  const HOST_ID = '__float_ball_host__';

  // ===== 提取页面数据（URL + 公司名线索） =====
  function extractPageData() {
    const ogSiteName = (() => {
      const el = document.querySelector('meta[property="og:site_name"]');
      return el ? el.getAttribute('content') || '' : '';
    })();

    const jsonLdOrgName = (() => {
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
          const data = JSON.parse(s.textContent);
          const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
          for (const item of items) {
            if (item && (item['@type'] === 'Organization' || item['@type'] === 'Corporation')) {
              return item.name || '';
            }
          }
        }
      } catch (_) {}
      return '';
    })();

    const copyright = (() => {
      const el = document.querySelector('footer') || document.body;
      const text = el ? el.textContent : '';
      const m = text.match(/(?:©|copyright|版权)\s*\d{0,4}\s*([^\n,，。.!！;；]{2,20})/i);
      return m ? m[1].trim() : '';
    })();

    const icpCompanyName = (() => {
      const text = document.body ? document.body.textContent : '';
      const m = text.match(/([^\n\s]{2,30}(?:有限公司|股份有限公司|集团|有限责任公司|科技有限公司|技术有限公司|网络技术有限公司|信息技术有限公司))\s*(?:粤|京|沪|浙|苏|鲁|闽|川|渝|鄂|湘|豫|冀|辽|吉|黑|皖|赣|陕|甘|青|台|港|澳|新|藏|宁|蒙|桂|琼|津)?ICP/i);
      return m ? m[1].trim() : '';
    })();

    const policeCompanyName = (() => {
      const text = document.body ? document.body.textContent : '';
      const m = text.match(/([^\n\s]{2,30}(?:有限公司|股份有限公司|集团|有限责任公司|科技有限公司|技术有限公司|网络技术有限公司|信息技术有限公司))\s*(?:粤|京|沪|浙|苏|鲁|闽|川|渝|鄂|湘|豫|冀|辽|吉|黑|皖|赣|陕|甘|青|台|港|澳|新|藏|宁|蒙|桂|琼|津)?公网安备/i);
      return m ? m[1].trim() : '';
    })();

    const metaAuthor = (() => {
      const el = document.querySelector('meta[name="author"]');
      return el ? el.getAttribute('content') || '' : '';
    })();

    const ogTitle = (() => {
      const el = document.querySelector('meta[property="og:title"]');
      return el ? el.getAttribute('content') || '' : '';
    })();

    const logoText = (() => {
      const selectors = [
        'a.logo', 'div.logo', 'span.logo',
        'header h1 a', 'header h1',
        '[class*="logo"] a', '[class*="brand"] a',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length >= 2) {
          return el.textContent.trim();
        }
      }
      return '';
    })();

    return {
      url: window.location.href,
      title: document.title,
      ogSiteName,
      jsonLdOrgName,
      copyright,
      icpCompanyName,
      policeCompanyName,
      metaAuthor,
      ogTitle,
      logoText,
    };
  }

  // ===== 「添加投递信息」：向 background 发消息，打开独立投递窗口 =====
  function onAddDeliveryInfo() {
    const data = extractPageData();
    chrome.runtime.sendMessage({
      type: 'OPEN_DELIVERY_WINDOW',
      ...data,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    });
  }

  // ===== 收到刷新消息时重新提取数据回传 =====
  function onRefreshPageData() {
    const data = extractPageData();
    return { data };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'REFRESH_PAGE_DATA') {
      sendResponse(onRefreshPageData());
      return true; // keep channel open for async sendResponse
    }
  });

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
          background: transparent;
          box-shadow: none;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; line-height: 1; font-weight: 700;
          color: #12a64f;
          cursor: grab;
          user-select: none; -webkit-user-select: none;
          touch-action: none;
        }
        .ball:hover { transform: scale(1.08); }
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
      btnDetail.textContent = '登录';
      btnDetail.addEventListener('click', onShowDetail);
      panel.append(btnAdd, btnDetail);

      const ball = document.createElement('div');
      ball.className = 'ball';
      ball.textContent = 'A';
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
