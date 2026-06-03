/**
 * classic-bridge.js
 * 经典结果流与宇宙首页桥接
 */

import { getDecision, retranslate, getLoadingMessage } from './decision-engine.js?v=3';
import { generateShareCard, saveOrShareImage, preloadAllIllustrations, generateQrDataUrl } from './share.js?v=6';
import { track } from './track.js';
import { getFamilyCardSelector } from './result-experience.js';

const POSTER_PREFIX = window.__POSTER_PREFIX || 'assets/posters/';
const POSTER_ASSET_VERSION = 'mode12-wear-yellow-fix';
const POSTER_ASSET_MAP = {
  eat_today: { yes: 'illustrations/eat_hot_comfort.png', no: 'illustrations/eat_light_clean.png', sarcastic: 'illustrations/diet_indulgent_food.png', retry: 'illustrations/eat_carb_happy.png' },
  drink_today: { yes: 'illustrations/drink_refresh_lemon_soda.png', no: 'illustrations/drink_warm_tea.png', sarcastic: 'illustrations/sleep_late_phone.png', retry: 'illustrations/drink_coffee_latte.png' },
  wear_today: { yes: 'illustrations/wear_soft_palette.png', no: 'illustrations/wear_mono_cool.png', sarcastic: 'illustrations/wear_mono_cool.png', retry: 'illustrations/wear_casual.jpg' },
  wash_hair: { yes: 'illustrations/wash_hair_must.png', no: 'illustrations/wash_hair_skip.png', sarcastic: 'illustrations/wash_hair_skip.png', retry: 'illustrations/wash_hair_must.png' },
  sleep_early: { yes: 'illustrations/sleep_early_recover.png', no: 'illustrations/sleep_late_phone.png', sarcastic: 'illustrations/sleep_late_phone.png', retry: 'illustrations/sleep_early_recover.png' },
  go_out: { yes: 'illustrations/go_out_sunlight.png', no: 'illustrations/go_out_stay_home.png', sarcastic: 'illustrations/go_out_stay_home.png', retry: 'illustrations/go_out_sunlight.png' },
  send_msg: { yes: 'illustrations/send_message_go.png', no: 'illustrations/send_message_hold.png', sarcastic: 'illustrations/send_message_hold.png', retry: 'illustrations/send_message_go.png' },
  buy_it: { yes: 'illustrations/buy_it_yes_new.png', no: 'illustrations/buy_it_wait_no.png', sarcastic: 'illustrations/buy_it_wait_no.png', retry: 'illustrations/buy_it_yes_new.png' },
  date: { yes: 'illustrations/date_go_romantic.png', no: 'illustrations/date_wait_no.png', sarcastic: 'illustrations/date_wait_no.png', retry: 'illustrations/date_go_romantic.png' },
  fitness: { yes: 'illustrations/fitness_light_move.png', no: 'illustrations/fitness_rest_gentle.png', sarcastic: 'illustrations/fitness_rest_sarcastic.png', retry: 'illustrations/fitness_light_move.png' },
  study: { yes: 'illustrations/study_focus_light.png', no: 'illustrations/study_slacker_sarcastic.png', sarcastic: 'illustrations/study_slacker_sarcastic.png', retry: 'illustrations/study_focus_light.png' },
  diet: { yes: 'illustrations/diet_indulgent_food.png', no: 'illustrations/diet_control_gentle.png', sarcastic: 'illustrations/fitness_rest_sarcastic.png', retry: 'illustrations/diet_control_gentle.png' },
  custom: { yes: 'illustrations/custom_yes_greenlight.png', no: 'illustrations/custom_no_redlight.png', sarcastic: 'illustrations/custom_sarcastic_theater.png', retry: 'illustrations/custom_wait_pause.png' },
};

const CUSTOM_TPL_MAP = {
  '去不去约会': 'date',
  '今天要不要健身': 'fitness',
  '今天要不要学习': 'study',
  '今天要不要减肥': 'diet',
};

const TEMPLATE_QUESTIONS = {
  eat_today: '今天吃什么',
  drink_today: '今天喝什么',
  wear_today: '今天穿什么',
  wash_hair: '要不要洗头',
  sleep_early: '要不要早睡',
  go_out: '要不要出门',
  send_msg: '发不发消息',
  buy_it: '买不买',
};

const PERSONA_MAP = {
  eat_today: 'EAT TODAY',
  drink_today: 'DRINK TODAY',
  wear_today: 'WEAR TODAY',
  wash_hair: 'WASH HAIR',
  sleep_early: 'SLEEP EARLY',
  go_out: 'GO OUT',
  send_msg: 'SEND MSG',
  buy_it: 'BUY IT',
  date: 'DATE',
  fitness: 'FITNESS',
  study: 'STUDY',
  diet: 'DIET',
  custom: 'ORACLE',
  oracle: 'ORACLE',
};

const SARCASTIC_TEMPLATES = ['eat_today', 'drink_today', 'wear_today', 'wash_hair', 'sleep_early', 'go_out', 'send_msg', 'buy_it', 'date', 'fitness', 'study', 'diet', 'custom'];

const bridgeState = {
  templateId: null,
  posterTplId: null,
  questionText: '',
  geoPermission: 'denied',
  latitude: null,
  longitude: null,
  lastResult: null,
  shareDataUrl: null,
  shareCacheKey: '',
  currentTone: 'bestie',
  previousPage: null,
  _calculating: false,
  _pendingTimers: [],
  _retryOffset: 0,
  _retrySerial: 0,
  _lastToneToggleAt: 0,
  _normalResultSnapshot: null,
};

const universeMain = document.querySelector('main');
const classicApp = document.getElementById('classic-app');
const heroSubtitle = document.getElementById('hero-subtitle');
const heroBanner = document.getElementById('hero-share-banner');
const randomButton = document.getElementById('btn-random-pick');

function posterPath(name) {
  return `${POSTER_PREFIX}${name}?v=${POSTER_ASSET_VERSION}`;
}

function hashString(input = '') {
  let hash = 2166136261;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getPosterText(result) {
  return [
    result?.headline,
    result?.resultTitle,
    result?.resultReason,
    result?.resultAction,
    result?.nextStep,
    result?.subhead,
  ].filter(Boolean).join(' ');
}

function getTitleMatchedPosterAsset(templateId, result, tone) {
  const text = getPosterText(result);
  const titleText = [result?.headline, result?.resultTitle].filter(Boolean).join(' ');
  if (!text) return '';

  if (tone === 'sarcastic') {
    if (templateId === 'eat_today') return 'illustrations/diet_indulgent_food.png';
    if (templateId === 'drink_today') {
      if (/咖啡|续命/.test(titleText)) return 'illustrations/sleep_late_phone.png';
      if (/奶茶|瘦|糖/.test(titleText)) return 'illustrations/fitness_rest_sarcastic.png';
      if (/热|身体|抗议|养生/.test(titleText)) return 'illustrations/sleep_late_phone.png';
      return 'illustrations/fitness_rest_sarcastic.png';
    }
    if (templateId === 'wear_today') return 'illustrations/wear_mono_cool.png';
    if (templateId === 'wash_hair') return 'illustrations/wash_hair_skip.png';
    if (templateId === 'go_out') return 'illustrations/go_out_stay_home.png';
    if (templateId === 'send_msg') return 'illustrations/send_message_hold.png';
    if (templateId === 'buy_it') return 'illustrations/buy_it_wait_no.png';
    if (templateId === 'date') return 'illustrations/date_wait_no.png';
    if (templateId === 'fitness') return 'illustrations/fitness_rest_sarcastic.png';
    if (templateId === 'study') return 'illustrations/custom_sarcastic_theater.png';
    if (templateId === 'diet') return 'illustrations/fitness_rest_sarcastic.png';
    if (templateId === 'custom') return 'illustrations/custom_sarcastic_theater.png';
  }

  if (templateId === 'wear_today') {
    if (/黄色|亮色|随便|休闲/.test(titleText)) return 'illustrations/wear_casual.jpg';
    if (/粉色|温柔|米白|浅蓝/.test(titleText)) return 'illustrations/wear_soft_palette.png';
    if (/黑色|白色|灰色|酷/.test(titleText)) return 'illustrations/wear_mono_cool.png';
    if (/黄色|亮色|卫衣|牛仔|连帽|随便|休闲/.test(text)) return 'illustrations/wear_casual.jpg';
    if (/粉色|针织|珍珠|温柔|米白|浅蓝/.test(text)) return 'illustrations/wear_soft_palette.png';
    if (/皮衣|马丁靴|酷|黑色|白色|灰色|衬衫|西装|高级/.test(text)) return 'illustrations/wear_mono_cool.png';
  }

  if (templateId === 'drink_today') {
    if (/下午茶|下午三点|蛋糕|饼干|蛋挞/.test(titleText)) return 'illustrations/drink_afternoon_tea.png';
    if (/姜茶|红枣|枸杞|桂圆|养生|热的|热饮/.test(titleText)) return 'illustrations/drink_warm_tea.png';
    if (/奶茶|珍珠|芋泥|杨枝|bubble|Bubble/i.test(titleText)) return 'illustrations/drink_milk_tea_happy.png';
    if (/气泡水|青柠|柠檬|手打|清爽|解腻/.test(titleText)) return 'illustrations/drink_refresh_lemon_soda.png';
    if (/冰美式|冰|冷萃|美式|咖啡|拿铁|续命/.test(titleText)) return 'illustrations/drink_coffee_latte.png';
    if (/下午茶|下午三点|蛋糕|饼干|蛋挞/.test(text)) return 'illustrations/drink_afternoon_tea.png';
    if (/姜茶|红枣|枸杞|桂圆|养生|热的|热饮/.test(text)) return 'illustrations/drink_warm_tea.png';
    if (/奶茶|珍珠|芋泥|杨枝|bubble|Bubble/i.test(text)) return 'illustrations/drink_milk_tea_happy.png';
    if (/气泡水|青柠|柠檬|手打|清爽|解腻/.test(text)) return 'illustrations/drink_refresh_lemon_soda.png';
    if (/冰美式|冰|冷萃|美式|咖啡|拿铁|续命/.test(text)) return 'illustrations/drink_coffee_latte.png';
  }

  if (templateId === 'eat_today') {
    if (/沙拉|凉皮|轻食|粥|蒸菜|喝汤|素/.test(text)) return 'illustrations/eat_light_clean.png';
    if (/碳水|饺子|炒饭|米饭|干饭|面管饱/.test(text)) return 'illustrations/eat_carb_happy.png';
    if (/烤肉|烧烤|炸鸡|小龙虾|犒劳|吃顿好的/.test(text)) return 'illustrations/diet_indulgent_food.png';
    if (/早餐|粥|包子|清淡|热的|火锅|重庆|面|拉面|麻辣烫|汤|盖浇饭/.test(text)) return 'illustrations/eat_hot_comfort.png';
  }

  if (templateId === 'sleep_early') {
    if (/3:00|三点|低电量|手机|别熬|熬夜|睡不着|晚点/.test(text)) return 'illustrations/sleep_late_phone.png';
    return 'illustrations/sleep_early_recover.png';
  }

  if (templateId === 'go_out') {
    if (/不出|宅|家里|别出|待着|晚点|错峰/.test(text)) return 'illustrations/go_out_stay_home.png';
    return 'illustrations/go_out_sunlight.png';
  }

  if (templateId === 'send_msg') {
    if (/别发|别点|凌晨|手机|冷静|憋住|打电话|等一小时/.test(text)) return 'illustrations/send_message_hold.png';
    return 'illustrations/send_message_go.png';
  }

  if (templateId === 'buy_it') {
    if (/别买|别冲|购物车|购物|剁手|穷|降价|等等|不需要|配不上/.test(text) || tone === 'sarcastic') return 'illustrations/buy_it_wait_no.png';
    return 'illustrations/buy_it_yes_new.png';
  }

  if (templateId === 'fitness') {
    if (tone === 'sarcastic' || /别练|别去|薯片|游戏|健身卡|撑不住|毒舌/.test(text)) return 'illustrations/fitness_rest_sarcastic.png';
    if (/休息|偷懒|硬撑|恢复|身体比运动/.test(text)) return 'illustrations/fitness_rest_gentle.png';
    return 'illustrations/fitness_light_move.png';
  }

  if (templateId === 'study') {
    if (tone === 'sarcastic') return 'illustrations/custom_sarcastic_theater.png';
    if (/别学|别卷|低电量|熬夜|困|摆烂|白学|放下书本/.test(text)) return 'illustrations/study_slacker_sarcastic.png';
    return 'illustrations/study_focus_light.png';
  }

  if (templateId === 'diet') {
    if (/不减肥|先吃饱|犒劳|放纵|吃顿好的/.test(text)) return 'illustrations/diet_indulgent_food.png';
    if (/忍住|别吃|外卖|控制|七分饱|适可而止/.test(text) || tone === 'sarcastic') return 'illustrations/diet_control_gentle.png';
    return 'illustrations/diet_control_gentle.png';
  }

  if (templateId === 'date') {
    if (/别去|别约|纠结|墙|怂|等等|不适合|时机/.test(text) || tone === 'sarcastic') return 'illustrations/date_wait_no.png';
    return 'illustrations/date_go_romantic.png';
  }

  if (templateId === 'custom') {
    if (tone === 'sarcastic' || /答案|脑内|演戏|纠结/.test(text)) return 'illustrations/custom_sarcastic_theater.png';
    if (/等等|放放|晚点|按兵不动|信号不明/.test(text)) return 'illustrations/custom_wait_pause.png';
    if (/别|不急|冷静|红灯|不是时候|先别/.test(text)) return 'illustrations/custom_no_redlight.png';
    return 'illustrations/custom_yes_greenlight.png';
  }

  return '';
}

function resolvePosterSrc(templateId, decisionBias, tone = 'bestie', variantSeed = 0, result = null) {
  const entry = POSTER_ASSET_MAP[templateId];
  if (!entry) return null;
  const isNo = decisionBias === 'B' || decisionBias === 'lean_B';
  const titleMatchedAsset = getTitleMatchedPosterAsset(templateId, result, tone);
  const assetName = titleMatchedAsset || (tone === 'sarcastic'
    ? entry.sarcastic
    : bridgeState._retrySerial > 0 || tone === 'slacker'
      ? entry.retry
      : isNo
        ? entry.no
        : entry.yes);
  const base = posterPath(assetName || (isNo ? entry.no : entry.yes));
  const variant = Math.abs(Number(variantSeed) || 0) % 3;
  const positionMap = ['center center', 'center 28%', 'center 72%'];
  const sizeMap = ['cover', '112% auto', 'auto 112%'];
  const imageLayer = `url('${base}')`;
  if (tone === 'sarcastic') {
    return {
      image: [
        'radial-gradient(circle at 22% 18%, rgba(255,122,122,0.34), transparent 34%)',
        'linear-gradient(160deg, rgba(120,16,32,0.62), rgba(40,4,56,0.48))',
        imageLayer,
      ].join(', '),
      position: `center center, center center, ${positionMap[variant]}`,
      size: `cover, cover, ${sizeMap[variant]}`,
      repeat: 'no-repeat',
      url: base,
    };
  }
  if (tone === 'slacker') {
    return {
      image: [
        'radial-gradient(circle at 80% 18%, rgba(200,220,255,0.16), transparent 32%)',
        'linear-gradient(160deg, rgba(74,85,104,0.42), rgba(15,23,42,0.56))',
        imageLayer,
      ].join(', '),
      position: `center center, center center, ${positionMap[variant]}`,
      size: `cover, cover, ${sizeMap[variant]}`,
      repeat: 'no-repeat',
      url: base,
    };
  }
  return {
    image: [
      'radial-gradient(circle at 78% 14%, rgba(255,255,255,0.16), transparent 26%)',
      'linear-gradient(180deg, rgba(8,10,24,0.04), rgba(8,10,24,0.22))',
      imageLayer,
    ].join(', '),
    position: `center center, center center, ${positionMap[variant]}`,
    size: `cover, cover, ${sizeMap[variant]}`,
    repeat: 'no-repeat',
    url: base,
  };
}

function trackPayload(result) {
  return {
    resultId: result?.resultId || '',
    family: result?.questionFamily || '',
    tone: result?.tone || bridgeState.currentTone,
    bias: result?.decisionBias || '',
    seriousnessLevel: result?.seriousnessLevel || '',
  };
}

function getEffectiveTone(result = bridgeState.lastResult) {
  if (result?.seriousnessLevel === 'L3') return 'oracle';
  return bridgeState.currentTone || 'bestie';
}

function showClassicPages() {
  if (!classicApp || !universeMain) return;
  classicApp.style.display = 'block';
  universeMain.style.display = 'none';
  document.body.classList.add('classic-active');
  if (window._orbitPaused !== undefined) window._orbitPaused = true;
}

function showUniverse() {
  if (!classicApp || !universeMain) return;
  classicApp.style.display = 'none';
  universeMain.style.display = '';
  document.body.classList.remove('classic-active');
  if (window._orbitPaused !== undefined) window._orbitPaused = false;
  if (window._startOrbitAnimation) window._startOrbitAnimation();
  classicApp.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
}

function navigateTo(pageName) {
  classicApp.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add('active');
}

function getTemplateQuestion(templateId) {
  return TEMPLATE_QUESTIONS[templateId] || '';
}

function getPosterTemplateId(templateId, questionText) {
  if (templateId === 'custom' && CUSTOM_TPL_MAP[questionText]) {
    return CUSTOM_TPL_MAP[questionText];
  }
  return templateId;
}

function clearTimers() {
  bridgeState._pendingTimers.forEach((timer) => clearTimeout(timer));
  bridgeState._pendingTimers = [];
}

function startFromUniverse(templateId, questionText) {
  bridgeState.templateId = templateId;
  bridgeState.posterTplId = getPosterTemplateId(templateId, questionText);
  bridgeState.questionText = questionText || getTemplateQuestion(templateId);
  bridgeState.currentTone = 'bestie';
  bridgeState.shareDataUrl = null;
  bridgeState.shareCacheKey = '';
  bridgeState._normalResultSnapshot = null;
  bridgeState._retryOffset = 0;
  bridgeState._retrySerial = 0;
  showClassicPages();
  startCalculation();
}

function requestGeoPermission() {
  if (!navigator.geolocation) {
    bridgeState.geoPermission = 'denied';
    startCalculation();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      bridgeState.geoPermission = 'granted';
      bridgeState.latitude = position.coords.latitude;
      bridgeState.longitude = position.coords.longitude;
      startCalculation();
    },
    () => {
      bridgeState.geoPermission = 'denied';
      startCalculation();
    },
    { timeout: 5000 }
  );
}

function flipBias(result) {
  const map = { A: 'B', lean_A: 'lean_B', wait: 'B', lean_B: 'lean_A', B: 'A' };
  const scoreMap = { A: 6, lean_A: 2, wait: 0, lean_B: -2, B: -6 };
  const nextBias = map[result.decisionBias] || 'A';
  const effectiveTone = getEffectiveTone(result);
  const translated = retranslate(
    {
      ...result,
      decisionBias: nextBias,
      totalScore: scoreMap[nextBias] || 0,
    },
    effectiveTone === 'bestie' || effectiveTone === 'oracle' ? undefined : effectiveTone
  );

  return {
    ...result,
    decisionBias: nextBias,
    totalScore: scoreMap[nextBias] || 0,
    ...translated,
  };
}

function startCalculation() {
  clearTimers();
  bridgeState._calculating = true;
  bridgeState.shareDataUrl = null;
  bridgeState.shareCacheKey = '';

  const loadingMsg = document.getElementById('loading-msg');
  if (loadingMsg) loadingMsg.textContent = getLoadingMessage(bridgeState.templateId);
  navigateTo('loading');

  const startedAt = Date.now();
  const minLoadingTime = 2000;
  const calcDate = bridgeState.lastResult
    ? new Date(Date.now() + bridgeState._retryOffset)
    : new Date();

  if (bridgeState.lastResult) {
    bridgeState._retryOffset += 60 * 60 * 1000;
  }

  const timer = setTimeout(() => {
    if (!bridgeState._calculating) return;
    try {
      let result = getDecision(
        bridgeState.questionText,
        bridgeState.templateId,
        calcDate,
        bridgeState.geoPermission,
        null
      );

      if (bridgeState._flipBias) {
        result = flipBias(result);
        bridgeState._flipBias = false;
      } else {
        const effectiveTone = getEffectiveTone(result);
        if (effectiveTone !== 'bestie' && effectiveTone !== 'oracle') {
          result = {
            ...result,
            ...retranslate(result, effectiveTone),
          };
        }
      }

      bridgeState.lastResult = result;

      const elapsed = Date.now() - startedAt;
      const waitMore = Math.max(0, minLoadingTime - elapsed);
      const showTimer = setTimeout(() => {
        if (!bridgeState._calculating) return;
        bridgeState._calculating = false;
        showResult(result);
      }, waitMore);
      bridgeState._pendingTimers.push(showTimer);
    } catch (error) {
      console.error('测算异常:', error);
      const fallbackTimer = setTimeout(() => {
        if (!bridgeState._calculating) return;
        bridgeState._calculating = false;
        showFallbackResult();
      }, minLoadingTime);
      bridgeState._pendingTimers.push(fallbackTimer);
    }
  }, 120);

  bridgeState._pendingTimers.push(timer);
}

function getBadgeText(bias) {
  const map = { A: '宇宙说 冲', lean_A: '偏冲', wait: '先缓缓', lean_B: '偏别', B: '宇宙说 别' };
  return map[bias] || '先缓缓';
}

function getBadgeClass(bias) {
  if (bias === 'A' || bias === 'lean_A') return 'badge-positive';
  if (bias === 'wait') return 'badge-neutral';
  return 'badge-negative';
}

function updateResultPreviewBackground(result) {
  const tone = getEffectiveTone(result);
  const previewSeed = (result.sceneSeed || result.variantSeed || 0) + (bridgeState._retryOffset || 0);
  const posterSrc = resolvePosterSrc(
    bridgeState.posterTplId || bridgeState.templateId || result.templateId,
    result.decisionBias,
    tone,
    previewSeed,
    result
  );

  const lightPoster = document.getElementById('poster-light');
  if (lightPoster && posterSrc) {
    lightPoster.style.backgroundImage = posterSrc.image;
    lightPoster.style.backgroundPosition = posterSrc.position;
    lightPoster.style.backgroundSize = posterSrc.size;
    lightPoster.style.backgroundRepeat = posterSrc.repeat;
  }

  const oraclePoster = document.getElementById('poster-oracle-bg');
  if (oraclePoster && posterSrc) {
    oraclePoster.src = posterSrc.url;
    oraclePoster.style.filter = tone === 'sarcastic'
      ? 'saturate(1.1) contrast(1.16) hue-rotate(-22deg) brightness(0.82)'
      : tone === 'slacker'
        ? 'saturate(0.48) contrast(0.96) brightness(0.78)'
        : 'saturate(1.02) contrast(1.02) brightness(0.96)';
  }
}

function refreshResultQrcodes(result) {
  const qrDataUrl = generateQrDataUrl(result?.shareUrl, 160);
  ['result-light-qrcode', 'result-oracle-qrcode'].forEach((id) => {
    const img = document.getElementById(id);
    if (!img) return;
    if (qrDataUrl) img.src = qrDataUrl;
    img.dataset.shareUrl = result?.shareUrl || '';
    img.dataset.resultId = result?.resultId || '';
    img.alt = result?.headline ? `${result.headline} 二维码` : '项目二维码';
  });
}

function renderLightResult(result) {
  updateResultPreviewBackground(result);

  const badge = document.getElementById('result-badge');
  if (badge) {
    badge.textContent = getBadgeText(result.decisionBias);
    badge.className = `tagcard-badge ${getBadgeClass(result.decisionBias)}`;
  }

  const title = document.getElementById('result-title');
  if (title) title.textContent = result.headline || result.resultTitle;

  const quote = document.getElementById('result-quote');
  if (quote) {
    const quoteText = result.subhead || result.oneLineQuote || '';
    quote.style.display = quoteText ? 'block' : 'none';
    quote.textContent = quoteText;
  }

  const trend = document.getElementById('result-trend');
  if (trend) trend.textContent = result.comfortLine || result.resultTrend || '';

  const reason = document.getElementById('result-reason');
  if (reason) reason.textContent = result.firstPrinciplesReason || result.resultReason || '';

  const reasonLabel = document.getElementById('result-reason-label');
  if (reasonLabel) reasonLabel.textContent = result.reasonLabel || '判断依据';

  const riskArea = document.getElementById('result-risk-area');
  const riskText = document.getElementById('result-risk');
  if (riskArea && riskText) {
    if (result.resultRisk) {
      riskArea.style.display = 'block';
      riskText.textContent = result.resultRisk;
    } else {
      riskArea.style.display = 'none';
      riskText.textContent = '';
    }
  }

  const action = document.getElementById('result-action');
  if (action) {
    const actionText = result.nextStep || result.resultAction || '';
    action.innerHTML = String(actionText)
      .split(/[。]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join('<br>');
  }

  const actionLabel = document.getElementById('result-action-label');
  if (actionLabel) actionLabel.textContent = result.actionLabel || '下一步怎么做';

  const shareTitle = document.getElementById('result-bottom-text');
  if (shareTitle) shareTitle.textContent = result.shareLabel || '这张图适合发给';

  const shareBox = document.getElementById('result-meme-area');
  const shareText = document.getElementById('result-meme');
  if (shareBox && shareText) {
    if (result.shareHook) {
      shareBox.style.display = 'block';
      shareText.textContent = result.shareHook;
    } else {
      shareBox.style.display = 'none';
      shareText.textContent = '';
    }
  }

  const now = new Date();
  const timestamp = document.getElementById('result-timestamp');
  if (timestamp) {
    timestamp.textContent = `宇宙于 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 下达判断`;
  }

  const timeEgg = document.getElementById('result-time-egg');
  if (timeEgg) {
    if (result.timeEgg) {
      timeEgg.style.display = 'block';
      timeEgg.textContent = result.timeEgg;
    } else {
      timeEgg.style.display = 'none';
      timeEgg.textContent = '';
    }
  }

  const persona = document.getElementById('result-persona');
  if (persona) {
    const key = bridgeState.posterTplId || bridgeState.templateId || result.questionFamily || 'custom';
    persona.textContent = PERSONA_MAP[key] || 'ORACLE';
  }

  updateToneButtons();
}

function renderOracleResult(result) {
  updateResultPreviewBackground(result);

  const title = document.getElementById('oracle-title');
  if (title) title.textContent = result.headline || result.resultTitle;

  const quoteArea = document.getElementById('oracle-quote-area');
  const quote = document.getElementById('oracle-quote');
  if (quoteArea && quote) {
    const quoteText = result.subhead || result.oneLineQuote || '';
    quoteArea.style.display = quoteText ? 'block' : 'none';
    quote.textContent = quoteText;
  }

  const reason = document.getElementById('oracle-reason');
  if (reason) reason.textContent = result.firstPrinciplesReason || result.resultReason || '';

  const reasonLabel = document.getElementById('oracle-reason-label');
  if (reasonLabel) reasonLabel.textContent = result.reasonLabel || '判断依据';

  const riskArea = document.getElementById('oracle-risk-area');
  const risk = document.getElementById('oracle-risk');
  if (riskArea && risk) {
    if (result.resultRisk) {
      riskArea.style.display = 'block';
      risk.textContent = result.resultRisk;
    } else {
      riskArea.style.display = 'none';
      risk.textContent = '';
    }
  }

  const action = document.getElementById('oracle-action');
  if (action) action.textContent = result.nextStep || result.resultAction || '';

  const actionLabel = document.getElementById('oracle-action-label');
  if (actionLabel) actionLabel.textContent = result.actionLabel || '下一步怎么做';

  const trend = document.getElementById('oracle-trend');
  if (trend) trend.textContent = result.comfortLine || result.resultTrend || '';

  const trendLabel = document.getElementById('oracle-trend-label');
  if (trendLabel) trendLabel.textContent = '情绪提醒';

  const memeArea = document.getElementById('oracle-meme-area');
  const meme = document.getElementById('oracle-meme');
  const memeLabel = document.getElementById('oracle-meme-label');
  if (memeArea && meme && memeLabel) {
    if (result.shareHook) {
      memeArea.style.display = 'block';
      meme.textContent = result.shareHook;
      memeLabel.textContent = result.shareLabel || '这张图适合发给';
    } else {
      memeArea.style.display = 'none';
      meme.textContent = '';
    }
  }

  const now = new Date();
  const timestamp = document.getElementById('oracle-timestamp');
  if (timestamp) {
    timestamp.textContent = `宇宙于 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 下达判断`;
  }

  const timeEgg = document.getElementById('oracle-time-egg');
  if (timeEgg) {
    if (result.timeEgg) {
      timeEgg.style.display = 'block';
      timeEgg.textContent = result.timeEgg;
    } else {
      timeEgg.style.display = 'none';
      timeEgg.textContent = '';
    }
  }

  const ctaArea = document.getElementById('oracle-cta-area');
  const escalateBtn = document.getElementById('btn-escalate');
  if (ctaArea && escalateBtn) {
    if (result.escalationRecommended && result.resultCta) {
      ctaArea.style.display = 'block';
      escalateBtn.textContent = result.resultCta;
    } else {
      ctaArea.style.display = 'none';
      escalateBtn.textContent = '';
    }
  }

  updateToneButtons();
}

function updateToneButtons() {
  const nextTones = {
    bestie: '切换毒舌模式',
    sarcastic: '换回正常模式',
    slacker: '换回正常模式',
  };
  document.querySelectorAll('[data-action="toggle-sarcastic"]').forEach((button) => {
    button.style.display = 'block';
    button.disabled = false;
    button.textContent = nextTones[bridgeState.currentTone] || '切换毒舌模式';
  });
}

function showResult(result) {
  bridgeState.shareDataUrl = null;
  bridgeState.shareCacheKey = '';
  refreshResultQrcodes(result);
  track('result_view', trackPayload(result));

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

function buildSharePayload() {
  const result = bridgeState.lastResult;
  if (!result) return null;

  return {
    type: result.posterVariant || 'long',
    templateId: bridgeState.posterTplId || bridgeState.templateId,
    question: bridgeState.questionText,
    title: result.resultTitle,
    headline: result.headline || result.resultTitle,
    subhead: result.subhead || '',
    firstPrinciplesReason: result.firstPrinciplesReason || result.resultReason,
    comfortLine: result.comfortLine || result.resultTrend || '',
    nextStep: result.nextStep || result.resultAction,
    shareHook: result.shareHook || result.shareMeme || '',
    reasonLabel: result.reasonLabel || '判断依据',
    actionLabel: result.actionLabel || '下一步怎么做',
    shareLabel: result.shareLabel || '这张图适合发给',
    ctaLabel: result.ctaLabel || '扫码测你自己的版本',
    questionFamily: result.questionFamily || bridgeState.posterTplId || 'generic',
    resultId: result.resultId || '',
    posterSceneId: result.posterSceneId || '',
    posterVariant: 'long',
    oneLiner: result.oneLineQuote || '',
    shortQuestion: result.shortQuestion || '',
    reason: result.resultReason || '',
    action: result.resultAction || '',
    risk: result.resultRisk || '',
    trend: result.resultTrend || '',
    confidence: result.confidenceLevel || 0,
    tone: result.tone || getEffectiveTone(result),
    shareUrl: result.shareUrl || 'https://awkn.cn/god/',
    sceneSeed: (result.sceneSeed || result.variantSeed || 0) ^ hashString(`${getEffectiveTone(result)}|${bridgeState._retryOffset || 0}|${result.posterSceneId || ''}`),
    posterImageSrc: resolvePosterSrc(
      bridgeState.posterTplId || bridgeState.templateId || result.templateId,
      result.decisionBias,
      getEffectiveTone(result),
      (result.sceneSeed || result.variantSeed || 0) + (bridgeState._retryOffset || 0),
      result
    )?.url || '',
  };
}

function getShareCacheKey(payload) {
  return JSON.stringify([
    payload.resultId,
    payload.posterSceneId,
    payload.tone,
    payload.question,
    payload.headline,
    payload.firstPrinciplesReason,
    payload.nextStep,
  ]);
}

async function ensureShareCard(force = false) {
  const payload = buildSharePayload();
  if (!payload) return null;

  const cacheKey = getShareCacheKey(payload);
  if (!force && bridgeState.shareDataUrl && bridgeState.shareCacheKey === cacheKey) {
    return bridgeState.shareDataUrl;
  }

  const dataUrl = await generateShareCard(payload);
  bridgeState.shareDataUrl = dataUrl;
  bridgeState.shareCacheKey = cacheKey;
  track('poster_generate', {
    ...trackPayload(bridgeState.lastResult),
    posterVariant: 'long',
  });
  return dataUrl;
}

async function quickSaveShareCard() {
  const dataUrl = await ensureShareCard(true);
  if (!dataUrl) return;
  await saveOrShareImage(dataUrl);
  track('poster_save', trackPayload(bridgeState.lastResult));
}

function showShareCard() {
  return quickSaveShareCard();
}

function saveCard() {
  return quickSaveShareCard();
}

function shareCard() {
  return quickSaveShareCard();
}

function goHome() {
  bridgeState._calculating = false;
  clearTimers();
  bridgeState.templateId = null;
  bridgeState.posterTplId = null;
  bridgeState.questionText = '';
  bridgeState.lastResult = null;
  bridgeState.shareDataUrl = null;
  bridgeState.shareCacheKey = '';
  bridgeState.currentTone = 'bestie';
  bridgeState._normalResultSnapshot = null;
  bridgeState._retryOffset = 0;
  bridgeState._retrySerial = 0;
  showUniverse();
}

function goBackToResult() {
  if (bridgeState.previousPage) navigateTo(bridgeState.previousPage);
}

function retry() {
  track('retry_click', trackPayload(bridgeState.lastResult));
  bridgeState._flipBias = true;
  bridgeState._retrySerial += 1;
  bridgeState._normalResultSnapshot = null;
  startCalculation();
}

function getSarcasticFallbackCopy(templateId, result) {
  const fallbackMap = {
    date: {
      resultTitle: '别把心动当指令',
      resultReason: '你现在缺的不是浪漫，是确认对方有没有同样投入。没证据就冲，只是在替幻想买单。',
      resultAction: '先发一个低成本试探，别一上来把自己交出去。',
      resultTrend: '暧昧可以上头，但别把脑子也交出去。',
      shareHook: '发给那个一恋爱就自动降智的人。',
    },
    fitness: {
      resultTitle: '别骗自己会练很久',
      resultReason: '真正的约束不是意志力，是启动成本。你能做十分钟，比幻想练两小时更真实。',
      resultAction: '现在换衣服，做 10 分钟。做完再决定要不要继续。',
      resultTrend: '你不是废，你只是还没启动。',
      shareHook: '发给那个健身卡快成纪念卡的人。',
    },
    study: {
      resultTitle: '别拿学习感动自己',
      resultReason: '坐在书前不等于吸收。先缩小任务，完成一个可验证的小块，才算真的推进。',
      resultAction: '只学 25 分钟，只交付一页笔记或一道题。',
      resultTrend: '少演一点努力，进度会更真实。',
      shareHook: '发给那个总说今晚一定学的人。',
    },
    diet: {
      resultTitle: '别把减肥变成赎罪',
      resultReason: '一顿饭不会毁掉你，真正毁计划的是今天暴食、明天惩罚的循环。',
      resultAction: '这顿吃正常热量，下一顿回到清淡，不要补偿性挨饿。',
      resultTrend: '稳定比狠更难，也更有用。',
      shareHook: '发给那个一边火锅一边忏悔的人。',
    },
    custom: {
      resultTitle: '你其实已经有答案了',
      resultReason: '你反复问，不是因为没有信号，而是因为答案不够讨好你。',
      resultAction: '选成本最低的一步先试，别继续在脑内开庭。',
      resultTrend: '纠结很累，行动至少有反馈。',
      shareHook: '发给那个嘴上随便、心里演完八十集的人。',
    },
  };

  const copy = fallbackMap[templateId];
  if (!copy) return null;
  return {
    ...copy,
    headline: copy.resultTitle,
    firstPrinciplesReason: copy.resultReason,
    nextStep: copy.resultAction,
    comfortLine: copy.resultTrend,
    tone: 'sarcastic',
  };
}

function toggleSarcastic(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const now = Date.now();
  if (now - bridgeState._lastToneToggleAt < 350) return;
  bridgeState._lastToneToggleAt = now;

  const result = bridgeState.lastResult;
  if (!result) return;

  const nextTone = bridgeState.currentTone === 'sarcastic' ? 'bestie' : 'sarcastic';
  const posterTemplateId = bridgeState.posterTplId || bridgeState.templateId || result.templateId || 'custom';

  if (nextTone === 'sarcastic' && !bridgeState._normalResultSnapshot) {
    bridgeState._normalResultSnapshot = { ...result };
  }

  if (nextTone === 'bestie' && bridgeState._normalResultSnapshot) {
    bridgeState.currentTone = 'bestie';
    bridgeState.lastResult = { ...bridgeState._normalResultSnapshot, tone: 'bestie' };
    bridgeState._normalResultSnapshot = null;
  } else {
    bridgeState.currentTone = nextTone;
    const translated = retranslate(
      result,
      bridgeState.currentTone === 'bestie' ? undefined : bridgeState.currentTone
    );

    const needsFallback = bridgeState.currentTone === 'sarcastic' && (
      translated.resultTitle === result.resultTitle ||
      translated.headline === result.headline ||
      ['date', 'fitness', 'study', 'diet', 'custom'].includes(posterTemplateId)
    );
    const fallbackCopy = needsFallback ? getSarcasticFallbackCopy(posterTemplateId, result) : null;

    bridgeState.lastResult = {
      ...bridgeState.lastResult,
      ...translated,
      ...(fallbackCopy || {}),
    };
  }
  bridgeState.shareDataUrl = null;
  bridgeState.shareCacheKey = '';
  refreshResultQrcodes(bridgeState.lastResult);

  if (bridgeState.lastResult.seriousnessLevel === 'L3') {
    renderOracleResult(bridgeState.lastResult);
  } else {
    renderLightResult(bridgeState.lastResult);
  }

  track('tone_toggle', trackPayload(bridgeState.lastResult));
}

function showFallbackResult() {
  bridgeState.lastResult = {
    seriousnessLevel: 'L1',
    decisionBias: 'wait',
    resultTitle: '宇宙今天摸鱼了',
    resultReason: '今天的信号不够清楚，先别硬做决定。',
    resultRisk: '',
    resultAction: '刷新一下，或者过几分钟再来',
    resultTrend: '状态没对上时，先缓一缓不算输',
    shareCardType: 'conclusion',
    confidenceLevel: 30,
    escalationRecommended: false,
    headline: '今天先别急',
    subhead: '现在更适合等信号回稳，再做下一步。',
    firstPrinciplesReason: '当信息不完整、状态也不稳定时，硬做决定只会放大误差。',
    comfortLine: '等等看，不代表今天就白过了。',
    shareHook: '发给那个今天也乱成一团的人。',
    nextStep: '过几分钟再测一次，或者先做最小成本的一步。',
    reasonLabel: '判断依据',
    actionLabel: '下一步怎么做',
    shareLabel: '这张图适合发给',
    questionFamily: 'generic',
    tone: 'bestie',
    resultId: 'fallback__wait__0',
    posterSceneId: 'generic__slow-light__bestie__0',
    shareUrl: 'https://awkn.cn/god/',
  };
  showResult(bridgeState.lastResult);
}

function updateHomepageForShareLanding() {
  const params = new URLSearchParams(window.location.search);
  const isShareLanding = params.get('src') === 'share';
  if (!isShareLanding) return;

  const family = params.get('family') || '';
  const tone = params.get('tone') || '';
  const rid = params.get('rid') || '';

  if (heroSubtitle) {
    heroSubtitle.textContent = '先看朋友抽到的答案，再测你自己的版本。';
  }
  if (heroBanner) {
    heroBanner.style.display = 'inline-flex';
    heroBanner.textContent = '你朋友刚抽到一张神谕';
  }
  if (randomButton) {
    randomButton.textContent = '测你自己的版本';
  }

  const selector = getFamilyCardSelector(family);
  if (selector) {
    const target = document.querySelector(selector);
    if (target) {
      target.classList.add('share-deeplink-focus');
      setTimeout(() => target.classList.remove('share-deeplink-focus'), 4800);
    }
  }

  track('share_deeplink_land', { resultId: rid, family, tone });
}

function openQrForCurrentResult(event) {
  const target = event.currentTarget;
  const shareUrl = target?.dataset?.shareUrl || bridgeState.lastResult?.shareUrl;
  if (!shareUrl) return;
  track('qr_open', trackPayload(bridgeState.lastResult));
  window.open(shareUrl, '_blank', 'noopener');
}

function bindQrClicks() {
  ['result-light-qrcode', 'result-oracle-qrcode'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', openQrForCurrentResult);
  });
}

function init() {
  preloadAllIllustrations().catch(() => {});
  updateHomepageForShareLanding();

  document.addEventListener('awkn:start-universe', (event) => {
    const detail = event.detail || {};
    if (!detail.templateId) return;
    startFromUniverse(detail.templateId, detail.questionText || undefined);
  });

  document.getElementById('btn-geo-grant')?.addEventListener('click', requestGeoPermission);
  document.getElementById('btn-geo-default')?.addEventListener('click', () => {
    bridgeState.geoPermission = 'denied';
    startCalculation();
  });
  document.getElementById('btn-geo-skip')?.addEventListener('click', () => {
    bridgeState.geoPermission = 'denied';
    startCalculation();
  });

  document.getElementById('btn-retry')?.addEventListener('click', retry);
  document.getElementById('btn-retry-oracle')?.addEventListener('click', retry);
  document.getElementById('btn-share-oracle')?.addEventListener('click', showShareCard);
  window.__awknToggleSarcastic = toggleSarcastic;
  ['click', 'touchend'].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (event.target.closest?.('[data-action="toggle-sarcastic"]')) {
        toggleSarcastic(event);
      }
    }, true);
  });
  document.getElementById('btn-escalate')?.addEventListener('click', quickSaveShareCard);
  document.getElementById('result-meme-area')?.addEventListener('click', quickSaveShareCard);
  document.getElementById('oracle-meme-area')?.addEventListener('click', quickSaveShareCard);

  document.getElementById('btn-home-light')?.addEventListener('click', goHome);
  document.getElementById('btn-home-oracle')?.addEventListener('click', goHome);
  document.getElementById('btn-home-share')?.addEventListener('click', goHome);

  document.getElementById('btn-save-card')?.addEventListener('click', saveCard);
  document.getElementById('btn-share-card')?.addEventListener('click', shareCard);
  document.getElementById('btn-back-result')?.addEventListener('click', goBackToResult);

  bindQrClicks();
  window.startFromUniverse = startFromUniverse;

  if (window.__pendingUniverseStart?.templateId) {
    const pending = window.__pendingUniverseStart;
    window.__pendingUniverseStart = null;
    startFromUniverse(pending.templateId, pending.questionText || undefined);
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest('.orbit-card[data-tpl]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    const tpl = card.getAttribute('data-tpl');
    const question = card.getAttribute('data-q');
    if (tpl) startFromUniverse(tpl, question || undefined);
  });

  if (randomButton) {
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

    randomButton.addEventListener('click', () => {
      const item = templates[Math.floor(Math.random() * templates.length)];
      startFromUniverse(item.tpl, item.q);
    });
  }
}

init();
window._orbitPaused = false;
