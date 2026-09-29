'use strict';

const ui = Object.fromEntries(['navigation', 'section-title', 'load-status', 'content', 'schema', 'permission', 'read-time', 'refresh'].map(id => [id, document.getElementById(id)]));
let dashboard;
let selected;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function render() {
  ui.navigation.replaceChildren();
  for (const entry of dashboard.navigation) {
    const button = element('button', 'nav-button', entry.label);
    button.type = 'button';
    button.setAttribute('aria-current', entry.id === selected ? 'page' : 'false');
    button.addEventListener('click', () => { selected = entry.id; render(); });
    ui.navigation.append(button);
  }
  const entry = dashboard.navigation.find(item => item.id === selected);
  ui['section-title'].textContent = entry.label;
  ui.content.replaceChildren();
  const items = dashboard.modules[selected]?.items;
  if (!Array.isArray(items) || items.length === 0) {
    const empty = element('div', 'empty-state', '');
    const glyph = element('span', 'empty-glyph', '＋');
    glyph.setAttribute('aria-hidden', 'true');
    empty.append(glyph, element('h3', '', '展示空间已就绪'), element('p', '', '当前栏目暂无数据。内容将在数据源更新后呈现。'), element('span', 'empty-note', '空壳初始化 · 无持仓或金融数据'));
    ui.content.append(empty);
  } else {
    for (const item of items) {
      const card = element('article', 'data-card', '');
      card.append(element('h3', '', String(item.title ?? '')), element('p', '', String(item.summary ?? '')));
      ui.content.append(card);
    }
  }
}

async function load() {
  ui.refresh.disabled = true;
  ui.content.setAttribute('aria-busy', 'true');
  ui['load-status'].textContent = '正在读取展示数据…';
  try {
    const response = await fetch('./dashboard/current.json?ts=' + Date.now(), {cache:'no-store'});
    if (!response.ok) throw new Error('数据源响应异常');
    const data = await response.json();
    if (data.schema_version !== 'cloud_monitor_dashboard.v1' || data.trade_permission !== false || !Array.isArray(data.navigation) || data.navigation.length !== 7 || data.navigation.some(entry => !entry || typeof entry.id !== 'string' || typeof entry.label !== 'string') || new Set(data.navigation.map(entry => entry.id)).size !== 7 || !data.modules || typeof data.modules !== 'object' || Array.isArray(data.modules)) {
      throw new Error('数据格式或权限不符合展示约束');
    }
    dashboard = data;
    selected = data.navigation.some(entry => entry.id === selected) ? selected : data.navigation[0].id;
    render();
    ui.schema.textContent = data.schema_version;
    ui.permission.textContent = String(data.trade_permission);
    ui['read-time'].textContent = new Date().toLocaleTimeString('zh-CN', {hour12: false});
    ui['load-status'].textContent = '数据源已连接';
    ui['load-status'].dataset.state = 'ready';
  } catch (error) {
    dashboard = undefined;
    ui.navigation.replaceChildren();
    ui.content.replaceChildren(element('div', 'error-state', '暂时无法读取数据，请稍后刷新。'));
    ui['section-title'].textContent = '数据未就绪';
    ui.schema.textContent = '—';
    ui.permission.textContent = '未确认 · 展示已停止';
    ui['read-time'].textContent = '—';
    ui['load-status'].textContent = error.message;
    ui['load-status'].dataset.state = 'error';
  } finally {
    ui.content.setAttribute('aria-busy', 'false');
    ui.refresh.disabled = false;
  }
}

ui.refresh.addEventListener('click', load);
load();
