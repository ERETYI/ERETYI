/* ===== 备考训练站 主逻辑 ===== */
(function () {
'use strict';

// ---------- 常量 ----------
var TYPE_NAMES = { sc:'单选题', mc:'多选题', tf:'判断题', fill:'填空题', sa:'简答题', calc:'计算题', essay:'论述题' };
var TYPE_ORDER = ['sc','mc','tf','fill','sa','calc','essay'];
var OBJECTIVE_TYPES = ['sc','mc','tf']; // 客观题自动判分
var STORAGE_WRONG = 'zhuanben_wrongbook_v1';
var STORAGE_EDITS = 'zhuanben_bank_edits_v1';
var STORAGE_EXAM = 'zhuanben_exam_history_v1';
var STORAGE_THEME = 'zhuanben_theme_v1';

// ---------- 题库元数据 ----------
var BANKS = {
  auto: { name: '《汽车机械基础》', sub: '专本贯通转段考试题库', accent: 'amber' },
  ev:   { name: '《新能源汽车电气技术》', sub: '专本贯通转段考试题库', accent: 'cyan' }
};

// ---------- 数据层 ----------
function getEdits() {
  try { return JSON.parse(localStorage.getItem(STORAGE_EDITS) || '{}'); } catch(e) { return {}; }
}
function saveEdits(e) { localStorage.setItem(STORAGE_EDITS, JSON.stringify(e)); }

function getBuiltinQuestions(bankKey) {
  if (bankKey === 'auto') return window.BANK_AUTO ? window.BANK_AUTO.slice() : [];
  if (bankKey === 'ev') return window.BANK_EV ? window.BANK_EV.slice() : [];
  return []; // 自定义科目没有内置题
}

function getQuestions(bankKey) {
  var builtin = getBuiltinQuestions(bankKey);
  var edits = getEdits();
  var bankEdits = edits[bankKey] || {};
  var result = [];
  builtin.forEach(function(q) {
    var eq = bankEdits[q.id];
    if (eq && eq._deleted) return;
    result.push(eq ? Object.assign({}, q, eq) : q);
  });
  // 用户新增的题
  if (bankEdits.__new__) {
    bankEdits.__new__.forEach(function(q) {
      if (!q._deleted) result.push(q);
    });
  }
  return result;
}

function getAllQuestions() {
  return getQuestions('auto').concat(getQuestions('ev'));
}

function getQuestionById(id) {
  var bank = id.split('_')[0];
  var qs = getQuestions(bank);
  for (var i = 0; i < qs.length; i++) if (qs[i].id === id) return qs[i];
  return null;
}

// ---------- 错题本 ----------
function getWrongList() {
  try { return JSON.parse(localStorage.getItem(STORAGE_WRONG) || '[]'); } catch(e) { return []; }
}
function saveWrongList(l) { localStorage.setItem(STORAGE_WRONG, JSON.stringify(l)); }
function addWrong(qid, userAns) {
  // 先加到本次训练的错题批次里，退出/结束时统一保存
  if (quizState) {
    quizState.wrongBatch.push({ id: qid, userAns: userAns });
  } else {
    // 不在答题中（比如错题本重练），直接保存
    var list = getWrongList();
    list.unshift({ id: qid, time: Date.now(), userAns: userAns });
    saveWrongList(list);
  }
}

// 保存本次训练的错题批次
function saveWrongBatch() {
  if (!quizState || !quizState.wrongBatch.length) return;
  var list = getWrongList();
  var now = Date.now();
  quizState.wrongBatch.forEach(function(w) {
    list.unshift({ id: w.id, time: now, userAns: w.userAns });
  });
  saveWrongList(list);
  quizState.wrongBatch = [];
}
function removeWrong(qid, el) {
  if (el) {
    // 播放移除动画
    el.classList.add('removing');
    setTimeout(function() {
      saveWrongList(getWrongList().filter(function(w) { return w.id !== qid; }));
      renderWrong();
      toast('已移除');
    }, 350);
  } else {
    saveWrongList(getWrongList().filter(function(w) { return w.id !== qid; }));
  }
}

// ---------- 模拟考试历史 ----------
function getExamHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_EXAM) || '[]'); } catch(e) { return []; }
}
function saveExamHistory(h) { localStorage.setItem(STORAGE_EXAM, JSON.stringify(h)); }
function addExamRecord(rec) {
  var h = getExamHistory();
  h.unshift(rec);
  saveExamHistory(h);
}

// ---------- 主题 ----------
var THEMES = {
  amber:  { accent: '#ffab2e', accent2: '#4dd6f5' },
  cyan:   { accent: '#4dd6f5', accent2: '#ffab2e' },
  green:  { accent: '#35d07f', accent2: '#ffab2e' },
  purple: { accent: '#b388ff', accent2: '#4dd6f5' },
  red:    { accent: '#ff5c5c', accent2: '#ffab2e' },
  pink:   { accent: '#ff6fa5', accent2: '#ffab2e' },
  orange: { accent: '#ff7849', accent2: '#4dd6f5' },
  teal:   { accent: '#2dd4bf', accent2: '#ffab2e' },
  indigo: { accent: '#818cf8', accent2: '#22d3ee' },
  lime:   { accent: '#a3e635', accent2: '#fb923c' },
  custom: { accent: '#ffab2e', accent2: '#4dd6f5' }
};
function applyTheme(name) {
  var t = THEMES[name] || THEMES.amber;
  if (name === 'custom') {
    var ca = localStorage.getItem(STORAGE_THEME + '_accent');
    var c2 = localStorage.getItem(STORAGE_THEME + '_accent2');
    var cb = localStorage.getItem(STORAGE_THEME + '_bg');
    if (ca) t = { accent: ca, accent2: c2 || '#4dd6f5', bg: cb || '#0e131b' };
  }
  document.documentElement.style.setProperty('--accent', t.accent);
  document.documentElement.style.setProperty('--accent2', t.accent2);
  if (t.bg) document.documentElement.style.setProperty('--bg', t.bg);
  localStorage.setItem(STORAGE_THEME, name);
}
function applyCustomColor(which, val) {
  localStorage.setItem(STORAGE_THEME + '_' + which, val);
  localStorage.setItem(STORAGE_THEME, 'custom');
  var ca = localStorage.getItem(STORAGE_THEME + '_accent') || '#ffab2e';
  var c2 = localStorage.getItem(STORAGE_THEME + '_accent2') || '#4dd6f5';
  var cb = localStorage.getItem(STORAGE_THEME + '_bg') || '#0e131b';
  document.documentElement.style.setProperty('--accent', ca);
  document.documentElement.style.setProperty('--accent2', c2);
  document.documentElement.style.setProperty('--bg', cb);
}
function loadTheme() {
  var name = localStorage.getItem(STORAGE_THEME) || 'amber';
  applyTheme(name);
  // 自定义背景色
  var cb = localStorage.getItem(STORAGE_THEME + '_bg');
  if (cb) document.documentElement.style.setProperty('--bg', cb);
}

// ---------- 路由 ----------
function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.nav === id.replace('page-',''));
  });
  window.scrollTo(0, 0);
  // 更新当前页面状态
  currentPage = id.replace('page-','');
}
function goHome() { 
  showPage('page-home'); 
  renderHome();
  hideRefZoom();
}

function showRef(idx, from) {
  showPage('page-ref');
  // 记录来源页面
  window.refFrom = from || 'home';
  window.currentRefIdx = idx;
  window.refOriginalContent = content; // 保存原始内容
  var list = getRefList();
  var ref = list[idx] || list[0];
  var content = ref.content || '<p>暂无内容</p>';
  window.refOriginalContent = content;
  // 添加搜索框和类别按钮
  var searchHtml = '<div class="ref-search-box">' +
    '<input type="text" id="ref-search-input" class="q-input" placeholder="输入关键词搜索题目..." />' +
    '<button class="btn btn-primary" onclick="window.__app.searchRef()">搜索</button>' +
    '<button class="btn btn-outline ref-cat-btn" onclick="window.__app.showRefCat()">☰</button>' +
  '</div>';
  document.getElementById('ref-body').innerHTML = '<h2>' + ref.name + '</h2>' + searchHtml + '<div id="ref-content">' + content + '</div>';
  // 侧边栏
  // 从资料内容里提取类别（优先提取试题，其次提取题型）
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  var text = tempDiv.textContent || '';
  var cats = ['全部'];
  // 先提取试题一、试题二、试题三等
  var testMatches = text.match(/试题[一二三四五六七八九十]+/g);
  if (testMatches) {
    testMatches.forEach(function(t) {
      if (cats.indexOf(t) < 0) cats.push(t);
    });
  }
  // 如果没有试题，再提取题型（精确匹配完整题型名称）
  if (cats.length === 1) {
    if (text.indexOf('单选题') >= 0) cats.push('单选题');
    if (text.indexOf('多选题') >= 0) cats.push('多选题');
    if (text.indexOf('判断题') >= 0) cats.push('判断题');
    if (text.indexOf('填空题') >= 0) cats.push('填空题');
    if (text.indexOf('简答题') >= 0) cats.push('简答题');
    if (text.indexOf('计算题') >= 0) cats.push('计算题');
    if (text.indexOf('论述题') >= 0) cats.push('论述题');
    if (text.indexOf('选择题') >= 0) cats.push('选择题');
    if (text.indexOf('问答题') >= 0) cats.push('问答题');
  }
  
  var catHtml = cats.map(function(cat) {
    var val = cat === '全部' ? 'all' : cat;
    return '<div class="ref-sidebar-item" onclick="window.__app.filterRefCat(\'' + val + '\')">' + cat + '</div>';
  }).join('');
  
  document.getElementById('ref-body').innerHTML += 
    '<div class="ref-mask" id="ref-mask" onclick="window.__app.closeRefCat()"></div>' +
    '<div class="ref-sidebar" id="ref-sidebar">' +
      '<div class="ref-sidebar-head">题目类别</div>' +
      catHtml +
    '</div>';
  // 初始化两指缩放
  var refBody = document.getElementById('ref-body');
  var refDoc = document.querySelector('.ref-doc');
  if (refBody && refDoc) {
    initPinchZoom(refBody, refDoc);
  }
}

// 显示类别侧边栏
function showRefCat() {
  var sidebar = document.getElementById('ref-sidebar');
  var mask = document.getElementById('ref-mask');
  if (sidebar) sidebar.classList.add('open');
  if (mask) mask.classList.add('open');
}

// 关闭类别侧边栏
function closeRefCat() {
  var sidebar = document.getElementById('ref-sidebar');
  var mask = document.getElementById('ref-mask');
  if (sidebar) sidebar.classList.remove('open');
  if (mask) mask.classList.remove('open');
}

// 筛选题目类别
function filterRefCat(cat) {
  var sidebar = document.getElementById('ref-sidebar');
  if (sidebar) sidebar.classList.remove('open');
  var mask = document.getElementById('ref-mask');
  if (mask) mask.classList.remove('open');
  var contentEl = document.getElementById('ref-content');
  var original = window.refOriginalContent || '';
  if (cat === 'all') {
    contentEl.innerHTML = original;
    return;
  }
  
  // 更简单可靠的筛选逻辑：
  // 1. 把原始HTML按<h3>标签分段
  // 2. 找到包含目标类别的那段h3，然后显示它和它之后、下一个h3之前的所有内容
  
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = original;
  
  // 获取所有h3标题
  var h3s = tempDiv.querySelectorAll('h3');
  if (h3s.length === 0) {
    // 没有h3标题，直接显示全部
    contentEl.innerHTML = original;
    return;
  }
  
  // 找到目标h3的位置
  var targetIndex = -1;
  for (var i = 0; i < h3s.length; i++) {
    if (h3s[i].textContent.indexOf(cat) >= 0) {
      targetIndex = i;
      break;
    }
  }
  
  if (targetIndex < 0) {
    contentEl.innerHTML = '<div class="search-results"><h4>未找到' + cat + '相关内容</h4></div>';
    return;
  }
  
  // 收集从目标h3开始，到下一个h3之前的所有内容
  var resultHtml = '';
  var startEl = h3s[targetIndex];
  var nextH3 = (targetIndex < h3s.length - 1) ? h3s[targetIndex + 1] : null;
  
  // 从startEl开始，遍历所有兄弟节点，直到遇到nextH3
  var current = startEl;
  while (current) {
    resultHtml += current.outerHTML;
    if (current === nextH3) break;
    current = current.nextElementSibling;
  }
  
  contentEl.innerHTML = '<div class="search-results"><h4>' + cat + '</h4>' + resultHtml + '</div>';
}

// 搜索参考资料
function searchRef() {
  var keyword = document.getElementById('ref-search-input').value.trim();
  var contentEl = document.getElementById('ref-content');
  if (!keyword) {
    // 关键词为空，显示全部
    var list = getRefList();
    var ref = list[window.currentRefIdx] || list[0];
    contentEl.innerHTML = ref.content || '<p>暂无内容</p>';
    return;
  }
  // 搜索内容
  var list = getRefList();
  var ref = list[window.currentRefIdx] || list[0];
  var content = ref.content || '';
  // 提取纯文本内容进行搜索
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  var text = tempDiv.textContent || tempDiv.innerText;
  // 简单搜索：找到包含关键词的段落，显示出来
  var paragraphs = tempDiv.querySelectorAll('p, div, h3, h4');
  var results = [];
  paragraphs.forEach(function(p) {
    if (p.textContent.indexOf(keyword) >= 0) {
      results.push(p.outerHTML);
    }
  });
  if (results.length > 0) {
    contentEl.innerHTML = '<div class="search-results"><h4>找到 ' + results.length + ' 条结果：</h4>' + results.join('') + '</div>';
  } else {
    contentEl.innerHTML = '<div class="search-results"><h4>未找到相关内容</h4><p>请尝试其他关键词</p></div>';
  }
}

// 两指手势缩放
function initPinchZoom(container, target) {
  var startDist = 0;
  var startScale = 1;
  var currentScale = 1;

  container.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      startDist = getDist(e.touches[0], e.touches[1]);
      startScale = currentScale;
    }
  });

  container.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dist = getDist(e.touches[0], e.touches[1]);
      // 降低灵敏度：乘以 0.7 的系数
      currentScale = Math.max(0.5, Math.min(3, startScale * (dist / startDist) * 0.7 + startScale * 0.3));
      target.style.transform = 'scale(' + currentScale + ')';
    }
  }, { passive: false });
}

function getDist(t1, t2) {
  var dx = t1.clientX - t2.clientX;
  var dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function zoomRef(delta) {
  // 保留函数兼容
}

function hideRefZoom() {
  // 不需要了
}

// 获取资料列表
function getRefList() {
  // 题库类资料实时从题库生成，确保勘误/更新同步生效；仅自定义资料存缓存
  function bankToHtml(bankKey, bankName) {
    var qs = getQuestions(bankKey);
    var html = '<h2>' + bankName + '（共' + qs.length + '题）</h2>';
    var currentType = '';
    qs.forEach(function(q) {
      if (q.type !== currentType) {
        currentType = q.type;
        html += '<h3>' + (TYPE_NAMES[currentType] || currentType) + '</h3>';
      }
      html += '<div style="margin-bottom:16px;padding:12px;background:var(--panel2);border-radius:8px;">';
      html += '<p><b>第' + q.num + '题：</b>' + q.q + '</p>';
      if (q.opts && q.opts.length) {
        q.opts.forEach(function(opt) {
          html += '<p style="margin:4px 0;padding-left:16px;">' + opt.k + '. ' + opt.t + '</p>';
        });
      }
      html += '<p style="color:var(--accent);margin-top:8px;"><b>答案：</b>' + q.answer + '</p>';
      if (q.ans) {
        html += '<p style="color:var(--text2);margin-top:4px;"><b>解析：</b>' + renderAns(q.ans) + '</p>';
      }
      html += '</div>';
    });
    return html;
  }
  
  // 实时生成默认资料（不读缓存）
  var defaultRefs = [
    { name: '新能源汽车构造', content: window.REF_NEWHOUSE || '' },
    { name: '汽车机械基础题库', content: bankToHtml('auto', '汽车机械基础') },
    { name: '新能源汽车电气题库', content: bankToHtml('ev', '新能源汽车电气技术') }
  ];
  // 合并用户自定义资料（若存在）
  var custom = [];
  try {
    var raw = localStorage.getItem('ref_list_custom');
    if (raw) custom = JSON.parse(raw);
  } catch(e) {}
  return defaultRefs.concat(custom);
}

// 保存资料列表（仅保存自定义资料，题库类资料实时生成）
function saveRefList(list) {
  var defaultNames = ['新能源汽车构造', '汽车机械基础题库', '新能源汽车电气题库'];
  var custom = (list || []).filter(function(r) {
    return defaultNames.indexOf(r.name) < 0;
  });
  localStorage.setItem('ref_list_custom', JSON.stringify(custom));
}

// 添加新资料
function addRef() {
  // 创建添加资料弹窗
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = 
    '<div style="background:var(--panel);border-radius:16px;padding:24px;width:100%;max-width:320px;">' +
      '<h3 style="margin:0 0 16px 0;font-size:18px;text-align:center;">添加新资料</h3>' +
      '<input type="text" id="ref-add-input" placeholder="输入资料名称" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);box-sizing:border-box;margin-bottom:16px;font-size:15px;">' +
      '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-outline" style="flex:1;" id="ref-add-cancel">取消</button>' +
        '<button class="btn btn-primary" style="flex:1;" id="ref-add-save">添加</button>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  
  // 自动聚焦
  setTimeout(function() { document.getElementById('ref-add-input').focus(); }, 100);
  
  // 取消按钮
  document.getElementById('ref-add-cancel').onclick = function() {
    modal.remove();
  };
  
  // 保存按钮
  document.getElementById('ref-add-save').onclick = function() {
    var name = document.getElementById('ref-add-input').value.trim();
    if (name) {
      var list = getRefList();
      list.push({ name: name, content: '' });
      saveRefList(list);
      toast('资料已添加');
      modal.remove();
      renderManage();
    }
  };
}

// 删除资料
function deleteRef(idx) {
  var list = getRefList();
  var name = list[idx].name;
  customConfirm('确定要删除资料「' + name + '」吗？', function() {
    list.splice(idx, 1);
    saveRefList(list);
    toast('资料已删除');
    renderManage();
  });
}

// 编辑资料名称
function editRef(idx) {
  var list = getRefList();
  var oldName = list[idx].name;
  
  // 创建编辑名称弹窗
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = 
    '<div style="background:var(--panel);border-radius:16px;padding:24px;width:100%;max-width:320px;">' +
      '<h3 style="margin:0 0 16px 0;font-size:18px;text-align:center;">编辑资料名称</h3>' +
      '<input type="text" id="ref-name-input" value="' + oldName + '" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);box-sizing:border-box;margin-bottom:16px;font-size:15px;">' +
      '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-outline" style="flex:1;" id="ref-name-cancel">取消</button>' +
        '<button class="btn btn-primary" style="flex:1;" id="ref-name-save">保存</button>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  
  // 自动聚焦
  setTimeout(function() { document.getElementById('ref-name-input').focus(); }, 100);
  
  // 取消按钮
  document.getElementById('ref-name-cancel').onclick = function() {
    modal.remove();
  };
  
  // 保存按钮
  document.getElementById('ref-name-save').onclick = function() {
    var newName = document.getElementById('ref-name-input').value.trim();
    if (newName) {
      list[idx].name = newName;
      saveRefList(list);
      toast('资料名称已更新');
      modal.remove();
      renderManage();
    }
  };
}

// 编辑资料内容 - 打开编辑页面
function editRefContent(idx) {
  var list = getRefList();
  var ref = list[idx];
  
  // 创建编辑弹窗
  var modal = document.createElement('div');
  modal.id = 'ref-edit-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = 
    '<div style="background:var(--panel);width:100%;max-width:100%;border-radius:20px 20px 0 0;display:flex;flex-direction:column;height:90vh;overflow:hidden;">' +
      '<div style="background:var(--panel);display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top, 24px) + 12px) 16px 12px;border-bottom:1px solid var(--border);flex-shrink:0;">' +
        '<button class="btn btn-sm" id="ref-edit-back">← 返回</button>' +
        '<span style="font-weight:600;font-size:16px;">编辑资料</span>' +
        '<button class="btn btn-primary btn-sm" id="ref-edit-save">保存</button>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:16px;">' +
        '<div class="ref-doc" contenteditable="true" id="ref-edit-area" style="background:var(--panel2);border:1px solid var(--border);border-radius:16px;padding:20px;outline:none;min-height:400px;">' + (ref.content || '') + '</div>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  
  // 返回按钮
  document.getElementById('ref-edit-back').onclick = function() {
    modal.remove();
  };
  
  // 保存按钮
  document.getElementById('ref-edit-save').onclick = function() {
    var newContent = document.getElementById('ref-edit-area').innerHTML;
    list[idx].content = newContent;
    saveRefList(list);
    toast('资料已保存');
    modal.remove();
    renderManage();
  };
}

// 添加图片到资料（保留旧函数兼容）
function addRefImage(idx) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var list = getRefList();
      var imgHtml = '<br><img src="' + ev.target.result + '" style="max-width:100%;"><br>';
      list[idx].content = (list[idx].content || '') + imgHtml;
      saveRefList(list);
      toast('图片已添加到资料');
      renderManage();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
function quitQuiz() {
  var from = quizState ? quizState.from : 'home';
  var mode = quizState ? quizState.mode : 'practice';
  var bankKey = quizState ? quizState.bank : null;
  // 退出时强制结算，保存本次错题
  saveWrongBatch();
  quizState = null;
  if (mode === 'exam') {
    // 模拟考试：返回首页
    goHome();
  } else if (from === 'wrong' || from === 'exam') {
    // 错题本/模拟考试错题来源：返回错题本
    showPage('page-wrong');
    renderWrong();
  } else if (bankKey) {
    // 训练答题：返回题目类型选择界面
    startConfig(bankKey);
  } else {
    goHome();
  }
}

function handleBack() {
  // 处理手机返回手势：返回上一级界面
  // 先检查是否有编辑弹窗打开
  var editModal = document.getElementById('ref-edit-modal');
  if (editModal) {
    editModal.remove();
    return;
  }
  // 检查是否有编辑名称弹窗
  var nameModal = document.querySelector('div[style*="align-items: center"][style*="justify-content: center"]');
  if (nameModal && nameModal.querySelector('#ref-name-input')) {
    nameModal.remove();
    return;
  }
  
  if (quizState) {
    // 在答题页：检查是不是在总览页面
    var body = document.getElementById('quiz-body');
    if (body && body.innerHTML.indexOf('答题总览') >= 0) {
      // 在总览页面，返回答题界面
      renderQuizQuestion();
    } else {
      // 在答题界面：退出答题，回到来源页面
      quitQuiz();
    }
  } else if (currentPage === 'ref') {
    // 在参考资料页面，根据来源返回
    if (window.refFrom === 'manage') {
      // 从题库管理进入，返回题库管理
      expandedBank = null;
      renderManage();
      showPage('page-manage');
    } else {
      // 从首页进入，返回首页
      goHome();
    }
  } else if (currentPage === 'manage') {
    // 在题库管理页面，返回首页
    goHome();
  } else if (currentPage === 'wrong') {
    // 在错题本页面，返回首页
    goHome();
  } else if (currentPage === 'settings') {
    // 在设置页面，返回首页
    goHome();
  } else if (currentPage !== 'home') {
    // 在其他页面：返回首页
    goHome();
  } else {
    // 在首页：退出应用
    if (window.AndroidBridge) {
      window.AndroidBridge.exitApp();
    }
  }
}
function submitExam() {
  if (!quizState) return;
  finishQuiz();
}
function prevQuestion() {
  if (!quizState || quizState.index <= 0) return;
  // 上一题（如果当前题已答，回退到上一题）
  quizState.index--;
  renderQuizQuestion();
}
function showOverview() {
  if (!quizState) return;
  var qs = quizState.questions;
  var answered = quizState.answers.length;
  var correct = quizState.correct;
  var wrong = answered - correct;
  var unanswered = qs.length - answered;

  // 构建答题状态映射
  var answerMap = {};
  quizState.answers.forEach(function(a) {
    answerMap[a.qid] = a.correct;
  });

  // 题号小圆球
  var dotsHtml = qs.map(function(q, idx) {
    var state = 'unanswered'; // 未答=灰色
    if (answerMap[q.id] === true) state = 'correct'; // 正确=绿色
    else if (answerMap[q.id] === false) state = 'wrong'; // 错误=红色
    return '<button class="q-dot ' + state + '" onclick="window.__app.jumpToQuestion(' + idx + ')">' + (idx+1) + '</button>';
  }).join('');

  var body = document.getElementById('quiz-body');
  var html = '<div class="overview-card">' +
    '<h3>答题总览</h3>' +
    '<div class="overview-stats">' +
      '<span class="ov-stat">总题 <b>' + qs.length + '</b></span>' +
      '<span class="ov-stat ov-correct">正确 <b>' + correct + '</b></span>' +
      '<span class="ov-stat ov-wrong">错误 <b>' + wrong + '</b></span>' +
      '<span class="ov-stat">未答 <b>' + unanswered + '</b></span>' +
    '</div>' +
    '<div class="q-dots">' + dotsHtml + '</div>' +
    '<div class="quiz-actions mt-20">' +
      (quizState.mode === 'exam' ? '<button class="btn btn-primary" onclick="window.__app.submitExam()">交卷</button>' : '') +
      '<button class="btn btn-outline" onclick="window.__app.exitOverview()">返回答题</button>' +
    '</div>' +
  '</div>';
  body.innerHTML = html;
}

function jumpToQuestion(idx) {
  if (!quizState) return;
  quizState.index = idx;
  renderQuizQuestion();
}

function exitOverview() {
  if (!quizState) return;
  renderQuizQuestion();
}

// 答题页返回按钮处理
function quizBack() {
  if (!quizState) return;
  // 检查是不是在总览页面
  var body = document.getElementById('quiz-body');
  if (body && body.innerHTML.indexOf('答题总览') >= 0) {
    // 在总览页面，返回答题界面
    renderQuizQuestion();
  } else {
    // 在答题界面，退出答题
    quitQuiz();
  }
}

// ---------- Toast ----------
var toastTimer = null;
function toast(msg) {
  // 移除已有 toast
  document.querySelectorAll('.toast').forEach(function(old){
    if (old.parentNode) old.parentNode.removeChild(old);
  });
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }

  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);

  // 立即显示（不用 transition 避免 WebView 兼容问题）
  requestAnimationFrame(function(){
    t.style.opacity = '1';
  });

  // 3 秒后强制隐藏并移除
  toastTimer = setTimeout(function() {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(function() {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 350);
    toastTimer = null;
  }, 2500);
}

// ============================================================
// 首页
// ============================================================
function renderHome() {
  var qs = getAllQuestions();
  document.getElementById('stat-banks').textContent = Object.keys(BANKS).length;
  document.getElementById('stat-questions').textContent = qs.length;
  document.getElementById('stat-wrong').textContent = getWrongList().length;

  // 随机显示歌颂读书的千古名句
  var quotes = [
    "书山有路勤为径，学海无涯苦作舟。",
    "读书破万卷，下笔如有神。",
    "腹有诗书气自华，读书万卷始通神。",
    "三更灯火五更鸡，正是男儿读书时。",
    "黑发不知勤学早，白首方悔读书迟。",
    "问渠那得清如许？为有源头活水来。",
    "读书不觉已春深，一寸光阴一寸金。",
    "书犹药也，善读之可以医愚。",
    "读万卷书，行万里路。",
    "学而不思则罔，思而不学则殆。",
    "知之者不如好之者，好之者不如乐之者。",
    "业精于勤，荒于嬉；行成于思，毁于随。",
    "宝剑锋从磨砺出，梅花香自苦寒来。",
    "千淘万漉虽辛苦，吹尽狂沙始到金。",
    "长风破浪会有时，直挂云帆济沧海。",
    "天生我材必有用，千金散尽还复来。",
    "会当凌绝顶，一览众山小。",
    "不畏浮云遮望眼，自缘身在最高层。",
    "纸上得来终觉浅，绝知此事要躬行。",
    "旧书不厌百回读，熟读深思子自知。",
    "发奋识遍天下字，立志读尽人间书。",
    "鸟欲高飞先振翅，人求上进先读书。",
    "立志宜思真品格，读书须尽苦功夫。",
    "非淡泊无以明志，非宁静无以致远。",
    "勿以恶小而为之，勿以善小而不为。",
    "熟读唐诗三百首，不会作诗也会吟。",
    "书到用时方恨少，事非经过不知难。",
    "问渠那得清如许，为有源头活水来。",
    "读书百遍，其义自见。",
    "千里之行，始于足下。",
    "锲而舍之，朽木不折；锲而不舍，金石可镂。",
    "青，取之于蓝，而青于蓝；冰，水为之，而寒于水。",
    "不积跬步，无以至千里；不积小流，无以成江海。",
    "路漫漫其修远兮，吾将上下而求索。",
    "亦余心之所善兮，虽九死其犹未悔。",
    "尺有所短；寸有所长。物有所不足；智有所不明。",
    "满招损，谦受益。",
    "三人行，必有我师焉。择其善者而从之，其不善者而改之。",
    "君子坦荡荡，小人长戚戚。",
    "岁寒，然后知松柏之后凋也。",
    "知者不惑，仁者不忧，勇者不惧。",
    "穷则独善其身，达则兼济天下。",
    "得道多助，失道寡助。",
    "生于忧患，死于安乐。",
    "天将降大任于是人也，必先苦其心志，劳其筋骨。",
    "尽信书，则不如无书。",
    "民为贵，社稷次之，君为轻。",
    "穷则变，变则通，通则久。",
    "天行健，君子以自强不息。地势坤，君子以厚德载物。",
    "博学之，审问之，慎思之，明辨之，笃行之。"
  ];
  var quoteEl = document.getElementById('home-slogan');
  if (quoteEl) {
    quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  }

  var container = document.getElementById('bank-cards');
  container.innerHTML = '';
  var bankKeys = Object.keys(BANKS);
  var refList = getRefList();
  
  // 所有卡片统一渐变：从上到下依次变浅
  var allCards = [];
  
  // 先添加学科卡片
  bankKeys.forEach(function(bk, idx) {
    var info = BANKS[bk];
    var qs = getQuestions(bk);
    var typeStats = {};
    qs.forEach(function(q) { typeStats[q.type] = (typeStats[q.type]||0) + 1; });
    
    // 统计该学科的错题数量
    var wrongList = getWrongList();
    var wrongCount = 0;
    wrongList.forEach(function(w) {
      if (w.id.indexOf(bk + '_') === 0) wrongCount++;
    });

    var chipsHtml = TYPE_ORDER.map(function(t) {
      if (!typeStats[t]) return '';
      return '<span class="type-chip">' + TYPE_NAMES[t] + ' <b>' + typeStats[t] + '</b></span>';
    }).join('');

    allCards.push({
      title: info.name,
      sub: (info.sub || '自定义题库'),
      chips: chipsHtml,
      total: '共 ' + qs.length + ' 题 · 错题 ' + wrongCount + ' 道',
      actions: 
        '<button class="btn btn-primary" onclick="window.__app.startConfig(\'' + bk + '\')">开始训练</button>' +
        '<button class="btn btn-primary" onclick="window.__app.startExam(\'' + bk + '\')">模拟考试</button>'
    });
  });

  // 再添加资料卡片
  refList.forEach(function(ref, idx) {
    allCards.push({
      title: ref.name,
      sub: '学习参考资料',
      chips: '<span class="type-chip">图文资料 <b>' + (ref.content ? 1 : 0) + '</b></span>',
      total: '可缩放查看',
      actions: '<button class="btn btn-primary" onclick="window.__app.showRef(' + idx + ', \'home\')">查看资料</button>'
    });
  });
  
  // 统一渲染，从上到下卡片左侧竖条色阶渐变
  var gradientColors = [
    '#ffd700', // 金黄
    '#ffab2e', // 黄橙
    '#ff8c42', // 橘橙
    '#ff6b35', // 橘红
    '#ff5c5c', // 朱红
    '#ff9f68'  // 淡橙
  ];
  
  allCards.forEach(function(card, idx) {
    var cardEl = document.createElement('div');
    cardEl.className = 'bank-card';
    var color = gradientColors[idx % gradientColors.length];
    cardEl.style.borderLeft = '4px solid ' + color;
    cardEl.innerHTML =
      '<h3>' + card.title + '</h3>' +
      '<div class="bank-sub">' + card.sub + '</div>' +
      '<div class="type-chips">' + card.chips + '</div>' +
      '<div class="bank-actions">' +
        '<span class="bank-total">' + card.total + '</span>' +
        card.actions +
      '</div>';
    container.appendChild(cardEl);
  });
}

// ============================================================
// 配置页
// ============================================================
var configState = { bank: null, types: [] };

function startConfig(bankKey) {
  configState = { bank: bankKey, types: [] };
  var info = BANKS[bankKey];
  document.getElementById('config-title').textContent = info.name + ' · 训练配置';
  var qs = getQuestions(bankKey);
  var typeStats = {};
  qs.forEach(function(q) { if (!q.disabled) typeStats[q.type] = (typeStats[q.type]||0) + 1; });

  var body = document.getElementById('config-body');
  var chipsHtml = '<span class="opt-chip selected" data-all="1" onclick="window.__app.selectAllTypes(this)">全套</span>';
  chipsHtml += TYPE_ORDER.map(function(t) {
    if (!typeStats[t]) return '';
    return '<span class="opt-chip selected" data-type="' + t + '" onclick="window.__app.toggleType(this)">' + TYPE_NAMES[t] + ' (' + typeStats[t] + ')</span>';
  }).join('');

  body.innerHTML =
    '<div class="config-section"><h4>选择题型</h4><div class="opt-list">' + chipsHtml + '</div></div>' +
    '<div class="config-section"><h4>题目数量</h4><div class="opt-list">' +
      '<span class="opt-chip selected" data-count="all" onclick="window.__app.setCount(this,\'all\')">完整套题</span>' +
      '<span class="opt-chip" data-count="20" onclick="window.__app.setCount(this,20)">随机 20 题</span>' +
      '<span class="opt-chip" data-count="40" onclick="window.__app.setCount(this,40)">随机 40 题</span>' +
    '</div></div>' +
    '<div class="config-section"><h4>模式</h4><div class="opt-list">' +
      '<span class="opt-chip" data-shuffle="0" onclick="window.__app.setShuffle(this,0)">题目乱序</span>' +
      '<span class="opt-chip" data-optshuffle="0" onclick="window.__app.setOptionShuffle(this,0)">选项乱序</span>' +
    '</div></div>' +
    '<div class="config-actions"><button class="btn btn-primary" style="width:100%" onclick="window.__app.startQuiz()">开始答题</button></div>';
  configState.count = 'all'; configState.shuffle = 0; configState.optionShuffle = 0;
  showPage('page-config');
}

function toggleType(el) {
  el.classList.toggle('selected');
}

function selectAllTypes(el) {
  // 切换全选状态
  var isSelected = el.classList.contains('selected');
  if (isSelected) {
    // 取消全选
    el.classList.remove('selected');
    document.querySelectorAll('[data-type]').forEach(function(chip) {
      chip.classList.remove('selected');
    });
  } else {
    // 全选
    el.classList.add('selected');
    document.querySelectorAll('[data-type]').forEach(function(chip) {
      chip.classList.add('selected');
    });
  }
}
function setCount(el, c) {
  document.querySelectorAll('[data-count]').forEach(function(e){e.classList.remove('selected');});
  el.classList.add('selected');
  configState.count = c;
}
function setShuffle(el, s) {
  // 切换高亮状态
  el.classList.toggle('selected');
  // 更新状态
  if (el.classList.contains('selected')) {
    configState.shuffle = 1;
  } else {
    configState.shuffle = 0;
  }
}

function setOptionShuffle(el, s) {
  // 切换高亮状态
  el.classList.toggle('selected');
  // 更新状态
  if (el.classList.contains('selected')) {
    configState.optionShuffle = 1;
  } else {
    configState.optionShuffle = 0;
  }
}

function startQuiz() {
  var selectedTypes = [];
  document.querySelectorAll('#config-body .opt-chip.selected[data-type]').forEach(function(c) {
    selectedTypes.push(c.dataset.type);
  });
  if (!selectedTypes.length) { toast('请至少选一个题型'); return; }

  var qs = getQuestions(configState.bank).filter(function(q) {
    return selectedTypes.indexOf(q.type) >= 0 && !q.disabled;
  });
  if (configState.shuffle) qs = shuffle(qs);
  if (configState.count !== 'all') qs = qs.slice(0, parseInt(configState.count));
  if (!qs.length) { toast('没有符合条件的题目'); return; }
  
  // 选项乱序
  if (configState.optionShuffle) {
    qs.forEach(function(q) {
      if (q.opts && q.opts.length > 1) {
        // 先找到所有正确答案的内容（支持多选）
        var correctContents = [];
        // 答案可能是单个字母（单选）或多个字母连在一起（多选，如"AB"）
        var answerLetters = q.answer.split('');
        q.opts.forEach(function(opt) {
          if (answerLetters.indexOf(opt.k) >= 0) {
            correctContents.push(opt.t);
          }
        });
        // 乱序选项，确保至少3项位置变化
        var originalOpts = q.opts.slice();
        var shuffled;
        var changedCount = 0;
        var attempts = 0;
        do {
          shuffled = shuffle(q.opts);
          // 计算有多少项位置变了
          changedCount = 0;
          shuffled.forEach(function(opt, idx) {
            if (opt.t !== originalOpts[idx].t) changedCount++;
          });
          attempts++;
        } while (changedCount < 3 && attempts < 10 && q.opts.length >= 4);
        // 重新分配选项字母A、B、C、D
        shuffled.forEach(function(opt, idx) {
          opt.k = String.fromCharCode(65 + idx); // A, B, C, D...
        });
        // 在新数组里找到所有正确答案对应的字母
        var newAnswerLetters = [];
        shuffled.forEach(function(opt) {
          if (correctContents.indexOf(opt.t) >= 0) {
            newAnswerLetters.push(opt.k);
          }
        });
        // 排序后作为新答案（保持字母顺序）
        newAnswerLetters.sort();
        q.answer = newAnswerLetters.join('');
        q.opts = shuffled;
      }
    });
  }

  beginQuiz(qs, { mode: 'practice', bank: configState.bank, from: 'home' });
}

// ============================================================
// 模拟考试
// ============================================================
function startExam(bankKey) {
  var qs = getQuestions(bankKey).filter(function(q) { return !q.disabled; });
  // 各题型随机抽一半
  var byType = {};
  qs.forEach(function(q) {
    byType[q.type] = byType[q.type] || [];
    byType[q.type].push(q);
  });
  var examQs = [];
  // 按题型固定顺序：单选→多选→判断→填空→简答→计算→论述
  TYPE_ORDER.forEach(function(t) {
    if (!byType[t]) return;
    var arr = shuffle(byType[t]);
    var half = Math.max(1, Math.floor(arr.length / 2));
    examQs = examQs.concat(arr.slice(0, half));
  });
  if (!examQs.length) { toast('该题库暂无题目'); return; }
  beginQuiz(examQs, { mode: 'exam', bank: bankKey, from: 'home' });
}

// ============================================================
// 答题引擎
// ============================================================
var quizState = null;
var currentPage = 'home';

function beginQuiz(questions, opts) {
  quizState = {
    questions: questions,
    index: 0,
    mode: opts.mode || 'practice',
    bank: opts.bank,
    from: opts.from || 'home',
    examId: opts.examId || null,
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    answers: [], // {qid, userAns, correct}
    wrongBatch: [], // 本次训练答错的题目 {qid, userAns}
    startTime: Date.now(),
    answered: false
  };
  showPage('page-quiz');
  renderQuizQuestion();
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function renderQuizQuestion() {
  var qs = quizState.questions;
  var i = quizState.index;
  document.getElementById('quiz-progress-text').textContent = (i+1) + '/' + qs.length;
  document.getElementById('quiz-progress-fill').style.width = ((i)/qs.length*100) + '%';

  var q = qs[i];
  var body = document.getElementById('quiz-body');
  var isExam = quizState.mode === 'exam';
  var banner = isExam ? '<div class="exam-banner">模拟考试 · 答对自动跳转 · 满分100 · 80分合格</div>' : '';

  // 实时统计
  var answered = quizState.answers.length;
  var correct = quizState.correct;
  var wrong = answered - correct;
  var statsHtml = '<div class="quiz-stats">' +
    '<span class="qs-total">总题 ' + qs.length + '</span>' +
    '<span class="qs-answered">已答 ' + answered + '</span>' +
    '<span class="qs-correct">✓ ' + correct + '</span>' +
    '<span class="qs-wrong">✗ ' + wrong + '</span>' +
  '</div>';

  var optsHtml = '';
  // 检查这道题是否已经答过
  var prevAns = null;
  for (var ai = 0; ai < quizState.answers.length; ai++) {
    if (quizState.answers[ai].qid === q.id) {
      prevAns = quizState.answers[ai];
      break;
    }
  }

  // 根据是否答过题设置 answered 状态（要在构建按钮之前设置）
  quizState.answered = !!prevAns;
  if (prevAns) {
    quizState.selectedOpts = prevAns.userAns ? prevAns.userAns.split('') : [];
  } else {
    quizState.selectedOpts = [];
  }

  if (q.type === 'sc' || q.type === 'mc') {
    optsHtml = '<div class="q-opts">' + q.opts.map(function(o, idx) {
      var cls = 'q-opt';
      var userAns = prevAns ? prevAns.userAns : '';
      if (userAns && userAns.indexOf(o.k) >= 0) cls += ' selected';
      return '<button class="' + cls + '" data-idx="' + idx + '" onclick="window.__app.pickOption(this,' + idx + ')">' +
        '<span class="opt-k">' + o.k + '</span>' + o.t + '</button>';
    }).join('') + '</div>';
  } else if (q.type === 'tf') {
    var tfSel = prevAns ? prevAns.userAns : '';
    optsHtml = '<div class="q-opts">' +
      '<button class="q-opt' + (tfSel === '√' ? ' selected' : '') + '" data-idx="0" onclick="window.__app.pickTF(this,\'√\')"><span class="opt-k">√</span> 正确</button>' +
      '<button class="q-opt' + (tfSel === '×' ? ' selected' : '') + '" data-idx="1" onclick="window.__app.pickTF(this,\'×\')"><span class="opt-k">×</span> 错误</button>' +
    '</div>';
  } else {
    // 主观题
    var prevInput = prevAns ? prevAns.userAns : '';
    optsHtml = '<textarea class="q-input" id="q-input" placeholder="请输入你的答案...">' + prevInput + '</textarea>';
    // 填空题不需要人工评分提示，简答/计算/论述需要
    if (q.type !== 'fill') {
      optsHtml += '<div class="subjective-tip">人工自行核对评分</div>';
    }
  }

  var actionsHtml = '';
  if (q.type === 'fill' || q.type === 'sa' || q.type === 'calc' || q.type === 'essay') {
    actionsHtml = '<button class="btn btn-primary" onclick="window.__app.gradeSubjective()">提交答案</button>';
  }
  // 交卷按钮（模拟考试模式）
  if (isExam) {
    actionsHtml += '<button class="btn btn-outline" onclick="window.__app.submitExam()">交卷</button>';
  }

  // 底部导航箭头（上一题/总览/下一题）
  var navHtml = '<div class="quiz-nav">' +
    (i > 0 ? '<button class="quiz-nav-btn" onclick="window.__app.prevQuestion()">← 上一题</button>' : '<span class="quiz-nav-btn disabled"></span>') +
    '<button class="quiz-nav-btn" onclick="window.__app.showOverview()">总览</button>' +
    '<button class="quiz-nav-btn" onclick="window.__app.nextQuestion()">下一题 →</button>' +
  '</div>';

  // 题目类型徽章 + 答完题后显示的下一题按钮（靠右）
  var typeBadgeHtml = '<span class="q-type-badge">' + TYPE_NAMES[q.type] + '</span>';
  if (quizState.answered) {
    typeBadgeHtml += '<button class="btn btn-primary btn-sm next-q-btn" onclick="window.__app.nextQuestion()">下一题 →</button>';
  }

  body.innerHTML = banner + statsHtml +
    '<div class="q-card" style="animation: fadeUp .25s ease;">' +
      '<div class="q-header">' + typeBadgeHtml + '</div>' +
      '<div class="q-text"><span class="q-num">第' + (i+1) + '题</span> ' + renderContent(q.q) + '</div>' +
      optsHtml +
      '<div class="feedback" id="feedback"></div>' +
      '<div class="quiz-actions" id="quiz-actions">' + actionsHtml + '</div>' +
    '</div>' +
    navHtml;

  // 如果这道题已经答过，显示之前的反馈
  if (prevAns) {
    quizState.answered = true;
    quizState.selectedOpts = prevAns.userAns.split('');
    var fb = document.getElementById('feedback');
    if (fb) {
      var isRight = prevAns.correct;
      var correct = q.answer || q.ans || '（见参考答案）';
      var html = '';
      if (isRight === true) {
        html = '<div class="fb-title">✓ 回答正确</div>';
        fb.className = 'feedback show ok';
      } else if (isRight === false) {
        html = '<div class="fb-title">✗ 回答错误</div>';
        fb.className = 'feedback show bad';
      } else {
        html = '<div class="fb-title">📝 主观题参考答案</div>';
        fb.className = 'feedback show';
      }
      html += '<div class="fb-ans">正确答案：<b>' + renderContent(correct) + '</b></div>';
      if (q.explain) html += '<div class="fb-explain">解析：' + renderContent(q.explain) + '</div>';
      else if (q.ans) html += '<div class="fb-explain">解析：' + renderAns(q.ans) + '</div>';
      fb.innerHTML = html;
    }
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// 渲染内容：转义 HTML，但保留 <img> 和 <br> 标签
function renderContent(s) {
  if (!s) return '';
  // 先转义全部
  var escaped = escapeHtml(s);
  // 还原 <img> 标签（匹配整个 <img ...> 并还原）
  escaped = escaped.replace(/&lt;img\s+([^&]+)&gt;/g, function(m, attrs) {
    return '<img ' + attrs.replace(/&quot;/g, '"') + '>';
  });
  // 还原 <br> 标签
  escaped = escaped.replace(/&lt;br\s*\/?&gt;/g, '<br>');
  return escaped;
}

// 渲染参考答案：按行输出（<br> 换行），以 "tips：" 开头的行使用淡绿色字体
function renderAns(s) {
  if (!s) return '';
  var lines = String(s).split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var rendered = renderContent(line);
    if (/^\s*tips[:：]/.test(line)) {
      rendered = '<span style="color:#66bb6a;">' + rendered + '</span>';
    }
    out.push(rendered);
  }
  return out.join('<br>');
}

function pickOption(el, idx) {
  var q = quizState.questions[quizState.index];
  if (quizState.answered) return;
  if (q.type === 'sc') {
    // 单选：立即判分
    quizState.selectedOpts = [idx];
    el.classList.add('selected');
    gradeObjective(q, q.opts[idx].k);
  } else if (q.type === 'mc') {
    // 多选：多选后点提交
    el.classList.toggle('selected');
    var sel = [];
    document.querySelectorAll('.q-opt.selected').forEach(function(e) { sel.push(parseInt(e.dataset.idx)); });
    quizState.selectedOpts = sel;
    // 显示提交按钮
    var actions = document.getElementById('quiz-actions');
    actions.innerHTML = '<button class="btn btn-primary" onclick="window.__app.submitMulti()">提交答案</button>';
  }
}

function pickTF(el, mark) {
  if (quizState.answered) return;
  quizState.selectedMark = mark;
  el.classList.add('selected');
  var q = quizState.questions[quizState.index];
  gradeObjective(q, mark);
}

function submitMulti() {
  var q = quizState.questions[quizState.index];
  if (quizState.answered) return;
  if (!quizState.selectedOpts.length) { toast('请选择选项'); return; }
  var ans = quizState.selectedOpts.sort().map(function(i){ return q.opts[i].k; }).join('');
  gradeObjective(q, ans);
}

function gradeObjective(q, userAns) {
  quizState.answered = true;
  var correct = q.answer;
  var isRight = (userAns === correct);

  // 标记选项颜色
  document.querySelectorAll('.q-opt').forEach(function(el) {
    var idx = parseInt(el.dataset.idx);
    var optK = (q.opts && q.opts.length > 0) ? q.opts[idx].k : (idx === 0 ? '√' : '×');
    el.classList.remove('selected');
    if (optK === correct) el.classList.add('correct');
    else if (optK === userAns) el.classList.add('wrong');
  });

  showFeedback(isRight, q, userAns);
  recordAnswer(q, userAns, isRight);

  // 答完后重新渲染，显示题目类型旁边的下一题按钮
  renderQuizQuestion();

  // 答对后自动跳转下一题
  if (isRight === true) {
    setTimeout(function() {
      if (quizState && quizState.answered) {
        nextQuestion();
      }
    }, 800);
  }
}

function gradeSubjective() {
  if (quizState.answered) return;
  var q = quizState.questions[quizState.index];
  var userAns = document.getElementById('q-input').value.trim();
  quizState.answered = true;
  quizState.userAnsTemp = userAns;

  // 填空题：逐字核验自动判分（忽略标点符号）
  if (q.type === 'fill') {
    var correctAns = (q.answer || q.ans || '').trim();
    // 去除所有标点符号再比对
    var removePunct = function(s) {
      return s.replace(/[，。！？；：、""''（）【】《》.,!?;:'"()\[\]<>~～\-—\s]/g, '');
    };
    var isRight = (removePunct(userAns) === removePunct(correctAns));
    showFeedback(isRight, q, userAns);
    recordAnswer(q, userAns, isRight);
    if (!isRight) addWrong(q.id, userAns);
    // 答完后重新渲染，显示题目类型旁边的下一题按钮
    renderQuizQuestion();
    // 答对后自动跳转下一题
    if (isRight === true) {
      setTimeout(function() {
        if (quizState && quizState.answered) {
          nextQuestion();
        }
      }, 800);
    }
  } else {
    // 简答/计算/论述：人工自评
    showFeedback(null, q, userAns); // 主观题不自动判分
    var actions = document.getElementById('quiz-actions');
    actions.innerHTML =
      '<button class="btn btn-outline" onclick="window.__app.selfGrade(true)">已掌握</button>' +
      '<button class="btn btn-danger" onclick="window.__app.selfGrade(false)">还需巩固</button>';
  }
}

function selfGrade(known) {
  var q = quizState.questions[quizState.index];
  var userAns = quizState.userAnsTemp || '';
  recordAnswer(q, userAns, known);
  if (!known) addWrong(q.id, userAns);
  quizState.userAnsTemp = '';
  // 答完后重新渲染，显示题目类型旁边的下一题按钮
  renderQuizQuestion();
}

function showFeedback(isRight, q, userAns) {
  var fb = document.getElementById('feedback');
  var correct = q.answer || q.ans || '（见参考答案）';
  var html = '';
  if (isRight === true) {
    html = '<div class="fb-title">✓ 回答正确</div>';
    fb.className = 'feedback show ok';
  } else if (isRight === false) {
    html = '<div class="fb-title">✗ 回答错误</div>';
    fb.className = 'feedback show bad';
    addWrong(q.id, userAns);
  } else {
    html = '<div class="fb-title">📝 主观题参考答案</div>';
    fb.className = 'feedback show';
  }
  html += '<div class="fb-ans">正确答案：<b>' + renderContent(correct) + '</b></div>';
  if (q.explain) html += '<div class="fb-explain">解析：' + renderContent(q.explain) + '</div>';
  else if (q.ans) html += '<div class="fb-explain">解析：' + renderAns(q.ans) + '</div>';
  fb.innerHTML = html;
}

function recordAnswer(q, userAns, isRight) {
  quizState.answers.push({ qid: q.id, userAns: userAns, correct: isRight });
  if (isRight === true) {
    quizState.correct++;
    quizState.score += scorePerQ(q);
    // 连对计数
    quizState.streak = (quizState.streak || 0) + 1;
    if (quizState.streak >= 2) {
      showStreakPopup('right', quizState.streak);
    }
  }
  else if (isRight === false) {
    quizState.wrong++;
    quizState.streak = 0; // 答错重置连对
    showStreakPopup('wrong', 0);
  }
}

// 连对弹出提示
function showStreakPopup(type, streak) {
  var emojis = ['😎', '🤩', '🥳', '😜', '🤗', '😏', '✨', '🎉'];
  var emoji = emojis[Math.floor(Math.random() * emojis.length)];
  var angle = -(15 + Math.random() * 30); // 向左倾斜15°-45°
  var text = '';
  if (type === 'right') {
    text = '连对' + streak + '道，太厉害了！' + emoji;
  } else {
    text = '太可惜了！😭';
  }
  var popup = document.createElement('div');
  popup.className = 'streak-popup';
  popup.style.transform = 'rotate(' + angle + 'deg)';
  popup.innerHTML = text;
  document.body.appendChild(popup);
  // 2秒后自动消失
  setTimeout(function() {
    popup.remove();
  }, 2000);
}

function scorePerQ(q) {
  // 模拟考试满分100，按题型分配权重
  if (quizState.mode !== 'exam') return 0;
  var totalQs = quizState.questions.length;
  return Math.round(100 / totalQs);
}

function nextQuestion() {
  quizState.index++;
  if (quizState.index >= quizState.questions.length) {
    finishQuiz();
  } else {
    renderQuizQuestion();
  }
}

function finishQuiz() {
  // 正常结束时保存本次错题批次
  saveWrongBatch();
  var elapsed = Math.round((Date.now() - quizState.startTime) / 1000);
  var qs = quizState.questions;
  var total = qs.length;
  var answered = quizState.answers.length;
  var correct = quizState.correct;

  // 按题型统计
  var typeStats = {};
  quizState.answers.forEach(function(a) {
    var q = getQuestionById(a.qid);
    if (!q) return;
    typeStats[q.type] = typeStats[q.type] || { total: 0, correct: 0 };
    typeStats[q.type].total++;
    if (a.correct) typeStats[q.type].correct++;
  });

  if (quizState.mode === 'exam') {
    // 模拟考试：计算分数
    var score = Math.round(correct / total * 100);
    var pass = score >= 80;
    // 归档错题
    var wrongQs = quizState.answers.filter(function(a){ return a.correct === false; });
    var rec = {
      id: 'exam_' + Date.now(),
      bank: quizState.bank,
      bankName: BANKS[quizState.bank].name,
      score: score,
      total: total,
      correct: correct,
      time: Date.now(),
      elapsed: elapsed,
      wrongIds: wrongQs.map(function(a){ return a.qid; }),
      answers: quizState.answers
    };
    addExamRecord(rec);
    showExamResult(rec, typeStats, elapsed);
  } else {
    showPracticeResult(correct, total, elapsed, typeStats);
  }
}

function showPracticeResult(correct, total, elapsed, typeStats) {
  var pct = total ? Math.round(correct/total*100) : 0;
  var rating = pct >= 90 ? '优秀' : pct >= 75 ? '良好' : pct >= 60 ? '及格' : '需努力';
  var typeHtml = Object.keys(typeStats).map(function(t) {
    var s = typeStats[t];
    var p = s.total ? Math.round(s.correct/s.total*100) : 0;
    return '<div class="type-result"><div class="tr-row"><span>' + TYPE_NAMES[t] + '</span><span>' + s.correct + '/' + s.total + ' (' + p + '%)</span></div>' +
      '<div class="tr-bar"><div class="tr-fill" style="width:' + p + '%"></div></div></div>';
  }).join('');

  document.getElementById('result-body').innerHTML =
    '<div class="result-card">' +
      '<div class="score-circle ' + (pct>=60?'pass':'fail') + '">' + pct + '%</div>' +
      '<div class="result-rating">' + rating + '</div>' +
      '<div class="result-detail">答对 ' + correct + ' / ' + total + ' 题 · 用时 ' + formatTime(elapsed) + '</div>' +
      typeHtml +
      '<div class="quiz-actions mt-20">' +
        '<button class="btn btn-outline" onclick="window.__app.goHome()">返回首页</button>' +
        '<button class="btn btn-primary" onclick="window.__app.retryWrong()">错题重练</button>' +
      '</div>' +
    '</div>';
  showPage('page-result');
}

function showExamResult(rec, typeStats, elapsed) {
  var pass = rec.score >= 80;
  var typeHtml = Object.keys(typeStats).map(function(t) {
    var s = typeStats[t];
    var p = s.total ? Math.round(s.correct/s.total*100) : 0;
    return '<div class="type-result"><div class="tr-row"><span>' + TYPE_NAMES[t] + '</span><span>' + s.correct + '/' + s.total + ' (' + p + '%)</span></div>' +
      '<div class="tr-bar"><div class="tr-fill" style="width:' + p + '%"></div></div></div>';
  }).join('');

  document.getElementById('result-body').innerHTML =
    '<div class="result-card">' +
      '<div class="score-circle ' + (pass?'pass':'fail') + '">' + rec.score + '</div>' +
      '<div class="result-rating">' + (pass ? '🎉 合格' : '❌ 不合格（需 ≥80 分）') + '</div>' +
      '<div class="result-detail">' + rec.bankName + ' · 答对 ' + rec.correct + '/' + rec.total + ' · 用时 ' + formatTime(rec.elapsed) + '</div>' +
      typeHtml +
      (rec.wrongIds.length ? '<div class="text2 mt-10">错题已收录到错题本「模拟考试」栏</div>' : '') +
      '<div class="quiz-actions mt-20">' +
        '<button class="btn btn-outline" onclick="window.__app.goHome()">返回首页</button>' +
        (rec.wrongIds.length ? '<button class="btn btn-danger" onclick="window.__app.retryExamWrong(\'' + rec.id + '\')">重做错题</button>' : '') +
        '<button class="btn btn-primary" onclick="window.__app.retryExam(\'' + rec.id + '\')">重做整卷</button>' +
      '</div>' +
    '</div>';
  showPage('page-result');
}

function formatTime(s) {
  var m = Math.floor(s/60), sec = s%60;
  return m + '分' + sec + '秒';
}

function retryWrong() {
  var list = getWrongList();
  if (!list.length) { toast('暂无错题'); return; }
  // 去重，只保留唯一的题目id
  var seen = {};
  var uniqueIds = [];
  list.forEach(function(w) {
    if (!seen[w.id]) {
      seen[w.id] = true;
      uniqueIds.push(w.id);
    }
  });
  var qs = uniqueIds.map(function(id){ return getQuestionById(id); }).filter(Boolean);
  if (!qs.length) { toast('暂无错题'); return; }
  beginQuiz(qs, { mode: 'practice', bank: quizState ? quizState.bank : 'auto', from: 'wrong' });
}

// 重练某批次的所有错题
function retryBatch(idsStr) {
  var ids = idsStr.split(',');
  var qs = ids.map(function(id){ return getQuestionById(id); }).filter(Boolean);
  if (!qs.length) { toast('暂无错题'); return; }
  beginQuiz(qs, { mode: 'practice', bank: qs[0].id.split('_')[0], from: 'wrong' });
}

function retryExamWrong(examId) {
  var h = getExamHistory();
  var rec = h.find(function(r){ return r.id === examId; });
  if (!rec) return;
  var qs = rec.wrongIds.map(function(id){ return getQuestionById(id); }).filter(Boolean);
  beginQuiz(qs, { mode: 'practice', bank: rec.bank, from: 'exam', examId: examId });
}

function retryExam(examId) {
  var rec = getExamHistory().find(function(r){ return r.id === examId; });
  if (!rec) return;
  // 重新从该题库随机抽一半
  var qs = getQuestions(rec.bank);
  // 按题型分组，每组抽一半
  var byType = {};
  qs.forEach(function(q) {
    if (!byType[q.type]) byType[q.type] = [];
    byType[q.type].push(q);
  });
  var examQs = [];
  Object.keys(byType).forEach(function(t) {
    var arr = byType[t];
    var half = Math.ceil(arr.length / 2);
    examQs = examQs.concat(arr.slice(0, half));
  });
  if (!examQs.length) { toast('该题库暂无题目'); return; }
  beginQuiz(examQs, { mode: 'exam', bank: rec.bank, from: 'exam', examId: examId });
}

// ============================================================
// 错题本
// ============================================================
var wrongTab = 'practice';
function renderWrong() {
  var body = document.getElementById('wrong-body');
  var clearBtn;
  if (wrongTab === 'practice') {
    clearBtn = '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
      '<button class="btn btn-outline btn-sm" onclick="window.__app.clearWrong()">清空全部错题</button>' +
    '</div>';
  } else {
    clearBtn = '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
      '<button class="btn btn-outline btn-sm" onclick="window.__app.clearExamHistory()">清空模拟考试记录</button>' +
    '</div>';
  }
  
  if (wrongTab === 'practice') {
    var list = getWrongList();
    if (!list.length) { 
      body.innerHTML = clearBtn + '<div class="empty-tip">暂无错题，去答题吧～</div>'; 
      return; 
    }
    // 按时间分组，精确到分钟
    var groups = {};
    list.forEach(function(w) {
      var d = new Date(w.time);
      var key = d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate() + ' ' + 
                d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });
    
    var html = clearBtn;
    
    Object.keys(groups).forEach(function(time) {
      var items = groups[time];
      // 收集这一批次的所有题目id
      var batchIds = items.map(function(w){ return w.id; }).join(',');
      html += '<div class="exam-group">' +
        '<div class="eg-head">' +
          '<span class="eg-title">' + time + '</span>' +
          '<span class="eg-score">' + items.length + ' 道错题</span>' +
          '<button class="btn btn-primary btn-sm" onclick="window.__app.retryBatch(\'' + batchIds + '\')">重练</button>' +
        '</div>' +
        '<div class="eg-wrong-list collapsed">' +
          '<div class="eg-wrong-title" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
            '<span class="eg-wrong-toggle">▶</span> 查看错题列表（' + items.length + ' 道）' +
          '</div>' +
          '<div class="eg-wrong-items">';
      
      items.forEach(function(w) {
        var q = getQuestionById(w.id);
        if (q) {
          html += '<div class="wrong-item">' +
            '<div class="wi-head"><span class="wi-bank">' + (BANKS[q.id.split('_')[0]]?BANKS[q.id.split('_')[0]].name:'') + ' · ' + TYPE_NAMES[q.type] + '</span>' +
            '<span class="wi-time">' + new Date(w.time).toLocaleTimeString('zh-CN') + '</span></div>' +
            '<div class="wi-q">' + escapeHtml(q.q.substring(0, 80)) + (q.q.length>80?'...':'') + '</div>' +
            '<div class="wi-meta">你的答案：' + escapeHtml(w.userAns||'') + '</div>' +
            '<div class="wi-actions">' +
              '<button class="btn btn-primary btn-sm" onclick="window.__app.practiceWrong(\'' + w.id + '\')">重练</button>' +
              '<button class="btn btn-outline btn-sm" onclick="window.__app.removeWrong(\'' + w.id + '\', this.closest(\'.wrong-item\'))">移除</button>' +
            '</div></div>';
        }
      });
      
      html += '</div></div></div>';
    });
    
    body.innerHTML = html;
  } else {
    // 模拟考试
    var h = getExamHistory();
    if (!h.length) { 
      body.innerHTML = clearBtn + '<div class="empty-tip">暂无模拟考试记录</div>'; 
      return; 
    }
    var html = clearBtn;
    body.innerHTML = html + h.map(function(rec) {
      var pass = rec.score >= 80;
      // 错题列表（显示题号，默认折叠）
      var wrongList = '';
      if (rec.wrongIds && rec.wrongIds.length) {
        wrongList = '<div class="eg-wrong-list collapsed">' +
          '<div class="eg-wrong-title" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
            '<span class="eg-wrong-toggle">▶</span> 错题列表（' + rec.wrongIds.length + ' 道）' +
          '</div>' +
          '<div class="eg-wrong-items">';
        rec.wrongIds.forEach(function(qid, idx) {
          var q = getQuestionById(qid);
          if (q) {
            wrongList += '<button class="eg-wrong-item" onclick="window.__app.practiceWrong(\'' + qid + '\')">' +
              (idx+1) + '. ' + TYPE_NAMES[q.type] + ' 第' + q.num + '题</button>';
          }
        });
        wrongList += '</div></div>';
      }
      return '<div class="exam-group">' +
        '<div class="eg-head"><span class="eg-title">' + rec.bankName + '</span>' +
        '<span class="eg-score ' + (pass?'pass':'fail') + '">' + rec.score + '分</span></div>' +
        '<div class="eg-meta">' + new Date(rec.time).toLocaleString('zh-CN') +
          ' · 答对 ' + rec.correct + '/' + rec.total + ' · 用时 ' + formatTime(rec.elapsed) + '</div>' +
        '<div class="eg-meta">错题 ' + rec.wrongIds.length + ' 道</div>' +
        wrongList +
        '<div class="eg-actions">' +
          (rec.wrongIds.length ? '<button class="btn btn-danger btn-sm" onclick="window.__app.retryExamWrong(\'' + rec.id + '\')">重做全部错题</button>' : '') +
          '<button class="btn btn-primary btn-sm" onclick="window.__app.retryExam(\'' + rec.id + '\')">重做整卷</button>' +
        '</div></div>';
    }).join('');
  }
}

function practiceWrong(qid) {
  var q = getQuestionById(qid);
  if (!q) return;
  beginQuiz([q], { mode: 'practice', bank: qid.split('_')[0], from: 'wrong' });
}
function clearWrong() {
  saveWrongList([]);
  renderWrong();
  toast('已清空所有错题');
}

// 清空模拟考试记录
function clearExamHistory() {
  localStorage.removeItem('zhuanben_exam_history_v1');
  renderWrong();
  toast('已清空模拟考试记录');
}

// ============================================================
// 题库管理（分学科 + 收纳折叠）
// ============================================================
var expandedBank = null;
function renderManage() {
  var body = document.getElementById('manage-body');
  var html = '';
  Object.keys(BANKS).forEach(function(bk) {
    var info = BANKS[bk];
    var qs = getQuestions(bk);
    var typeStats = {};
    qs.forEach(function(q) { typeStats[q.type] = (typeStats[q.type]||0) + 1; });
    var expanded = expandedBank === bk;

    // 题型行（支持自定义题型）
    var typeRows = Object.keys(typeStats).map(function(t) {
      var name = TYPE_NAMES[t] || t;
      return '<div class="manage-type-row"><span>' + name + '</span><span class="mtr-count">' + typeStats[t] + ' 题</span></div>';
    }).join('');

    html +=
      '<div class="manage-section' + (expanded?' expanded':'') + '" data-bank="' + bk + '">' +
        '<div class="manage-head" onclick="window.__app.toggleBank(\'' + bk + '\')" onlongpress="window.__app.deleteBank(\'' + bk + '\')">' +
          '<div><div class="mh-title">' + info.name + '</div>' +
          '<div class="mh-count">共 ' + qs.length + ' 题 · ' +
            Object.keys(typeStats).map(function(t){ var name = TYPE_NAMES[t] || t; return name + typeStats[t]; }).join('、') +
          '</div></div>' +
          '<span class="mh-toggle">' + (expanded ? '▼ 收纳' : '▶ 展开') + '</span>' +
        '</div>' +
        '<div class="manage-body">' +
          typeRows +
          '<div class="manage-toolbar">' +
            '<button class="btn btn-outline btn-sm" onclick="window.__app.exportBank(\'' + bk + '\')">导出 JSON</button>' +
            '<button class="btn btn-outline btn-sm" onclick="window.__app.importJson(\'' + bk + '\')">导入 JSON</button>' +
            '<button class="btn btn-primary btn-sm" onclick="window.__app.addQuestion(\'' + bk + '\')">添加题目</button>' +
            '<button class="btn btn-danger btn-sm" onclick="window.__app.deleteBank(\'' + bk + '\')">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  });

  // 创建学科区
  html += '<div class="config-section mt-20"><h4>创建学科</h4>' +
    '<div class="custom-bank-form">' +
      '<input type="text" id="new-bank-name" class="q-input" placeholder="输入学科名称，如：机械设计基础" style="margin-bottom:10px;">' +
      '<button class="btn btn-primary" onclick="window.__app.createCustomBank()">创建新学科</button>' +
    '</div></div>';

  // 资料管理区
  var refList = getRefList();
  html += '<div class="config-section mt-20"><h4>资料管理</h4>';
  refList.forEach(function(ref, idx) {
    var expanded = expandedBank === ('__ref_' + idx);
    html += '<div class="manage-section' + (expanded ? ' expanded' : '') + '">' +
      '<div class="manage-head" onclick="window.__app.toggleBank(\'__ref_' + idx + '\')">' +
        '<div><div class="mh-title">' + ref.name + '</div>' +
        '<div class="mh-count">' + (ref.content ? ref.content.length + ' 字符' : '空资料') + '</div></div>' +
        '<span class="mh-toggle">' + (expanded ? '▼ 收纳' : '▶ 展开') + '</span>' +
      '</div>' +
      (expanded ? '<div class="manage-body">' +
        '<div class="manage-toolbar">' +
          '<button class="btn btn-primary btn-sm" onclick="window.__app.showRef(' + idx + ', \'manage\')">查看资料</button>' +
          '<button class="btn btn-outline btn-sm" onclick="window.__app.editRef(' + idx + ')">编辑名称</button>' +
          '<button class="btn btn-outline btn-sm" onclick="window.__app.editRefContent(' + idx + ')">编辑内容</button>' +
          '<button class="btn btn-danger btn-sm" onclick="window.__app.deleteRef(' + idx + ')">删除</button>' +
        '</div>' +
      '</div>' : '') +
    '</div>';
  });
  html += '<div class="manage-toolbar mt-10" style="margin-top:10px;">' +
    '<button class="btn btn-primary btn-sm" onclick="window.__app.addRef()">添加新资料</button>' +
  '</div></div>';

  body.innerHTML = html;
}

function toggleBank(bk) {
  expandedBank = (expandedBank === bk) ? null : bk;
  renderManage();
}

function createCustomBank() {
  var name = document.getElementById('new-bank-name').value.trim();
  if (!name) { toast('请输入学科名称'); return; }
  var id = 'custom_' + Date.now();
  BANKS[id] = { name: name, custom: true };
  toast('学科「' + name + '」创建成功');
  renderManage();
}

// 自定义确认弹窗
function customConfirm(message, onConfirm) {
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = 
    '<div style="background:var(--panel);border-radius:16px;padding:24px;width:100%;max-width:320px;">' +
      '<h3 style="margin:0 0 16px 0;font-size:18px;text-align:center;">确认操作</h3>' +
      '<p style="margin:0 0 20px 0;font-size:15px;color:var(--text2);text-align:center;line-height:1.6;">' + message + '</p>' +
      '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-outline" style="flex:1;" id="confirm-cancel">取消</button>' +
        '<button class="btn btn-primary" style="flex:1;" id="confirm-ok">确定</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  
  document.getElementById('confirm-cancel').onclick = function() {
    modal.remove();
  };
  document.getElementById('confirm-ok').onclick = function() {
    modal.remove();
    onConfirm();
  };
}

// 删除题库
function deleteBank(bk) {
  var info = BANKS[bk];
  if (!info) return;
  customConfirm('确定要删除学科「' + info.name + '」吗？所有题目都会被删除！', function() {
    delete BANKS[bk];
    localStorage.removeItem('custom_banks');
    // 保存自定义题库
    var custom = {};
    Object.keys(BANKS).forEach(function(k) {
      if (BANKS[k].custom) custom[k] = BANKS[k];
    });
    localStorage.setItem('custom_banks', JSON.stringify(custom));
    toast('学科已删除');
    renderManage();
  });
}

function addQuestion(bk) {
  // 弹出添加题目表单
  var typeOptions = TYPE_ORDER.map(function(t) {
    return '<option value="' + t + '">' + TYPE_NAMES[t] + '</option>';
  }).join('');
  var html = '<div class="q-card">' +
    '<h4>添加题目到「' + BANKS[bk].name + '」</h4>' +
    '<input type="text" id="aq-type" class="q-input" placeholder="题型（如：单选题、多选题、简答题、自定义题型）" style="margin-bottom:8px;">' +
    '<textarea id="aq-q" class="q-input" placeholder="题目内容（可在末尾插入 <br><img src=...> 来添加图片）" style="height:80px;margin:8px 0;"></textarea>' +
    '<textarea id="aq-opts" class="q-input" placeholder="选项（选择题填写，每题一行，格式：A.选项内容）" style="height:80px;margin:8px 0;display:none;"></textarea>' +
    '<input type="text" id="aq-answer" class="q-input" placeholder="正确答案（如 A、√、对）" style="margin:8px 0;">' +
    '<textarea id="aq-explain" class="q-input" placeholder="参考答案/解析（可在末尾插入 <br><img src=...> 来添加图片）" style="height:60px;margin:8px 0;"></textarea>' +
    '<div class="quiz-actions">' +
      '<button class="btn btn-primary" onclick="window.__app.saveQuestion(\'' + bk + '\')">保存题目</button>' +
      '<button class="btn btn-outline" onclick="window.__app.toggleBank(\'' + bk + '\')">取消</button>' +
    '</div>' +
  '</div>';
  document.getElementById('manage-body').innerHTML = html;
}

function saveQuestion(bk) {
  var type = document.getElementById('aq-type').value;
  var q = document.getElementById('aq-q').value.trim();
  var answer = document.getElementById('aq-answer').value.trim();
  var explain = document.getElementById('aq-explain').value.trim();
  if (!q || !answer) { toast('请填写题目和答案'); return; }

  var id = bk + '_custom_' + Date.now();
  var opts = [];
  if (type === 'sc' || type === 'mc') {
    var optsText = document.getElementById('aq-opts').value.trim();
    if (optsText) {
      optsText.split('\n').forEach(function(line) {
        line = line.trim();
        if (line) {
          var k = line.charAt(0);
          var t = line.substring(1).replace(/^[.．、\s]+/, '');
          opts.push({ k: k, t: t });
        }
      });
    }
  }

  var newQ = {
    id: id, type: type, num: 999,
    q: q, opts: opts,
    answer: answer, ans: answer, explain: explain,
    custom: true
  };

  // 保存到 localStorage（存入对应科目的 __new__ 数组）
  var edits = JSON.parse(localStorage.getItem(STORAGE_EDITS) || '{}');
  if (!edits[bk]) edits[bk] = {};
  if (!edits[bk].__new__) edits[bk].__new__ = [];
  edits[bk].__new__.push(newQ);
  localStorage.setItem(STORAGE_EDITS, JSON.stringify(edits));

  toast('题目保存成功');
  renderManage();
}

// JSON 导出导入
function exportBank(bk) {
  var qs = getQuestions(bk);
  var blob = new Blob([JSON.stringify(qs, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = bk + '-questions.json';
  a.click();
}
function importJson(bk) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var arr = JSON.parse(ev.target.result);
        if (!Array.isArray(arr)) throw '格式错误';
        var edits = getEdits();
        edits[bk] = edits[bk] || {};
        arr.forEach(function(q) {
          q.id = q.id || (bk + '_' + q.type + '_' + q.num);
          edits[bk][q.id] = q;
        });
        saveEdits(edits);
        toast('导入成功');
        renderManage();
      } catch(err) { toast('导入失败：' + err); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Word 导入（浏览器端解析 docx）
function importWord(bk) {
  document.getElementById('word-file').dataset.bank = bk;
  document.getElementById('word-file').click();
}

function handleWordImport(input) {
  var file = input.files[0];
  var bk = input.dataset.bank || 'auto';
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    if (typeof JSZip === 'undefined') { toast('JSZip 未加载，请联网后重试'); return; }
    JSZip.loadAsync(e.target.result).then(function(zip) {
      return zip.file('word/document.xml').async('string');
    }).then(function(xml) {
      var questions = parseDocxXml(xml, bk);
      if (!questions.length) { toast('未解析到题目，请检查文件格式'); return; }
      var edits = getEdits();
      edits[bk] = edits[bk] || {};
      questions.forEach(function(q) { edits[bk][q.id] = q; });
      saveEdits(edits);
      toast('成功导入 ' + questions.length + ' 题');
      renderManage();
    }).catch(function(err) { toast('解析失败：' + err); });
  };
  reader.readAsArrayBuffer(file);
}

// 轻量 docx XML 解析
function parseDocxXml(xml, bankKey) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(xml, 'text/xml');
  var paras = doc.getElementsByTagName('w:p');
  var lines = [];
  for (var i = 0; i < paras.length; i++) {
    var ts = paras[i].getElementsByTagName('w:t');
    var txt = '';
    for (var j = 0; j < ts.length; j++) txt += ts[j].textContent;
    txt = txt.trim();
    if (txt) lines.push(txt);
  }

  var questions = [];
  var curType = null, curNum = null, curQ = '', curOpts = [], optMap = {};

  function flush() {
    if (curNum !== null && curType) {
      questions.push({
        id: bankKey + '_' + curType + '_' + curNum,
        type: curType, num: curNum, q: curQ,
        opts: Object.keys(optMap).map(function(k){ return {k:k,t:optMap[k]}; }),
        answer: '', disabled: false
      });
    }
    curNum = null; curQ = ''; curOpts = []; optMap = {};
  }

  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var sm = l.match(/^[一二三四五六七八九十]+[、．.]\s*(.*)/);
    if (sm) {
      var name = sm[1];
      if (name.indexOf('单选')>=0||name.indexOf('单项')>=0) { flush(); curType='sc'; continue; }
      if (name.indexOf('多选')>=0) { flush(); curType='mc'; continue; }
      if (name.indexOf('判断')>=0) { flush(); curType='tf'; continue; }
      if (name.indexOf('填空')>=0) { flush(); curType='fill'; continue; }
      if (name.indexOf('简答')>=0) { flush(); curType='sa'; continue; }
      if (name.indexOf('计算')>=0) { flush(); curType='calc'; continue; }
      if (name.indexOf('论述')>=0) { flush(); curType='essay'; continue; }
    }
    if (l.indexOf('答案')>=0 && l.length<20) break;

    var qm = l.match(/^(\d{1,3})\s*[.．、]\s*(.*)/);
    var om = l.match(/^([A-DＡ-Ｄ])\s*[.．、]\s*(.*)/);
    if (qm && !om) {
      flush();
      curNum = parseInt(qm[1]);
      curQ = qm[2];
    } else if (om) {
      var k = om[1].toUpperCase().replace(/[Ａ-Ｄ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0xFEE0); });
      optMap[k] = om[2];
    }
  }
  flush();
  return questions;
}

// ============================================================
// 设置
// ============================================================
function renderSettings() {
  var body = document.getElementById('settings-body');
  var currentTheme = localStorage.getItem('app_theme') || 'dark';

  body.innerHTML =
    '<div class="config-section"><h4>界面主题</h4>' +
      '<div class="theme-grid">' +
        '<button class="theme-btn' + (currentTheme === 'dark' ? ' active' : '') + '" onclick="window.__app.setTheme(\'dark\')">🌙 深夜黑</button>' +
        '<button class="theme-btn' + (currentTheme === 'light' ? ' active' : '') + '" onclick="window.__app.setTheme(\'light\')">❄️ 雪花白</button>' +
        '<button class="theme-btn' + (currentTheme === 'eye-care' ? ' active' : '') + '" onclick="window.__app.setTheme(\'eye-care\')">🌿 护眼绿</button>' +
        '<button class="theme-btn' + (currentTheme === 'night-purple' ? ' active' : '') + '" onclick="window.__app.setTheme(\'night-purple\')">🔮 暗夜紫</button>' +
        '<button class="theme-btn' + (currentTheme === 'deep-ocean' ? ' active' : '') + '" onclick="window.__app.setTheme(\'deep-ocean\')">🌊 深海蓝</button>' +
      '</div>' +
    '</div>' +
    '<div class="config-section"><h4>关于</h4>' +
      '<div class="text2">' +
        '<b>免责声明：</b><br>' +
        '1. 本软件由个人AI开发，仅供学习交流使用，不保证内容的准确性和完整性。<br>' +
        '2. 题库内容来源于公开资料整理，如有侵权请联系删除。<br>' +
        '3. 使用者应自行核对题目和答案的正确性，本软件不对因使用本软件造成的任何损失承担责任。<br>' +
        '4. 本软件不收集任何用户数据，所有数据仅保存在本地设备。' +
      '</div></div>';
}

// 深色/浅色模式切换
function setDarkMode(isDark) {
  localStorage.setItem('dark_mode', isDark ? 'dark' : 'light');
  if (isDark) {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }
  renderSettings();
}

// 主题切换
function setTheme(theme) {
  localStorage.setItem('app_theme', theme);
  // 移除所有主题类
  document.body.classList.remove('light-mode', 'eye-care-mode', 'night-purple-mode', 'deep-ocean-mode');
  // 添加对应主题类
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else if (theme === 'eye-care') {
    document.body.classList.add('eye-care-mode');
  } else if (theme === 'night-purple') {
    document.body.classList.add('night-purple-mode');
  } else if (theme === 'deep-ocean') {
    document.body.classList.add('deep-ocean-mode');
  }
  renderSettings();
}

// 初始化主题
function initTheme() {
  var theme = localStorage.getItem('app_theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else if (theme === 'eye-care') {
    document.body.classList.add('eye-care-mode');
  } else if (theme === 'night-purple') {
    document.body.classList.add('night-purple-mode');
  } else if (theme === 'deep-ocean') {
    document.body.classList.add('deep-ocean-mode');
  }
}

function importWord() {
  var input = document.createElement('input');
  input.type='file'; input.accept='.docx,.doc,.txt';
  input.onchange = function(e) {
    var f = e.target.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = ev.target.result;
      // 简单解析题目格式
      var questions = [];
      var lines = text.split(/\r?\n/);
      var curType = 'sc';
      var curNum = 0;
      var curQ = '';
      var optMap = {};
      var curAns = '';
      var bankName = prompt('请输入导入的题库名称：', f.name.replace(/\.[^.]+$/, ''));
      if (!bankName) { toast('已取消'); return; }
      var bankId = 'custom_' + Date.now();
      BANKS[bankId] = { name: bankName, custom: true };
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (!l) continue;
        // 题型识别
        if (l.indexOf('单选') >= 0 || l.indexOf('一、') >= 0) { curType = 'sc'; continue; }
        if (l.indexOf('多选') >= 0 || l.indexOf('二、') >= 0) { curType = 'mc'; continue; }
        if (l.indexOf('判断') >= 0 || l.indexOf('三、') >= 0) { curType = 'tf'; continue; }
        if (l.indexOf('填空') >= 0 || l.indexOf('四、') >= 0) { curType = 'fill'; continue; }
        if (l.indexOf('简答') >= 0 || l.indexOf('五、') >= 0) { curType = 'sa'; continue; }
        // 题目识别
        var qm = l.match(/^(\d{1,3})\s*[.．、]\s*(.*)/);
        var om = l.match(/^([A-DＡ-Ｄ])\s*[.．、]\s*(.*)/);
        var am = l.match(/^答案\s*[.．:：]\s*(.*)/);
        if (qm && !om) {
          if (curQ) {
            questions.push({ id: bankId + '_' + curNum, type: curType, num: curNum, q: curQ, opts: Object.keys(optMap).map(function(k){return{k:k,t:optMap[k]};}), answer: curAns, ans: curAns, explain: '' });
          }
          curNum = parseInt(qm[1]);
          curQ = qm[2];
          optMap = {};
          curAns = '';
        } else if (om) {
          var k = om[1].toUpperCase().replace(/[Ａ-Ｄ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0xFEE0); });
          optMap[k] = om[2];
        } else if (am) {
          curAns = am[1];
        } else {
          if (curQ) curQ += ' ' + l;
        }
      }
      if (curQ) {
        questions.push({ id: bankId + '_' + curNum, type: curType, num: curNum, q: curQ, opts: Object.keys(optMap).map(function(k){return{k:k,t:optMap[k]};}), answer: curAns, ans: curAns, explain: '' });
      }
      if (questions.length === 0) { toast('未能识别题目，请检查文件格式'); return; }
      // 保存到 localStorage
      var edits = JSON.parse(localStorage.getItem(STORAGE_EDITS) || '{}');
      edits[bankId] = { __new__: questions };
      localStorage.setItem(STORAGE_EDITS, JSON.stringify(edits));
      toast('成功导入 ' + questions.length + ' 道题到「' + bankName + '」');
      renderManage();
    };
    reader.readAsText(f);
  };
  input.click();
}

function resetAll() {
  if (confirm('删除所有题库将清除所有自定义题库和错题，确定？')) {
    localStorage.removeItem(STORAGE_EDITS);
    localStorage.removeItem(STORAGE_WRONG);
    localStorage.removeItem(STORAGE_EXAM_HISTORY);
    toast('已删除所有题库'); goHome();
  }
}

// ============================================================
// 初始化
// ============================================================
function init() {
  loadTheme();
  initTheme();

  // 导航
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var page = btn.dataset.nav;
      if (page === 'home') goHome();
      else if (page === 'wrong') { wrongTab='practice'; renderWrongTabs(); showPage('page-wrong'); renderWrong(); }
      else if (page === 'manage') { expandedBank=null; renderManage(); showPage('page-manage'); }
      else if (page === 'settings') { renderSettings(); showPage('page-settings'); }
    });
  });

  // 错题本 tab
  document.querySelectorAll('.wrong-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      wrongTab = tab.dataset.wtab;
      renderWrongTabs();
      renderWrong();
    });
  });

  // 主观题按钮事件（通过事件委托）
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'q-input-submit') gradeSubjective();
  });

  // 左右滑动手势（答题页）
  var touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!quizState) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    // 横向滑动为主（>50px，且横向距离 > 纵向距离的 1.5 倍）
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        // 左滑 → 下一题（如果当前题已答）
        if (quizState.answered) nextQuestion();
      } else {
        // 右滑 → 上一题
        prevQuestion();
      }
    }
  }, { passive: true });

  renderHome();
}

function renderWrongTabs() {
  document.querySelectorAll('.wrong-tab').forEach(function(t){
    t.classList.toggle('active', t.dataset.wtab === wrongTab);
  });
}

// 暴露给全局
window.__app = {
  startConfig: startConfig,
  startExam: startExam,
  toggleType: toggleType,
  selectAllTypes: selectAllTypes,
  setCount: setCount,
  setShuffle: setShuffle,
  setOptionShuffle: setOptionShuffle,
  startQuiz: startQuiz,
  pickOption: pickOption,
  pickTF: pickTF,
  submitMulti: submitMulti,
  gradeSubjective: gradeSubjective,
  nextQuestion: nextQuestion,
  selfGrade: selfGrade,
  retryWrong: retryWrong,
  retryBatch: retryBatch,
  retryExamWrong: retryExamWrong,
  retryExam: retryExam,
  practiceWrong: practiceWrong,
  removeWrong: removeWrong,
  clearWrong: clearWrong,
  toggleBank: toggleBank,
  exportBank: exportBank,
  importJson: importJson,
  applyTheme: applyTheme,
  applyCustomColor: applyCustomColor,
  importWord: importWord,
  resetAll: resetAll,
  goHome: goHome,
  quitQuiz: quitQuiz,
  handleBack: handleBack,
  submitExam: submitExam,
  prevQuestion: prevQuestion,
  showOverview: showOverview,
  createCustomBank: createCustomBank,
  addQuestion: addQuestion,
  saveQuestion: saveQuestion,
  exitOverview: exitOverview,
  jumpToQuestion: jumpToQuestion,
  showRef: showRef,
  searchRef: searchRef,
  showRefCat: showRefCat,
  closeRefCat: closeRefCat,
  filterRefCat: filterRefCat,
  quizBack: quizBack,
  zoomRef: zoomRef,
  hideRefZoom: hideRefZoom,
  setDarkMode: setDarkMode,
  setTheme: setTheme,
  editRef: editRef,
  addRefImage: addRefImage,
  addRef: addRef,
  editRefContent: editRefContent,
  deleteBank: deleteBank,
  deleteRef: deleteRef,
  clearExamHistory: clearExamHistory
};

document.addEventListener('DOMContentLoaded', init);

// SW 注册（忽略错误，WebView 中可能不支持）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function(){});
}

})();
