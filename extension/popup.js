// popup.js — 工具栏弹窗入口（与悬浮球面板同款按钮，本期仅 UI 占位）
'use strict';

// ===== 「添加投递信息」：向 background 发消息，打开独立投递窗口 =====
async function onAddDeliveryInfo() {
  // 扩展上下文拿不到页面的 window.location，需经 chrome.tabs 查询活动标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab && tab.url ? tab.url : '';
  const pageTitle = tab && tab.title ? tab.title : '';
  // 弹窗自身也关闭，让用户体验更清爽（可选）
  window.close();
  chrome.runtime.sendMessage({
    type: 'OPEN_DELIVERY_WINDOW',
    url: currentUrl,
    title: pageTitle,
    screenWidth: screen.width,
    screenHeight: screen.height,
  });
}
function onShowDetail() {
  // TODO(下一期): 展示投递详情
  console.log('[float-ball-popup] 点击了【详情】（功能待实现）');
}

function onLogin() {
  // TODO(下一期): 登录页跳转
  console.log('[float-ball-popup] 点击了【登录】（UI 占位）');
}

function onRegister() {
  // TODO(下一期): 注册页跳转
  console.log('[float-ball-popup] 点击了【注册】（UI 占位）');
}

document.getElementById('btn-add').addEventListener('click', onAddDeliveryInfo);
if (document.getElementById('btn-detail')) document.getElementById('btn-detail').addEventListener('click', onShowDetail);
if (document.getElementById('btn-login')) document.getElementById('btn-login').addEventListener('click', onLogin);
if (document.getElementById('btn-register')) document.getElementById('btn-register').addEventListener('click', onRegister);
