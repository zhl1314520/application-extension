// background.js — 扩展 Service Worker（负责创建独立投递窗口）
'use strict';

const DELIVERY_PAGE = 'delivery.html';
const WIN_HEIGHT = 520;

// 构造 query 字符串
function buildQuery(msg) {
  const queryParts = [];
  if (msg.url) queryParts.push('url=' + encodeURIComponent(msg.url));
  if (msg.title) queryParts.push('title=' + encodeURIComponent(msg.title));
  if (msg.ogSiteName) queryParts.push('ogSiteName=' + encodeURIComponent(msg.ogSiteName));
  if (msg.jsonLdOrgName) queryParts.push('jsonLdOrgName=' + encodeURIComponent(msg.jsonLdOrgName));
  if (msg.copyright) queryParts.push('copyright=' + encodeURIComponent(msg.copyright));
  if (msg.icpCompanyName) queryParts.push('icpCompanyName=' + encodeURIComponent(msg.icpCompanyName));
  if (msg.policeCompanyName) queryParts.push('policeCompanyName=' + encodeURIComponent(msg.policeCompanyName));
  if (msg.metaAuthor) queryParts.push('metaAuthor=' + encodeURIComponent(msg.metaAuthor));
  if (msg.ogTitle) queryParts.push('ogTitle=' + encodeURIComponent(msg.ogTitle));
  if (msg.logoText) queryParts.push('logoText=' + encodeURIComponent(msg.logoText));
  return queryParts.length ? '?' + queryParts.join('&') : '';
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'OPEN_DELIVERY_WINDOW') {
    const query = buildQuery(msg);

    // 计算屏幕居中坐标
    const sw = Number.isFinite(msg.screenWidth) && msg.screenWidth > 0 ? msg.screenWidth : 1920;
    const sh = Number.isFinite(msg.screenHeight) && msg.screenHeight > 0 ? msg.screenHeight : 1080;
    const top = Math.max(0, Math.round((sh - WIN_HEIGHT) / 2));

    chrome.windows.create({
      url: chrome.runtime.getURL(DELIVERY_PAGE + query),
      type: 'popup',
      width: sw,          // 宽度 = 屏幕宽度，最大适应
      height: WIN_HEIGHT, // 高度固定
      left: 0,
      top,
      focused: true,
    });
    return false;
  }
});
