/**
 * 上帝帮你掷骰子 - 主应用逻辑
 * ES Module 入口，负责页面路由、流程控制、结果渲染与分享
 */

import { getDecision, retranslate, getLoadingMessage } from './decision-engine.js';
import { initParticles } from './particles.js';
import { generateShareCard, saveOrShareImage, preloadAllIllustrations } from './share.js';

// ─── 应用状态 ───────────────────────────────────────────────
const state = {
  currentPage: 'home',
  templateId: null,
  questionText: '',
  geoPermission: 'denied',
  latitude: null,
  longitude: null,
  lastResult: null,
  particlesInstance: null,
  shareDataUrl: null,
  currentTone: 'bestie', // 当前语气模式：bestie / sarcastic
};

// 支持毒舌模式的模板列表
const SARCASTIC_TEMPLATES = ['eat_today', 'drink_today', 'wear_today', 'wash_hair', 'sleep_early', 'go_out', 'send_msg', 'buy_it'];

// ─── 页面路由 ───────────────────────────────────────────────

/**
 * 简单的显示/隐藏路由系统
 * @param {string} pageName - 目标页面名称（不含 page- 前缀）
 */
function navigateTo(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) {
    target.classList.add('active');
    state.currentPage = pageName;
  }
}

// ─── 核心流程函数 ───────────────────────────────────────────

/**
 * 启动主流程：直接进入计算
 */
function startFlow() {
  startCalculation();
}

/**
 * 请求地理位置权限
 */
function requestGeoPermission() {
  if (!navigator.geolocation) {
    state.geoPermission = 'denied';
    startCalculation();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.geoPermission = 'granted';
      state.latitude = pos.coords.latitude;
      state.longitude = pos.coords.longitude;
      startCalculation();
    },
    () => {
      state.geoPermission = 'denied';
      startCalculation();
    },
    { timeout: 5000 }
  );
}

/**
 * 开始测算：进入加载页，调用决策引擎
 */
function startCalculation() {
  // 设置模板化加载文案
  const loadingMsg = document.getElementById('loading-msg');
  if (loadingMsg) loadingMsg.textContent = getLoadingMessage(state.templateId);
  navigateTo('loading');

  const startTime = Date.now();
  const minLoadingTime = 2000; // 最少展示2秒加载动画

  // 使用 setTimeout 让加载动画先渲染一帧
  setTimeout(() => {
    try {
      const result = getDecision(
        state.questionText,
        state.templateId,
        new Date(),
        state.geoPermission,
        null // city
      );
      state.lastResult = result;

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);

      setTimeout(() => {
        showResult(result);
      }, remainingTime);
    } catch (e) {
      console.error('测算异常:', e);
      // 降级：显示默认结果
      setTimeout(() => {
        showFallbackResult();
      }, minLoadingTime);
    }
  }, 100);
}

/**
 * 根据结果类型分发到对应结果页
 * @param {Object} result - 决策引擎返回的结果对象
 */
function showResult(result) {
  if (result.seriousnessLevel === 'L3') {
    renderOracleResult(result);
    navigateTo('result-oracle');
  } else {
    renderLightResult(result);
    navigateTo('result-light');
  }
}

// ─── 轻题结果渲染（L1 / L2）───────────────────────────────

/**
 * 渲染轻题结果页
 * @param {Object} result - 决策引擎返回的结果对象
 */
function renderLightResult(result) {
  let tid = state.templateId || result.templateId;

  // 当 tid=custom 时，根据问题文字匹配海报
  const qTextL = state.questionText || (document.getElementById('question-input') ? document.getElementById('question-input').value.trim() : '');
  if (tid === 'custom' && qTextL) {
    const keywordMap = {
      '约会': 'date', '相亲': 'date', '恋爱': 'date',
      '健身': 'fitness', '运动': 'fitness', '锻炼': 'fitness',
      '学习': 'study', '读书': 'study', '看书': 'study',
      '减肥': 'diet', '瘦身': 'diet', '减脂': 'diet',
    };
    for (const [keyword, posterId] of Object.entries(keywordMap)) {
      if (qTextL.includes(keyword)) { tid = posterId; break; }
    }
  }

  // 海报背景图
  const bgEl = document.getElementById('poster-light-bg');
  if (bgEl && tid) {
    bgEl.src = `assets/posters/${tid}.jpg`;
  } else if (bgEl) {
    bgEl.src = 'assets/posters/custom.jpg';
  }

  // 徽章
  const badge = document.getElementById('result-badge');
  badge.textContent = getBadgeText(result.decisionBias);
  badge.className = 'result-badge ' + getBadgeClass(result.decisionBias);

  // 内容
  document.getElementById('result-title').textContent = result.resultTitle;

  // 宇宙一句话（最适合截图传播）
  const quoteArea = document.getElementById('result-quote-area');
  const quoteEl = document.getElementById('result-quote');
  if (result.oneLineQuote) {
    quoteArea.style.display = 'block';
    quoteEl.textContent = result.oneLineQuote;
  } else {
    quoteArea.style.display = 'none';
  }

  document.getElementById('result-reason').textContent = result.resultReason;

  // 风险（可选）
  const riskArea = document.getElementById('result-risk-area');
  if (result.resultRisk) {
    riskArea.style.display = 'block';
    document.getElementById('result-risk').textContent = result.resultRisk;
  } else {
    riskArea.style.display = 'none';
  }

  document.getElementById('result-action').textContent = result.resultAction;
  document.getElementById('result-trend').textContent = result.resultTrend;

  // 时间戳
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('result-timestamp').textContent = `宇宙于 ${hh}:${mm} 下达指令`;

  // 分享梗
  const memeArea = document.getElementById('result-meme-area');
  if (result.shareMeme) {
    memeArea.style.display = 'block';
    document.getElementById('result-meme').textContent = result.shareMeme;
  } else {
    memeArea.style.display = 'none';
  }

  // 时间彩蛋
  const timeEggEl = document.getElementById('result-time-egg');
  if (result.timeEgg) {
    timeEggEl.style.display = 'block';
    timeEggEl.textContent = result.timeEgg;
  } else {
    timeEggEl.style.display = 'none';
  }

  // 分享按钮：所有轻题都显示
  const shareBtn = document.getElementById('btn-share');
  shareBtn.style.display = 'block';

  // 分享按钮按模板个性化
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

  // 毒舌切换按钮：仅支持毒舌的模板显示
  const sarcasticBtn = document.getElementById('btn-sarcastic');
  if (tid && SARCASTIC_TEMPLATES.includes(tid)) {
    sarcasticBtn.style.display = 'block';
    const nextTones = { bestie: '让毒舌宇宙骂醒你', sarcastic: '切换摆烂模式', slacker: '换回温柔宇宙' };
    sarcasticBtn.textContent = nextTones[state.currentTone] || '让毒舌宇宙骂醒你';
  } else {
    sarcasticBtn.style.display = 'none';
  }

  // 根据模板类型调整按钮文案
  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    // 所有模板统一文案
    retryBtn.textContent = '再给上帝一次机会';
  }
  const retryOracleBtn = document.getElementById('btn-retry-oracle');
  if (retryOracleBtn) {
    retryOracleBtn.textContent = '再给上帝一次机会';
  }
}

/**
 * 获取徽章文字
 * @param {string} bias - 决策偏向 (A / lean_A / wait / lean_B / B)
 * @returns {string}
 */
function getBadgeText(bias) {
  const map = {
    A: '宇宙说 冲',
    lean_A: '偏冲',
    wait: '先缓缓',
    lean_B: '偏别',
    B: '宇宙说 别',
  };
  return map[bias] || '先缓缓';
}

/**
 * 获取徽章样式类名
 * @param {string} bias - 决策偏向
 * @returns {string}
 */
function getBadgeClass(bias) {
  if (bias === 'A' || bias === 'lean_A') return 'badge-positive';
  if (bias === 'wait') return 'badge-neutral';
  return 'badge-negative';
}

// ─── 重题结果渲染（L3）─────────────────────────────────────

/**
 * 渲染重题（神谕）结果页
 * @param {Object} result - 决策引擎返回的结果对象
 */
function renderOracleResult(result) {
  // 海报背景图：根据问题文字匹配
  let tid = state.templateId || result.templateId;
  const qText = state.questionText || (document.getElementById('question-input') ? document.getElementById('question-input').value.trim() : '');
  if (tid === 'custom' && qText) {
    const keywordMap = {
      '约会': 'date', '相亲': 'date', '恋爱': 'date',
      '健身': 'fitness', '运动': 'fitness', '锻炼': 'fitness',
      '学习': 'study', '读书': 'study', '看书': 'study',
      '减肥': 'diet', '瘦身': 'diet', '减脂': 'diet',
    };
    for (const [keyword, posterId] of Object.entries(keywordMap)) {
      if (qText.includes(keyword)) { tid = posterId; break; }
    }
  }
  const oracleBg = document.getElementById('poster-oracle-bg');
  if (oracleBg && tid) {
    oracleBg.src = `assets/posters/${tid}.jpg`;
  }

  document.getElementById('oracle-title').textContent = result.resultTitle;

  // 宇宙一句话（最适合截图传播）
  const oracleQuoteArea = document.getElementById('oracle-quote-area');
  const oracleQuoteEl = document.getElementById('oracle-quote');
  if (result.oneLineQuote) {
    oracleQuoteArea.style.display = 'block';
    oracleQuoteEl.textContent = result.oneLineQuote;
  } else {
    oracleQuoteArea.style.display = 'none';
  }

  document.getElementById('oracle-reason').textContent = result.resultReason;

  // 风险区
  const riskArea = document.getElementById('oracle-risk-area');
  if (result.resultRisk) {
    riskArea.style.display = 'block';
    document.getElementById('oracle-risk').textContent = result.resultRisk;
  } else {
    riskArea.style.display = 'none';
  }

  document.getElementById('oracle-action').textContent = result.resultAction;
  document.getElementById('oracle-trend').textContent = result.resultTrend;

  // 分享梗
  const oracleMemeArea = document.getElementById('oracle-meme-area');
  if (result.shareMeme) {
    oracleMemeArea.style.display = 'block';
    document.getElementById('oracle-meme').textContent = result.shareMeme;
  } else {
    oracleMemeArea.style.display = 'none';
  }

  // 时间戳
  const nowO = new Date();
  const hhO = String(nowO.getHours()).padStart(2, '0');
  const mmO = String(nowO.getMinutes()).padStart(2, '0');
  document.getElementById('oracle-timestamp').textContent = `宇宙于 ${hhO}:${mmO} 下达指令`;

  // 时间彩蛋
  const oracleTimeEggEl = document.getElementById('oracle-time-egg');
  if (result.timeEgg) {
    oracleTimeEggEl.style.display = 'block';
    oracleTimeEggEl.textContent = result.timeEgg;
  } else {
    oracleTimeEggEl.style.display = 'none';
  }

  // CTA（升级建议按钮）
  const ctaArea = document.getElementById('oracle-cta-area');
  if (result.escalationRecommended && result.resultCta) {
    ctaArea.style.display = 'block';
    document.getElementById('btn-escalate').textContent = result.resultCta;
  } else {
    ctaArea.style.display = 'none';
  }
}

// ─── 分享功能 ──────────────────────────────────────────────

/**
 * 生成并展示分享卡
 */
async function showShareCard() {
  navigateTo('share');

  const result = state.lastResult;
  if (!result) return;

  // 首次分享时请求定位权限（权限页后置策略）
  if (state.geoPermission === 'unknown' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.geoPermission = 'granted';
        state.latitude = pos.coords.latitude;
        state.longitude = pos.coords.longitude;
      },
      () => {
        state.geoPermission = 'denied';
      },
      { timeout: 5000 }
    );
  }

  try {
    const dataUrl = await generateShareCard({
      type: result.shareCardType || 'conclusion',
      templateId: state.templateId,
      question: state.questionText,
      title: result.resultTitle,
      oneLiner: result.oneLineQuote,
      reason: result.resultReason,
      action: result.resultAction,
      risk: result.resultRisk,
      trend: result.resultTrend,
      cta: result.resultCta,
      confidence: result.confidenceLevel,
    });

    // 显示预览
    const preview = document.getElementById('share-preview');
    preview.innerHTML =
      `<img src="${dataUrl}" alt="分享卡" style="max-width:320px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">`;
    state.shareDataUrl = dataUrl;
  } catch (e) {
    console.error('分享卡生成失败:', e);
  }
}

/**
 * 保存分享卡图片
 */
async function saveCard() {
  if (state.shareDataUrl) {
    await saveOrShareImage(state.shareDataUrl);
  }
}

/**
 * 分享分享卡图片
 */
async function shareCard() {
  if (state.shareDataUrl) {
    await saveOrShareImage(state.shareDataUrl);
  }
}

// ─── 导航辅助 ──────────────────────────────────────────────

/**
 * 返回首页并重置状态
 */
function goHome() {
  // 重置状态
  state.templateId = null;
  state.questionText = '';
  state.lastResult = null;
  state.shareDataUrl = null;
  state.currentTone = 'bestie';

  // 重置 UI
  document.getElementById('free-input-area').style.display = 'none';
  const textarea = document.getElementById('question-input');
  if (textarea) textarea.value = '';
  const charCount = document.getElementById('char-count');
  if (charCount) charCount.textContent = '0/50';

  // 重置提交按钮
  const submitBtn = document.getElementById('btn-submit-question');
  if (submitBtn) submitBtn.disabled = true;

  // 回到宇宙版首页
  window.location.href = 'index.html';
}

/**
 * 从分享页返回结果页
 */
function goBackToResult() {
  if (state.lastResult && state.lastResult.seriousnessLevel === 'L3') {
    navigateTo('result-oracle');
  } else {
    navigateTo('result-light');
  }
}

/**
 * 切换语气（bestie → sarcastic → slacker → bestie）
 */
function toggleSarcastic() {
  const result = state.lastResult;
  if (!result) return;

  // 切换语气
  const tones = ['bestie', 'sarcastic', 'slacker'];
  const currentIdx = tones.indexOf(state.currentTone);
  const newTone = tones[(currentIdx + 1) % tones.length];
  state.currentTone = newTone;

  // 调用 retranslate 重新翻译
  const display = retranslate(result, newTone === 'sarcastic' ? 'sarcastic' : null);

  // 更新结果页内容
  document.getElementById('result-title').textContent = display.resultTitle;
  document.getElementById('result-reason').textContent = display.resultReason;
  document.getElementById('result-action').textContent = display.resultAction;
  document.getElementById('result-trend').textContent = display.resultTrend;

  // 更新 lastResult（用于分享卡）
  result.resultTitle = display.resultTitle;
  result.resultReason = display.resultReason;
  result.resultAction = display.resultAction;
  result.resultTrend = display.resultTrend;

  // 更新按钮文案
  const sarcasticBtn = document.getElementById('btn-sarcastic');
  const nextTones = { bestie: '让毒舌宇宙骂醒你', sarcastic: '切换摆烂模式', slacker: '换回温柔宇宙' };
  sarcasticBtn.textContent = nextTones[newTone] || '让毒舌宇宙骂醒你';
}

/**
 * 显示降级结果（决策引擎异常时使用）
 */
function showFallbackResult() {
  state.lastResult = {
    seriousnessLevel: 'L1',
    decisionBias: 'wait',
    resultTitle: '宇宙今天摸鱼了',
    resultReason: '宇宙说今天信号不好，换个时间再来',
    resultRisk: '',
    resultAction: '刷新一下，或者过5分钟再来，宇宙可能充好电了',
    resultTrend: '宇宙去充电了，稍后再来',
    shareCardType: 'conclusion',
    confidenceLevel: 30,
    escalationRecommended: false,
  };
  renderLightResult(state.lastResult);
  navigateTo('result-light');
}

// ─── 初始化（module 脚本默认 deferred，DOM 已就绪）────────────────

(function init() {
  // 1. 初始化粒子背景
  state.particlesInstance = initParticles('particles-canvas');

  // 2. 预加载分享卡插画
  preloadAllIllustrations().catch(() => {});

  // 3. 解析 URL 参数（从 alt.html 跳转过来时自动选中模板）
  const urlParams = new URLSearchParams(window.location.search);
  const urlTpl = urlParams.get('tpl');
  const urlQ = urlParams.get('q');
  if (urlTpl) {
    // 预设问题文本（在 card.click 之前设置）
    if (urlQ && urlTpl === 'custom') {
      state.questionText = urlQ;
    }
    setTimeout(() => {
      const card = document.querySelector(`.template-card[data-template="${urlTpl}"]`);
      if (card) {
        card.click();
        // 如果有预设问题文本（自定义模块）
        if (urlQ && urlTpl === 'custom') {
          const textarea = document.getElementById('question-input');
          if (textarea) {
            textarea.value = urlQ;
            textarea.dispatchEvent(new Event('input'));
          }
        }
      }
    }, 500);
  }

  // 4. 绑定模板卡片点击
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const templateId = card.dataset.template;
      state.templateId = templateId;

      if (templateId === 'custom') {
        // 显示自由输入区
        document.getElementById('free-input-area').style.display = 'block';
        document.getElementById('question-input').focus();
      } else {
        // 模板问题自动生成
        const templateQuestions = {
          eat_today: '今天吃什么',
          drink_today: '今天喝什么',
          wear_today: '今天穿什么',
          wash_hair: '今天要不要洗头',
          sleep_early: '今天要不要早睡',
          go_out: '今天要不要出门',
          send_msg: '发不发这条消息',
          buy_it: '买不买',
        };
        state.questionText = templateQuestions[templateId] || '';
        state.currentTone = 'bestie'; // 重置语气
        startFlow();
      }
    });
  });

  // 3. 自由输入相关
  const textarea = document.getElementById('question-input');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('btn-submit-question');

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len}/50`;
    submitBtn.disabled = len === 0;
  });

  submitBtn.addEventListener('click', () => {
    state.questionText = textarea.value.trim();
    if (state.questionText) startFlow();
  });

  // 4. 权限层按钮
  document.getElementById('btn-geo-grant').addEventListener('click', requestGeoPermission);
  document.getElementById('btn-geo-default').addEventListener('click', () => {
    state.geoPermission = 'denied';
    startCalculation();
  });
  document.getElementById('btn-geo-skip').addEventListener('click', () => {
    state.geoPermission = 'denied';
    startCalculation();
  });

  // 5. 结果页按钮
  document.getElementById('btn-retry').addEventListener('click', goHome);
  document.getElementById('btn-share').addEventListener('click', showShareCard);
  document.getElementById('btn-retry-oracle').addEventListener('click', goHome);
  document.getElementById('btn-share-oracle').addEventListener('click', showShareCard);
  document.getElementById('btn-sarcastic').addEventListener('click', toggleSarcastic);
  document.getElementById('btn-escalate').addEventListener('click', () => {
    goHome();
  });

  // 6. 回首页按钮（所有非首页页面）
  document.getElementById('btn-home-light').addEventListener('click', goHome);
  document.getElementById('btn-home-oracle').addEventListener('click', goHome);
  document.getElementById('btn-home-share').addEventListener('click', goHome);

  // 7. 分享页按钮
  document.getElementById('btn-save-card').addEventListener('click', saveCard);
  document.getElementById('btn-share-card').addEventListener('click', shareCard);
  document.getElementById('btn-back-result').addEventListener('click', goBackToResult);
})();
