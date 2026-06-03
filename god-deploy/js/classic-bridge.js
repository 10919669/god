/**
 * classic-bridge.js - 经典版功能桥接到宇宙版
 * 复用 decision-engine.js 和 share.js，不依赖 app.js
 */

import { getDecision, retranslate, getLoadingMessage } from './decision-engine.js';
import { generateShareCard, saveOrShareImage, preloadAllIllustrations } from './share.js';

// ─── 海报路径（支持 use_old_posters=1 切换旧图） ───
const _PP = window.__POSTER_PREFIX || 'assets/posters/';
function posterPath(name) { return _PP + name; }
const POSTER_BASE_MAP = {
  eat_today: 'eat_today.jpg', drink_today: 'drink_today.jpg', wear_today: 'wear_today.jpg',
  wash_hair: 'wash_hair.jpg', sleep_early: 'sleep_early.jpg', go_out: 'go_out.jpg',
  send_msg: 'send_msg.jpg', buy_it: 'buy_it.jpg', date: 'date.jpg',
  fitness: 'fitness.jpg', study: 'study.jpg', diet: 'diet.jpg', custom: 'custom.jpg',
};

// ─── 状态 ───────────────────────────────────────────────
const bridgeState = {
  templateId: null,
  questionText: '',
  geoPermission: 'denied',
  latitude: null,
  longitude: null,
  lastResult: null,
  shareDataUrl: null,
  currentTone: 'bestie',
  previousPage: null,
  _calculating: false,
  _pendingTimers: [],
};

const SARCASTIC_TEMPLATES = ['eat_today', 'drink_today', 'wear_today', 'wash_hair', 'sleep_early', 'go_out', 'send_msg', 'buy_it', 'custom'];

// ─── DOM 引用 ───────────────────────────────────────────
const universeMain = document.querySelector('main');
const classicApp = document.getElementById('classic-app');
const orbitalRing = document.querySelector('.orbital-ring');

// ─── 页面切换 ───────────────────────────────────────────

function showClassicPages() {
  classicApp.style.display = 'block';
  universeMain.style.display = 'none';
  document.body.classList.add('classic-active');
  if (window._orbitPaused !== undefined) window._orbitPaused = true;
}

function showUniverse() {
  classicApp.style.display = 'none';
  universeMain.style.display = '';
  document.body.classList.remove('classic-active');
  if (window._orbitPaused !== undefined) window._orbitPaused = false;
  if (window._startOrbitAnimation) window._startOrbitAnimation();
  classicApp.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
}

function navigateTo(pageName) {
  classicApp.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add('active');
}

// ─── 核心流程 ───────────────────────────────────────────

/**
 * 从宇宙版卡片点击进入（由卡片 click 事件调用）
 * @param {string} templateId - 模板ID
 * @param {string} [questionText] - 自定义问题
 */
function startFromUniverse(templateId, questionText) {
  // 当 templateId 为 custom 时，根据问题文本推断真实模板 ID（用于海报背景图匹配）
  const CUSTOM_TPL_MAP = {
    '去不去约会': 'date',
    '今天要不要健身': 'fitness',
    '今天要不要学习': 'study',
    '今天要不要减肥': 'diet',
  };
  if (templateId === 'custom' && questionText && CUSTOM_TPL_MAP[questionText]) {
    bridgeState.posterTplId = CUSTOM_TPL_MAP[questionText];
  } else {
    bridgeState.posterTplId = templateId;
  }
  bridgeState.templateId = templateId;
  bridgeState.questionText = questionText || getTemplateQuestion(templateId);
  bridgeState.currentTone = 'bestie';

  showClassicPages();
  // 权限页后置：直接开始计算
  startCalculation();
}

function getTemplateQuestion(tid) {
  const map = {
    eat_today: '今天吃什么',
    drink_today: '今天喝什么',
    wear_today: '今天穿什么',
    wash_hair: '要不要洗头',
    sleep_early: '要不要早睡',
    go_out: '要不要出门',
    send_msg: '发不发消息',
    buy_it: '买不买',
  };
  return map[tid] || '';
}

function requestGeoPermission() {
  if (!navigator.geolocation) {
    bridgeState.geoPermission = 'denied';
    startCalculation();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      bridgeState.geoPermission = 'granted';
      bridgeState.latitude = pos.coords.latitude;
      bridgeState.longitude = pos.coords.longitude;
      startCalculation();
    },
    () => {
      bridgeState.geoPermission = 'denied';
      startCalculation();
    },
    { timeout: 5000 }
  );
}

function startCalculation() {
  bridgeState._calculating = true;
  // 设置模板化加载文案
  const loadingMsg = document.getElementById('loading-msg');
  if (loadingMsg) loadingMsg.textContent = getLoadingMessage(bridgeState.templateId);
  navigateTo('loading');
  const startTime = Date.now();
  const minLoadingTime = 2000;

  // 重试时偏移时间，确保排盘不同、结果不同
  const calcDate = bridgeState.lastResult
    ? new Date(Date.now() + (bridgeState._retryOffset || 0))
    : new Date();
  if (bridgeState.lastResult) {
    bridgeState._retryOffset = (bridgeState._retryOffset || 0) + 60 * 60 * 1000; // 每次偏移1小时
  }

  const timer1 = setTimeout(() => {
    if (!bridgeState._calculating) return;
    try {
      const result = getDecision(
        bridgeState.questionText,
        bridgeState.templateId,
        calcDate,
        bridgeState.geoPermission,
        null
      );
      bridgeState.lastResult = result;

      // 再给上帝一次机会：反转 YES↔NO
      if (bridgeState._flipBias && result.decisionBias) {
        const FLIP = { A: 'B', lean_A: 'lean_B', wait: 'B', lean_B: 'lean_A', B: 'A' };
        result.decisionBias = FLIP[result.decisionBias] || 'A';
        const scoreMap = { A: 6, lean_A: 2, wait: 0, lean_B: -2, B: -6 };
        result.totalScore = scoreMap[result.decisionBias] || 0;
        // 重新翻译文案匹配新的 bias
        const newDisplay = retranslate(result, null);
        result.resultTitle = newDisplay.resultTitle;
        result.resultReason = newDisplay.resultReason;
        result.resultAction = newDisplay.resultAction;
        result.resultTrend = newDisplay.resultTrend;
        result.shareMeme = newDisplay.shareMeme || '';
        result.oneLineQuote = newDisplay.oneLineQuote || '';
        bridgeState._flipBias = false;
      }

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      const timer2 = setTimeout(() => {
        if (!bridgeState._calculating) return;
        bridgeState._calculating = false;
        showResult(result);
      }, remainingTime);
      bridgeState._pendingTimers.push(timer2);
    } catch (e) {
      console.error('测算异常:', e);
      const timer3 = setTimeout(() => {
        if (!bridgeState._calculating) return;
        bridgeState._calculating = false;
        showFallbackResult();
      }, minLoadingTime);
      bridgeState._pendingTimers.push(timer3);
    }
  }, 100);
  bridgeState._pendingTimers.push(timer1);
}

function showResult(result) {
  if (result.seriousnessLevel === 'L3') {
    renderOracleResult(result);
    bridgeState.previousPage = 'result-oracle';
    navigateTo('result-oracle');
  } else {
    renderLightResult(result);
    bridgeState.previousPage = 'result-light';
    navigateTo('result-light');
  }
}

// ─── 结果渲染（从 app.js 复制） ─────────────────────────

function getBadgeText(bias) {
  const map = { A: '宇宙说 冲', lean_A: '偏冲', wait: '先缓缓', lean_B: '偏别', B: '宇宙说 别' };
  return map[bias] || '先缓缓';
}

function getBadgeClass(bias) {
  if (bias === 'A' || bias === 'lean_A') return 'badge-positive';
  if (bias === 'wait') return 'badge-neutral';
  return 'badge-negative';
}

function renderLightResult(result) {
  // 设置海报背景图（tagcard-card 用背景图而非 img）
  const posterCard = document.getElementById('poster-light');
  const tid = bridgeState.posterTplId || bridgeState.templateId || result.templateId;
  // 根据 YES/NO 选择不同海报
  const isNo = result.decisionBias === 'B' || result.decisionBias === 'lean_B';
  let posterSrc = POSTER_BASE_MAP[tid] ? posterPath(POSTER_BASE_MAP[tid]) : null;
  if (isNo && posterSrc) {
    posterSrc = posterSrc.replace('.jpg', '_no.jpg');
  }
  if (posterCard && posterSrc) {
    posterCard.style.backgroundImage = `url('${posterSrc}')`;
  }

  const badge = document.getElementById('result-badge');
  if (badge) {
    badge.textContent = getBadgeText(result.decisionBias);
    badge.className = 'tagcard-badge ' + getBadgeClass(result.decisionBias);
  }

  document.getElementById('result-title').textContent = result.resultTitle;

  // 宇宙一句话（oneliner）
  const quoteEl = document.getElementById('result-quote');
  if (result.oneLineQuote && quoteEl) {
    quoteEl.style.display = 'block';
    // 按中文逗号分段，每段加「」
    const parts = result.oneLineQuote.split('，').filter(s => s.trim());
    quoteEl.innerHTML = parts.map(p => '「' + p.trim() + '」').join('<br>');
  } else if (quoteEl) {
    quoteEl.style.display = 'none';
  }

  document.getElementById('result-reason').textContent = result.resultReason;

  const riskArea = document.getElementById('result-risk-area');
  if (result.resultRisk) {
    riskArea.style.display = 'block';
    document.getElementById('result-risk').textContent = result.resultRisk;
  } else {
    riskArea.style.display = 'none';
  }

  // 建议按句号分段
  const actionEl = document.getElementById('result-action');
  if (result.resultAction && actionEl) {
    const parts = result.resultAction.split('。').filter(s => s.trim());
    actionEl.innerHTML = parts.map(p => p.trim().replace(/\n+/g, ' ')).join('<br>');
  }

  document.getElementById('result-trend').textContent = result.resultTrend;

  const now = new Date();
  document.getElementById('result-timestamp').textContent =
    `宇宙于 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} 下达指令`;

  // 分享梗（按逗号分段换行）
  const memeArea = document.getElementById('result-meme-area');
  if (result.shareMeme) {
    memeArea.style.display = 'block';
    const memeEl = document.getElementById('result-meme');
    const memeParts = result.shareMeme.split(/[，？?]/).filter(s => s.trim());
    memeEl.innerHTML = memeParts.join('<br>');
  } else {
    memeArea.style.display = 'none';
  }

  const timeEggEl = document.getElementById('result-time-egg');
  if (result.timeEgg) {
    timeEggEl.style.display = 'block';
    timeEggEl.textContent = result.timeEgg;
  } else {
    timeEggEl.style.display = 'none';
  }

  // persona 标签
  const personaEl = document.getElementById('result-persona');
  if (personaEl) {
    const PERSONA_MAP = {
      eat_today: 'EAT TODAY', drink_today: 'DRINK TODAY', wear_today: 'WEAR TODAY',
      wash_hair: 'WASH HAIR', sleep_early: 'SLEEP EARLY', go_out: 'GO OUT',
      send_msg: 'SEND MSG', buy_it: 'BUY IT', date: 'DATE',
      fitness: 'FITNESS', study: 'STUDY', diet: 'DIET', custom: 'ORACLE',
    };
    personaEl.textContent = PERSONA_MAP[tid] || '';
  }

  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.style.display = 'block';
    const SHARE_BUTTON_TEXTS = {
      eat_today: '发给那个最该请客的人',
      drink_today: '发给今天要续命的人',
      wear_today: '发给那个总问你穿什么的人',
      wash_hair: '发给那个最该洗头的人',
      sleep_early: '发给那个熬夜冠军',
      go_out: '发给那个天天鸽你的人',
      send_msg: '发给那个让你纠结的人',
      buy_it: '发给那个剁手党',
      date: '发给那个单身狗',
      fitness: '发给那个健身狂魔',
      study: '发给那个学渣',
      diet: '发给那个吃货',
      custom: '发给朋友吐槽',
    };
    shareBtn.textContent = SHARE_BUTTON_TEXTS[tid] || '发给朋友吐槽';
  }

  const sarcasticBtn = document.getElementById('btn-sarcastic');
  const sarcasticTid = bridgeState.templateId || result.templateId;
  if (sarcasticTid && SARCASTIC_TEMPLATES.includes(sarcasticTid)) {
    sarcasticBtn.style.display = 'block';
    const nextTones = { bestie: '让毒舌宇宙骂醒你', sarcastic: '切换摆烂模式', slacker: '换回温柔宇宙' };
    sarcasticBtn.textContent = nextTones[bridgeState.currentTone] || '让毒舌宇宙骂醒你';
  } else {
    sarcasticBtn.style.display = 'none';
  }
}

function renderOracleResult(result) {
  // 设置海报背景图
  const posterBg = document.getElementById('poster-oracle-bg');
  const tid = bridgeState.posterTplId || bridgeState.templateId || result.templateId;
  const isNo = result.decisionBias === 'B' || result.decisionBias === 'lean_B';
  let posterSrc = POSTER_BASE_MAP[tid] ? posterPath(POSTER_BASE_MAP[tid]) : null;
  if (isNo && posterSrc) {
    posterSrc = posterSrc.replace('.jpg', '_no.jpg');
  }
  if (posterBg && posterSrc) {
    posterBg.src = posterSrc;
  }

  document.getElementById('oracle-title').textContent = result.resultTitle;

  // 宇宙一句话（最适合截图传播）
  const oracleQuoteArea = document.getElementById('oracle-quote-area');
  const oracleQuoteEl = document.getElementById('oracle-quote');
  if (result.oneLineQuote && oracleQuoteArea && oracleQuoteEl) {
    oracleQuoteArea.style.display = 'block';
    oracleQuoteEl.textContent = result.oneLineQuote;
  } else if (oracleQuoteArea) {
    oracleQuoteArea.style.display = 'none';
  }

  document.getElementById('oracle-reason').textContent = result.resultReason;

  const riskArea = document.getElementById('oracle-risk-area');
  if (result.resultRisk) {
    riskArea.style.display = 'block';
    document.getElementById('oracle-risk').textContent = result.resultRisk;
  } else {
    riskArea.style.display = 'none';
  }

  document.getElementById('oracle-action').textContent = result.resultAction;
  document.getElementById('oracle-trend').textContent = result.resultTrend;

  const oracleMemeArea = document.getElementById('oracle-meme-area');
  if (result.shareMeme) {
    oracleMemeArea.style.display = 'block';
    document.getElementById('oracle-meme').textContent = result.shareMeme;
  } else {
    oracleMemeArea.style.display = 'none';
  }

  const nowO = new Date();
  document.getElementById('oracle-timestamp').textContent =
    `宇宙于 ${String(nowO.getHours()).padStart(2,'0')}:${String(nowO.getMinutes()).padStart(2,'0')} 下达指令`;

  const timeEggEl = document.getElementById('oracle-time-egg');
  if (result.timeEgg) {
    timeEggEl.style.display = 'block';
    timeEggEl.textContent = result.timeEgg;
  } else {
    timeEggEl.style.display = 'none';
  }

  const ctaArea = document.getElementById('oracle-cta-area');
  if (result.escalationRecommended && result.resultCta) {
    ctaArea.style.display = 'block';
    document.getElementById('btn-escalate').textContent = result.resultCta;
  } else {
    ctaArea.style.display = 'none';
  }
}

// ─── 分享功能 ───────────────────────────────────────────

// 获取用户昵称（从localStorage或输入框）
function getUserNickname() {
  // 先尝试从localStorage读取
  const saved = localStorage.getItem('user_nickname');
  if (saved) return saved;
  // 否则从输入框读取
  const input = document.querySelector('.user-nickname-input');
  return input?.value || '匿名宇宙旅人';
}

// 保存用户昵称到localStorage
function saveUserNickname(nickname) {
  if (nickname && nickname !== '匿名宇宙旅人') {
    localStorage.setItem('user_nickname', nickname);
  }
}

// 获取用户签名
function getUserSignature() {
  const saved = localStorage.getItem('user_signature');
  if (saved) return saved;
  const input = document.querySelector('.user-signature-input');
  return input?.value || '';
}

// 保存用户签名
function saveUserSignature(signature) {
  if (signature) {
    localStorage.setItem('user_signature', signature);
  }
}

// 初始化昵称输入框（从localStorage恢复）
function initNicknameInputs() {
  const saved = localStorage.getItem('user_nickname');
  if (saved) {
    document.querySelectorAll('.user-nickname-input').forEach(input => {
      input.value = saved;
    });
  }
  const savedSig = localStorage.getItem('user_signature');
  if (savedSig) {
    document.querySelectorAll('.user-signature-input').forEach(input => {
      input.value = savedSig;
    });
  }
}

async function showShareCard() {
  bridgeState.previousPage = bridgeState.lastResult?.seriousnessLevel === 'L3' ? 'result-oracle' : 'result-light';
  navigateTo('share');

  const result = bridgeState.lastResult;
  if (!result) return;

  // 获取并保存用户昵称和签名
  const nickname = getUserNickname();
  saveUserNickname(nickname);
  const signature = getUserSignature();
  saveUserSignature(signature);

  try {
    const dataUrl = await generateShareCard({
      type: result.shareCardType || 'conclusion',
      templateId: bridgeState.posterTplId || bridgeState.templateId,
      question: bridgeState.questionText,
      title: result.resultTitle,
      oneLiner: result.oneLineQuote,
      reason: result.resultReason,
      action: result.resultAction,
      risk: result.resultRisk,
      trend: result.resultTrend,
      cta: result.resultCta,
      confidence: result.confidenceLevel,
      nickname: nickname,
      signature: signature,
    });

    const preview = document.getElementById('share-preview');
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '分享卡';
    img.style.cssText = 'max-width:320px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    preview.innerHTML = '';
    preview.appendChild(img);
    bridgeState.shareDataUrl = dataUrl;
  } catch (e) {
    console.error('分享卡生成失败:', e);
  }
}

function saveCard() {
  if (bridgeState.shareDataUrl) saveOrShareImage(bridgeState.shareDataUrl);
}

function shareCard() {
  if (bridgeState.shareDataUrl) saveOrShareImage(bridgeState.shareDataUrl);
}

// ─── 导航 ───────────────────────────────────────────────

/** 返回宇宙版 */
function goHome() {
  bridgeState._calculating = false;
  bridgeState._pendingTimers.forEach(t => clearTimeout(t));
  bridgeState._pendingTimers = [];
  bridgeState.templateId = null;
  bridgeState.questionText = '';
  bridgeState.lastResult = null;
  bridgeState.shareDataUrl = null;
  bridgeState.currentTone = 'bestie';
  showUniverse();
}

/** 从分享页返回结果页 */
function goBackToResult() {
  if (bridgeState.previousPage) {
    navigateTo(bridgeState.previousPage);
  }
}

/** 再给上帝一次机会 — 反转结果（YES↔NO），重新生成 */
function retry() {
  bridgeState._flipBias = true;
  startCalculation();
}

/** 切换语气（bestie → sarcastic → slacker → bestie） */
function toggleSarcastic() {
  const result = bridgeState.lastResult;
  if (!result) return;

  const tones = ['bestie', 'sarcastic', 'slacker'];
  const toneLabels = { bestie: '闺蜜', sarcastic: '毒舌', slacker: '摆烂' };
  const currentIdx = tones.indexOf(bridgeState.currentTone);
  const newTone = tones[(currentIdx + 1) % tones.length];
  bridgeState.currentTone = newTone;

  const display = retranslate(result, newTone === 'sarcastic' ? 'sarcastic' : null);

  // 更新对应结果页
  if (result.seriousnessLevel === 'L3') {
    document.getElementById('oracle-title').textContent = display.resultTitle;
    document.getElementById('oracle-reason').textContent = display.resultReason;
    document.getElementById('oracle-action').textContent = display.resultAction;
    document.getElementById('oracle-trend').textContent = display.resultTrend;
  } else {
    document.getElementById('result-title').textContent = display.resultTitle;
    document.getElementById('result-reason').textContent = display.resultReason;
    // 建议按句号分段
    const actionEl = document.getElementById('result-action');
    if (display.resultAction && actionEl) {
      const parts = display.resultAction.split('。').filter(s => s.trim());
      actionEl.innerHTML = parts.map(p => p.trim().replace(/\n+/g, ' ')).join('<br>');
    }
    document.getElementById('result-trend').textContent = display.resultTrend;
  }

  result.resultTitle = display.resultTitle;
  result.resultReason = display.resultReason;
  result.resultAction = display.resultAction;
  result.resultTrend = display.resultTrend;

  // 切换海报背景
  const posterCard = document.getElementById('poster-light');
  if (posterCard) {
    if (newTone === 'sarcastic') {
      posterCard.style.backgroundImage = `url('${posterPath('sarcastic_universal.jpg')}')`;
    } else {
      // 恢复 YES/NO 海报
      const tid = bridgeState.posterTplId || bridgeState.templateId || result.templateId;
      const isNo = result.decisionBias === 'B' || result.decisionBias === 'lean_B';
      let posterSrc = POSTER_BASE_MAP[tid] ? posterPath(POSTER_BASE_MAP[tid]) : null;
      if (isNo && posterSrc) {
        posterSrc = posterSrc.replace('.jpg', '_no.jpg');
      }
      if (posterSrc) {
        posterCard.style.backgroundImage = `url('${posterSrc}')`;
      }
    }
  }

  const sarcasticBtn = document.getElementById('btn-sarcastic');
  if (sarcasticBtn) {
    const nextTones = { bestie: '让毒舌宇宙骂醒你', sarcastic: '切换摆烂模式', slacker: '换回温柔宇宙' };
    sarcasticBtn.textContent = nextTones[newTone] || '让毒舌宇宙骂醒你';
  }
}

function showFallbackResult() {
  bridgeState.lastResult = {
    seriousnessLevel: 'L1',
    decisionBias: 'wait',
    resultTitle: '宇宙今天摸鱼了',
    resultReason: '宇宙说今天信号不好，换个时间再来',
    resultRisk: '',
    resultAction: '刷新一下，或者过5分钟再来',
    resultTrend: '宇宙去充电了，稍后再来',
    shareCardType: 'conclusion',
    confidenceLevel: 30,
    escalationRecommended: false,
  };
  renderLightResult(bridgeState.lastResult);
  bridgeState.previousPage = 'result-light';
  navigateTo('result-light');
}

// ─── 初始化 ─────────────────────────────────────────────

// 初始化（module 脚本默认 deferred，DOM 已就绪，无需 DOMContentLoaded）
(function init() {
  // 预加载分享卡插画
  preloadAllIllustrations().catch(() => {});

  // 初始化昵称输入框
  initNicknameInputs();

  // 权限按钮
  document.getElementById('btn-geo-grant')?.addEventListener('click', requestGeoPermission);
  document.getElementById('btn-geo-default')?.addEventListener('click', () => {
    bridgeState.geoPermission = 'denied';
    startCalculation();
  });
  document.getElementById('btn-geo-skip')?.addEventListener('click', () => {
    bridgeState.geoPermission = 'denied';
    startCalculation();
  });

  // 结果页按钮
  document.getElementById('btn-retry')?.addEventListener('click', retry);
  document.getElementById('btn-share')?.addEventListener('click', showShareCard);
  document.getElementById('result-meme-area')?.addEventListener('click', showShareCard);
  document.getElementById('btn-retry-oracle')?.addEventListener('click', retry);
  document.getElementById('btn-share-oracle')?.addEventListener('click', showShareCard);
  document.getElementById('btn-sarcastic')?.addEventListener('click', toggleSarcastic);
  document.getElementById('btn-escalate')?.addEventListener('click', () => {
    // 升级按钮暂不处理
  });

  // 返回按钮
  document.getElementById('btn-home-light')?.addEventListener('click', goHome);
  document.getElementById('btn-home-oracle')?.addEventListener('click', goHome);
  document.getElementById('btn-home-share')?.addEventListener('click', goHome);

  // 分享页按钮
  document.getElementById('btn-save-card')?.addEventListener('click', saveCard);
  document.getElementById('btn-share-card')?.addEventListener('click', shareCard);
  document.getElementById('btn-back-result')?.addEventListener('click', goBackToResult);

  // 将 startFromUniverse 暴露到全局，供宇宙版卡片调用
  window.startFromUniverse = startFromUniverse;

  // 使用事件委托绑定宇宙版卡片点击（避免 DOM 渲染时序问题）
  document.addEventListener('click', function(e) {
    const card = e.target.closest('.orbit-card[data-tpl]');
    if (card) {
      e.preventDefault();
      e.stopPropagation();
      const tpl = card.getAttribute('data-tpl');
      const q = card.getAttribute('data-q');
      if (tpl) {
        startFromUniverse(tpl, q || undefined);
      }
    }
  });

  // "让宇宙帮我选"按钮 → 随机选一个模板
  const randomBtn = document.getElementById('btn-random-pick');
  if (randomBtn) {
    const templates = [
      { tpl: 'eat_today' },
      { tpl: 'drink_today' },
      { tpl: 'wear_today' },
      { tpl: 'go_out' },
      { tpl: 'send_msg' },
      { tpl: 'buy_it' },
      { tpl: 'wash_hair' },
      { tpl: 'sleep_early' },
      { tpl: 'custom', q: '去不去约会' },
      { tpl: 'custom', q: '今天要不要健身' },
      { tpl: 'custom', q: '今天要不要学习' },
      { tpl: 'custom', q: '今天要不要减肥' },
    ];
    randomBtn.addEventListener('click', function() {
      const item = templates[Math.floor(Math.random() * templates.length)];
      startFromUniverse(item.tpl, item.q);
    });
  }
})();

// 暴露暂停控制变量
window._orbitPaused = false;
