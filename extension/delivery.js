// delivery.js — 独立投递窗口 UI 逻辑（页签切换 + 接收 URL + 实时更新 + 我的投递 CRUD）
'use strict';

// ===== 后端 API 基址（Django 服务）=====
const API_BASE = 'http://127.0.0.1:8000/api';

// ===== 缓存后端返回的记录，供编辑/删除回填使用 =====
let mineRecords = [];

// ===== 编辑态：非 null 表示当前正在修改该 id 的记录，Submit 走 PUT 更新 =====
let editingId = null;

// ===== 页签切换 =====
const tabs = document.querySelectorAll('.tab-item');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
    if (target === 'mine') renderMineList();
  });
});

// ===== 解析公司名（中国公司官网友好策略） =====
// 优先级：ICP备案 > 公安备案 > JSON-LD > og:site_name > logo > metaAuthor > copyright > title > 字典 > 域名
function parseCompanyName(data) {
  const { url, title, ogSiteName, jsonLdOrgName, copyright, icpCompanyName, policeCompanyName, metaAuthor, ogTitle, logoText } = data;
  let company = '';

  // 策略 1：ICP 备案号旁的公司全称（中国法律强制，最可靠）
  if (icpCompanyName) {
    company = icpCompanyName.trim();
  }

  // 策略 2：公安备案号旁的公司全称（中国法律强制）
  if (!company && policeCompanyName) {
    company = policeCompanyName.trim();
  }

  // 策略 3：JSON-LD Organization schema（公司官网最可靠的结构化数据）
  if (!company && jsonLdOrgName) {
    company = jsonLdOrgName.trim();
  }

  // 策略 4：og:site_name（Open Graph 协议，官网常见）
  if (!company && ogSiteName) {
    company = ogSiteName.trim();
  }

  // 策略 5：Logo 文本（从 <a class="logo">、<header h1> 提取）
  if (!company && logoText) {
    company = logoText.trim();
  }

  // 策略 6：meta author 标签
  if (!company && metaAuthor) {
    company = metaAuthor.trim();
  }

  // 策略 7：copyright 文本提取（如 "© 2024 脉脉科技 All rights reserved" → "脉脉科技"）
  if (!company && copyright) {
    company = copyright.replace(/\s*(all\s+rights?\s+reserved|版权所有|保留所有权利|reserved|inc\.|ltd\.|co\.,?\s*ltd\.?|股份有限公司|有限公司|集团|集团有限).*$/i, '').trim();
  }

  // 策略 8：og:title 或页面标题提取（通用兜底）
  if (!company && (ogTitle || title)) {
    const titleToUse = ogTitle || title;
    const titleMatch = titleToUse.match(/^([^\s\-–—|·]+)\s*(?:-|–|—|\||·|$)/);
    if (titleMatch) {
      const extracted = titleMatch[1].trim();
      if (extracted.length >= 2 && !/^(home|首页|index|官网|official)$/i.test(extracted)) {
        company = extracted;
      }
    }
  }

  // 策略 9：字典映射（覆盖常见公司域名）
  if (!company && url) {
    try {
      const hostname = new URL(url).hostname;
      const COMPANY_MAP = {
        'baidu.com': '百度',
        'bytedance.com': '字节跳动',
        'douyin.com': '抖音',
        'tencent.com': '腾讯',
        'qq.com': '腾讯',
        'alibaba.com': '阿里巴巴',
        'alipay.com': '支付宝',
        'taobao.com': '淘宝',
        'tmall.com': '天猫',
        'jd.com': '京东',
        'meituan.com': '美团',
        'dianping.com': '大众点评',
        'pinduoduo.com': '拼多多',
        'xiaomi.com': '小米',
        'huawei.com': '华为',
        'netease.com': '网易',
        '163.com': '网易',
        'sohu.com': '搜狐',
        'sina.com.cn': '新浪',
        'weibo.com': '微博',
        'bilibili.com': '哔哩哔哩',
        'zhihu.com': '知乎',
        'lagou.com': '拉勾',
        'bosszhipin.com': 'BOSS直聘',
        'zhipin.com': 'BOSS直聘',
        'liepin.com': '猎聘',
        '51job.com': '前程无忧',
        'zhaopin.com': '智联招聘',
        'linkedin.com': '领英',
        'indeed.com': 'Indeed',
        'glassdoor.com': 'Glassdoor',
        'moseeker.com': '脉脉',
      };

      company = COMPANY_MAP[hostname];
      if (!company) {
        const domain = hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
        company = COMPANY_MAP[domain];
      }

      // 策略 10：域名提取（绝对兜底）
      if (!company) {
        company = hostname.replace(/^www\./, '').split('.')[0];
      }
    } catch (_) {
      // URL 解析失败时保持空
    }
  }

  return company || '（未解析到公司名）';
}

// ===== 更新页面显示 =====
function updateDisplay(data) {
  if (data.url) {
    document.getElementById('current-url').textContent = data.url;
  }
  const companyName = parseCompanyName(data);
  document.getElementById('company-name').textContent = companyName;
}

// ===== 初始化：从 URL query 参数接收数据 =====
const params = new URLSearchParams(window.location.search);
const initialData = {
  url: params.get('url') || '',
  title: params.get('title') || '',
  ogSiteName: params.get('ogSiteName') || '',
  jsonLdOrgName: params.get('jsonLdOrgName') || '',
  copyright: params.get('copyright') || '',
  icpCompanyName: params.get('icpCompanyName') || '',
  policeCompanyName: params.get('policeCompanyName') || '',
  metaAuthor: params.get('metaAuthor') || '',
  ogTitle: params.get('ogTitle') || '',
  logoText: params.get('logoText') || '',
};

if (initialData.url) {
  updateDisplay(initialData);
}

// ===== 手动刷新按钮：点击后播放旋转动画 + 重新从 background 请求数据 =====
const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.remove('spinning');
    void refreshBtn.offsetWidth;
    refreshBtn.classList.add('spinning');
    // 向当前标签页的 content.js 发消息，让它重新 extractPageData
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_PAGE_DATA' }, (resp) => {
          if (chrome.runtime.lastError) {
            // content.js 未注入，静默处理
          } else if (resp && resp.data) {
            Object.assign(initialData, resp.data);
            updateDisplay(resp.data);
          }
        });
      }
    } catch (_) {}
  });
}

// ===== 岗位选择器：支持 4 个固定选项 + 自定义"其他"输入 =====
const positionSelect = document.getElementById('position-select');
const positionOther = document.getElementById('position-other');

let currentPosition = '软件测试工程师';

if (positionSelect && positionOther) {
  positionSelect.addEventListener('change', () => {
    if (positionSelect.value === '__other__') {
      positionSelect.style.display = 'none';
      positionOther.style.display = 'block';
      positionOther.value = '';
      positionOther.focus();
    } else {
      currentPosition = positionSelect.value;
    }
  });

  positionOther.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = positionOther.value.trim();
      if (val) currentPosition = val;
    }
  });

  // 初始同步
  if (positionSelect.value !== '__other__') currentPosition = positionSelect.value;
}

// ===== 未投岗位选择器：同"已投岗位"逻辑，独立状态 =====
const positionSelectUnfilled = document.getElementById('position-select-unfilled');
const positionOtherUnfilled = document.getElementById('position-other-unfilled');

let currentUnfilledPosition = '无';

if (positionSelectUnfilled && positionOtherUnfilled) {
  positionSelectUnfilled.addEventListener('change', () => {
    if (positionSelectUnfilled.value === '__other__') {
      positionSelectUnfilled.style.display = 'none';
      positionOtherUnfilled.style.display = 'block';
      positionOtherUnfilled.value = '';
      positionOtherUnfilled.focus();
    } else {
      currentUnfilledPosition = positionSelectUnfilled.value;
    }
  });

  positionOtherUnfilled.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = positionOtherUnfilled.value.trim();
      if (val) currentUnfilledPosition = val;
    }
  });

  if (positionSelectUnfilled.value !== '__other__') currentUnfilledPosition = positionSelectUnfilled.value;
}

// ===== 获取最终岗位值（处理"其他"情况）=====
function getSelectedPosition(selectEl, otherInputEl) {
  if (selectEl.value === '__other__' && otherInputEl.style.display !== 'none') {
    return otherInputEl.value.trim() || selectEl.options[selectEl.options.selectedIndex].text;
  }
  return selectEl.value;
}

// ===== Submit：将表单数据持久化到列表 =====
const submitBtn = document.getElementById('submit-btn');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    // 数据源：直接读"当前投递"页面上实际显示的内容，所见即所提交
    const url = (document.getElementById('current-url').textContent || '').trim();
    const company = (document.getElementById('company-name').textContent || '').trim();
    const position = getSelectedPosition(positionSelect, positionOther);
    const unfilledPosition = getSelectedPosition(positionSelectUnfilled, positionOtherUnfilled);

    if (!url || url === '') {
      alert('当前未检测到网址，请先打开一个招聘页面。');
      return;
    }

    // 本地日期（规避 toISOString 的 UTC 偏移，保证"今天"按北京时间算）
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const payload = {
      url,
      company,
      sent_position: position,
      unfilled_pos: unfilledPosition !== '无' ? unfilledPosition : '',
    };

    // 编辑态：PUT 更新原记录、保留其原投递时间；否则 POST 新增、盖今日
    const isEditing = editingId != null;
    if (isEditing) {
      const orig = mineRecords.find(x => String(x.id) === String(editingId));
      payload.apply_date = (orig && orig.date_raw) ? orig.date_raw : localDate;
    } else {
      payload.apply_date = localDate;
    }

    try {
      const endpoint = isEditing ? `${API_BASE}/update/${editingId}/` : `${API_BASE}/create/`;
      const resp = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!json || json.code !== 0) {
        alert('提交失败：' + (json && json.msg ? json.msg : '后端未返回有效数据'));
        return;
      }
    } catch (e) {
      alert('无法连接后端，请确认 Django 服务已启动（http://127.0.0.1:8000）。');
      return;
    }

    // 提交成功 → 退出编辑态，按钮恢复"Submit"
    editingId = null;
    if (submitBtn) submitBtn.textContent = 'Submit';

    // 切到"我的投递"tab
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'mine'));
    panels.forEach(p => p.classList.toggle('active', p.id === 'panel-mine'));
    renderMineList();
  });
}

// ===== 渲染"我的投递"列表 =====
async function renderMineList() {
  const tbody = document.getElementById('mine-tbody');
  if (!tbody) return;

  let records = [];
  try {
    const resp = await fetch(`${API_BASE}/`);
    const json = await resp.json();
    records = (json && json.code === 0 && Array.isArray(json.data)) ? json.data : [];
  } catch (e) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">无法连接后端，请确认 Django 服务已启动（http://127.0.0.1:8000）</td></tr>';
    return;
  }
  mineRecords = records;

  if (records.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">暂无投递记录，去「当前投递」Submit 吧 ☝️</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    return `<tr data-id="${r.id}">
      <td class="col-id">${escapeHtml(String(r.num ?? ''))}</td>
      <td class="col-time">${escapeHtml(r.apply_date || '')}</td>
      <td class="col-url" title="${escapeHtml(r.url)}">${escapeHtml(String(r.url || '').slice(0, 60))}</td>
      <td class="col-company">${escapeHtml(r.company || '')}</td>
      <td class="col-position-sent">${escapeHtml(r.sent_position || '')}</td>
      <td class="col-position-unfilled">${escapeHtml(r.unfilled_pos || '')}</td>
      <td class="col-action"><span class="edit-btn" data-id="${r.id}" title="修改">✏️</span></td>
      <td class="col-action-del"><span class="del-btn" data-id="${r.id}" title="删除">🗑️</span></td>
    </tr>`;
  }).join('');

  // 绑定编辑/删除事件
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => handleEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

// ===== HTML 转义 =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== 删除记录 =====
async function handleDelete(id) {
  if (!confirm('确定要删除这条投递记录吗？')) return;
  try {
    await fetch(`${API_BASE}/delete/${id}/`, { method: 'DELETE' });
  } catch (e) {
    alert('无法连接后端，删除失败。');
    return;
  }
  renderMineList();
}

// ===== 编辑记录：回填到当前投递表单，用户可修改后重新 Submit =====
function handleEdit(id) {
  const r = mineRecords.find(x => String(x.id) === String(id));
  if (!r) return;

  // 进入编辑态：记住正在改哪条，Submit 时走 PUT 更新
  editingId = r.id;

  // 回填 URL 和公司名
  document.getElementById('current-url').textContent = r.url;
  document.getElementById('company-name').textContent = r.company;

  const FIXED = ['软件测试工程师', '硬件测试工程师', '测试开发工程师', '测试工程师'];
  const sent = r.sent_position || '';
  const unfilled = r.unfilled_pos || '';

  // 回填已投岗位
  if (FIXED.includes(sent)) {
    positionSelect.value = sent;
    positionSelect.style.display = '';
    positionOther.style.display = 'none';
    currentPosition = sent;
  } else {
    positionSelect.value = '__other__';
    positionSelect.style.display = 'none';
    positionOther.style.display = 'block';
    positionOther.value = sent;
    currentPosition = sent;
  }

  // 回填待投岗位
  if (unfilled) {
    if (FIXED.includes(unfilled)) {
      positionSelectUnfilled.value = unfilled;
      positionSelectUnfilled.style.display = '';
      positionOtherUnfilled.style.display = 'none';
      currentUnfilledPosition = unfilled;
    } else {
      positionSelectUnfilled.value = '__other__';
      positionSelectUnfilled.style.display = 'none';
      positionOtherUnfilled.style.display = 'block';
      positionOtherUnfilled.value = unfilled;
      currentUnfilledPosition = unfilled;
    }
  } else {
    positionSelectUnfilled.value = '无';
    positionSelectUnfilled.style.display = '';
    positionOtherUnfilled.style.display = 'none';
    currentUnfilledPosition = '无';
  }

  // 切到"当前投递"表单，让用户看到回填结果
  if (submitBtn) submitBtn.textContent = '提交修改';
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'current'));
  panels.forEach(p => p.classList.toggle('active', p.id === 'panel-current'));
}

// ===== 消息监听：接收 content.js 推送的实时数据更新 =====
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender && sender.id === chrome.runtime.id && msg && msg.type === 'PAGE_DATA_UPDATE') {
    Object.assign(initialData, msg.data);
    updateDisplay(msg.data);
  }
});
