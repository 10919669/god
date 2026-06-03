/**
 * decision-engine.js
 * 决策评分层 + 模板翻译层
 * "上帝帮你掷骰子" 决策和文案模块
 *
 * 使用 ES Module 导出
 * 依赖 ./liuren-engine.js 的 divine() 函数
 */

import { divine } from './liuren-engine.js';

// ============================================================
// 工具函数
// ============================================================

/**
 * 从数组中随机选取一个元素
 * @param {Array} arr
 * @returns {*}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 将数值限制在 [min, max] 范围内
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * 判断当前时间是否靠近子时（23:00-01:00 边界）
 * 子时跨日，取前后30分钟判定
 * @param {Date} date
 * @returns {boolean}
 */
function nearZiHour(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const totalMin = h * 60 + m;
  // 子时 23:00-01:00，靠近判定：22:30-23:30 或 00:30-01:30
  return (totalMin >= 1350 && totalMin <= 1410) || (totalMin >= 30 && totalMin <= 90);
}

/**
 * 判断当前是否靠近中气（节气中点）
 * 简化实现：取每月约15日为中气附近
 * @param {Date} date
 * @returns {boolean}
 */
function nearZhongQi(date) {
  const day = date.getDate();
  // 每月约14-16日为中气附近
  return day >= 14 && day <= 16;
}

// ============================================================
// 1. 问题分类模块
// ============================================================

/**
 * 模板ID到分类的映射表
 */
const TEMPLATE_MAP = {
  eat_today:       { category: 'daily',       seriousnessLevel: 'L1' },
  wear_today:      { category: 'daily',       seriousnessLevel: 'L1' },
  drink_today:     { category: 'daily',       seriousnessLevel: 'L1' },
  go_out:          { category: 'daily',       seriousnessLevel: 'L1' },
  wash_hair:       { category: 'daily',       seriousnessLevel: 'L1' },
  sleep_early:     { category: 'daily',       seriousnessLevel: 'L1' },
  send_message:    { category: 'social',      seriousnessLevel: 'L2' },
  send_msg:        { category: 'social',      seriousnessLevel: 'L2' },
  buy_it:          { category: 'shopping',    seriousnessLevel: 'L1' },
  ab_choice:       { category: 'social',      seriousnessLevel: 'L2' },
  contact_ta:      { category: 'relationship', seriousnessLevel: 'L3' },
  continue_or_not: { category: 'relationship', seriousnessLevel: 'L3' },
  take_opportunity:{ category: 'work',         seriousnessLevel: 'L3' },
};

/**
 * L3 触发词库
 */
const L3_KEYWORDS = {
  relationship: ['联系', '表白', '分手', '复合', '推进关系', '在一起'],
  work:         ['辞职', '换工作', '跳槽', '接offer', '创业'],
  major:        ['买房', '投资', '借钱', '签约', '结婚'],
};

/**
 * 分析问题文本，判断决策形态
 * @param {string} text
 * @returns {'single'|'AB'|'yesno'|'timing'}
 */
function detectDecisionShape(text) {
  if (!text) return 'single';
  const t = text.trim();

  // AB选择：包含 "还是"、"或者"、"/"、"A还是B"、"选A"、"选B"
  if (/还是|或者|\/|选A|选B|A还是B|二选一/.test(t)) return 'AB';

  // 是否型：包含 "要不要"、"该不该"、"能不能"、"是否"、"去不去"、"好不好"
  if (/要不要|该不该|能不能|是否|去不去|好不好|行不行|可以吗/.test(t)) return 'yesno';

  // 时间型：包含 "什么时候"、"几时"、"何时"、"时机"
  if (/什么时候|几时|何时|时机|时间/.test(t)) return 'timing';

  return 'single';
}

/**
 * 问题分类
 * @param {string} questionText - 问题文本
 * @param {string} templateId - 模板ID
 * @returns {{ category: string, seriousnessLevel: string, decisionShape: string, toneMode: string, shareCardType: string }}
 */
export function classifyQuestion(questionText, templateId) {
  try {
  // 优先使用模板映射
  const mapped = TEMPLATE_MAP[templateId];
  if (mapped) {
    const { category, seriousnessLevel } = mapped;
    const toneMode = seriousnessLevel === 'L3' ? 'oracle' : 'bestie';
    const shareCardType = seriousnessLevel === 'L1' ? 'conclusion'
                        : seriousnessLevel === 'L2' ? 'versus'
                        : 'ask_help';
    const decisionShape = detectDecisionShape(questionText);
    return { category, seriousnessLevel, decisionShape, toneMode, shareCardType };
  }

  // 自由输入：通过触发词判定
  const text = (questionText || '').toLowerCase();
  let category = 'daily';
  let seriousnessLevel = 'L1';

  for (const [cat, keywords] of Object.entries(L3_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        category = cat === 'major' ? 'work' : cat;
        seriousnessLevel = 'L3';
        break;
      }
    }
    if (seriousnessLevel === 'L3') break;
  }

  // 如果没有命中L3，尝试L2判定
  if (seriousnessLevel === 'L1') {
    const l2Patterns = [/朋友|同事|同学|社交/, /约|见面|聚会/];
    for (const p of l2Patterns) {
      if (p.test(text)) {
        category = 'social';
        seriousnessLevel = 'L2';
        break;
      }
    }
  }

  // 细分分类：健身/学习/减肥
  if (category === 'daily') {
    if (/健身|运动|锻炼|跑步/.test(text)) category = 'fitness';
    else if (/学习|看书|复习|写作业|考试/.test(text)) category = 'study';
    else if (/减肥|节食|瘦身|控制体重|戒糖/.test(text)) category = 'diet';
  }

  const toneMode = seriousnessLevel === 'L3' ? 'oracle' : 'bestie';
  const shareCardType = seriousnessLevel === 'L1' ? 'conclusion'
                      : seriousnessLevel === 'L2' ? 'versus'
                      : 'ask_help';
  const decisionShape = detectDecisionShape(questionText);

  return { category, seriousnessLevel, decisionShape, toneMode, shareCardType };
  } catch (e) {
    console.warn('[decision-engine] classifyQuestion 异常:', e);
    return {
      category: templateId || 'custom',
      seriousnessLevel: 'L1',
      decisionShape: 'yes_no',
      toneMode: 'bestie',
      shareCardType: 'conclusion'
    };
  }
}

// ============================================================
// 2. 征象分析模块
// ============================================================

/**
 * 五行生克判定
 * 天干五行对照表
 */
const STEM_ELEMENT = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
};

/**
 * 五行生克关系
 * 生：wood→fire→earth→metal→water→wood
 * 克：wood→earth→water→fire→metal→wood
 */
const ELEMENT_GENERATES = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};
const ELEMENT_OVERCOMES = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

/**
 * 获取地支的五行属性
 */
const BRANCH_ELEMENT = {
  '子': 'water', '丑': 'earth', '寅': 'wood', '卯': 'wood',
  '辰': 'earth', '巳': 'fire',  '午': 'fire', '未': 'earth',
  '申': 'metal', '酉': 'metal', '戌': 'earth', '亥': 'water',
};

/**
 * 判断五行生克
 * @param {string} fromElem - 来源五行
 * @param {string} toElem - 目标五行
 * @returns {'generate'|'overcome'|'none'}
 */
function elementRelation(fromElem, toElem) {
  if (ELEMENT_GENERATES[fromElem] === toElem) return 'generate';
  if (ELEMENT_OVERCOMES[fromElem] === toElem) return 'overcome';
  return 'none';
}

/**
 * 判断三传是否顺行
 * 顺行：初传→中传→末传的地支序号递增（考虑循环）
 */
const BRANCH_INDEX = {
  '子': 0, '丑': 1, '寅': 2, '卯': 3, '辰': 4, '巳': 5,
  '午': 6, '未': 7, '申': 8, '酉': 9, '戌': 10, '亥': 11,
};

function isForwardSequence(chu, zhong, mo) {
  const i1 = BRANCH_INDEX[chu] ?? -1;
  const i2 = BRANCH_INDEX[zhong] ?? -1;
  const i3 = BRANCH_INDEX[mo] ?? -1;
  if (i1 < 0 || i2 < 0 || i3 < 0) return false;
  // 顺行：i1 < i2 < i3，或循环顺行（如 亥→子→丑）
  if (i1 < i2 && i2 < i3) return true;
  // 循环顺行判定：i1 > i3 且 i2 < i3（跨子时）
  if (i1 > i3 && i2 < i3 && i2 < i1) return true;
  return false;
}

/**
 * 判断三传是否逆行
 */
function isReverseSequence(chu, zhong, mo) {
  const i1 = BRANCH_INDEX[chu] ?? -1;
  const i2 = BRANCH_INDEX[zhong] ?? -1;
  const i3 = BRANCH_INDEX[mo] ?? -1;
  if (i1 < 0 || i2 < 0 || i3 < 0) return false;
  if (i1 > i2 && i2 > i3) return true;
  // 循环逆行
  if (i1 < i3 && i2 > i3 && i2 > i1) return true;
  return false;
}

/**
 * 判断地支是否空亡
 * 简化实现：根据日干支推算空亡
 * 空亡规则：甲子旬空戌亥，甲戌旬空申酉，甲申旬空午未，
 *           甲午旬空辰巳，甲辰旬空寅卯，甲寅旬空子丑
 */
const XUNKONG_MAP = {
  '甲': '戌亥', '乙': '申酉', '丙': '午未', '丁': '辰巳',
  '戊': '寅卯', '己': '子丑', '庚': '戌亥', '辛': '申酉',
  '壬': '午未', '癸': '辰巳',
};

function isVoid(branch, dayStem) {
  const voidBranches = XUNKONG_MAP[dayStem] || '';
  return voidBranches.includes(branch);
}

/**
 * 判断干支是否相合
 * 六合：子丑、寅亥、卯戌、辰酉、巳申、午未
 */
const LIU_HE_PAIRS = [
  ['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未'],
];

function isGanZhiHe(ganBranch, zhiBranch) {
  if (!ganBranch || !zhiBranch) return false;
  for (const [a, b] of LIU_HE_PAIRS) {
    if ((ganBranch === a && zhiBranch === b) || (ganBranch === b && zhiBranch === a)) return true;
  }
  return false;
}

/**
 * 判断干支是否相冲
 * 六冲：子午、丑未、寅申、卯酉、辰戌、巳亥
 */
const LIU_CHONG_PAIRS = [
  ['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];

function isGanZhiChong(ganBranch, zhiBranch) {
  if (!ganBranch || !zhiBranch) return false;
  for (const [a, b] of LIU_CHONG_PAIRS) {
    if ((ganBranch === a && zhiBranch === b) || (ganBranch === b && zhiBranch === a)) return true;
  }
  return false;
}

/**
 * 判断是否为败地（沐浴）
 * 简化：十二长生中"败"（沐浴）位
 * 木败子、火败卯、金败午、水土败酉
 */
const BAI_POSITIONS = {
  wood: '子', fire: '卯', metal: '午', earth: '酉', water: '酉',
};

function isBai(element, branch) {
  return BAI_POSITIONS[element] === branch;
}

/**
 * 判断是否为旺禄临身
 * 旺：五行在对应季节旺相；禄：天干禄位
 * 简化实现：检查日干上神是否为日干的禄位
 */
const LU_POSITION = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
  '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
  '壬': '亥', '癸': '子',
};

/**
 * 判断三刑是否出现
 * 三刑：寅巳申、丑戌未、子卯、辰午酉亥（自刑）
 */
const SAN_XING = [
  ['寅', '巳', '申'],
  ['丑', '戌', '未'],
  ['子', '卯'],
  ['辰', '午', '酉', '亥'],
];

function hasSanXing(...branches) {
  const set = new Set(branches.filter(Boolean));
  for (const group of SAN_XING) {
    const gSet = new Set(group);
    let matchCount = 0;
    for (const b of set) {
      if (gSet.has(b)) matchCount++;
    }
    if (matchCount >= 2) return true; // 至少见两支即为见刑
  }
  return false;
}

/**
 * 天乙贵人查法
 * 甲戊庚牛羊（丑未），乙己鼠猴乡（子申），
 * 丙丁猪鸡位（亥酉），壬癸兔蛇藏（卯巳），六辛逢马虎（午寅）
 */
const TIAN_YI_GUI_REN = {
  '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
  '乙': ['子', '申'], '己': ['子', '申'],
  '丙': ['亥', '酉'], '丁': ['亥', '酉'],
  '壬': ['卯', '巳'], '癸': ['卯', '巳'],
  '辛': ['午', '寅'],
};

/**
 * 驿马查法
 * 申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳
 */
const YI_MA = {
  '子': '寅', '申': '寅', '辰': '寅',
  '寅': '申', '午': '申', '戌': '申',
  '巳': '亥', '酉': '亥', '丑': '亥',
  '亥': '巳', '卯': '巳', '未': '巳',
};

/**
 * 四课天将（神将）判定
 * 简化：根据课传地支推断可能临的神将
 * 白虎：申酉金；青龙：寅卯木；朱雀：午火；玄武：亥子水
 */
function detectShenJiang(branch) {
  const elem = BRANCH_ELEMENT[branch];
  const result = [];
  if (elem === 'metal' && (branch === '申' || branch === '酉')) result.push('白虎');
  if (elem === 'wood' && (branch === '寅' || branch === '卯')) result.push('青龙');
  if (elem === 'fire' && branch === '午') result.push('朱雀');
  if (elem === 'water' && (branch === '亥' || branch === '子')) result.push('玄武');
  return result;
}

/**
 * 征象分析
 * @param {object} divinationResult - 大六壬排盘结果（来自 liuren-engine.js 的 divine()）
 * @returns {object} 征象对象
 */
export function analyzeSignals(divinationResult) {
  const signals = {
    favorable: [],
    unfavorable: [],
    movement: 0,
    caution: 0,
    delay: 0,
    support: 0,
    conflict: 0,
    void_: 0,
    structureType: 'mixed',
  };

  if (!divinationResult) return signals;

  const {
    dayStem,       // 日干（甲乙丙丁...）
    dayBranch,     // 日支（子丑寅卯...）
    ganShangShen,  // 日干上神（地支）
    zhiShangShen,  // 日支上神（地支）
    chuZhuan,      // 初传（地支）
    zhongZhuan,    // 中传（地支）
    moZhuan,       // 末传（地支）
    siKe,          // 四课 [{shang, xia}, ...]
    hasDingShen,   // 课传是否见丁神
    patterns,      // 特殊格局数组
  } = divinationResult;

  // --- 日干上神与日干的关系 ---
  if (ganShangShen && dayStem) {
    const stemElem = STEM_ELEMENT[dayStem];
    const shangElem = BRANCH_ELEMENT[ganShangShen];
    if (stemElem && shangElem) {
      const rel = elementRelation(shangElem, stemElem);
      if (rel === 'generate') {
        signals.favorable.push('干上神生干');
        signals.support++;
      } else if (rel === 'overcome') {
        signals.unfavorable.push('干上神克干');
        signals.conflict++;
      }
    }
  }

  // --- 三传顺逆 ---
  if (chuZhuan && zhongZhuan && moZhuan) {
    const forward = isForwardSequence(chuZhuan, zhongZhuan, moZhuan);
    const reverse = isReverseSequence(chuZhuan, zhongZhuan, moZhuan);

    if (forward) {
      // 检查是否相生链
      const e1 = BRANCH_ELEMENT[chuZhuan];
      const e2 = BRANCH_ELEMENT[zhongZhuan];
      const e3 = BRANCH_ELEMENT[moZhuan];
      if (e1 && e2 && e3 && ELEMENT_GENERATES[e1] === e2 && ELEMENT_GENERATES[e2] === e3) {
        signals.favorable.push('三传顺生');
        signals.movement++;
      }
    }

    if (reverse) {
      signals.unfavorable.push('三传逆行');
      signals.delay++;
    }
  }

  // --- 空亡判定 ---
  if (chuZhuan && dayStem && isVoid(chuZhuan, dayStem)) {
    signals.unfavorable.push('初传落空');
    signals.void_++;
  }
  if (moZhuan && dayStem && isVoid(moZhuan, dayStem)) {
    signals.unfavorable.push('末传落空');
    signals.void_++;
    signals.delay++;
  }

  // --- 丁神 ---
  if (hasDingShen && dayStem) {
    const stemElem = STEM_ELEMENT[dayStem];
    if (stemElem === 'metal') {
      signals.unfavorable.push('金日逢丁');
      signals.caution += 2;
      signals.conflict++;
    } else if (stemElem === 'water') {
      signals.favorable.push('水日逢丁');
      signals.movement++;
    }
  }

  // --- 天乙贵人 ---
  if (dayStem) {
    const guiRenBranches = TIAN_YI_GUI_REN[dayStem] || [];
    const allBranches = [chuZhuan, zhongZhuan, moZhuan, ganShangShen, zhiShangShen].filter(Boolean);
    const hasGuiRen = guiRenBranches.some(g => allBranches.includes(g));
    if (hasGuiRen) {
      signals.favorable.push('贵人临传');
      signals.support += 2;
    }
  }

  // --- 驿马 ---
  if (dayBranch) {
    const ma = YI_MA[dayBranch];
    const allBranches = [chuZhuan, zhongZhuan, moZhuan].filter(Boolean);
    if (ma && allBranches.includes(ma)) {
      signals.favorable.push('驿马发动');
      signals.movement += 2;
    }
  }

  // --- 特殊格局 ---
  if (patterns && Array.isArray(patterns)) {
    if (patterns.includes('前后引从')) {
      signals.favorable.push('前后引从');
      signals.support += 2;
    }
    if (patterns.includes('首尾相见')) {
      signals.favorable.push('首尾相见');
      signals.support++;
    }
  }

  // --- 干支关系 ---
  if (ganShangShen && zhiShangShen) {
    if (isGanZhiHe(ganShangShen, zhiShangShen)) {
      signals.favorable.push('干支相合');
      signals.support++;
    }
    if (isGanZhiChong(ganShangShen, zhiShangShen)) {
      signals.unfavorable.push('干支相冲');
      signals.conflict++;
    }
  }

  // --- 干支皆败 ---
  if (dayStem && ganShangShen && zhiShangShen) {
    const stemElem = STEM_ELEMENT[dayStem];
    if (stemElem && isBai(stemElem, ganShangShen) && isBai(stemElem, zhiShangShen)) {
      signals.unfavorable.push('干支皆败');
      signals.caution += 2;
    }
  }

  // --- 旺禄临身 ---
  if (dayStem && ganShangShen) {
    const lu = LU_POSITION[dayStem];
    if (lu === ganShangShen) {
      signals.favorable.push('旺禄临身');
      signals.support += 2;
    }
  }

  // --- 闭口卦 ---
  if (patterns && Array.isArray(patterns) && patterns.includes('闭口')) {
    signals.unfavorable.push('闭口');
    signals.caution++;
  }

  // --- 三刑 ---
  if (chuZhuan && zhongZhuan && moZhuan) {
    if (hasSanXing(chuZhuan, zhongZhuan, moZhuan)) {
      signals.unfavorable.push('三刑');
      signals.conflict += 2;
      signals.caution++;
    }
  }

  // --- 神将临课 ---
  const allTransBranches = [chuZhuan, zhongZhuan, moZhuan].filter(Boolean);
  for (const b of allTransBranches) {
    const jiang = detectShenJiang(b);
    if (jiang.includes('白虎') && b === dayBranch) {
      signals.unfavorable.push('白虎临身');
      signals.caution += 2;
    }
    if (jiang.includes('青龙') && b === dayBranch) {
      signals.favorable.push('青龙临身');
      signals.support++;
    }
    if (jiang.includes('朱雀')) {
      signals.unfavorable.push('朱雀临传');
      signals.conflict++;
    }
    if (jiang.includes('玄武')) {
      signals.unfavorable.push('玄武临传');
      signals.void_++;
    }
  }

  // --- 数值钳位 ---
  signals.movement = clamp(signals.movement, 0, 5);
  signals.caution  = clamp(signals.caution,  0, 5);
  signals.delay    = clamp(signals.delay,    0, 5);
  signals.support  = clamp(signals.support,  0, 5);
  signals.conflict = clamp(signals.conflict, 0, 5);
  signals.void_    = clamp(signals.void_,    0, 5);

  // --- structureType 判定 ---
  const favCount = signals.favorable.length;
  const unfavCount = signals.unfavorable.length;

  if (unfavCount > favCount && signals.conflict >= 3) {
    signals.structureType = 'blocked';
  } else if (signals.delay >= 3) {
    signals.structureType = 'repeated';
  } else if (chuZhuan && zhongZhuan && moZhuan && isReverseSequence(chuZhuan, zhongZhuan, moZhuan)) {
    signals.structureType = 'reversed';
  } else if (favCount > unfavCount && unfavCount <= 1) {
    signals.structureType = 'stable';
  } else if (favCount > 0 && unfavCount > 0) {
    signals.structureType = 'mixed';
  } else if (unfavCount > favCount) {
    signals.structureType = 'blocked';
  } else {
    signals.structureType = 'mixed';
  }

  return signals;
}

// ============================================================
// 3. 决策评分模块
// ============================================================

/**
 * 决策评分
 * @param {object} signals - 征象对象
 * @param {string} seriousnessLevel - 问题等级 L1/L2/L3
 * @param {string} precisionMode - 精度模式 precise/manual_city/fast
 * @param {string} [category] - 问题类别（用于升级判定）
 * @returns {object} 决策结果
 */
export function calculateDecision(signals, seriousnessLevel, precisionMode, category) {
  // 精度加成
  const precisionBonus = precisionMode === 'precise' ? 1 : precisionMode === 'fast' ? -1 : 0;

  // 边界惩罚（此处简化为0，实际由 getDecision 传入 date 计算）
  const boundaryPenalty = 0;

  // 总分计算
  const totalScore =
    signals.favorable.length * 2
    - signals.unfavorable.length * 2
    + signals.movement
    + signals.support
    - signals.caution
    - signals.delay
    - signals.conflict
    - signals.void_
    + precisionBonus
    - boundaryPenalty;

  // 方向判定
  let decisionBias;
  if (totalScore >= 4)       decisionBias = 'A';
  else if (totalScore >= 1)  decisionBias = 'lean_A';
  else if (totalScore >= -1) decisionBias = 'wait';
  else if (totalScore >= -4) decisionBias = 'lean_B';
  else                        decisionBias = 'B';

  // 置信度
  const confidenceLevel = clamp(
    50 + totalScore * 5 + (precisionMode === 'precise' ? 10 : 0),
    10,
    100
  );

  // 风险等级
  let riskLevel;
  const isConflictVoidLow = signals.conflict <= 1 && signals.void_ <= 1;
  if (seriousnessLevel === 'L1' && totalScore >= 1 && isConflictVoidLow) {
    riskLevel = 'low';
  } else if (
    (signals.favorable.length > 0 && signals.unfavorable.length > 0) ||
    seriousnessLevel === 'L2'
  ) {
    riskLevel = 'medium';
  } else if (
    seriousnessLevel === 'L3' &&
    (signals.caution >= 3 || signals.conflict >= 3 || signals.delay >= 3)
  ) {
    riskLevel = 'high';
  } else {
    riskLevel = 'medium';
  }

  // 动作模式
  let actionMode;
  if (decisionBias === 'A' && riskLevel === 'low') {
    actionMode = 'act_now';
  } else if (decisionBias === 'lean_A' && (riskLevel === 'medium' || riskLevel === 'high')) {
    actionMode = 'test_lightly';
  } else if (decisionBias === 'wait') {
    actionMode = 'wait_and_watch';
  } else if (decisionBias === 'lean_B' && riskLevel === 'medium') {
    actionMode = 'wait_and_watch'; // do_not_rush 映射
  } else if (decisionBias === 'B' && riskLevel === 'high') {
    actionMode = 'wait_and_watch'; // stop 映射
  } else if (decisionBias === 'A') {
    actionMode = 'act_now';
  } else if (decisionBias === 'lean_A') {
    actionMode = 'test_lightly';
  } else if (decisionBias === 'lean_B') {
    actionMode = 'wait_and_watch';
  } else {
    actionMode = 'wait_and_watch';
  }

  // 趋势模式
  let trendMode;
  if (signals.structureType === 'stable' && signals.favorable.length >= 3) {
    trendMode = 'smooth';
  } else if (signals.structureType === 'mixed' && signals.delay >= 1 && signals.delay <= 2) {
    trendMode = 'fluctuating';
  } else if (signals.structureType === 'blocked' || signals.void_ >= 3) {
    trendMode = 'blocked';
  } else if (signals.structureType === 'repeated' || signals.structureType === 'reversed') {
    trendMode = 'delayed';
  } else if (signals.structureType === 'stable') {
    trendMode = 'smooth';
  } else if (signals.delay >= 2) {
    trendMode = 'delayed';
  } else {
    trendMode = 'fluctuating';
  }

  // 升级触发
  let escalationRecommended = false;
  if (seriousnessLevel === 'L3') escalationRecommended = true;
  if (riskLevel === 'high') escalationRecommended = true;
  if (decisionBias === 'wait' && (category === 'relationship' || category === 'work')) {
    escalationRecommended = true;
  }
  if (trendMode === 'blocked' || trendMode === 'delayed') escalationRecommended = true;

  return {
    totalScore,
    decisionBias,
    confidenceLevel,
    riskLevel,
    actionMode,
    trendMode,
    escalationRecommended,
  };
}

// ============================================================
// 4. 模板翻译模块
// ============================================================

/**
 * 文案模板库
 */

const TEMPLATES = {
  // --- 吃什么模板（6大方向）---
  eat_today: {
    // 方向1-热的（A/lean_A可用）→ 3个具象子方向
    hot: {
      title: [
        '今天就吃汤面',
        '盖浇饭yyds',
        '必须吃火锅',
      ],
      reason: [
        '你现在需要的不是美食，是一碗热汤从喉咙暖到胃里的踏实感。',
        '今天脑子转不动，吃饭也别费脑子，一口饭一口菜最省心。',
        '最近烦心事太多，没有什么是一顿火锅解决不了的。',
      ],
      action: [
        '优先选：番茄鸡蛋面、豚骨拉面、重庆小面\n别碰：凉拌面、冷面',
        '优先选：鱼香肉丝饭、宫保鸡丁饭、番茄牛腩饭\n别碰：需要自己拌的拌饭',
        '优先选：单人小火锅、砂锅米线、麻辣烫\n别碰：需要等很久的大桌火锅',
      ],
      trend: '越纠结越饿，赶紧下单',
      risk: '',
      cta: '',
    },
    // 方向2-清爽的（A/lean_A可用）
    light: {
      title: [
        '今天吃沙拉',
        '凉皮安排上',
        '轻食日',
      ],
      reason: [
        '你最近吃太油了，肠胃已经在喊救命了。',
        '今天天气有点闷，吃点凉的才舒服。',
        '宇宙说，今天是给身体减负的好日子。',
      ],
      action: [
        '优先选：鸡胸肉沙拉、牛油果沙拉、蔬菜沙拉\n别碰：加了沙拉酱的凯撒沙拉',
        '优先选：麻酱凉皮、鸡丝凉面、朝鲜冷面\n别碰：太辣的油泼面',
        '优先选：三明治、寿司、蔬菜卷\n别碰：油炸的炸鸡汉堡',
      ],
      trend: '清爽一餐，心情都会变好',
      risk: '',
      cta: '',
    },
    // 方向3-碳水型（A/lean_A可用）
    carb: {
      title: [
        '碳水才是王道',
        '一碗面管饱',
        '吃饺子啦',
      ],
      reason: [
        '今天能量消耗太大，不吃米饭会饿到下午。',
        '干饭人，干饭魂，今天就想吃面条。',
        '不知道吃什么的时候，吃饺子永远不会错。',
      ],
      action: [
        '优先选：白米饭、蛋炒饭、酱油炒饭\n别碰：杂粮饭（今天不配）',
        '优先选：牛肉面、炸酱面、担担面\n别碰：分量小的阳春面',
        '优先选：猪肉白菜饺、三鲜馄饨、韭菜鸡蛋饺\n别碰：速冻饺子（能现包最好）',
      ],
      trend: '碳水给快乐，今天值得吃饱',
      risk: '',
      cta: '',
    },
    // 方向4-满足感型（A/lean_A可用）
    satisfy: {
      title: [
        '今天吃烤肉',
        '炸鸡快乐',
        '小龙虾自由',
      ],
      reason: [
        '你辛苦了这么久，值得一顿滋滋冒油的烤肉。',
        '宇宙批准你今天放纵一次，想吃炸鸡就吃。',
        '夏天到了，怎么能不吃小龙虾呢？',
      ],
      action: [
        '优先选：韩式烤肉、烤串、烤五花肉\n别碰：需要自己烤很久的自助烤肉',
        '优先选：原味炸鸡、蜂蜜芥末炸鸡、韩式炸鸡\n别碰：减脂期的空气炸锅炸鸡',
        '优先选：十三香小龙虾、蒜蓉小龙虾、清蒸小龙虾\n别碰：不新鲜的冷冻小龙虾',
      ],
      trend: '今天值得被好好犒劳',
      risk: '',
      cta: '',
    },
    // 方向5-轻负担型（wait/lean_B/B可用）
    light_burden: {
      title: [
        '今天喝粥',
        '蒸菜最健康',
        '喝汤就够了',
      ],
      reason: [
        '最近肠胃不舒服，喝点粥养养胃。',
        '少油少盐，吃完整个人都清爽了。',
        '今天没什么胃口，喝点汤垫垫肚子就行。',
      ],
      action: [
        '优先选：小米粥、南瓜粥、皮蛋瘦肉粥\n别碰：加了太多料的海鲜粥',
        '优先选：清蒸鱼、蒸蛋、蒸排骨\n别碰：红烧、油炸的菜',
        '优先选：冬瓜汤、番茄鸡蛋汤、菌菇汤\n别碰：太油腻的骨头汤',
      ],
      trend: '少吃一口，明天不后悔',
      risk: '',
      cta: '',
    },
    // 方向6-饮品/小食型（wait/lean_B/B可用）
    snack: {
      title: [
        '今天喝奶茶',
        '咖啡续命',
        '下午茶时间',
      ],
      reason: [
        '快乐水余额不足，再不充值就要emo了。',
        '你的脑子已经转不动了，需要咖啡因紧急救援。',
        '下午三点，是时候摸鱼吃点东西了。',
      ],
      action: [
        '优先选：珍珠奶茶、芋泥奶茶、杨枝甘露\n别碰：无糖奶茶（没有灵魂）',
        '优先选：冰美式、拿铁、卡布奇诺\n别碰：加了太多糖浆的花式咖啡',
        '优先选：蛋糕、饼干、蛋挞\n别碰：太甜的马卡龙',
      ],
      trend: '小确幸也是确幸',
      risk: '',
      cta: '',
    },
  },

  // --- 穿什么模板（3风格）---
  wear_today: {
    // 风格1-温柔风（A/lean_A）→ 3个幸运色
    gentle: {
      title: [
        '今天穿粉色',
        '穿米白色',
        '穿浅蓝色',
      ],
      reason: [
        '粉色是今天的幸运色，会给你带来桃花运和好人缘。',
        '米白色自带温柔滤镜，今天的你会特别有亲和力。',
        '浅蓝色像天空一样干净，会让你今天心情特别好。',
      ],
      action: [
        '上装：粉色针织衫\n下装：白色半身裙\n配饰：珍珠项链、白色帆布鞋',
        '上装：米白色衬衫\n下装：卡其色阔腿裤\n配饰：米色贝雷帽、棕色皮鞋',
        '上装：浅蓝色牛仔衬衫\n下装：白色牛仔裤\n配饰：银色手链、小白鞋',
      ],
      trend: '温柔的人今天运气不会差',
      risk: '',
      cta: '',
    },
    // 风格2-酷飒干练（A/lean_A）→ 3个幸运色
    cool: {
      title: [
        '今天穿黑色',
        '穿白色',
        '穿灰色',
      ],
      reason: [
        '黑色是今天的幸运色，会给你带来强大的气场和自信。',
        '白色自带高级感，今天的你走路都会带风。',
        '灰色低调又有质感，适合今天重要的场合。',
      ],
      action: [
        '上装：黑色皮衣\n下装：黑色牛仔裤\n配饰：银色项链、马丁靴',
        '上装：白色T恤\n下装：黑色西装裤\n配饰：黑色棒球帽、小白鞋',
        '上装：灰色西装\n下装：黑色半身裙\n配饰：黑色高跟鞋、简约手表',
      ],
      trend: '今天适合做主角',
      risk: '',
      cta: '',
    },
    // 风格3-休闲舒适（wait/lean_B/B）→ 3个幸运色
    casual: {
      title: [
        '今天穿黄色',
        '穿绿色',
        '穿紫色',
      ],
      reason: [
        '黄色是今天的幸运色，会给你带来好心情和财运。',
        '绿色代表生机和活力，今天的你会特别有精神。',
        '紫色神秘又浪漫，今天会有意外的惊喜等着你。',
      ],
      action: [
        '上装：黄色卫衣\n下装：蓝色牛仔裤\n配饰：白色棒球帽、帆布鞋',
        '上装：绿色T恤\n下装：黑色运动裤\n配饰：绿色发带、运动鞋',
        '上装：紫色连帽衫\n下装：灰色运动裤\n配饰：紫色袜子、老爹鞋',
      ],
      trend: '舒服才是今天的主题',
      risk: '',
      cta: '',
    },
  },

  // --- 喝什么模板（4大方向）---
  drink_today: {
    // 方向1-咖啡续命（A/lean_A可用）→ 3个具象子方向
    coffee: {
      title: [
        '今天必须喝冰美式',
        '来杯拿铁',
      ],
      reason: [
        '你的脑子已经卡成 PPT 了，只有冰美式能重启。',
        '今天有点累，需要温柔一点的咖啡因。',
      ],
      action: [
        '点大杯冰美式，不加糖不加奶，一口下去灵魂归位。\n别碰：生椰拿铁（越喝越困）',
        '热拿铁，少糖，奶泡厚一点，喝完整个人都软下来了。\n别碰：美式（太苦了会心情不好）',
      ],
      trend: '咖啡因归位，效率翻倍',
      risk: '',
      cta: '',
    },
    // 方向2-奶茶快乐（A/lean_A可用）→ 2个具象子方向
    milk_tea: {
      title: [
        '今天喝珍珠奶茶',
        '芋泥脑袋集合',
      ],
      reason: [
        '快乐水余额为 0，再不充值就要原地 emo。',
        '宇宙都知道你想念芋泥的绵密了。',
      ],
      action: [
        '全糖加冰加珍珠，少冰也可以，但绝对不能无糖。\n别碰：三分糖（没有灵魂）',
        '芋泥啵啵奶茶，加芋泥加啵啵，喝前摇一摇。\n别碰：任何没有芋泥的奶茶',
      ],
      trend: '快乐水充值成功',
      risk: '',
      cta: '',
    },
    // 方向3-养生局（wait/lean_B/B可用）→ 2个具象子方向
    wellness: {
      title: [
        '今天喝热姜茶',
        '泡杯红枣茶',
      ],
      reason: [
        '你的手脚冰凉，身体在喊救命了。',
        '最近熬夜太多，该补补气血了。',
      ],
      action: [
        '红糖姜茶，趁热喝，喝完捂捂手，寒气全跑光。\n别碰：冰饮（喝了会肚子疼）',
        '红枣枸杞茶，加两颗桂圆，温水冲泡，喝一天。\n别碰：浓茶（会失眠）',
      ],
      trend: '养生从今天开始',
      risk: '',
      cta: '',
    },
    // 方向4-清爽解腻（wait/lean_B/B可用）→ 2个具象子方向
    refresh: {
      title: [
        '今天喝柠檬茶',
        '来杯气泡水',
      ],
      reason: [
        '昨天吃太油了，嘴里发苦，需要点酸的。',
        '下午三点，是时候摸鱼打个嗝了。',
      ],
      action: [
        '手打柠檬茶，少糖，加冰，解腻又开胃。\n别碰：太甜的果茶',
        '青柠味气泡水，冰的，打开的时候"呲"一声，烦恼全消。\n别碰：可乐（越喝越渴）',
      ],
      trend: '清爽一下，满血复活',
      risk: '',
      cta: '',
    },
  },

  // --- 喝什么毒舌版 ---
  drink_today_sarcastic: {
    coffee: {
      title: ['赶紧喝咖啡，别装了'],
      reason: ['你现在的状态，不喝咖啡跟行尸走肉没区别。'],
      action: ['冰美式，大杯，不加糖。别点那些花里胡哨的，你没那么精致。\n别碰：生椰拿铁（糖分爆表）'],
      trend: '咖啡因是你最后的尊严',
      risk: '',
      cta: '',
    },
    milk_tea: {
      title: ['喝吧，反正你也瘦不下来'],
      reason: ['你不喝奶茶，你今天一天都不会开心。'],
      action: ['全糖加冰加珍珠，别整那些三分糖的。\n三分糖的奶茶跟白开水有什么区别？'],
      trend: '快乐水入魂，烦恼全消',
      risk: '',
      cta: '',
    },
    wellness: {
      title: ['喝点热的吧，你身体在抗议了'],
      reason: ['看看你的黑眼圈，再不养生就要进ICU了。'],
      action: ['红枣姜茶，别加糖。你需要的不是好喝，是续命。\n别碰：冰饮（你是嫌自己命太长吗）'],
      trend: '再不养生就晚了',
      risk: '',
      cta: '',
    },
    refresh: {
      title: ['喝点柠檬水去去油腻'],
      reason: ['昨天吃了什么你自己心里没数吗？'],
      action: ['手打柠檬茶，少糖。你身上的油腻感已经溢出屏幕了。\n别碰：全糖果茶（越喝越渴）'],
      trend: '清爽一下，别油腻了',
      risk: '',
      cta: '',
    },
  },

  // --- 通用轻题模板（L1/L2 非吃穿）---
  generic_light: {
    A: {
      title: [
        '可以，就这么办',
        '宇宙盖章，冲吧',
        '别纠结了，去做',
      ],
      reason: [
        '你现在更需要顺一点的选择，A更贴你现在的状态。',
        '拖着不会更好，只会更烦。',
        '宇宙已经帮你算了三遍，都是A。',
      ],
      action: [
        '就按这个走，先把决定做掉。',
        '别继续纠结了，先做再说。',
        '去做别的事，别在这个问题上浪费时间。',
      ],
      trend: '越纠结越浪费时间，赶紧的',
      risk: '',
      cta: '',
    },
    wait: {
      title: [
        '这题先放放，宇宙还没想好',
        '现在选容易后悔，晚点再说',
        '宇宙建议你先喝口水',
      ],
      reason: [
        '你现在不是没答案，是心还没定。',
        '今天容易冲动，做出的决定大概率会后悔。',
        '宇宙说，这个问题需要再发酵一下。',
      ],
      action: [
        '先放一会儿，晚点再看。',
        '别被一时情绪推着选。',
        '去干点别的，答案自己会冒出来。',
      ],
      trend: '过一会儿再看，答案会更清晰',
      risk: '',
      cta: '',
    },
    B: {
      title: [
        '听劝，别冲动',
        '再想想，不急',
        '宇宙建议你冷静',
      ],
      reason: [
        '现在不是最好的时机，再等等。',
        '宇宙算过了，保守一点更稳妥。',
        '你心里其实已经有答案了，只是不敢承认。',
      ],
      action: [
        '先稳住，别冒险。',
        '放一放，过会儿再决定。',
        '现在不动，也是一种选择。',
      ],
      trend: '今天适合求稳，别折腾',
      risk: '',
      cta: '',
    },
  },

  // --- 通用轻题按分类细分 ---
  generic_relationship: {
    A: {
      title: ['去！宇宙帮你约好了', '冲，今天桃花运旺', '别犹豫了，对方也在等你'],
      reason: ['宇宙算过了，今天适合主动出击。', '星象显示今天社交能量满格。', '你犹豫的这段时间，对方可能也在纠结。'],
      action: ['发个消息试探一下，别想太多。', '约个轻松的场景，咖啡或散步都行。', '把自己收拾好看点，信心很重要。'],
      trend: '今天社交能量满格，适合主动',
      risk: '', cta: '',
    },
    wait: {
      title: ['这题先放放，缘分急不来', '现在不是最好的时机', '宇宙说，再等等'],
      reason: ['今天气场不太对，容易尴尬。', '你现在的状态不适合见面，先调整自己。', '有些事急不来，缘分到了自然水到渠成。'],
      action: ['先专注自己，把自己状态调整好。', '不急，等一个更自然的契机。', '先在线上保持联系，别断了。'],
      trend: '缘分这件事，急不来',
      risk: '', cta: '',
    },
    B: {
      title: ['算了吧，今天不适合', '别去了，会后悔', '宇宙建议你宅着'],
      reason: ['今天社交能量偏低，容易冷场。', '宇宙算过了，今天出门约会大概率翻车。', '你心里其实知道答案，只是不想承认。'],
      action: ['在家追剧也挺好的，别勉强。', '把时间花在让自己开心的事上。', '改天吧，今天不是对的日子。'],
      trend: '今天适合独处，别勉强社交',
      risk: '', cta: '',
    },
  },
  generic_fitness: {
    A: {
      title: ['动起来！宇宙给你充好电了', '今天适合流汗', '去健身，别偷懒'],
      reason: ['今天体能状态不错，不运动会浪费。', '宇宙算过了，运动后你会心情大好。', '你最近坐太久了，身体需要动一动。'],
      action: ['先来个15分钟热身，别直接上大重量。', '跑步或快走30分钟，出点汗就行。', '带上耳机，选个燃向歌单。'],
      trend: '今天运动能量满格',
      risk: '', cta: '',
    },
    wait: {
      title: ['今天可以适度活动', '别太猛，悠着点', '宇宙建议轻度运动'],
      reason: ['今天身体状态一般，别勉强高强度。', '适度运动可以，但别把自己累趴。', '宇宙说，散步也算运动。'],
      action: ['散步20分钟就够了，别逞强。', '做点拉伸或瑜伽，放松一下。', '如果实在不想动，休息也是一种选择。'],
      trend: '适度就好，别逞强',
      risk: '', cta: '',
    },
    B: {
      title: ['今天休息吧，别硬撑', '宇宙批准你偷懒一天', '身体比运动更重要'],
      reason: ['你最近运动量够了，身体需要恢复。', '今天肌肉状态不佳，强行运动容易受伤。', '休息也是训练的一部分，别有负罪感。'],
      action: ['泡个热水澡，早点睡觉。', '做点轻度拉伸，帮助恢复。', '今天吃好点，给身体补充能量。'],
      trend: '休息是为了更好地出发',
      risk: '', cta: '',
    },
  },
  generic_study: {
    A: {
      title: ['学！宇宙给你开了绿灯', '今天脑子特别好使', '别玩了，去学习'],
      reason: ['今天专注力不错，适合学习新东西。', '宇宙算过了，今天学习效率是平时的两倍。', '你拖延的够久了，再不学就真来不及了。'],
      action: ['先学25分钟，用番茄钟法。', '把手机放远一点，真的。', '从最简单的部分开始，进入状态再说。'],
      trend: '今天学习效率翻倍',
      risk: '', cta: '',
    },
    wait: {
      title: ['先别急，调整好状态再学', '今天可以学，但别太拼', '宇宙建议劳逸结合'],
      reason: ['你现在的状态硬学效率不高。', '先放松一下，等脑子清醒了再开始。', '今天适合复习旧知识，不太适合学新东西。'],
      action: ['先看15分钟，如果进入状态就继续。', '复习之前学过的内容，巩固一下。', '学累了就休息，别硬撑。'],
      trend: '劳逸结合，效率更高',
      risk: '', cta: '',
    },
    B: {
      title: ['今天别学了，学了也白学', '宇宙批准你摆烂', '放下书本，去玩吧'],
      reason: ['你现在的脑子根本装不进去东西。', '今天不是学习的好日子，别浪费时间了。', '你已经很累了，再逼自己只会适得其反。'],
      action: ['出去走走，换个环境。', '看个电影或打把游戏，放松一下。', '早点睡觉，明天精神好了再学。'],
      trend: '今天适合摆烂，别有负罪感',
      risk: '', cta: '',
    },
  },
  generic_diet: {
    A: {
      title: ['吃！宇宙说今天不减肥', '人生苦短，先吃饱', '今天适合犒劳自己'],
      reason: ['你最近吃太少了，身体需要能量。', '宇宙算过了，今天吃不会胖。', '偶尔放纵一下，心情好比什么都重要。'],
      action: ['想吃什么就吃什么，别有负罪感。', '叫上朋友一起吃，快乐加倍。', '吃完散个步，就当没吃。'],
      trend: '今天适合享受美食',
      risk: '', cta: '',
    },
    wait: {
      title: ['可以吃，但别太放飞', '宇宙建议适可而止', '吃七分饱就好'],
      reason: ['可以吃，但注意量。', '今天消化系统一般，别吃太油腻。', '宇宙说，控制一下份量。'],
      action: ['想吃可以，但别点太多。', '选清淡一点的，别太刺激。', '吃完记得喝杯温水。'],
      trend: '适度享受，别过头',
      risk: '', cta: '',
    },
    B: {
      title: ['忍住！宇宙在看着你', '别吃了，你昨天才说要减肥', '放下那个外卖APP'],
      reason: ['你昨天才发誓要减肥，今天就忘了？', '宇宙算过了，今天吃一定会后悔。', '你最近体重趋势不太妙，控制一下。'],
      action: ['喝杯水，有时候渴了会误以为是饿。', '吃点水果或坚果，比零食健康。', '想想你减肥的目标，忍住就是胜利。'],
      trend: '管住嘴，迈开腿',
      risk: '', cta: '',
    },
  },

  // --- 重题模板（L3, oracle 语气）---
  oracle: {
    A_high: {
      title: [
        '方向没错，可以动',
        '这步可以走，但别走太急',
        '宇宙亮了绿灯，但黄灯也亮着',
      ],
      reason: [
        '你真正纠结的不是要不要做，而是怕做了以后收不回来。',
        '现在不是不能动，是不能一下走太满。',
        '宇宙说大方向没问题，但细节要注意。',
      ],
      risk: [
        '这题更怕仓促，不怕慢半步。',
        '风险不在第一步，在后续承接。',
        '别急着摊牌，先看看对方的反应。',
      ],
      action: [
        '先试探，不要一次性压满。',
        '先做低成本动作，再看反馈。',
        '小步走，别跑步。',
      ],
      trend: [
        '短期还会拉扯，但不是完全不能推进。',
        '这件事适合先动一点，不适合立刻定局。',
        '慢慢来，比较快。',
      ],
      cta: [
        '先发给你信任的人看看',
        '想认真看，再进入完整推演',
      ],
    },
    A_normal: {
      title: [
        '方向没错，可以动',
        '宇宙亮了绿灯',
        '这步可以走',
      ],
      reason: [
        '宇宙说，现在是个不错的时机。',
        '各方面条件都差不多齐了，可以推进。',
        '你等的信号已经到了。',
      ],
      risk: [
        '注意节奏，别太急。',
        '大方向没问题，细节别忽略。',
      ],
      action: [
        '可以开始了，别再等了。',
        '先迈出第一步，后面的路会清晰。',
        '宇宙催你动起来了。',
      ],
      trend: [
        '现在是推进的好时机。',
        '越早行动，越早看到结果。',
        '趁热打铁，效果最好。',
      ],
      cta: [
        '想认真看，再进入完整推演',
      ],
    },
    wait: {
      title: [
        '这题现在别硬推',
        '宇宙建议你先按兵不动',
        '信号不明，等一等更安全',
      ],
      reason: [
        '你眼下看到的是决定本身，没看到后面的代价。',
        '现在更像不稳，不像水到渠成。',
        '宇宙说，时候未到。',
      ],
      risk: [
        '真正要防的不是慢，是误判。',
        '现在强推进，后面补救成本更高。',
        '别因为焦虑就仓促做决定。',
      ],
      action: [
        '先停半步，整理条件再决定。',
        '不要为了结束焦虑而仓促做结论。',
        '等一等，信号会来。',
      ],
      trend: [
        '短期仍有反复。',
        '这题值得换到更深层去看。',
        '不急，好事多磨。',
      ],
      cta: [
        '先发给你信任的人看看',
        '想认真看，再进入完整推演',
      ],
    },
    B: {
      title: [
        '这步先别走',
        '宇宙亮了红灯',
        '现在不是时候，先收着',
      ],
      reason: [
        '现在不是时候。',
        '你还没看到全部信息。',
        '宇宙说，再等等。',
      ],
      risk: [
        '贸然行动的代价可能超出预期。',
        '这题最怕的不是不做，是做错了。',
        '现在出手大概率要后悔。',
      ],
      action: [
        '先不动，等信号更明确。',
        '把精力放在准备上，而不是行动上。',
        '忍住，别冲动。',
      ],
      trend: [
        '短期内不适合强行推进。',
        '等一等，信号会来。',
        '按兵不动，就是最好的行动。',
      ],
      cta: [
        '先发给你信任的人看看',
        '想认真看，再进入完整推演',
      ],
    },
  },

  // --- 洗头模板（温柔版，3方向）---
  wash_hair: {
    must_wash: {
      title: ['今天必须洗头'],
      reason: ['明天要见重要的人，或者要出门约会，头发油了会影响形象。'],
      action: ['洗个头，吹个造型，喷点香水，今天你就是最靓的仔。\n别偷懒，油头真的很减分。'],
      trend: '洗完头，整个人都清爽了',
      risk: '',
      cta: '',
    },
    skip_wash: {
      title: ['可以不洗头'],
      reason: ['今天不出门，或者只下楼买个菜，没人会看你。'],
      action: ['戴个帽子就行，省下来的时间多睡半小时。\n明天再洗也不迟。'],
      trend: '不洗头是对周末最基本的尊重',
      risk: '',
      cta: '',
    },
    tomorrow: {
      title: ['明天再洗'],
      reason: ['今天太累了，不想动，而且头发还能再撑一天。'],
      action: ['扎个马尾，或者戴个发箍，凑合一下。\n明天早上起来再洗。'],
      trend: '洗头？明天的事明天再说',
      risk: '',
      cta: '',
    },
  },

  // --- 洗头模板（毒舌版，2方向）---
  wash_hair_sarcastic: {
    must_wash: {
      title: ['赶紧洗头，油死了'],
      reason: ['你头发油得都能炒菜了，自己闻不到吗？'],
      action: ['赶紧去洗，不然没人愿意跟你坐一起。\n别找借口说 "今天不出门"。'],
      trend: '油头退散！',
      risk: '',
      cta: '',
    },
    skip_wash: {
      title: ['别洗了，浪费水'],
      reason: ['反正你明天也不出门，洗了也是白洗。'],
      action: ['戴个帽子遮一下，没人会发现的。\n省下来的水费买杯奶茶不好吗？'],
      trend: '不洗头，从我做起',
      risk: '',
      cta: '',
    },
  },

  // --- 早睡模板（温柔版，3方向）---
  sleep_early: {
    sleep_now: {
      title: ['今天早点睡'],
      reason: ['最近熬夜太多了，黑眼圈都快掉到下巴了。'],
      action: ['放下手机，闭上眼睛，11 点之前睡着，明天会精神很多。\n别刷抖音了，越刷越精神。'],
      trend: '早睡早起，身体好',
      risk: '',
      cta: '',
    },
    sleep_late: {
      title: ['可以晚点睡'],
      reason: ['今天周末，明天不用上班，偶尔熬一次夜没关系。'],
      action: ['追追剧，玩玩游戏，放松一下。\n别熬到凌晨三点，不然明天会头疼。'],
      trend: '周末不熬夜，人生没意义',
      risk: '',
      cta: '',
    },
    dont_stay: {
      title: ['别熬夜了'],
      reason: ['再熬夜，头发就要掉光了，而且皮肤会变差。'],
      action: ['喝杯热牛奶，听听轻音乐，早点睡觉。\n熬夜真的会变丑。'],
      trend: '熬夜一时爽，一直熬夜一直爽？才怪',
      risk: '',
      cta: '',
    },
  },

  // --- 早睡模板（毒舌版，2方向）---
  sleep_early_sarcastic: {
    sleep_now: {
      title: ['赶紧睡觉，别熬了'],
      reason: ['再熬下去，你就要猝死了。'],
      action: ['放下手机，立刻马上睡觉，别找任何借口。\n你的身体已经在抗议了。'],
      trend: '熬夜猝死了解一下',
      risk: '',
      cta: '',
    },
    sleep_late: {
      title: ['熬吧，反正你也睡不着'],
      reason: ['你每天都喊着要早睡，结果每次都熬到凌晨两点。'],
      action: ['继续刷抖音吧，反正你也睡不着。\n明天顶着黑眼圈去上班。'],
      trend: '早睡是不可能早睡的',
      risk: '',
      cta: '',
    },
  },

  // --- 出门模板（温柔版，4方向）---
  go_out: {
    must_go: {
      title: ['今天一定要出门'],
      reason: ['你已经宅太久了，再宅下去要发霉了。'],
      action: ['去楼下走一走，晒晒太阳，心情会变好。'],
      trend: '出去转转，运气会变好',
      risk: '',
      cta: '',
    },
    can_go: {
      title: ['今天适合出门逛逛'],
      reason: ['今天的天气很好，不出门可惜了。'],
      action: ['约上朋友去逛逛街，或者去公园散散步。'],
      trend: '出门走走，灵感都来了',
      risk: '',
      cta: '',
    },
    stay_home: {
      title: ['今天别出门了'],
      reason: ['外面没有帅哥美女，只有冷风和堵车。'],
      action: ['宅在家里追剧吃零食，比出门舒服多了。'],
      trend: '宅家才是正经事',
      risk: '',
      cta: '',
    },
    go_later: {
      title: ['晚点再出门'],
      reason: ['现在外面人太多了，晚点去人少。'],
      action: ['先在家躺一会儿，等太阳落山了再出去。'],
      trend: '错峰出行，体验更好',
      risk: '',
      cta: '',
    },
  },

  // --- 出门毒舌版 ---
  go_out_sarcastic: {
    must_go: {
      title: ['赶紧出门，你快长蘑菇了'],
      reason: ['你已经在家躺了多久了？沙发都快被你压出人形了。'],
      action: ['换身衣服，出门走走。别穿睡衣，求你了。\n你就算去便利店也行，至少见见太阳。'],
      trend: '再不出门就要和沙发融为一体了',
      risk: '',
      cta: '',
    },
    can_go: {
      title: ['出去转转吧，别宅了'],
      reason: ['你的朋友圈已经三天没有动态了，朋友们以为你失踪了。'],
      action: ['约个人出去喝杯东西，别一个人待着发霉。\n实在没人约，自己去逛超市也行。'],
      trend: '出门呼吸一下新鲜空气吧',
      risk: '',
      cta: '',
    },
    stay_home: {
      title: ['别出门了，外面不欢迎你'],
      reason: ['外面又热又挤，你出去干嘛？当人形路障吗？'],
      action: ['在家躺着不好吗？空调、WiFi、零食，人生三大件。\n出门又要花钱，你确定你钱包扛得住？'],
      trend: '宅家保平安，出门必花钱',
      risk: '',
      cta: '',
    },
    go_later: {
      title: ['晚点再出去，现在出门是找罪受'],
      reason: ['现在外面人山人海，你出去就是给别人添堵。'],
      action: ['等太阳落山再出去，那时候人少，温度也舒服。\n先在家躺平，养精蓄锐。'],
      trend: '错峰出行是智慧',
      risk: '',
      cta: '',
    },
  },

  // --- 发消息模板（温柔版，4方向）---
  send_msg: {
    send_now: {
      title: ['发！现在就发'],
      reason: ['发了可能后悔一分钟，不发后悔一辈子。'],
      action: ['别改了，直接发，想太多没用。'],
      trend: '勇敢一点，结果不会差',
      risk: '',
      cta: '',
    },
    dont_send: {
      title: ['别发，会后悔'],
      reason: ['你现在只是一时冲动，发了明天会想撤回。'],
      action: ['先存草稿，明天早上再看，你会感谢自己。'],
      trend: '冷静一下，明天再说',
      risk: '',
      cta: '',
    },
    wait_hour: {
      title: ['再等一小时'],
      reason: ['现在情绪太激动，说出来的话会伤人。'],
      action: ['冷静一下，想清楚你真正想说什么。'],
      trend: '等一等，不差这一小时',
      risk: '',
      cta: '',
    },
    call_instead: {
      title: ['别发文字，打电话'],
      reason: ['文字容易产生误会，打电话说更清楚。'],
      action: ['语气放温柔一点，好好沟通。'],
      trend: '打电话比发消息强一百倍',
      risk: '',
      cta: '',
    },
  },

  // --- 发消息毒舌版 ---
  send_msg_sarcastic: {
    send_now: {
      title: ['发！别怂了'],
      reason: ['你打了删、删了打，折腾了半小时了，有这时间都能聊十轮了。'],
      action: ['直接发，别改了。你改了第18遍的内容跟第1遍没什么区别。\n发完把手机放下，别盯着屏幕等回复。'],
      trend: '再不发对方以为你死了',
      risk: '',
      cta: '',
    },
    dont_send: {
      title: ['别发！你现在的状态发出去就是灾难'],
      reason: ['你现在情绪上头，发出去的话明天早上起来会想换个星球生活。'],
      action: ['把手机放下，去喝杯水，数到100再决定。\n如果数到100还想发，那你自求多福。'],
      trend: '忍住，你明天会感谢现在的自己',
      risk: '',
      cta: '',
    },
    wait_hour: {
      title: ['先冷静一小时，你现在的脑子不清醒'],
      reason: ['你现在说的话，有一半是情绪，另一半是废话。'],
      action: ['把手机锁屏，去洗个脸。一小时后如果还想发，再发。\n相信我，一小时后你大概率不想发了。'],
      trend: '时间是最好的过滤器',
      risk: '',
      cta: '',
    },
    call_instead: {
      title: ['别发消息了，打电话吧'],
      reason: ['你打了500字的小作文，对方只会回一个"嗯"。'],
      action: ['直接打电话，三分钟说完比打字一小时效率高。\n而且打电话的时候你至少不会过度斟酌每一个标点符号。'],
      trend: '电话沟通，拒绝内耗',
      risk: '',
      cta: '',
    },
  },

  // --- 买不买模板（温柔版，4方向）---
  buy_it: {
    buy_now: {
      title: ['买！喜欢就买'],
      reason: ['赚钱就是为了花的，开心最重要。'],
      action: ['只要不是太贵，买了能让你开心很久，就值。'],
      trend: '买了开心，不买后悔',
      risk: '',
      cta: '',
    },
    dont_buy: {
      title: ['别买，你不需要'],
      reason: ['你只是一时新鲜，买了也不会用三次。'],
      action: ['先加入购物车，一周后还想买再买。'],
      trend: '冷静消费，钱包不疼',
      risk: '',
      cta: '',
    },
    buy_cheap: {
      title: ['可以买，但别买贵的'],
      reason: ['这个东西确实有用，但没必要买顶配。'],
      action: ['买基础款就够了，功能都一样。'],
      trend: '性价比才是真理',
      risk: '',
      cta: '',
    },
    wait_sale: {
      title: ['再等等，会降价'],
      reason: ['马上就要大促了，现在买亏了。'],
      action: ['先收藏，等打折的时候再入手。'],
      trend: '等等党永远不亏',
      risk: '',
      cta: '',
    },
  },

  // --- 买不买模板（毒舌版，2方向）---
  buy_it_sarcastic: {
    buy_now: {
      title: ['买吧，反正你也存不住钱'],
      reason: ['不买这个，你也会买别的没用的东西。'],
      action: ['记得用优惠券，能省一块是一块。'],
      trend: '你的钱包：我又没了',
      risk: '',
      cta: '',
    },
    dont_buy: {
      title: ['别买，你配不上'],
      reason: ['这个东西很好，但你用不出它的价值。'],
      action: ['把钱留着吃饭吧，别瞎造。'],
      trend: '放过你的钱包吧',
      risk: '',
      cta: '',
    },
  },

  // --- 吃什么模板（毒舌版，3方向）---
  eat_today_sarcastic: {
    hot: {
      title: ['赶紧吃热的'],
      reason: ['再刷外卖，饭点都过了，你要饿到下午吗？'],
      action: ['随便点个面就行，别挑了，你没那么讲究。'],
      trend: '再不点外卖，外卖小哥都下班了',
      risk: '',
      cta: '',
    },
    light: {
      title: ['吃点素的吧'],
      reason: ['看看你的肚子，再吃油的要穿不下裤子了。'],
      action: ['沙拉就行，别加沙拉酱，那玩意比肉还胖。'],
      trend: '该减肥了朋友',
      risk: '',
      cta: '',
    },
    satisfy: {
      title: ['行吧，允许你吃顿好的'],
      reason: ['反正你减肥也减不下来，不如吃开心点。'],
      action: ['别点太多，吃不完浪费钱。'],
      trend: '吃了这顿再减肥',
      risk: '',
      cta: '',
    },
  },

  // --- 穿什么模板（毒舌版，3方向）---
  wear_today_sarcastic: {
    gentle: {
      title: ['穿温柔点'],
      reason: ['不然没人会发现你其实是个好人。'],
      action: ['别穿你那件起球的毛衣了，太掉价。'],
      trend: '人靠衣装，别靠幻想',
      risk: '',
      cta: '',
    },
    cool: {
      title: ['穿酷一点'],
      reason: ['不然别人以为你好欺负。'],
      action: ['别穿拖鞋出门，显得你很邋遢。'],
      trend: '酷一点，世界对你温柔一点',
      risk: '',
      cta: '',
    },
    casual: {
      title: ['随便穿穿就行'],
      reason: ['反正也没人看你。'],
      action: ['穿你最脏的那件衣服，脏了直接扔。'],
      trend: '舒服最重要，形象不重要',
      risk: '',
      cta: '',
    },
  },
};

/**
 * 获取时间段桶（用于文案变体）
 * @param {Date} date
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
function getTimeBucket(date) {
  const h = date.getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'afternoon';
  if (h >= 14 && h < 18) return 'evening';
  return 'night';
}

/**
 * 模板翻译 - 将决策结果翻译为展示文案
 * @param {object} decision - 决策结果（来自 calculateDecision）
 * @param {string} question - 问题文本
 * @param {string} category - 类别
 * @param {string} seriousnessLevel - 等级
 * @param {string} toneMode - 语气模式
 * @param {string} [templateId] - 模板ID
 * @param {Date} [date] - 当前时间
 * @param {string} [forceTone] - 强制语气 'sarcastic'|undefined
 * @returns {object} 展示文案
 */
export function translateToDisplay(decision, question, category, seriousnessLevel, toneMode, templateId, date, forceTone) {
  try {
  const { decisionBias, riskLevel, escalationRecommended } = decision;
  const now = date || new Date();

  let resultTitle = '';
  let resultReason = '';
  let resultRisk = '';
  let resultAction = '';
  let resultTrend = '';
  let resultCta = '';

  // === 吃什么模板（6大方向）===
  if (templateId === 'eat_today') {
    // 毒舌模式：尝试使用毒舌模板
    let effectiveTemplateId = 'eat_today';
    let effectiveTpl = TEMPLATES.eat_today;
    if (forceTone === 'sarcastic' && TEMPLATES.eat_today_sarcastic) {
      effectiveTemplateId = 'eat_today_sarcastic';
      effectiveTpl = TEMPLATES.eat_today_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      // A/lean_A 随机选方向1-4（温柔版）或对应毒舌方向
      if (effectiveTemplateId === 'eat_today_sarcastic') {
        directionKeys = ['hot', 'light', 'satisfy'];
      } else {
        directionKeys = ['hot', 'light', 'carb', 'satisfy'];
      }
    } else {
      // wait/lean_B/B 随机选方向5-6（温柔版）或对应毒舌方向
      if (effectiveTemplateId === 'eat_today_sarcastic') {
        directionKeys = ['light', 'satisfy'];
      } else {
        directionKeys = ['light_burden', 'snack'];
      }
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    // 毒舌版找不到方向时降级到温柔版
    if (!tpl) {
      const fallbackKeys = decisionBias === 'A' || decisionBias === 'lean_A'
        ? ['hot', 'light', 'carb', 'satisfy']
        : ['light_burden', 'snack'];
      const fallbackKey = pick(fallbackKeys);
      const fallbackTpl = TEMPLATES.eat_today[fallbackKey];
      resultTitle  = pick(fallbackTpl.title);
      resultReason = pick(fallbackTpl.reason);
      resultAction = pick(fallbackTpl.action);
      resultTrend  = fallbackTpl.trend;
    } else {
      resultTitle  = pick(tpl.title);
      resultReason = pick(tpl.reason);
      resultAction = pick(tpl.action);
      resultTrend  = tpl.trend;
    }
    // 每日幸运彩蛋（基于日期的确定性随机）
    const daySeed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    const luckyDishes = ['番茄鸡蛋面', '珍珠奶茶', '宫保鸡丁饭', '三鲜馄饨', '杨枝甘露', '冰美式', '麻酱凉皮', '韩式烤肉', '小米粥'];
    const luckyDish = luckyDishes[daySeed % luckyDishes.length];
    resultAction += '\n\n✨ 今日超级幸运菜：' + luckyDish + ' ✨';
  }
  // === 穿什么模板（3风格）===
  else if (templateId === 'wear_today') {
    // 毒舌模式：尝试使用毒舌模板
    let effectiveTpl = TEMPLATES.wear_today;
    if (forceTone === 'sarcastic' && TEMPLATES.wear_today_sarcastic) {
      effectiveTpl = TEMPLATES.wear_today_sarcastic;
    }

    let styleKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      // A/lean_A 随机选风格1-2
      styleKeys = ['gentle', 'cool'];
    } else {
      // wait/lean_B/B 选风格3
      styleKeys = ['casual'];
    }
    const styleKey = pick(styleKeys);
    const tpl = effectiveTpl[styleKey];
    // 毒舌版找不到方向时降级到温柔版
    if (!tpl) {
      const fallbackTpl = TEMPLATES.wear_today[styleKey];
      resultTitle  = pick(fallbackTpl.title);
      resultReason = pick(fallbackTpl.reason);
      resultAction = pick(fallbackTpl.action);
      resultTrend  = fallbackTpl.trend;
    } else {
      resultTitle  = pick(tpl.title);
      resultReason = pick(tpl.reason);
      resultAction = pick(tpl.action);
      resultTrend  = tpl.trend;
    }
    // 每日幸运色彩蛋
    const daySeedW = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    const luckyColors = ['粉色', '黑色', '黄色', '米白色', '灰色', '绿色', '紫色', '白色', '浅蓝色'];
    const luckyColor = luckyColors[daySeedW % luckyColors.length];
    resultAction += '\n\n✨ 今日超级幸运色：' + luckyColor + ' ✨';
  }
  // === 喝什么模板（4大方向）===
  else if (templateId === 'drink_today') {
    let effectiveTpl = TEMPLATES.drink_today;
    if (forceTone === 'sarcastic' && TEMPLATES.drink_today_sarcastic) {
      effectiveTpl = TEMPLATES.drink_today_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['coffee', 'milk_tea'];
    } else {
      directionKeys = ['wellness', 'refresh'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    resultTitle  = pick(tpl.title);
    resultReason = pick(tpl.reason);
    resultAction = pick(tpl.action);
    resultTrend  = tpl.trend;

    // 每日幸运彩蛋
    const daySeedD = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    const luckyDrinks = ['冰美式', '珍珠奶茶', '芋泥啵啵', '红糖姜茶', '手打柠檬茶', '拿铁', '气泡水', '红枣枸杞茶'];
    const luckyDrink = luckyDrinks[daySeedD % luckyDrinks.length];
    resultAction += '\n\n✨ 今日超级幸运饮：' + luckyDrink + ' ✨';
  }
  // === 洗头模板（3方向温柔 / 2方向毒舌）===
  else if (templateId === 'wash_hair') {
    let effectiveTpl = TEMPLATES.wash_hair;
    if (forceTone === 'sarcastic' && TEMPLATES.wash_hair_sarcastic) {
      effectiveTpl = TEMPLATES.wash_hair_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['must_wash', 'skip_wash'];
    } else {
      directionKeys = ['tomorrow'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    // 毒舌版找不到方向时降级到温柔版
    if (!tpl) {
      const fallbackKeys = decisionBias === 'A' || decisionBias === 'lean_A'
        ? ['must_wash', 'skip_wash']
        : ['tomorrow'];
      const fallbackKey = pick(fallbackKeys);
      const fallbackTpl = TEMPLATES.wash_hair[fallbackKey];
      resultTitle  = pick(fallbackTpl.title);
      resultReason = pick(fallbackTpl.reason);
      resultAction = pick(fallbackTpl.action);
      resultTrend  = fallbackTpl.trend;
    } else {
      resultTitle  = pick(tpl.title);
      resultReason = pick(tpl.reason);
      resultAction = pick(tpl.action);
      resultTrend  = tpl.trend;
    }
  }
  // === 早睡模板（3方向温柔 / 2方向毒舌）===
  else if (templateId === 'sleep_early') {
    let effectiveTpl = TEMPLATES.sleep_early;
    if (forceTone === 'sarcastic' && TEMPLATES.sleep_early_sarcastic) {
      effectiveTpl = TEMPLATES.sleep_early_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['sleep_now', 'sleep_late'];
    } else {
      directionKeys = ['dont_stay'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    // 毒舌版找不到方向时降级到温柔版
    if (!tpl) {
      const fallbackKeys = decisionBias === 'A' || decisionBias === 'lean_A'
        ? ['sleep_now', 'sleep_late']
        : ['dont_stay'];
      const fallbackKey = pick(fallbackKeys);
      const fallbackTpl = TEMPLATES.sleep_early[fallbackKey];
      resultTitle  = pick(fallbackTpl.title);
      resultReason = pick(fallbackTpl.reason);
      resultAction = pick(fallbackTpl.action);
      resultTrend  = fallbackTpl.trend;
    } else {
      resultTitle  = pick(tpl.title);
      resultReason = pick(tpl.reason);
      resultAction = pick(tpl.action);
      resultTrend  = tpl.trend;
    }
  }
  // === 出门模板（4方向）===
  else if (templateId === 'go_out') {
    let effectiveTpl = TEMPLATES.go_out;
    if (forceTone === 'sarcastic' && TEMPLATES.go_out_sarcastic) {
      effectiveTpl = TEMPLATES.go_out_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['must_go', 'can_go'];
    } else {
      directionKeys = ['stay_home', 'go_later'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    resultTitle  = pick(tpl.title);
    resultReason = pick(tpl.reason);
    resultAction = pick(tpl.action);
    resultTrend  = tpl.trend;
  }
  // === 发消息模板（4方向）===
  else if (templateId === 'send_msg') {
    let effectiveTpl = TEMPLATES.send_msg;
    if (forceTone === 'sarcastic' && TEMPLATES.send_msg_sarcastic) {
      effectiveTpl = TEMPLATES.send_msg_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['send_now', 'call_instead'];
    } else {
      directionKeys = ['dont_send', 'wait_hour'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    resultTitle  = pick(tpl.title);
    resultReason = pick(tpl.reason);
    resultAction = pick(tpl.action);
    resultTrend  = tpl.trend;
  }
  // === 买不买模板（4方向温柔 / 2方向毒舌）===
  else if (templateId === 'buy_it') {
    let effectiveTpl = TEMPLATES.buy_it;
    if (forceTone === 'sarcastic' && TEMPLATES.buy_it_sarcastic) {
      effectiveTpl = TEMPLATES.buy_it_sarcastic;
    }

    let directionKeys;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      directionKeys = ['buy_now', 'buy_cheap'];
    } else {
      directionKeys = ['dont_buy', 'wait_sale'];
    }
    const dirKey = pick(directionKeys);
    const tpl = effectiveTpl[dirKey];
    // 毒舌版找不到方向时降级到温柔版
    if (!tpl) {
      const fallbackKeys = decisionBias === 'A' || decisionBias === 'lean_A'
        ? ['buy_now', 'buy_cheap']
        : ['dont_buy', 'wait_sale'];
      const fallbackKey = pick(fallbackKeys);
      const fallbackTpl = TEMPLATES.buy_it[fallbackKey];
      resultTitle  = pick(fallbackTpl.title);
      resultReason = pick(fallbackTpl.reason);
      resultAction = pick(fallbackTpl.action);
      resultTrend  = fallbackTpl.trend;
    } else {
      resultTitle  = pick(tpl.title);
      resultReason = pick(tpl.reason);
      resultAction = pick(tpl.action);
      resultTrend  = tpl.trend;
    }
  }
  // === 重题模板（L3, oracle 语气）===
  else if (toneMode === 'oracle') {
    let tplKey;
    if (decisionBias === 'A' || decisionBias === 'lean_A') {
      tplKey = riskLevel === 'high' ? 'A_high' : 'A_normal';
    } else if (decisionBias === 'wait') {
      tplKey = 'wait';
    } else {
      tplKey = 'B';
    }
    const tpl = TEMPLATES.oracle[tplKey] || TEMPLATES.oracle.wait;
    resultTitle  = pick(tpl.title);
    resultReason = pick(tpl.reason);
    resultRisk   = pick(tpl.risk);
    resultAction = pick(tpl.action);
    resultTrend  = pick(tpl.trend);
    resultCta    = pick(tpl.cta);
  }
  // === 通用轻题模板（L1/L2）===
  else {
    const biasKey = decisionBias === 'lean_A' ? 'A'
                  : decisionBias === 'lean_B' ? 'B'
                  : decisionBias;
    // 按 category 选择细分模板，无匹配则回退 generic_light
    const CATEGORY_TPL_MAP = {
      relationship: 'generic_relationship',
      social: 'generic_relationship',
      fitness: 'generic_fitness',
      study: 'generic_study',
      diet: 'generic_diet',
    };
    const tplName = CATEGORY_TPL_MAP[category] || 'generic_light';
    const tpl = TEMPLATES[tplName][biasKey] || TEMPLATES[tplName].wait || TEMPLATES.generic_light[biasKey] || TEMPLATES.generic_light.wait;
    resultTitle  = pick(tpl.title);
    resultReason = pick(tpl.reason);
    resultAction = pick(tpl.action);
    resultTrend  = tpl.trend;
  }

  // === 通用风险提示（30% 概率出现）===
  if (!resultRisk && Math.random() < 0.3) {
    const GENERIC_RISKS = [
      '⚠️ 不过，宇宙提醒你：别太依赖随机结果。',
      '⚠️ 宇宙免责声明：本结果仅供娱乐，重要决定请理性思考。',
      '⚠️ 温馨提示：如果第三次还是这个结果，就别再测了。',
      '⚠️ 宇宙说：测多了不准，信一次就好。',
    ];
    resultRisk = GENERIC_RISKS[Math.floor(Math.random() * GENERIC_RISKS.length)];
  }

  // === CTA 逻辑 ===
  if (!resultCta) {
    if (seriousnessLevel === 'L1') {
      resultCta = '不信邪，再测一次';
    } else if (seriousnessLevel === 'L2') {
      resultCta = '发给朋友看看';
    } else if (seriousnessLevel === 'L3') {
      if (escalationRecommended) {
        resultCta = '想认真看，再进入完整推演';
      } else {
        resultCta = '先发给你信任的人看看';
      }
    }
  }

  // === 宇宙一句话（最适合截图传播的句子）===
  const ONE_LINER_QUOTES = {
    eat_today: [
      '你不是不知道吃什么，你是什么都想吃。',
      '宇宙看了你的外卖记录，替你心疼了一下钱包。',
      '今天这顿不重要，重要的是你终于不纠结了。',
      '选不出来不是因为你挑，是因为你太饿。',
      '宇宙说：随便吃，只要不是上次那个。',
    ],
    drink_today: [
      '你不是渴，你是需要一点仪式感。',
      '宇宙说今天适合喝点甜的，生活已经够苦了。',
      '选不出来不是因为你挑剔，是因为你太累了。',
      '今天这杯，敬你终于做了一个决定。',
      '宇宙说：喝吧，明天再开始养生。',
    ],
    wear_today: [
      '穿什么不重要，重要的是你出门了。',
      '宇宙说今天穿什么都会好看，因为自信是最好的穿搭。',
      '你花在选衣服上的时间，够你多睡半小时了。',
      '今天穿得好看不是为了别人，是为了自己心情好。',
      '宇宙说：就那件，别换了，你已经迟到了。',
    ],
    go_out: [
      '你不是不想出门，你只是不想一个人出门。',
      '宇宙说今天宜出行，不宜继续躺着。',
      '出门和不出门，你心里早有答案了。',
      '宇宙帮你算过了，今天出门遇到好事的概率比宅家高。',
      '你纠结的不是出不出门，是出门后去哪。',
    ],
    buy_it: [
      '你不是买不起，你是在跟理性做最后的挣扎。',
      '宇宙说：买吧，快乐比省钱重要。',
      '你纠结的不是买不买，是买了之后会不会后悔。',
      '宇宙帮你算过了，这笔钱花出去你会开心至少三天。',
      '买不买取决于一个简单的问题：你今晚想不想收到快递。',
    ],
    sleep_early: [
      '你不是不困，你只是舍不得今天结束。',
      '宇宙说今晚宜早睡，明天你会感谢现在的自己。',
      '你熬夜不是因为有事做，是因为不想面对明天的自己。',
      '宇宙帮你算过了，今晚早睡能多赚一个小时的运气。',
      '放下手机，宇宙保证你明天不会后悔。',
    ],
    wash_hair: [
      '今天不洗也行，别靠近你想见的人。',
      '你不是懒得洗，你是在赌别人闻不出来。',
      '头发已经替你做出选择了。',
      '再拖下去，刘海会先说真话。',
      '这不是形象问题，是气场问题。',
      '宇宙不嫌你油，但你朋友可能会。',
      '洗完头不一定脱胎换骨，但至少像重新做人。',
      '今天洗头，算是对世界的一点尊重。',
      '你以为还能撑一天，宇宙觉得不太行。',
      '这题不用算命，镜子已经有答案了。',
    ],
    send_msg: [
      '你不是不会发，你是在怕没回音。',
      '这条消息最难的不是内容，是按下发送。',
      '想太多会失去时机，也会失去勇气。',
      '如果你已经在编辑框里来回三次了，那就别装冷静。',
      '不发会惦记，发了才有后续。',
      '这题不是勇敢题，是尊严题。',
      '今天发不发，决定的是你今晚睡不睡得着。',
      '有些话拖久了，就不像当下想说的了。',
      '发出去不一定有答案，不发一定没有。',
      '体面和遗憾，通常只差一个发送键。',
    ],
    custom: [
      '宇宙帮你算了，但答案你自己早就知道了。',
      '你问宇宙的时候，心里其实已经有了答案。',
      '宇宙不是算命先生，但今天这个答案，信一次。',
      '纠结本身就是在浪费时间，不如掷个骰子。',
      '宇宙说：这个问题没有标准答案，但有最佳时机。',
    ],
    _general: [
      '你不是在纠结，你是在等别人替你做决定。',
      '宇宙看了你三秒，已经知道你会怎么选。',
      '今天不是没答案，是你不想承认答案。',
      '这题你早有倾向，只是想找个台阶。',
      '宇宙不是替你决定，是替你拆穿自己。',
      '你嘴上说随便，心里其实很具体。',
      '再纠结下去，结论不会变，心情会更差。',
      '今天最该做的不是想清楚，是先动起来。',
      '你不是没主意，你只是怕后果。',
      '这不是选择题，这是体面题。',
      '你现在缺的不是建议，是一点点被允许。',
      '宇宙同意你冲，但不负责收拾残局。',
      '今天这一步，不走也会一直惦记。',
      '你以为自己在分析，其实已经在拖延。',
      '有些决定晚一点不会更好，只会更烦。',
      '宇宙不催你，但现实会。',
      '这题别再绕了，你已经想太久了。',
      '你不是犹豫型，你是嘴硬型。',
      '宇宙没有偏心，只是你太好猜。',
      '今天最贵的不是选择，是继续耗着。',
    ],
  };
  let oneLineQuote = '';
  const templateQuotes = ONE_LINER_QUOTES[templateId];
  if (templateQuotes && templateQuotes.length) {
    oneLineQuote = templateQuotes[Math.floor(Math.random() * templateQuotes.length)];
  } else {
    const general = ONE_LINER_QUOTES._general;
    oneLineQuote = general[Math.floor(Math.random() * general.length)];
  }

  // === 分享梗（每个模板类型多句随机，追加在建议后面）===
  const SHARE_MEMES = {
    eat_today: [
      '转发给你的饭搭子，让 Ta 请你吃这顿。',
      '发给那个每次都说"随便"的人。',
      '今天这顿，宇宙替你点了。',
    ],
    drink_today: [
      '艾特那个会请你喝奶茶的人。',
      '发给那个每天靠咖啡续命的人。',
      '今天这杯，宇宙请了。',
    ],
    wear_today: [
      '今天穿对幸运色，暴富暴美。',
      '发给那个每天问你穿什么的人。',
      '宇宙说今天这样穿，准没错。',
    ],
    wash_hair: [
      '转发给那个三天不洗头的闺蜜。',
      '发给那个每次见面都问你洗头了吗的人。',
      '宇宙已经闻到了，你该洗了。',
    ],
    sleep_early: [
      '转发给那个天天熬夜的朋友。',
      '发给那个凌晨三点还在刷手机的人。',
      '宇宙说今晚不睡，明天后悔。',
    ],
    go_out: [
      '转发给你宅在家的朋友，催 Ta 出门。',
      '发给那个已经三天没出过门的人。',
      '宇宙说今天不出门，亏大了。',
    ],
    send_msg: [
      '截图发给闺蜜，让 Ta 帮你参谋。',
      '发给那个每次都劝你"别发"的朋友。',
      '宇宙说发吧，别想了。',
    ],
    buy_it: [
      '宇宙说可以买，那我就放心了。',
      '发给那个每次都说"你不需要"的人。',
      '买！宇宙批准了，谁也拦不住。',
    ],
    // 以下为自由输入问题，按 category 匹配
    daily: [
      '转发给你的饭搭子，让 Ta 请你吃这顿。',
      '发给那个每次都说"随便"的人。',
    ],
    social: [
      '转发给你想约的那个人，看 Ta 怎么说。',
      '发给那个你正在纠结要不要联系的人。',
    ],
    relationship: [
      '转发给你想约的那个人，看 Ta 怎么说。',
      '发给那个你正在纠结要不要联系的人。',
    ],
    work: [
      '别让老板看见这条。',
      '转发给那个天天想辞职的同事。',
    ],
    major: [
      '宇宙说可以买，那我就放心了。',
      '买！宇宙批准了，谁也拦不住。',
    ],
    custom: [
      '转发给闺蜜，让 Ta 帮你评评理。',
      '宇宙都帮你算了，还不信？发给朋友评评理。',
      '这个问题你纠结了多久了？让朋友帮你拍板吧。',
    ],
  };
  let shareMeme = '';
  const memePool = (templateId && SHARE_MEMES[templateId]) || (category && SHARE_MEMES[category]);
  if (memePool && Array.isArray(memePool)) {
    shareMeme = memePool[Math.floor(Math.random() * memePool.length)];
  } else if (typeof memePool === 'string') {
    shareMeme = memePool;
  }

  // === 特殊时间彩蛋 ===
  let timeEgg = '';
  const h = date.getHours();
  const m = date.getMinutes();
  if (h === 11 && m === 11) {
    timeEgg = '✨ 11:11 宇宙彩蛋：今天适合一个人吃火锅，不用迁就别人，想吃什么点什么。';
  } else if (h === 13 && m === 14) {
    timeEgg = '✨ 13:14 宇宙彩蛋：今天适合表白，成功率99%，大胆说出来！';
  } else if (h === 22 && m === 22) {
    timeEgg = '✨ 22:22 宇宙彩蛋：别熬夜了，再熬头发掉光了。';
  } else if (h === 0 && m === 0) {
    timeEgg = '✨ 00:00 宇宙彩蛋：新的一天开始了，过去的都过去了，今天是新的开始。';
  }

  return {
    resultTitle,
    resultReason,
    resultRisk,
    resultAction,
    resultTrend,
    resultCta,
    shareMeme,
    timeEgg,
    oneLineQuote,
  };
  } catch (e) {
    console.warn('[decision-engine] translateToDisplay 异常:', e);
    return {
      resultTitle: '宇宙信号丢失',
      resultReason: '宇宙正在重新校准信号...',
      resultRisk: '',
      resultAction: '再掷一次',
      resultTrend: '',
      resultCta: '',
      shareMeme: '',
      timeEgg: '',
      oneLineQuote: '',
    };
  }
}

// ============================================================
// 5. 主入口函数
// ============================================================

/**
 * 完整决策流程
 * @param {string} question - 问题文本
 * @param {string} templateId - 模板ID
 * @param {Date} [date=new Date()] - 起课时间
 * @param {string} [geoPermission='denied'] - 地理权限 'granted'|'denied'
 * @param {string|null} [city=null] - 手动输入的城市
 * @returns {object} 完整决策结果
 */
export function getDecision(question, templateId, date = new Date(), geoPermission = 'denied', city = null) {
  // 1. 精度模式
  const precisionMode = geoPermission === 'granted' ? 'precise' : (city ? 'manual_city' : 'fast');

  // 2. 边界惩罚
  let boundaryPenalty = 0;
  if (nearZiHour(date)) boundaryPenalty += 1;
  if (nearZhongQi(date)) boundaryPenalty += 1;

  // 3. 问题分类
  const classification = classifyQuestion(question, templateId);
  const { category, seriousnessLevel, toneMode, shareCardType } = classification;

  // 4. 排盘
  let divination = {};
  try {
    divination = divine(date, city) || {};
  } catch (e) {
    console.warn('[decision-engine] 排盘异常:', e);
    divination = {};
  }

  // 5. 征象分析
  const signals = analyzeSignals(divination);

  // 6. 决策评分（注入 boundaryPenalty）
  const decision = calculateDecision(signals, seriousnessLevel, precisionMode, category);

  // 7. 修正 totalScore（加入 boundaryPenalty）
  decision.totalScore -= boundaryPenalty;

  // 8. 重新计算 decisionBias（基于修正后的 totalScore）
  if (decision.totalScore >= 4)       decision.decisionBias = 'A';
  else if (decision.totalScore >= 1)  decision.decisionBias = 'lean_A';
  else if (decision.totalScore >= -1) decision.decisionBias = 'wait';
  else if (decision.totalScore >= -4) decision.decisionBias = 'lean_B';
  else                                decision.decisionBias = 'B';

  // 9. 重新计算 confidenceLevel
  decision.confidenceLevel = clamp(
    50 + decision.totalScore * 5 + (precisionMode === 'precise' ? 10 : 0),
    10,
    100
  );

  // 10. 模板翻译
  const display = translateToDisplay(
    decision, question, category, seriousnessLevel, toneMode, templateId, date
  );

  // 11. 组装完整结果
  return {
    // 排盘数据（内部用，不直接展示）
    divination,

    // 分类
    category,
    seriousnessLevel,
    toneMode,
    shareCardType,
    templateId,

    // 决策
    decisionBias: decision.decisionBias,
    confidenceLevel: decision.confidenceLevel,
    riskLevel: decision.riskLevel,
    actionMode: decision.actionMode,
    trendMode: decision.trendMode,
    escalationRecommended: decision.escalationRecommended,

    // 前台展示
    resultTitle: display.resultTitle,
    resultReason: display.resultReason,
    resultRisk: display.resultRisk,
    resultAction: display.resultAction,
    resultTrend: display.resultTrend,
    resultCta: display.resultCta,
    shareMeme: display.shareMeme || '',
    timeEgg: display.timeEgg || '',
    oneLineQuote: display.oneLineQuote || '',

    // 精度
    precisionMode,
  };
}

/**
 * 重新翻译（切换语气时调用）
 * @param {object} result - getDecision 返回的完整结果
 * @param {string} [forceTone] - 强制语气 'sarcastic'|'slacker'|undefined
 * @returns {object} 展示文案
 */
export function retranslate(result, forceTone) {
  let display = translateToDisplay(
    {
      decisionBias: result.decisionBias,
      riskLevel: result.riskLevel,
      escalationRecommended: result.escalationRecommended,
    },
    '',
    result.category,
    result.seriousnessLevel,
    result.toneMode,
    result.templateId,
    new Date(),
    forceTone
  );

  // 摆烂模式：对 bestie 结果做后处理
  if (forceTone === 'slacker') {
    display = applySlackerTone(display, result.decisionBias);
  }

  return display;
}

/**
 * 摆烂语气后处理：把 bestie 文案改成摆烂风格
 */
function applySlackerTone(display, decisionBias) {
  const isYes = decisionBias === 'A' || decisionBias === 'lean_A';
  const slackerTitles = {
    A: '行吧，随便吧',
    lean_A: '也行，无所谓',
    wait: '都行，你开心就好',
    lean_B: '算了，别折腾了',
    B: '别想了，躺平吧',
  };
  const slackerReasons = [
    '想了想，其实也没那么重要。',
    '宇宙算了算，发现纠结本身比结果更累。',
    '反正选哪个最后都一样，不如不选。',
    '宇宙表示：这个问题超纲了，建议放弃。',
  ];
  const slackerActions = [
    '建议：躺平，什么都不做，让时间替你选。',
    '建议：先睡一觉，醒来可能就不纠结了。',
    '建议：打开外卖软件，点一杯奶茶，问题自动消失。',
    '建议：把手机放下，去阳台吹吹风，答案会来找你。',
  ];
  const slackerTrends = [
    '摆烂也是一种态度，至少不累。',
    '今天不纠结了，明天再说。',
    '宇宙说：你已经很努力了，休息一下吧。',
  ];

  return {
    ...display,
    resultTitle: slackerTitles[decisionBias] || '都行',
    resultReason: slackerReasons[Math.floor(Math.random() * slackerReasons.length)],
    resultAction: slackerActions[Math.floor(Math.random() * slackerActions.length)],
    resultTrend: slackerTrends[Math.floor(Math.random() * slackerTrends.length)],
    oneLineQuote: [
      '纠结了一天，最后选了"不选"。',
      '宇宙说：你今天最大的成就，是终于放弃了。',
      '不是所有问题都需要答案，有些只需要时间。',
      '摆烂不是放弃，是对生活的另一种信任。',
    ][Math.floor(Math.random() * 4)],
    shareMeme: [
      '发给那个跟你一样纠结了一整天的人。',
      '转发给那个永远在做选择的人。',
    ][Math.floor(Math.random() * 2)],
  };
}

// ============================================================
// 6. 加载页模板化等待文案
// ============================================================

const LOADING_MESSAGES = {
  eat_today: [
    '宇宙正在翻菜单...',
    '正在连接银河系美食频道...',
    '宇宙正在为你点外卖...',
  ],
  drink_today: [
    '宇宙正在调酒...',
    '正在连接银河系饮品站...',
    '宇宙正在帮你续命...',
  ],
  wear_today: [
    '宇宙正在翻衣柜...',
    '正在扫描今日幸运色...',
    '宇宙正在搭配你的OOTD...',
  ],
  go_out: [
    '宇宙正在查看天气...',
    '正在计算出门好运指数...',
    '宇宙正在规划你的路线...',
  ],
  send_msg: [
    '宇宙正在帮你编辑...',
    '正在分析对方心情指数...',
    '宇宙正在替你鼓起勇气...',
  ],
  buy_it: [
    '宇宙正在查价格...',
    '正在计算冲动消费指数...',
    '宇宙正在帮你管钱包...',
  ],
  wash_hair: [
    '宇宙正在闻你的头发...',
    '正在计算油量指数...',
    '宇宙正在决定你油不油...',
  ],
  sleep_early: [
    '宇宙正在查看你的黑眼圈...',
    '正在计算熬夜扣血量...',
    '宇宙正在劝你放下手机...',
  ],
  custom: [
    '宇宙正在冥想你的问题...',
    '正在连接宇宙信号...',
    '宇宙正在认真思考...',
  ],
};

/**
 * 获取模板对应的加载文案（随机一条）
 * @param {string} templateId
 * @returns {string}
 */
export function getLoadingMessage(templateId) {
  const msgs = LOADING_MESSAGES[templateId] || LOADING_MESSAGES.custom;
  return msgs[Math.floor(Math.random() * msgs.length)];
}
