/**
 * share.js - 分享卡生成
 * "上帝帮你掷骰子" 分享模块
 */

// ========== 模板尺寸（全部 9:16）==========
const TEMPLATE_SIZES = {
  conclusion: { width: 750, height: 1334 },
  versus:     { width: 750, height: 1334 },
  ask_help:   { width: 750, height: 1334 },
};

// ========== 颜色常量 ==========
const COLORS = {
  bg:          '#1A1A2E',
  brand:       '#C9A96E',
  brandLight:  '#E8D5A3',
  white:       '#FFFFFF',
  whiteSoft:   'rgba(255,255,255,0.85)',
  whiteMuted:  'rgba(255,255,255,0.55)',
  risk:        '#E85D5D',
  riskBg:      'rgba(232,93,93,0.12)',
  ctaBg:       '#C9A96E',
  ctaText:     '#1A1A2E',
  divider:     'rgba(201,169,110,0.3)',
};

// ========== 插画资源配置 ==========
const ILLUSTRATION_CONFIG = {
  eat_today: {
    main: 'assets/posters/eat_today.jpg',
    accentColor: '#F4A261',
    topGradient: ['#F4A261', '#E76F51'],
    bottomText: '宇宙已帮你点好单 ✨',
  },
  drink_today: {
    main: 'assets/posters/drink_today.jpg',
    accentColor: '#D4A574',
    topGradient: ['#D4A574', '#8D6E63'],
    bottomText: '宇宙已帮你续好命 ☕',
  },
  wear_today: {
    main: 'assets/posters/wear_today.jpg',
    accentColor: '#FF8A80',
    topGradient: ['#FF8A80', '#A5D6A7'],
    bottomText: '宇宙已帮你搭好衣 👗',
  },
  wash_hair: {
    main: 'assets/posters/wash_hair.jpg',
    accentColor: '#B39DDB',
    topGradient: ['#B39DDB', '#64B5F6'],
    bottomText: '宇宙已帮你洗好头 🫧',
  },
  sleep_early: {
    main: 'assets/posters/sleep_early.jpg',
    accentColor: '#7986CB',
    topGradient: ['#5C6BC0', '#FFD54F'],
    bottomText: '宇宙已帮你铺好床 🌙',
  },
  go_out: {
    main: 'assets/posters/go_out.jpg',
    accentColor: '#66BB6A',
    topGradient: ['#66BB6A', '#8D6E63'],
    bottomText: '宇宙已帮你开好门 🚪',
  },
  send_msg: {
    main: 'assets/posters/send_msg.jpg',
    accentColor: '#42A5F5',
    topGradient: ['#42A5F5', '#EC407A'],
    bottomText: '宇宙已帮你发好信 💬',
  },
  buy_it: {
    main: 'assets/posters/buy_it.jpg',
    accentColor: '#FFD54F',
    topGradient: ['#FFD54F', '#EC407A'],
    bottomText: '宇宙已帮你付好款 🛍️',
  },
  date: {
    main: 'assets/posters/date.jpg',
    accentColor: '#F48FB1',
    topGradient: ['#F48FB1', '#CE93D8'],
    bottomText: '宇宙已帮你约好人 💕',
  },
  fitness: {
    main: 'assets/posters/fitness.jpg',
    accentColor: '#FF8A65',
    topGradient: ['#FF8A65', '#AED581'],
    bottomText: '宇宙已帮你热好身 💪',
  },
  study: {
    main: 'assets/posters/study.jpg',
    accentColor: '#4DB6AC',
    topGradient: ['#4DB6AC', '#7986CB'],
    bottomText: '宇宙已帮你翻好书 📖',
  },
  diet: {
    main: 'assets/posters/diet.jpg',
    accentColor: '#81C784',
    topGradient: ['#81C784', '#AED581'],
    bottomText: '宇宙已帮你管好嘴 🍎',
  },
  custom: {
    main: 'assets/posters/custom.jpg',
    accentColor: '#CE93D8',
    topGradient: ['#CE93D8', '#7986CB'],
    bottomText: '宇宙已帮你算好卦 🔮',
  },
};

// ========== 图片缓存与加载 ==========
const imageCache = new Map();

function loadImage(src) {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn('插画加载失败:', src);
      reject(new Error('Failed to load: ' + src));
    };
    img.src = src;
  });
}

async function loadIllustration(templateId) {
  const config = ILLUSTRATION_CONFIG[templateId];
  if (!config) return { main: null, config: null };
  try {
    const main = await loadImage(config.main);
    return { main, config };
  } catch {
    return { main: null, config };
  }
}

export async function preloadAllIllustrations() {
  const keys = Object.keys(ILLUSTRATION_CONFIG);
  await Promise.allSettled(keys.map(k => loadIllustration(k)));
}

// ========== 布局常量（C方案：极简社交卡，大留白）==========
const LAYOUT = {
  conclusion: {
    width: 750, height: 1334,
    topDeco: { y: 0, h: 60 },
    brand: { y: 40 },
    question: { y: 110 },
    illustration: { y: 180, h: 280, imgW: 630 },
    divider: { y: 480 },
    content: { startY: 510, endY: 1200 },
    bottomDeco: { y: 1200, h: 60 },
    watermark: { y: 1310 },
  },
  versus: {
    width: 750, height: 1334,
    topDeco: { y: 0, h: 60 },
    brand: { y: 40 },
    question: { y: 110 },
    illustration: { y: 180, h: 280, imgW: 630 },
    divider: { y: 480 },
    content: { startY: 510, endY: 1200 },
    bottomDeco: { y: 1200, h: 60 },
    watermark: { y: 1310 },
  },
  ask_help: {
    width: 750, height: 1334,
    topDeco: { y: 0, h: 60 },
    brand: { y: 40 },
    question: { y: 110 },
    illustration: { y: 180, h: 280, imgW: 630 },
    divider: { y: 480 },
    content: { startY: 510, endY: 1200 },
    bottomDeco: { y: 1200, h: 60 },
    watermark: { y: 1310 },
  },
};

// ========== 辅助函数 ==========

/**
 * 圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 根据字符串生成颜色（HSL）
 */
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * 绘制用户头像和昵称
 */
function drawUserInfo(ctx, w, y, nickname) {
  const avatarSize = 40;
  const avatarX = w / 2 - avatarSize / 2 - 80;
  const avatarY = y;

  // 绘制圆形头像
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // 根据昵称生成颜色填充
  ctx.fillStyle = stringToColor(nickname);
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

  // 昵称首字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname.charAt(0), avatarX + avatarSize / 2, avatarY + avatarSize / 2);

  ctx.restore();

  // 绘制昵称文字
  ctx.fillStyle = COLORS.whiteMuted;
  ctx.font = '16px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname, avatarX + avatarSize + 12, avatarY + avatarSize / 2);
}

/**
 * 绘制用户签名
 */
function drawSignature(ctx, w, y, signature) {
  if (!signature) return;

  // 金色斜体签名，带引号装饰
  ctx.fillStyle = COLORS.brand;
  ctx.font = 'italic 18px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 带引号的签名
  const signedText = `「${signature}」`;
  ctx.fillText(signedText, w / 2, y);
}

/**
 * 绘制星空背景点缀
 */
function drawStarfield(ctx, w, h) {
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    const sr = 0.3 + Math.random() * 1.0;
    const sa = 0.15 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${sa.toFixed(2)})`;
    ctx.fill();
  }
}

/**
 * 文字自动换行绘制
 * @returns {number} 实际绘制行数
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
  const { align = 'center', color = COLORS.whiteSoft, fontSize = 28, fontWeight = '400' } = options;
  ctx.font = `${fontWeight} ${fontSize}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (const ch of chars) {
    const testLine = line + ch;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = ch;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount++;
  }
  return lineCount;
}

/**
 * 绘制金色渐变文字
 */
function drawGoldText(ctx, text, x, y, maxWidth, fontSize, lineHeight) {
  ctx.font = `700 ${fontSize}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const grad = ctx.createLinearGradient(x - maxWidth / 2, y, x + maxWidth / 2, y + fontSize);
  grad.addColorStop(0, COLORS.brandLight);
  grad.addColorStop(0.5, COLORS.brand);
  grad.addColorStop(1, COLORS.brandLight);
  ctx.fillStyle = grad;

  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (const ch of chars) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = ch;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount++;
  }
  return lineCount;
}

/**
 * 绘制顶部品牌标识
 */
function drawBrand(ctx, w, brandY) {
  ctx.font = '600 32px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.brand;
  ctx.fillText('上帝帮你掷骰子', w / 2, brandY);
}

/**
 * 绘制底部信息区（编号+日期+CTA）
 */
function drawWatermark(ctx, w, h, watermarkY) {
  const now = new Date();
  const dateStr = now.getFullYear() + '.' +
    String(now.getMonth() + 1).padStart(2, '0') + '.' +
    String(now.getDate()).padStart(2, '0');
  const serialNo = 'No.' + String(Math.floor(Math.random() * 9000000 + 1000000));

  // 日期（小字）
  ctx.font = '400 16px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('宇宙于 ' + dateStr + ' 下达指令', w / 2, watermarkY - 40);

  // 编号（小字）
  ctx.fillText(serialNo, w / 2, watermarkY - 20);

  // CTA（极小字）
  ctx.fillStyle = 'rgba(201,169,110,0.5)';
  ctx.fillText('扫码让宇宙帮你选', w / 2, watermarkY);
}

/**
 * 绘制分隔线
 */
function drawDivider(ctx, x, y, w) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ========== 新增：插画绘制函数 ==========

/**
 * 绘制顶部装饰区 — 主题色渐变条
 */
function drawTopDecoration(ctx, w, config) {
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, config.topGradient[0] + '22');
  grad.addColorStop(0.5, config.topGradient[0] + '44');
  grad.addColorStop(1, config.topGradient[1] + '22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 80);

  // 底部细线
  ctx.beginPath();
  ctx.moveTo(0, 80);
  ctx.lineTo(w, 80);
  ctx.strokeStyle = config.accentColor + '33';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * 绘制底部装饰区 — 主题色渐变 + 趣味标语
 */
function drawBottomDecoration(ctx, w, h, config) {
  const grad = ctx.createLinearGradient(0, h - 100, w, h);
  grad.addColorStop(0, config.topGradient[1] + '11');
  grad.addColorStop(0.5, config.topGradient[0] + '33');
  grad.addColorStop(1, config.topGradient[1] + '11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - 100, w, 100);

  // 顶部细线
  ctx.beginPath();
  ctx.moveTo(0, h - 100);
  ctx.lineTo(w, h - 100);
  ctx.strokeStyle = config.accentColor + '22';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 趣味标语
  if (config.bottomText) {
    ctx.font = '400 20px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = config.accentColor + '88';
    ctx.fillText(config.bottomText, w / 2, h - 72);
  }
}

/**
 * 绘制主插画 — 居中，圆角裁剪，比例适配
 */
function drawMainIllustration(ctx, img, layout) {
  const { y, h, imgW } = layout.illustration;
  const x = (layout.width - imgW) / 2;

  // 圆角裁剪
  ctx.save();
  roundRect(ctx, x, y, imgW, h, 16);
  ctx.clip();

  // 保持比例绘制（cover 模式）
  const scale = Math.max(imgW / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = x + (imgW - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  ctx.restore();

  // 插画边框
  roundRect(ctx, x, y, imgW, h, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ========== 模板绘制（重构版）==========

/**
 * conclusion 模板 — C方案极简社交卡
 * 信息层级：结论(最大) > 金句 > 理由 > 建议 > 趋势
 */
function drawConclusion(ctx, w, h, opt, layout) {
  let curY = layout.content.startY;

  // 结论标题（放大到 42px，视觉焦点）
  curY += drawGoldText(ctx, opt.title || '', w / 2, curY, w - 120, 42, 56) * 56 + 16;

  // 宇宙一句话（金句提升到第二位，带引号）
  if (opt.oneLiner) {
    curY += 12;
    curY += wrapText(ctx, '「' + opt.oneLiner + '」', w / 2, curY, w - 140, 38, {
      fontSize: 26, fontWeight: '600', color: '#C4B5FD',
    }) * 38 + 16;
  }

  // 分隔线（短金线）
  drawDivider(ctx, w / 2, curY, w * 0.2);
  curY += 28;

  // 理由（带标签）
  if (opt.reason) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('宇宙的理由', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, opt.reason, w / 2, curY, w - 120, 36, {
      fontSize: 22, color: COLORS.whiteSoft,
    }) * 36 + 20;
  }

  // 建议（带标签）
  if (opt.action) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('建议', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, '→ ' + opt.action, w / 2, curY, w - 120, 36, {
      fontSize: 22, color: COLORS.brandLight, fontWeight: '500',
    }) * 36 + 20;
  }

  // 趋势（带标签）
  if (opt.trend) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('趋势', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, opt.trend, w / 2, curY, w - 120, 34, {
      fontSize: 20, color: 'rgba(255,255,255,0.65)',
    }) * 34 + 16;
  }

  // 置信度（小字，低调）
  if (opt.confidence != null) {
    curY += 8;
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('置信度 ' + opt.confidence + '%', w / 2, curY);
  }
}

/**
 * versus 模板 — C方案极简社交卡
 */
function drawVersus(ctx, w, h, opt, layout) {
  let curY = layout.content.startY;

  // VS 标记
  ctx.font = '700 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.brand;
  ctx.fillText('— VS —', w / 2, curY);
  curY += 40;

  // 结论标题（放大）
  curY += drawGoldText(ctx, opt.title || '', w / 2, curY, w - 120, 42, 56) * 56 + 16;

  // 分隔线
  drawDivider(ctx, w / 2, curY, w * 0.2);
  curY += 28;

  // 理由（带标签）
  if (opt.reason) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('宇宙的理由', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, opt.reason, w / 2, curY, w - 120, 36, {
      fontSize: 22, color: COLORS.whiteSoft,
    }) * 36 + 20;
  }

  // 建议（带标签）
  if (opt.action) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('建议', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, '→ ' + opt.action, w / 2, curY, w - 120, 36, {
      fontSize: 22, color: COLORS.brandLight, fontWeight: '500',
    }) * 36 + 20;
  }

  // 趋势（带标签）
  if (opt.trend) {
    ctx.font = '400 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.whiteMuted;
    ctx.fillText('趋势', w / 2, curY);
    curY += 30;

    curY += wrapText(ctx, opt.trend, w / 2, curY, w - 120, 34, {
      fontSize: 20, color: 'rgba(255,255,255,0.65)',
    }) * 34 + 16;
  }
}

/**
 * ask_help 模板 — Oracle 风格长卡
 */
function drawAskHelp(ctx, w, h, opt, layout) {
  let curY = layout.content.startY;

  // Oracle 风格标题
  ctx.font = '600 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.brand;
  ctx.fillText('✦ 神谕 ✦', w / 2, curY);
  curY += 44;

  // 结论标题
  curY += drawGoldText(ctx, opt.title || '', w / 2, curY, w - 100, 34, 46) * 46 + 12;

  // 理由
  curY += wrapText(ctx, opt.reason || '', w / 2, curY, w - 100, 36, {
    fontSize: 24, color: COLORS.whiteSoft,
  }) * 36 + 12;

  // 建议
  if (opt.action) {
    curY += wrapText(ctx, '→ ' + opt.action, w / 2, curY, w - 100, 36, {
      fontSize: 24, color: COLORS.brandLight, fontWeight: '500',
    }) * 36 + 20;
  }

  // 风险提示区
  if (opt.risk) {
    curY += 10;
    const riskPadX = 50;
    const riskPadY = 20;
    const riskTextW = w - riskPadX * 2;
    const riskLineCount = wrapText(ctx, opt.risk, w / 2, curY + riskPadY, riskTextW - 40, 34, {
      fontSize: 22, color: COLORS.risk,
    });
    const riskBoxH = riskLineCount * 34 + riskPadY * 2;

    roundRect(ctx, riskPadX, curY, riskTextW, riskBoxH, 12);
    ctx.fillStyle = COLORS.riskBg;
    ctx.fill();

    wrapText(ctx, '⚠ ' + opt.risk, w / 2, curY + riskPadY, riskTextW - 40, 34, {
      fontSize: 22, color: COLORS.risk,
    });
    curY += riskBoxH + 20;
  }

  // CTA 按钮
  if (opt.cta) {
    curY += 14;
    const btnW = 400;
    const btnH = 56;
    const btnX = (w - btnW) / 2;
    roundRect(ctx, btnX, curY, btnW, btnH, 28);
    ctx.fillStyle = COLORS.ctaBg;
    ctx.fill();

    ctx.font = '600 26px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ctaText;
    ctx.fillText(opt.cta, w / 2, curY + btnH / 2);
  }
}

// ========== 公开 API ==========

/**
 * 生成分享卡图片
 * @param {object} options
 * @param {string} options.type - 'conclusion' | 'versus' | 'ask_help'
 * @param {string} [options.templateId] - 模块ID（用于加载对应插画）
 * @param {string} options.question - 问题文本
 * @param {string} options.title - 结论标题
 * @param {string} options.reason - 理由
 * @param {string} options.action - 建议
 * @param {string} [options.risk] - 风险（可选）
 * @param {string} [options.trend] - 趋势（可选）
 * @param {string} [options.cta] - CTA文案（可选）
 * @param {number} [options.confidence] - 置信度0-100
 * @returns {Promise<string>} - base64 PNG URL
 */
export async function generateShareCard(options) {
  try {
  const { type = 'conclusion', templateId } = options;
  const size = TEMPLATE_SIZES[type] || TEMPLATE_SIZES.conclusion;
  const layout = LAYOUT[type] || LAYOUT.conclusion;

  // 等待字体加载完成
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // 预加载插画
  const { main: illustImg, config: illustConfig } = await loadIllustration(templateId);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');

  // 1. 深色背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, size.width, size.height);

  // 2. 星空点缀
  drawStarfield(ctx, size.width, size.height);

  // 3. 顶部装饰
  if (illustConfig) {
    drawTopDecoration(ctx, size.width, illustConfig);
  }

  // 4. 品牌标识
  drawBrand(ctx, size.width, layout.brand.y);

  // 4.5 用户头像和昵称
  if (options.nickname) {
    drawUserInfo(ctx, size.width, layout.brand.y + 50, options.nickname);
  }

  // 5. 问题文字
  wrapText(ctx, options.question || '', size.width / 2, layout.question.y, size.width - 80, 36, {
    fontSize: 24, color: COLORS.whiteMuted, fontWeight: '400',
  });

  // 6. 主插画
  if (illustImg) {
    drawMainIllustration(ctx, illustImg, layout);
  }

  // 7. 分隔线
  drawDivider(ctx, size.width / 2, layout.divider.y, size.width * 0.5);

  // 8. 内容区
  switch (type) {
    case 'versus':
      drawVersus(ctx, size.width, size.height, options, layout);
      break;
    case 'ask_help':
      drawAskHelp(ctx, size.width, size.height, options, layout);
      break;
    default:
      drawConclusion(ctx, size.width, size.height, options, layout);
  }

  // 9. 底部装饰
  if (illustConfig) {
    drawBottomDecoration(ctx, size.width, size.height, illustConfig);
  }

  // 9.5 用户签名
  if (options.signature) {
    drawSignature(ctx, size.width, size.height - 120, options.signature);
  }

  // 10. 水印
  drawWatermark(ctx, size.width, size.height, layout.watermark.y);

  return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[share] generateShareCard 异常:', e);
    // 降级：生成简单的纯文字分享图
    return generateFallbackShareCard(options);
  }
}

/**
 * 降级分享卡（纯文字版）
 */
function generateFallbackShareCard(options) {
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 1334;
  const ctx = canvas.getContext('2d');

  // 深色背景
  ctx.fillStyle = '#1A1A2E';
  ctx.fillRect(0, 0, 750, 1334);

  // 品牌标识
  ctx.fillStyle = '#C9A96E';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('上帝帮你掷骰子', 375, 200);

  // 问题
  ctx.fillStyle = '#E8E8E8';
  ctx.font = '24px "Noto Sans SC", sans-serif';
  ctx.fillText(options.question || '你的问题', 375, 400);

  // 结论
  ctx.fillStyle = '#C9A96E';
  ctx.font = 'bold 48px "Noto Serif SC", serif';
  ctx.fillText(options.title || '宇宙说：冲', 375, 600);

  // 底部提示
  ctx.fillStyle = '#8B8B9E';
  ctx.font = '18px "Noto Sans SC", sans-serif';
  ctx.fillText('长按保存，分享给朋友', 375, 1200);

  return canvas.toDataURL('image/png');
}

/**
 * 保存/分享图片
 * @param {string} dataUrl - base64图片
 * @param {string} [filename] - 文件名
 */
export async function saveOrShareImage(dataUrl, filename = '上帝帮你掷骰子.png') {
  // 优先使用 Web Share API
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '上帝帮你掷骰子',
          text: '来看看上帝的答案',
        });
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // 降级：创建 <a> 标签下载
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
