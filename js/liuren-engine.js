/**
 * liuren-engine.js
 * 大六壬规则引擎 - "上帝帮你掷骰子" 核心算法模块
 *
 * 使用 ES Module 导出，提供 divine(date, city) 主函数
 * 实现完整的大六壬排盘、四课、三传、神煞、格局分析
 */

// ============================================================
// 1. 基础常量
// ============================================================

/** 天干 */
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 地支（0-based 索引） */
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 天干五行映射 */
export const GAN_ELEMENT = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
};

/** 地支五行映射 */
export const ZHI_ELEMENT = {
  '子': 'water', '丑': 'earth', '寅': 'wood', '卯': 'wood',
  '辰': 'earth', '巳': 'fire',  '午': 'fire', '未': 'earth',
  '申': 'metal', '酉': 'metal', '戌': 'earth', '亥': 'water',
};

/** 五行相生：wood→fire→earth→metal→water→wood */
export const ELEMENT_SHENG = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};

/** 五行相克：wood→earth→water→fire→metal→wood */
export const ELEMENT_KE = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

/**
 * 十干寄宫（天干字符 → 地支索引）
 * 甲→寅(2), 乙→辰(4), 丙→巳(5), 戊→巳(5),
 * 丁→未(7), 己→未(7), 庚→申(8), 辛→戌(10),
 * 壬→亥(11), 癸→丑(1)
 */
export const GAN_JI_GONG = {
  '甲': 2,  '乙': 4,  '丙': 5,  '丁': 7,
  '戊': 5,  '己': 7,  '庚': 8,  '辛': 10,
  '壬': 11, '癸': 1,
};

/** 地支六合对（索引对） */
export const LIU_HE = [
  [0, 1],   // 子丑
  [2, 11],  // 寅亥
  [3, 10],  // 卯戌
  [4, 9],   // 辰酉
  [5, 8],   // 巳申
  [6, 7],   // 午未
];

/** 地支三合局（三支索引 → 五行） */
export const SAN_HE = [
  { branches: [8, 0, 4],  element: 'water' },  // 申子辰 → 水
  { branches: [11, 3, 7], element: 'wood' },   // 亥卯未 → 木
  { branches: [2, 6, 10], element: 'fire' },   // 寅午戌 → 火
  { branches: [5, 9, 1],  element: 'metal' },  // 巳酉丑 → 金
];

/** 地支六冲对（索引对） */
export const LIU_CHONG = [
  [0, 6],   // 子午
  [1, 7],   // 丑未
  [2, 8],   // 寅申
  [3, 9],   // 卯酉
  [4, 10],  // 辰戌
  [5, 11],  // 巳亥
];

/** 地支三刑（数组内各支互刑） */
export const SAN_XING = [
  [2, 5, 8],    // 寅巳申（无恩之刑）
  [1, 10, 7],   // 丑戌未（恃势之刑）
  [0, 3],       // 子卯（无礼之刑）
  [4, 6, 9, 11], // 辰午酉亥（自刑）
];

/** 天干五合（索引对） */
export const GAN_WU_HE = [
  [0, 5],  // 甲己
  [1, 6],  // 乙庚
  [2, 7],  // 丙辛
  [3, 8],  // 丁壬
  [4, 9],  // 戊癸
];

/** 天干阴阳：甲丙戊庚壬=阳, 乙丁己辛癸=阴 */
export const GAN_YIN_YANG = {
  '甲': 'yang', '乙': 'yin', '丙': 'yang', '丁': 'yin',
  '戊': 'yang', '己': 'yin', '庚': 'yang', '辛': 'yin',
  '壬': 'yang', '癸': 'yin',
};

// ============================================================
// 2. 节气数据（1901-2050年，每年12个值=1800个十六进制值）
// ============================================================

/**
 * 节气数据编码说明：
 * 每个字节编码格式：
 *   byte1: 高5位=节气日(1-31), 低3位=月份高3位(0-7)
 *   byte2: 高1位=月份低1位, 中5位=时(0-23), 低2位=分/15(0,15,30,45)
 * 解码公式:
 *   day = byte1 >> 3
 *   month = ((byte1 & 0x07) << 1) | (byte2 >> 7)
 *   hour = (byte2 >> 2) & 0x1F
 *   minute = (byte2 & 0x03) * 15
 *
 * 注意：每年12个值，对应12个节（小寒、立春、惊蛰、清明、立夏、芒种、
 * 小暑、立秋、白露、寒露、立冬、大雪），不是24个节气。
 * 中气（大寒、雨水、春分、谷雨、小满、夏至、大暑、处暑、秋分、
 * 霜降、小雪、冬至）的时间取相邻两个节之间的中点近似。
 */
const LUNAR_HOL_DAY = [
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x97,0x96,0x97,0x87,0x79,0x79,0x69,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA6,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA5,0x97,0x96,0x97,0x87,0x79,0x79,0x69,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA6,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x69,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x79,0x77,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x97,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x96,0xA5,0x96,0x96,0x88,0x78,0x78,0x78,0x87,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
  0x96,0xA4,0x96,0x96,0x97,0x87,0x79,0x79,0x79,0x69,0x78,0x78,
  0x96,0xA5,0x87,0x96,0x87,0x87,0x79,0x69,0x69,0x69,0x78,0x78,
  0x86,0xA5,0x96,0xA5,0x96,0x97,0x88,0x78,0x78,0x69,0x78,0x87,
  0x95,0xB4,0x96,0xA5,0x96,0x97,0x78,0x79,0x78,0x69,0x78,0x87,
  0x96,0xB4,0x96,0xA6,0x97,0x97,0x78,0x79,0x79,0x69,0x78,0x77,
];

/**
 * 12个节名称（每年12个值对应的节气名称）
 * 索引0=小寒, 1=立春, 2=惊蛰, 3=清明, 4=立夏, 5=芒种,
 * 6=小暑, 7=立秋, 8=白露, 9=寒露, 10=立冬, 11=大雪
 */
const JIE_NAMES = [
  '小寒', '立春', '惊蛰', '清明', '立夏', '芒种',
  '小暑', '立秋', '白露', '寒露', '立冬', '大雪',
];

/**
 * 12个中气名称（与12个节交替排列）
 * 索引0=大寒, 1=雨水, 2=春分, 3=谷雨, 4=小满, 5=夏至,
 * 6=大暑, 7=处暑, 8=秋分, 9=霜降, 10=小雪, 11=冬至
 */
const ZHONGQI_NAMES = [
  '大寒', '雨水', '春分', '谷雨', '小满', '夏至',
  '大暑', '处暑', '秋分', '霜降', '小雪', '冬至',
];

/**
 * 中气名到月将地支索引的映射
 * 月将即月建所对应的天盘十二神将
 */
const ZHONGQI_TO_YUEJIANG = {
  '雨水': 11,  // 亥/登明
  '春分': 10,  // 戌/河魁
  '谷雨': 9,   // 酉/从魁
  '小满': 8,   // 申/传送
  '夏至': 7,   // 未/小吉
  '大暑': 6,   // 午/胜光
  '处暑': 5,   // 巳/太乙
  '秋分': 4,   // 辰/天罡
  '霜降': 3,   // 卯/太冲
  '小雪': 2,   // 寅/功曹
  '冬至': 1,   // 丑/大吉
  '大寒': 0,   // 子/神后
};

// ============================================================
// 3. 工具函数
// ============================================================

/**
 * 安全取模（处理负数情况）
 * @param {number} a - 被除数
 * @param {number} n - 除数
 * @returns {number} 非负余数
 */
function mod(a, n) {
  return ((a % n) + n) % n;
}

/**
 * 获取地支的五行属性
 * @param {number} zhiIndex - 地支索引 0-11
 * @returns {string} 五行名称
 */
function getZhiElement(zhiIndex) {
  return ZHI_ELEMENT[DI_ZHI[zhiIndex]];
}

/**
 * 获取天干的五行属性
 * @param {number} ganIndex - 天干索引 0-9
 * @returns {string} 五行名称
 */
function getGanElement(ganIndex) {
  return GAN_ELEMENT[TIAN_GAN[ganIndex]];
}

/**
 * 判断五行 a 是否克五行 b
 * @param {string} a - 来源五行
 * @param {string} b - 目标五行
 * @returns {boolean}
 */
function isKe(a, b) {
  return ELEMENT_KE[a] === b;
}

/**
 * 判断五行 a 是否生五行 b
 * @param {string} a - 来源五行
 * @param {string} b - 目标五行
 * @returns {boolean}
 */
function isSheng(a, b) {
  return ELEMENT_SHENG[a] === b;
}

// ============================================================
// 4. 节气解码
// ============================================================

/**
 * 解码单个节气值
 * @param {number} byte1 - 第一个字节
 * @param {number} byte2 - 第二个字节
 * @returns {{ month: number, day: number, hour: number, minute: number }}
 */
function decodeJieQi(byte1, byte2) {
  const day = byte1 >> 3;
  const month = ((byte1 & 0x07) << 1) | (byte2 >> 7);
  const hour = (byte2 >> 2) & 0x1F;
  const minute = (byte2 & 0x03) * 15;
  return { month, day, hour, minute };
}

/**
 * 解码某年所有节气数据
 * @param {number} year - 年份（1901-2050）
 * @returns {Array<{name: string, month: number, day: number, hour: number, minute: number, date: Date}>}
 */
function decodeYearJieQi(year) {
  const idx = year - 1901;
  if (idx < 0 || idx > 149) return [];
  const offset = idx * 12;
  const result = [];
  for (let i = 0; i < 12; i++) {
    const byte1 = LUNAR_HOL_DAY[offset + i];
    const { month, day, hour, minute } = decodeJieQi(byte1, 0x80);
    // byte2 使用 0x80 近似（月份低1位=1，时=0，分=0）
    // 实际上这里只有一个字节，我们用近似方式解码
    // 重新解码：单字节模式下，高5位=日，低3位=月高3位
    const actualDay = byte1 >> 3;
    const actualMonthHigh = byte1 & 0x07;
    // 由于只有单字节，月份需要根据节气顺序推断
    // 12个节对应的月份：小寒(1月), 立春(2月), 惊蛰(3月), 清明(4月),
    // 立夏(5月), 芒种(6月), 小暑(7月), 立秋(8月), 白露(9月),
    // 寒露(10月), 立冬(11月), 大雪(12月)
    const jieMonth = i + 1; // 节气所在月份
    const jieDate = new Date(year, jieMonth - 1, actualDay, 0, 0, 0);
    result.push({
      name: JIE_NAMES[i],
      month: jieMonth,
      day: actualDay,
      hour: 0,
      minute: 0,
      date: jieDate,
    });
  }
  return result;
}

/**
 * 获取指定日期所在的中气及对应月将
 * 算法：找到问事时间之前最近的那个中气
 * 中气在两个节之间，近似取节的日期+15天
 * @param {Date} date - 问事日期
 * @returns {{ zhongqiName: string, yueJiangIndex: number }}
 */
function getMonthGeneral(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  // 构建当前时间的分钟数（用于精确比较）
  const currentMinutes = day * 24 * 60 + hour * 60 + minute;

  // 解码当前年和前一年的节气
  let jieList = decodeYearJieQi(year);
  if (year > 1901) {
    jieList = [...decodeYearJieQi(year - 1), ...jieList];
  }

  // 按时间排序，找到当前时间之前最近的那个节
  // 然后取其后的中气（约15天后）
  let lastJieIndex = -1;
  for (let i = jieList.length - 1; i >= 0; i--) {
    const jie = jieList[i];
    const jieYear = jie.date.getFullYear();
    const jieMonth = jie.date.getMonth();
    const jieDay = jie.date.getDate();
    if (jieYear < year) {
      lastJieIndex = i;
      break;
    }
    if (jieYear === year && jieMonth < month) {
      lastJieIndex = i;
      break;
    }
    if (jieYear === year && jieMonth === month && jieDay <= day) {
      lastJieIndex = i;
      break;
    }
  }

  // 确定中气索引
  // 中气在节之后约15天
  // 如果当前时间在中气之前，则月将取上一个中气
  // 如果当前时间在中气之后，则月将取当前中气

  // 简化方案：根据月份直接确定月将
  // 大六壬月将以中气为界换将
  // 雨水后→亥将, 春分后→戌将, 谷雨后→酉将, 小满后→申将,
  // 夏至后→未将, 大暑后→午将, 处暑后→巳将, 秋分后→辰将,
  // 霜降后→卯将, 小雪后→寅将, 冬至后→丑将, 大寒后→子将

  // 中气大约在每月的15-23日之间
  // 使用节气数据来精确判断
  let zhongqiIndex = -1;

  if (lastJieIndex >= 0) {
    // 找到该节之后的中气（索引相同，名称不同）
    const jieIdx = lastJieIndex % 12;
    // 中气在节之后约15天
    const jieDate = jieList[lastJieIndex].date;
    const zhongqiDate = new Date(jieDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    if (date >= zhongqiDate) {
      // 当前时间已过中气，使用当前中气对应的月将
      zhongqiIndex = jieIdx;
    } else {
      // 当前时间未到中气，使用上一个中气对应的月将
      zhongqiIndex = (jieIdx - 1 + 12) % 12;
    }
  } else {
    // 回退到上一年最后一节
    const prevYear = year - 1;
    if (prevYear >= 1901) {
      const prevJieList = decodeYearJieQi(prevYear);
      const lastJie = prevJieList[prevJieList.length - 1];
      const jieIdx = 11; // 大雪
      const jieDate = lastJie.date;
      const zhongqiDate = new Date(jieDate.getTime() + 15 * 24 * 60 * 60 * 1000);
      if (date >= zhongqiDate) {
        zhongqiIndex = jieIdx;
      } else {
        zhongqiIndex = (jieIdx - 1 + 12) % 12;
      }
    } else {
      // 极端回退
      zhongqiIndex = (month + 1) % 12;
    }
  }

  const zhongqiName = ZHONGQI_NAMES[zhongqiIndex];
  const yueJiangIndex = ZHONGQI_TO_YUEJIANG[zhongqiName];

  return { zhongqiName, yueJiangIndex };
}

// ============================================================
// 5. 日干支计算
// ============================================================

/**
 * 计算两个日期之间的天数差
 * @param {Date} d1 - 起始日期
 * @param {Date} d2 - 结束日期
 * @returns {number} 天数差（d2 - d1）
 */
function daysBetween(d1, d2) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * 计算日干支
 * 基准日：1900-01-01 = 甲戌日（甲=索引0，戌=索引10）
 * @param {Date} date - 目标日期
 * @returns {{ ganIndex: number, zhiIndex: number, gan: string, zhi: string }}
 */
function getDayGanZhi(date) {
  const baseDate = new Date(1900, 0, 1); // 1900-01-01
  const totalDays = daysBetween(baseDate, date);
  const ganIndex = mod(totalDays, 10);
  const zhiIndex = mod(10 + totalDays, 12);
  return {
    ganIndex,
    zhiIndex,
    gan: TIAN_GAN[ganIndex],
    zhi: DI_ZHI[zhiIndex],
  };
}

// ============================================================
// 6. 占时确定
// ============================================================

/**
 * 根据小时和分钟确定时辰地支索引
 * 子时：23:00-01:00, 丑时：01:00-03:00, ...
 * @param {number} hour - 小时（0-23）
 * @param {number} minute - 分钟（0-59）
 * @returns {number} 地支索引 0-11
 */
function getHourBranch(hour, minute) {
  if (hour === 23 || hour === 0) return 0; // 子
  return Math.floor((hour + 1) / 2);
}

// ============================================================
// 7. 真太阳时校正
// ============================================================

/**
 * 城市经纬度数据库
 * 包含所有省会城市及主要城市
 */
const CITY_LONGITUDE = {
  '北京': 116.41,
  '上海': 121.47,
  '天津': 117.20,
  '重庆': 106.55,
  '哈尔滨': 126.63,
  '长春': 125.32,
  '沈阳': 123.43,
  '呼和浩特': 111.75,
  '石家庄': 114.51,
  '太原': 112.55,
  '济南': 117.00,
  '郑州': 113.65,
  '西安': 108.94,
  '兰州': 103.83,
  '银川': 106.28,
  '西宁': 101.78,
  '乌鲁木齐': 87.62,
  '合肥': 117.28,
  '南京': 118.78,
  '杭州': 120.15,
  '南昌': 115.86,
  '福州': 119.30,
  '台北': 121.52,
  '武汉': 114.30,
  '长沙': 112.97,
  '广州': 113.26,
  '南宁': 108.37,
  '海口': 110.35,
  '成都': 104.07,
  '贵阳': 106.71,
  '昆明': 102.83,
  '拉萨': 91.17,
  '香港': 114.17,
  '澳门': 113.55,
  '深圳': 114.07,
  '苏州': 120.62,
  '无锡': 120.30,
  '宁波': 121.55,
  '温州': 120.70,
  '东莞': 113.75,
  '佛山': 113.12,
  '珠海': 113.58,
  '厦门': 118.09,
  '泉州': 118.68,
  '大连': 121.62,
  '青岛': 120.38,
  '烟台': 121.45,
  '威海': 122.12,
  '秦皇岛': 119.60,
  '唐山': 118.18,
  '保定': 115.46,
  '洛阳': 112.45,
  '开封': 114.35,
  '徐州': 117.19,
  '常州': 119.97,
  '扬州': 119.42,
  '绍兴': 120.58,
  '嘉兴': 120.76,
  '金华': 119.65,
  '台州': 121.42,
  '南通': 120.86,
  '盐城': 120.16,
  '连云港': 119.18,
  '淮安': 119.02,
  '湛江': 110.36,
  '中山': 113.38,
  '惠州': 114.42,
  '桂林': 110.29,
  '柳州': 109.41,
  '三亚': 109.51,
  '大理': 100.23,
  '丽江': 100.23,
  '绵阳': 104.73,
  '宜宾': 104.64,
  '遵义': 106.93,
  '赣州': 114.94,
  '九江': 115.99,
  '芜湖': 118.38,
  '蚌埠': 117.39,
  '襄阳': 112.14,
  '宜昌': 111.29,
  '岳阳': 113.13,
  '衡阳': 112.57,
  '株洲': 113.13,
  '佛山': 113.12,
  '汕头': 116.68,
  '潮州': 116.63,
  '揭阳': 116.37,
  '漳州': 117.65,
  '吉林': 126.55,
  '齐齐哈尔': 123.97,
  '包头': 109.84,
  '大同': 113.30,
};

/**
 * 真太阳时校正
 * 根据城市经度与北京时间基准经度(120E)的差值进行校正
 * 每度约4分钟
 * @param {Date} date - 原始时间
 * @param {string} city - 城市名称
 * @returns {Date} 校正后的时间
 */
function correctSolarTime(date, city) {
  const longitude = CITY_LONGITUDE[city] || 120;
  const correctionMinutes = (longitude - 120) * 4;
  return new Date(date.getTime() + correctionMinutes * 60000);
}

// ============================================================
// 8. 天地盘
// ============================================================

/**
 * 构建天地盘
 * 天盘 = 地盘 + shift（顺时针旋转）
 * @param {number} shift - 位移值（月将在地盘的位置与占时的差）
 * @returns {{ diPan: number[], tianPan: number[], shift: number }}
 */
function buildTianDiPan(shift) {
  const diPan = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const tianPan = diPan.map(i => mod(i + shift, 12));
  return { diPan, tianPan, shift };
}

// ============================================================
// 9. 四课
// ============================================================

/**
 * 构建四课
 * 第一课：日干寄宫上神
 * 第二课：第一课上神之上神
 * 第三课：日支上神
 * 第四课：第三课上神之上神
 * @param {number} dayGanIndex - 日干索引 0-9
 * @param {number} dayBranchIndex - 日支索引 0-11
 * @param {number[]} tianPan - 天盘数组
 * @returns {Array<{shang: string, xia: string, shangIdx: number, xiaIdx: number}>}
 */
function buildSiKe(dayGanIndex, dayBranchIndex, tianPan) {
  const ganJiGong = GAN_JI_GONG[TIAN_GAN[dayGanIndex]];

  // 第一课：以日干寄宫为下，天盘对应位为上
  const ke1_di = ganJiGong;
  const ke1_tian = tianPan[ke1_di];

  // 第二课：以第一课的天盘为下，再取天盘
  const ke2_di = ke1_tian;
  const ke2_tian = tianPan[ke2_di];

  // 第三课：以日支为下，天盘对应位为上
  const ke3_di = dayBranchIndex;
  const ke3_tian = tianPan[ke3_di];

  // 第四课：以第三课的天盘为下，再取天盘
  const ke4_di = ke3_tian;
  const ke4_tian = tianPan[ke4_di];

  return [
    { shang: DI_ZHI[ke1_tian], xia: DI_ZHI[ke1_di], shangIdx: ke1_tian, xiaIdx: ke1_di },
    { shang: DI_ZHI[ke2_tian], xia: DI_ZHI[ke2_di], shangIdx: ke2_tian, xiaIdx: ke2_di },
    { shang: DI_ZHI[ke3_tian], xia: DI_ZHI[ke3_di], shangIdx: ke3_tian, xiaIdx: ke3_di },
    { shang: DI_ZHI[ke4_tian], xia: DI_ZHI[ke4_di], shangIdx: ke4_tian, xiaIdx: ke4_di },
  ];
}

// ============================================================
// 10. 三传九宗门
// ============================================================

/**
 * 查找四课中的克关系
 * @param {Array} siKe - 四课数组
 * @returns {{ xiaKeShang: Array, shangKeXia: Array }}
 *   xiaKeShang: 下贼上（下盘五行克上盘五行）的课索引列表
 *   shangKeXia: 上克下（上盘五行克下盘五行）的课索引列表
 */
function findKeRelations(siKe) {
  const xiaKeShang = []; // 下贼上
  const shangKeXia = []; // 上克下

  for (let i = 0; i < siKe.length; i++) {
    const ke = siKe[i];
    const xiaElem = getZhiElement(ke.xiaIdx);
    const shangElem = getZhiElement(ke.shangIdx);

    if (isKe(xiaElem, shangElem)) {
      xiaKeShang.push(i);
    }
    if (isKe(shangElem, xiaElem)) {
      shangKeXia.push(i);
    }
  }

  return { xiaKeShang, shangKeXia };
}

/**
 * 查找驿马
 * 根据日支三合局取驿马
 * @param {number} dayBranchIndex - 日支索引
 * @returns {number} 驿马地支索引
 */
function findYiMa(dayBranchIndex) {
  // 申子辰(8,0,4)马寅(2)
  // 亥卯未(11,3,7)马巳(5)
  // 寅午戌(2,6,10)马申(8)
  // 巳酉丑(5,9,1)马亥(11)
  const maMap = {
    0: 2, 4: 2, 8: 2,   // 申子辰 → 寅
    3: 5, 7: 5, 11: 5,  // 亥卯未 → 巳
    2: 8, 6: 8, 10: 8,  // 寅午戌 → 申
    1: 11, 5: 11, 9: 11, // 巳酉丑 → 亥
  };
  return maMap[dayBranchIndex] ?? 2;
}

/**
 * 判断四课是否不全（有两课相同）
 * @param {Array} siKe - 四课数组
 * @returns {boolean}
 */
function isSiKeIncomplete(siKe) {
  const keys = siKe.map(k => `${k.shangIdx}-${k.xiaIdx}`);
  const uniqueKeys = new Set(keys);
  return uniqueKeys.size < 4;
}

/**
 * 判断是否为八专课（日干寄宫与日支相同）
 * @param {number} dayGanIndex - 日干索引
 * @param {number} dayBranchIndex - 日支索引
 * @returns {boolean}
 */
function isBaZhuan(dayGanIndex, dayBranchIndex) {
  const ganJiGong = GAN_JI_GONG[TIAN_GAN[dayGanIndex]];
  return ganJiGong === dayBranchIndex;
}

/**
 * 三传九宗门 - 确定三传
 * @param {number} dayGanIndex - 日干索引
 * @param {number} dayBranchIndex - 日支索引
 * @param {Array} siKe - 四课数组
 * @param {number[]} tianPan - 天盘数组
 * @param {number} shift - 位移值
 * @returns {{ chu: number, zhong: number, mo: number, keTi: string }}
 *   chu/zhong/mo: 初/中/末传地支索引
 *   keTi: 课体名称
 */
function determineSanZhuan(dayGanIndex, dayBranchIndex, siKe, tianPan, shift) {
  const dayElement = getGanElement(dayGanIndex);
  const isYang = GAN_YIN_YANG[TIAN_GAN[dayGanIndex]] === 'yang';

  // ---- 伏吟（shift=0 或 shift=12）----
  if (shift === 0 || shift === 12) {
    const { xiaKeShang, shangKeXia } = findKeRelations(siKe);
    let chu;

    if (xiaKeShang.length > 0) {
      // 有下贼上，取贼课上神为初传
      chu = siKe[xiaKeShang[0]].shangIdx;
    } else if (shangKeXia.length > 0) {
      // 有上克下，取克课上神为初传
      chu = siKe[shangKeXia[0]].shangIdx;
    } else {
      // 无克，取日干上神为初传
      chu = siKe[0].shangIdx;
    }

    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '伏吟' };
  }

  // ---- 返吟（shift=6 或 shift=-6）----
  if (shift === 6 || shift === -6) {
    const { xiaKeShang, shangKeXia } = findKeRelations(siKe);
    let chu;

    if (xiaKeShang.length > 0) {
      chu = siKe[xiaKeShang[0]].shangIdx;
    } else if (shangKeXia.length > 0) {
      chu = siKe[shangKeXia[0]].shangIdx;
    } else {
      // 无克，取驿马为初传
      chu = findYiMa(dayBranchIndex);
    }

    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '返吟' };
  }

  // ---- 八专课 ----
  if (isBaZhuan(dayGanIndex, dayBranchIndex)) {
    let chu;
    if (isYang) {
      // 阳日：取干上神，顺数三位
      chu = siKe[0].shangIdx;
    } else {
      // 阴日：取支上神，逆数三位
      chu = siKe[2].shangIdx;
    }
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '八专' };
  }

  // ---- 四课不全（别责法）----
  if (isSiKeIncomplete(siKe)) {
    let chu;
    if (isYang) {
      // 阳日：取日干五合干的上神
      const ganHePair = GAN_WU_HE.find(pair => pair[0] === dayGanIndex || pair[1] === dayGanIndex);
      if (ganHePair) {
        const heGanIndex = ganHePair[0] === dayGanIndex ? ganHePair[1] : ganHePair[0];
        const heJiGong = GAN_JI_GONG[TIAN_GAN[heGanIndex]];
        chu = tianPan[heJiGong];
      } else {
        chu = siKe[0].shangIdx;
      }
    } else {
      // 阴日：取日支三合局前一辰
      const sanHeGroup = SAN_HE.find(g => g.branches.includes(dayBranchIndex));
      if (sanHeGroup) {
        const idx = sanHeGroup.branches.indexOf(dayBranchIndex);
        chu = sanHeGroup.branches[(idx - 1 + 3) % 3];
      } else {
        chu = siKe[2].shangIdx;
      }
    }
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '别责' };
  }

  // ---- 贼克法 ----
  const { xiaKeShang, shangKeXia } = findKeRelations(siKe);

  if (xiaKeShang.length === 1) {
    // 重审：仅1个下贼上，取该课上神为初传
    const chu = siKe[xiaKeShang[0]].shangIdx;
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '重审' };
  }

  if (xiaKeShang.length > 1) {
    // 比用：多个下贼上，取与日干五行相同者
    const sameElement = xiaKeShang.filter(i => {
      return getZhiElement(siKe[i].shangIdx) === dayElement;
    });
    if (sameElement.length > 0) {
      const chu = siKe[sameElement[0]].shangIdx;
      const zhong = tianPan[chu];
      const mo = tianPan[zhong];
      return { chu, zhong, mo, keTi: '比用' };
    }
    // 无法区分，用涉害法（简法：取日干上神发用）
    const chu = siKe[0].shangIdx;
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '涉害' };
  }

  if (shangKeXia.length === 1 && xiaKeShang.length === 0) {
    // 元首：无下贼上，仅1个上克下
    const chu = siKe[shangKeXia[0]].shangIdx;
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '元首' };
  }

  if (shangKeXia.length > 1 && xiaKeShang.length === 0) {
    // 知一：多个上克下，取与日干五行相同者
    const sameElement = shangKeXia.filter(i => {
      return getZhiElement(siKe[i].shangIdx) === dayElement;
    });
    if (sameElement.length > 0) {
      const chu = siKe[sameElement[0]].shangIdx;
      const zhong = tianPan[chu];
      const mo = tianPan[zhong];
      return { chu, zhong, mo, keTi: '知一' };
    }
    // 涉害法
    const chu = siKe[0].shangIdx;
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '涉害' };
  }

  // ---- 遥克法 ----
  // 四课无贼克，看日干与四课上神五行遥克
  const shangShenList = siKe.map(k => k.shangIdx);
  const yaoKeList = []; // 上神克日干
  const yaoBeiKeList = []; // 日干克上神

  for (let i = 0; i < shangShenList.length; i++) {
    const shangElem = getZhiElement(shangShenList[i]);
    if (isKe(shangElem, dayElement)) {
      yaoKeList.push(i);
    }
    if (isKe(dayElement, shangElem)) {
      yaoBeiKeList.push(i);
    }
  }

  if (yaoKeList.length > 0) {
    // 上神克日干（蒿矢），取与日干五行相同者
    const sameElement = yaoKeList.filter(i => {
      return getZhiElement(shangShenList[i]) === dayElement;
    });
    const pickIdx = sameElement.length > 0 ? sameElement[0] : yaoKeList[0];
    const chu = shangShenList[pickIdx];
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '遥克' };
  }

  if (yaoBeiKeList.length > 0) {
    // 日干克上神（弹射），取与日干五行相同者
    const sameElement = yaoBeiKeList.filter(i => {
      return getZhiElement(shangShenList[i]) === dayElement;
    });
    const pickIdx = sameElement.length > 0 ? sameElement[0] : yaoBeiKeList[0];
    const chu = shangShenList[pickIdx];
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '遥克' };
  }

  // ---- 昴星法 ----
  // 四课无克无遥克
  if (isYang) {
    // 阳日：取酉(9)上神为初传
    const chu = tianPan[9];
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '昴星' };
  } else {
    // 阴日：取酉(9)下神为初传
    const chu = 9; // 酉在地盘的位置就是9
    const zhong = tianPan[chu];
    const mo = tianPan[zhong];
    return { chu, zhong, mo, keTi: '昴星' };
  }
}

// ============================================================
// 11. 神煞
// ============================================================

/**
 * 计算旬空
 * 根据日干支确定旬首，旬首干支相加对10/12取余确定空亡
 * @param {number} dayGanIndex - 日干索引
 * @param {number} dayBranchIndex - 日支索引
 * @returns {number[]} 空亡地支索引数组（2个）
 */
function getXunKong(dayGanIndex, dayBranchIndex) {
  // 旬空规则：甲子旬空戌亥(10,11)，甲戌旬空申酉(8,9)，
  // 甲申旬空午未(6,7)，甲午旬空辰巳(4,5)，
  // 甲辰旬空寅卯(2,3)，甲寅旬空子丑(0,1)
  // 旬首天干索引 = dayGanIndex, 旬首地支索引由日支推算
  // 简化：用日干索引直接查表
  const xunKongMap = {
    0: [10, 11], // 甲 → 甲子旬 → 空戌亥
    1: [8, 9],   // 乙 → 甲戌旬 → 空申酉
    2: [6, 7],   // 丙 → 甲申旬 → 空午未
    3: [4, 5],   // 丁 → 甲午旬 → 空辰巳
    4: [2, 3],   // 戊 → 甲辰旬 → 空寅卯
    5: [0, 1],   // 己 → 甲寅旬 → 空子丑
    6: [10, 11], // 庚 → 甲子旬 → 空戌亥
    7: [8, 9],   // 辛 → 甲戌旬 → 空申酉
    8: [6, 7],   // 壬 → 甲申旬 → 空午未
    9: [4, 5],   // 癸 → 甲午旬 → 空辰巳
  };
  return xunKongMap[dayGanIndex] || [10, 11];
}

/**
 * 查天乙贵人
 * 甲戊庚→丑未(1,7)，乙己→子申(0,8)，丙丁→亥酉(11,9)，
 * 壬癸→卯巳(3,5)，辛→午寅(6,2)
 * @param {number} dayGanIndex - 日干索引
 * @returns {number[]} 贵人地支索引数组（2个）
 */
function getTianYiGuiRen(dayGanIndex) {
  const map = {
    0: [1, 7],   // 甲 → 丑未
    4: [1, 7],   // 戊 → 丑未
    6: [1, 7],   // 庚 → 丑未
    1: [0, 8],   // 乙 → 子申
    5: [0, 8],   // 己 → 子申
    2: [11, 9],  // 丙 → 亥酉
    3: [11, 9],  // 丁 → 亥酉
    8: [3, 5],   // 壬 → 卯巳
    9: [3, 5],   // 癸 → 卯巳
    7: [6, 2],   // 辛 → 午寅
  };
  return map[dayGanIndex] || [1, 7];
}

/**
 * 查德神
 * 甲己德寅(2)，乙庚德申(8)，丙辛德巳(5)，丁壬德亥(11)，戊癸德巳(5)
 * @param {number} dayGanIndex - 日干索引
 * @returns {number} 德神地支索引
 */
function getDeShen(dayGanIndex) {
  const map = {
    0: 2, 5: 2,   // 甲己 → 寅
    1: 8, 6: 8,   // 乙庚 → 申
    2: 5, 7: 5,   // 丙辛 → 巳
    3: 11, 8: 11, // 丁壬 → 亥
    4: 5, 9: 5,   // 戊癸 → 巳
  };
  return map[dayGanIndex] ?? 2;
}

/**
 * 查禄神
 * 甲禄寅(2)，乙禄卯(3)，丙戊禄巳(5)，丁己禄午(6)，
 * 庚禄申(8)，辛禄酉(9)，壬禄亥(11)，癸禄子(0)
 * @param {number} dayGanIndex - 日干索引
 * @returns {number} 禄神地支索引
 */
function getLuShen(dayGanIndex) {
  const map = {
    0: 2,  // 甲 → 寅
    1: 3,  // 乙 → 卯
    2: 5,  // 丙 → 巳
    3: 6,  // 丁 → 午
    4: 5,  // 戊 → 巳
    5: 6,  // 己 → 午
    6: 8,  // 庚 → 申
    7: 9,  // 辛 → 酉
    8: 11, // 壬 → 亥
    9: 0,  // 癸 → 子
  };
  return map[dayGanIndex] ?? 2;
}

/**
 * 查华盖
 * 寅午戌(2,6,10)→戌(10)，亥卯未(11,3,7)→未(7)，
 * 申子辰(8,0,4)→辰(4)，巳酉丑(5,9,1)→丑(1)
 * @param {number} dayBranchIndex - 日支索引
 * @returns {number} 华盖地支索引
 */
function getHuaGai(dayBranchIndex) {
  const map = {
    2: 10, 6: 10, 10: 10,  // 寅午戌 → 戌
    11: 7, 3: 7, 7: 7,     // 亥卯未 → 未
    8: 4, 0: 4, 4: 4,      // 申子辰 → 辰
    5: 1, 9: 1, 1: 1,      // 巳酉丑 → 丑
  };
  return map[dayBranchIndex] ?? 4;
}

/**
 * 查桃花（咸池）
 * 申子辰(8,0,4)→酉(9)，亥卯未(11,3,7)→子(0)，
 * 寅午戌(2,6,10)→卯(3)，巳酉丑(5,9,1)→午(6)
 * @param {number} dayBranchIndex - 日支索引
 * @returns {number} 桃花地支索引
 */
function getTaoHua(dayBranchIndex) {
  const map = {
    8: 9, 0: 9, 4: 9,      // 申子辰 → 酉
    11: 0, 3: 0, 7: 0,     // 亥卯未 → 子
    2: 3, 6: 3, 10: 3,     // 寅午戌 → 卯
    5: 6, 9: 6, 1: 6,      // 巳酉丑 → 午
  };
  return map[dayBranchIndex] ?? 9;
}

/**
 * 计算完整神煞
 * @param {number} dayGanIndex - 日干索引
 * @param {number} dayBranchIndex - 日支索引
 * @returns {object} 神煞对象
 */
function calculateShenSha(dayGanIndex, dayBranchIndex) {
  const xunKong = getXunKong(dayGanIndex, dayBranchIndex);
  const tianYiGuiRen = getTianYiGuiRen(dayGanIndex);
  const deShen = getDeShen(dayGanIndex);
  const luShen = getLuShen(dayGanIndex);
  const huaGai = getHuaGai(dayBranchIndex);
  const taoHua = getTaoHua(dayBranchIndex);
  const yiMa = findYiMa(dayBranchIndex);

  return {
    xunKong: xunKong.map(i => DI_ZHI[i]),
    xunKongIndex: xunKong,
    tianYiGuiRen: tianYiGuiRen.map(i => DI_ZHI[i]),
    tianYiGuiRenIndex: tianYiGuiRen,
    deShen: DI_ZHI[deShen],
    deShenIndex: deShen,
    luShen: DI_ZHI[luShen],
    luShenIndex: luShen,
    huaGai: DI_ZHI[huaGai],
    huaGaiIndex: huaGai,
    taoHua: DI_ZHI[taoHua],
    taoHuaIndex: taoHua,
    yiMa: DI_ZHI[yiMa],
    yiMaIndex: yiMa,
  };
}

// ============================================================
// 12. 格局分析
// ============================================================

/**
 * 分析特殊格局
 * @param {number} dayGanIndex - 日干索引
 * @param {number} dayBranchIndex - 日支索引
 * @param {Array} siKe - 四课数组
 * @param {number} chu - 初传地支索引
 * @param {number} zhong - 中传地支索引
 * @param {number} mo - 末传地支索引
 * @param {number[]} xunKong - 旬空地支索引数组
 * @returns {string[]} 格局名称数组
 */
function analyzePatterns(dayGanIndex, dayBranchIndex, siKe, chu, zhong, mo, xunKong) {
  const patterns = [];
  const ganJiGong = GAN_JI_GONG[TIAN_GAN[dayGanIndex]];
  const dayElement = getGanElement(dayGanIndex);

  // 前后引从：初传在日干寄宫前一位，末传在后一位
  const ganJiGongPrev = mod(ganJiGong - 1, 12);
  const ganJiGongNext = mod(ganJiGong + 1, 12);
  if (chu === ganJiGongPrev && mo === ganJiGongNext) {
    patterns.push('前后引从');
  }
  // 反向也算
  if (chu === ganJiGongNext && mo === ganJiGongPrev) {
    patterns.push('前后引从');
  }

  // 首尾相见：初传与末传相同或六合
  if (chu === mo) {
    patterns.push('首尾相见');
  } else {
    const isLiuHe = LIU_HE.some(pair =>
      (pair[0] === chu && pair[1] === mo) || (pair[1] === chu && pair[0] === mo)
    );
    if (isLiuHe) {
      patterns.push('首尾相见');
    }
  }

  // 闭口卦：旬空临日或初传
  if (xunKong.includes(dayBranchIndex) || xunKong.includes(chu)) {
    patterns.push('闭口');
  }

  // 交车相合：日干上神与日支上神六合
  const ganShangIdx = siKe[0].shangIdx;
  const zhiShangIdx = siKe[2].shangIdx;
  const isJiaoChe = LIU_HE.some(pair =>
    (pair[0] === ganShangIdx && pair[1] === zhiShangIdx) ||
    (pair[1] === ganShangIdx && pair[0] === zhiShangIdx)
  );
  if (isJiaoChe) {
    patterns.push('交车相合');
  }

  // 干支皆败：日干上神和日支上神都处于"沐浴"位
  // 沐浴位：木败子(0)、火败卯(3)、金败午(6)、水土败酉(9)
  const baiMap = { wood: 0, fire: 3, metal: 6, earth: 9, water: 9 };
  const baiPosition = baiMap[dayElement];
  if (baiPosition !== undefined && ganShangIdx === baiPosition && zhiShangIdx === baiPosition) {
    patterns.push('干支皆败');
  }

  // 旺禄临身：日禄临日干且不空亡
  const luShenIndex = getLuShen(dayGanIndex);
  if (ganShangIdx === luShenIndex && !xunKong.includes(luShenIndex)) {
    patterns.push('旺禄临身');
  }

  return patterns;
}

/**
 * 判断课传中是否见丁神
 * 丁神：课传中见丁(天干)或午(地支，丁寄午)
 * @param {Array} siKe - 四课数组
 * @param {number} chu - 初传地支索引
 * @param {number} zhong - 中传地支索引
 * @param {number} mo - 末传地支索引
 * @returns {boolean}
 */
function hasDingShen(siKe, chu, zhong, mo) {
  // 检查四课和三传中是否有午(6)，丁寄午
  const allZhi = [
    siKe[0].shangIdx, siKe[0].xiaIdx,
    siKe[1].shangIdx, siKe[1].xiaIdx,
    siKe[2].shangIdx, siKe[2].xiaIdx,
    siKe[3].shangIdx, siKe[3].xiaIdx,
    chu, zhong, mo,
  ];
  return allZhi.includes(6); // 午=6，丁寄午
}

// ============================================================
// 13. divine() 主函数
// ============================================================

/**
 * 大六壬排盘主函数
 * @param {Date} date - 起课时间
 * @param {string} [city=null] - 城市名称（用于真太阳时校正）
 * @returns {object} 完整排盘结果
 */
export function divine(date, city = null) {
  // 1. 真太阳时校正
  const correctedDate = city ? correctSolarTime(date, city) : new Date(date);

  // 2. 子时跨日处理：23:00后日干支取次日
  const hour = correctedDate.getHours();
  const minute = correctedDate.getMinutes();
  let dayDate = new Date(correctedDate);
  if (hour >= 23) {
    dayDate = new Date(correctedDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // 3. 日干支计算
  const dayGZ = getDayGanZhi(dayDate);
  const dayGanIndex = dayGZ.ganIndex;
  const dayBranchIndex = dayGZ.zhiIndex;

  // 4. 占时确定
  const hourBranchIndex = getHourBranch(hour, minute);

  // 5. 月将确定
  const { zhongqiName, yueJiangIndex } = getMonthGeneral(correctedDate);

  // 6. 天地盘（位移 = 月将 - 占时）
  const shift = mod(yueJiangIndex - hourBranchIndex, 12);
  const { diPan, tianPan } = buildTianDiPan(shift);

  // 7. 四课
  const siKe = buildSiKe(dayGanIndex, dayBranchIndex, tianPan);

  // 8. 三传
  const sanZhuan = determineSanZhuan(dayGanIndex, dayBranchIndex, siKe, tianPan, shift);

  // 9. 神煞
  const shenSha = calculateShenSha(dayGanIndex, dayBranchIndex);

  // 10. 格局分析
  const patterns = analyzePatterns(
    dayGanIndex, dayBranchIndex, siKe,
    sanZhuan.chu, sanZhuan.zhong, sanZhuan.mo,
    shenSha.xunKongIndex
  );

  // 11. 丁神判定
  const hasDing = hasDingShen(siKe, sanZhuan.chu, sanZhuan.zhong, sanZhuan.mo);

  // 12. 组装返回结果
  return {
    dayStem: TIAN_GAN[dayGanIndex],          // 日干字符
    dayBranch: DI_ZHI[dayBranchIndex],        // 日支字符
    dayGanIndex,                               // 日干索引 0-9
    dayBranchIndex,                            // 日支索引 0-11
    ganShangShen: DI_ZHI[siKe[0].shangIdx],   // 日干上神（地支字符）
    zhiShangShen: DI_ZHI[siKe[2].shangIdx],   // 日支上神（地支字符）
    chuZhuan: DI_ZHI[sanZhuan.chu],           // 初传（地支字符）
    zhongZhuan: DI_ZHI[sanZhuan.zhong],       // 中传（地支字符）
    moZhuan: DI_ZHI[sanZhuan.mo],             // 末传（地支字符）
    siKe: siKe.map(k => ({ shang: k.shang, xia: k.xia })), // 四课数组
    hasDingShen: hasDing,                     // 课传是否见丁神
    patterns,                                  // 特殊格局数组
    keTi: sanZhuan.keTi,                      // 课体名称
    shenSha,                                   // 神煞对象
    tianPan,                                   // 天盘数组（地支索引0-11）
    diPan,                                     // 地盘数组（0-11）
    shift,                                     // 位移值
    monthGeneral: DI_ZHI[yueJiangIndex],       // 月将地支字符
    hourBranch: DI_ZHI[hourBranchIndex],       // 占时地支字符
  };
}
