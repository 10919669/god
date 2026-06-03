/**
 * share.js
 * 长版社交海报生成器
 */

const POSTER_WIDTH = 1080;
const POSTER_MIN_HEIGHT = 1680;
const POSTER_DEFAULT_HEIGHT = 1920;
const POSTER_MAX_HEIGHT = 2280;
const OUTER_MARGIN = 48;
const CONTENT_WIDTH = POSTER_WIDTH - OUTER_MARGIN * 2;
const HERO_HEIGHT = 560;
const HERO_TOP = 182;
const BODY_TOP = HERO_TOP + HERO_HEIGHT - 56;
const BOTTOM_BLOCK_HEIGHT = 208;

const BASE_COLORS = {
  text: '#F8FAFC',
  muted: 'rgba(226,232,240,0.78)',
  soft: 'rgba(226,232,240,0.58)',
  divider: 'rgba(255,255,255,0.10)',
  panel: 'rgba(5,10,28,0.78)',
  panelBorder: 'rgba(255,255,255,0.08)',
  gold: '#F4D38A',
  goldSoft: '#E9C77A',
  dark: '#050814',
};

const FAMILY_PALETTES = {
  eat_today: ['#FF8A3D', '#FF597B', '#22133C'],
  drink_today: ['#65D6CE', '#58A6FF', '#162240'],
  wear_today: ['#FCA5A5', '#C084FC', '#261337'],
  wash_hair: ['#7DD3FC', '#C4B5FD', '#14213A'],
  sleep_early: ['#8B5CF6', '#FDE68A', '#120B30'],
  go_out: ['#34D399', '#60A5FA', '#0F1B36'],
  send_msg: ['#60A5FA', '#FB7185', '#1B1A3A'],
  buy_it: ['#FBBF24', '#FB7185', '#281C33'],
  date: ['#FB7185', '#C084FC', '#24162E'],
  fitness: ['#FB923C', '#4ADE80', '#152227'],
  study: ['#22D3EE', '#818CF8', '#121C36'],
  diet: ['#86EFAC', '#34D399', '#12211E'],
  oracle: ['#A78BFA', '#F4D38A', '#140F2B'],
  generic: ['#7DD3FC', '#A78BFA', '#141A2E'],
};

const TONE_LABELS = {
  bestie: '温柔宇宙',
  sarcastic: '毒舌宇宙',
  slacker: '摆烂宇宙',
  oracle: '宇宙判断',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeTone(tone = '') {
  if (tone === 'sarcastic' || tone === 'slacker' || tone === 'oracle') return tone;
  return 'bestie';
}

function withAlpha(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex;
  const safeAlpha = clamp(alpha, 0, 1);
  const value = Math.round(safeAlpha * 255).toString(16).padStart(2, '0');
  return `${hex}${value}`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = null) {
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function setFont(ctx, font) {
  ctx.font = font;
}

function splitParagraphs(text = '') {
  return String(text)
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return [];

  const lines = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    let line = '';
    for (const char of Array.from(paragraph)) {
      const nextLine = line + char;
      if (ctx.measureText(nextLine).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = nextLine;
      }
    }
    if (line) lines.push(line);
    if (paragraphIndex < paragraphs.length - 1) lines.push('');
  });
  return lines;
}

function measureTextBlock(ctx, text, maxWidth, font, lineHeight) {
  setFont(ctx, font);
  const lines = wrapLines(ctx, text, maxWidth);
  const height = lines.length > 0 ? lines.length * lineHeight : 0;
  return { lines, height };
}

function drawLines(ctx, lines, x, y, lineHeight, color, align = 'left') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  ctx.restore();
}

function drawLinesWithShadow(ctx, lines, x, y, lineHeight, color, align = 'left', shadow = {}) {
  ctx.save();
  ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.36)';
  ctx.shadowBlur = shadow.blur ?? 18;
  ctx.shadowOffsetX = shadow.offsetX ?? 0;
  ctx.shadowOffsetY = shadow.offsetY ?? 6;
  drawLines(ctx, lines, x, y, lineHeight, color, align);
  ctx.restore();
}

function buildPalette(family, tone) {
  const [c1, c2, c3] = FAMILY_PALETTES[family] || FAMILY_PALETTES.generic;
  if (tone === 'sarcastic') {
    return ['#FB7185', c2, '#220C18'];
  }
  if (tone === 'slacker') {
    return ['#94A3B8', '#64748B', '#111827'];
  }
  if (tone === 'oracle') {
    return ['#C4B5FD', '#F4D38A', '#140F2B'];
  }
  return [c1, c2, c3];
}

function drawBackdrop(ctx, height, palette, rng) {
  const gradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, height);
  gradient.addColorStop(0, '#040611');
  gradient.addColorStop(0.36, palette[2]);
  gradient.addColorStop(1, '#03050E');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POSTER_WIDTH, height);

  for (let i = 0; i < 72; i++) {
    const x = rng() * POSTER_WIDTH;
    const y = rng() * height;
    const radius = 0.5 + rng() * 1.8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.08 + rng() * 0.22})`;
    ctx.fill();
  }

  ctx.save();
  const glow = ctx.createRadialGradient(POSTER_WIDTH * 0.5, 120, 30, POSTER_WIDTH * 0.5, 120, 420);
  glow.addColorStop(0, withAlpha(palette[0], 0.18));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, POSTER_WIDTH, 540);
  ctx.restore();
}

function drawChip(ctx, text, x, y, fill, stroke, color) {
  if (!text) return 0;
  setFont(ctx, '600 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  const width = ctx.measureText(text).width + 42;
  drawRoundedRect(ctx, x, y, width, 46, 23, fill, stroke);
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 21, y + 23);
  ctx.restore();
  return width;
}

function drawQuestionStrip(ctx, question) {
  if (!question) return;
  drawRoundedRect(
    ctx,
    OUTER_MARGIN,
    118,
    CONTENT_WIDTH,
    44,
    22,
    'rgba(255,255,255,0.04)',
    'rgba(255,255,255,0.07)'
  );
  setFont(ctx, '500 20px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  const lines = wrapLines(ctx, question, CONTENT_WIDTH - 44);
  drawLines(ctx, lines.slice(0, 1), OUTER_MARGIN + 22, 129, 26, BASE_COLORS.soft, 'left');
}

function drawBrandHeader(ctx, questionFamily, tone) {
  ctx.save();
  const titleGradient = ctx.createLinearGradient(OUTER_MARGIN, 0, POSTER_WIDTH - OUTER_MARGIN, 0);
  titleGradient.addColorStop(0, '#F8FAFC');
  titleGradient.addColorStop(0.5, '#F4D38A');
  titleGradient.addColorStop(1, '#F8FAFC');
  setFont(ctx, '700 40px "Noto Serif SC","Source Han Serif SC","Songti SC",serif');
  ctx.fillStyle = titleGradient;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('上帝帮你掷骰子', OUTER_MARGIN, 52);
  ctx.restore();

  const familyText = questionFamily.replace(/_/g, ' ').toUpperCase();
  const toneText = TONE_LABELS[tone] || TONE_LABELS.bestie;
  const familyWidth = drawChip(
    ctx,
    familyText,
    OUTER_MARGIN,
    76,
    'rgba(255,255,255,0.05)',
    'rgba(255,255,255,0.08)',
    BASE_COLORS.muted
  );
  drawChip(
    ctx,
    toneText,
    OUTER_MARGIN + familyWidth + 12,
    76,
    'rgba(244,211,138,0.12)',
    'rgba(244,211,138,0.18)',
    BASE_COLORS.gold
  );
}

function drawSceneCard(ctx, x, y, width, height, palette, tone) {
  const cardGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  cardGradient.addColorStop(0, withAlpha(palette[0], 0.28));
  cardGradient.addColorStop(0.55, withAlpha(palette[1], 0.18));
  cardGradient.addColorStop(1, withAlpha('#050814', 0.92));
  drawRoundedRect(ctx, x, y, width, height, 42, cardGradient, 'rgba(255,255,255,0.08)');

  const overlay = ctx.createLinearGradient(x, y, x, y + height);
  overlay.addColorStop(0, 'rgba(255,255,255,0.02)');
  overlay.addColorStop(0.7, 'rgba(0,0,0,0)');
  overlay.addColorStop(1, tone === 'sarcastic' ? 'rgba(62,12,20,0.35)' : 'rgba(5,8,20,0.48)');
  drawRoundedRect(ctx, x, y, width, height, 42, overlay, null);
}

function drawWindowScene(ctx, x, y, width, height, palette, rng, accent = true) {
  drawRoundedRect(ctx, x + width * 0.08, y + 48, width * 0.84, height * 0.58, 24, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, y + 48);
  ctx.lineTo(x + width * 0.5, y + height * 0.58 + 48);
  ctx.moveTo(x + width * 0.08, y + height * 0.35);
  ctx.lineTo(x + width * 0.92, y + height * 0.35);
  ctx.stroke();
  ctx.restore();

  if (accent) {
    ctx.save();
    ctx.fillStyle = withAlpha(palette[1], 0.24);
    ctx.beginPath();
    ctx.ellipse(x + width * 0.72, y + height * 0.42, 92, 64, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBowlScene(ctx, x, y, width, height, palette, rng) {
  drawWindowScene(ctx, x, y, width, height, palette, rng, false);
  ctx.save();
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.55);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x + width * 0.5, y + height * 0.64, 118, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + width * 0.5, y + height * 0.64, 104, 0.16 * Math.PI, 0.84 * Math.PI);
  ctx.strokeStyle = withAlpha(palette[0], 0.52);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    const offset = (i - 1.5) * 42;
    ctx.save();
    ctx.strokeStyle = withAlpha(palette[1], 0.38);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.5 + offset, y + height * 0.54);
    ctx.bezierCurveTo(
      x + width * 0.52 + offset,
      y + height * 0.44 - rng() * 40,
      x + width * 0.46 + offset,
      y + height * 0.34,
      x + width * 0.5 + offset,
      y + height * 0.25
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawCupScene(ctx, x, y, width, height, palette) {
  drawWindowScene(ctx, x, y, width, height, palette, () => 0.5, true);
  drawRoundedRect(ctx, x + width * 0.38, y + height * 0.36, width * 0.24, height * 0.3, 24, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.22)');
  ctx.save();
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.45);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x + width * 0.63, y + height * 0.48, 34, -0.3 * Math.PI, 0.35 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + width * 0.49, y + height * 0.36);
  ctx.lineTo(x + width * 0.57, y + height * 0.21);
  ctx.strokeStyle = withAlpha(palette[1], 0.7);
  ctx.stroke();
  ctx.restore();
}

function drawMirrorScene(ctx, x, y, width, height, palette) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + width * 0.5, y + height * 0.42, 138, 166, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = withAlpha(palette[0], 0.62);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.18);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.3, y + height * 0.26);
  ctx.lineTo(x + width * 0.18, y + height * 0.4);
  ctx.moveTo(x + width * 0.7, y + height * 0.26);
  ctx.lineTo(x + width * 0.82, y + height * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawBubbleScene(ctx, x, y, width, height, palette, rng) {
  drawMirrorScene(ctx, x, y, width, height, palette);
  for (let i = 0; i < 18; i++) {
    const radius = 10 + rng() * 22;
    const cx = x + width * 0.18 + rng() * width * 0.64;
    const cy = y + height * 0.24 + rng() * height * 0.58;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(i % 2 === 0 ? palette[0] : '#FFFFFF', 0.09 + rng() * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
  }
}

function drawMoonScene(ctx, x, y, width, height, palette) {
  drawWindowScene(ctx, x, y, width, height, palette, () => 0.5, true);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + width * 0.72, y + height * 0.28, 64, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha('#FFF1B0', 0.9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + width * 0.75, y + height * 0.26, 62, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette[2], 0.94);
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x + width * 0.21, y + height * 0.66, width * 0.46, 26, 13, 'rgba(255,255,255,0.12)');
  drawRoundedRect(ctx, x + width * 0.19, y + height * 0.7, width * 0.5, 40, 20, 'rgba(255,255,255,0.09)');
}

function drawDoorScene(ctx, x, y, width, height, palette) {
  drawRoundedRect(ctx, x + width * 0.34, y + height * 0.16, width * 0.32, height * 0.62, 22, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.12)');
  const openGlow = ctx.createLinearGradient(x + width * 0.48, y + height * 0.16, x + width * 0.66, y + height * 0.78);
  openGlow.addColorStop(0, withAlpha(palette[0], 0.54));
  openGlow.addColorStop(1, 'rgba(255,255,255,0.02)');
  drawRoundedRect(ctx, x + width * 0.5, y + height * 0.16, width * 0.16, height * 0.62, 18, openGlow);
  ctx.beginPath();
  ctx.arc(x + width * 0.57, y + height * 0.46, 6, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha('#FFFFFF', 0.72);
  ctx.fill();
}

function drawPhoneScene(ctx, x, y, width, height, palette) {
  drawRoundedRect(ctx, x + width * 0.39, y + height * 0.19, width * 0.22, height * 0.52, 28, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)');
  drawRoundedRect(ctx, x + width * 0.42, y + height * 0.24, width * 0.16, height * 0.39, 18, withAlpha(palette[1], 0.22));
  drawRoundedRect(ctx, x + width * 0.17, y + height * 0.28, width * 0.18, 62, 22, withAlpha(palette[0], 0.22));
  drawRoundedRect(ctx, x + width * 0.62, y + height * 0.42, width * 0.2, 76, 24, withAlpha('#FFFFFF', 0.12));
  ctx.beginPath();
  ctx.moveTo(x + width * 0.29, y + height * 0.4);
  ctx.lineTo(x + width * 0.33, y + height * 0.48);
  ctx.lineTo(x + width * 0.39, y + height * 0.44);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette[0], 0.22);
  ctx.fill();
}

function drawBagScene(ctx, x, y, width, height, palette) {
  drawRoundedRect(ctx, x + width * 0.33, y + height * 0.28, width * 0.34, height * 0.36, 18, 'rgba(255,255,255,0.09)', 'rgba(255,255,255,0.18)');
  ctx.save();
  ctx.strokeStyle = withAlpha(palette[0], 0.72);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + width * 0.42, y + height * 0.3, 28, Math.PI, 0);
  ctx.arc(x + width * 0.58, y + height * 0.3, 28, Math.PI, 0);
  ctx.stroke();
  ctx.restore();

  drawRoundedRect(ctx, x + width * 0.2, y + height * 0.44, width * 0.18, height * 0.28, 14, withAlpha('#FFFFFF', 0.08), 'rgba(255,255,255,0.12)');
}

function drawRoseScene(ctx, x, y, width, height, palette, rng) {
  drawWindowScene(ctx, x, y, width, height, palette, rng, true);
  drawRoundedRect(ctx, x + width * 0.24, y + height * 0.69, width * 0.52, 16, 8, 'rgba(255,255,255,0.10)');
  ctx.save();
  ctx.fillStyle = withAlpha('#FB7185', 0.78);
  ctx.beginPath();
  ctx.ellipse(x + width * 0.72, y + height * 0.56, 38, 52, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#34D399', 0.72);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.72, y + height * 0.6);
  ctx.lineTo(x + width * 0.66, y + height * 0.84);
  ctx.stroke();
  ctx.restore();
}

function drawFitnessScene(ctx, x, y, width, height, palette) {
  ctx.save();
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.12);
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + width * 0.5, y + height * 0.66, 70 + i * 36, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
  drawRoundedRect(ctx, x + width * 0.3, y + height * 0.34, width * 0.12, 26, 10, withAlpha(palette[0], 0.42));
  drawRoundedRect(ctx, x + width * 0.58, y + height * 0.34, width * 0.12, 26, 10, withAlpha(palette[0], 0.42));
  drawRoundedRect(ctx, x + width * 0.38, y + height * 0.36, width * 0.24, 18, 9, 'rgba(255,255,255,0.18)');
}

function drawStudyScene(ctx, x, y, width, height, palette) {
  drawRoundedRect(ctx, x + width * 0.24, y + height * 0.62, width * 0.52, 18, 9, 'rgba(255,255,255,0.1)');
  drawRoundedRect(ctx, x + width * 0.28, y + height * 0.44, width * 0.18, height * 0.18, 8, withAlpha(palette[1], 0.2), 'rgba(255,255,255,0.15)');
  drawRoundedRect(ctx, x + width * 0.48, y + height * 0.42, width * 0.2, height * 0.2, 8, 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.15)');
  ctx.save();
  ctx.strokeStyle = withAlpha('#F4D38A', 0.62);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.34, y + height * 0.44);
  ctx.lineTo(x + width * 0.24, y + height * 0.3);
  ctx.lineTo(x + width * 0.18, y + height * 0.38);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x + width * 0.33, y + height * 0.28, 26, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha('#FFF1B0', 0.82);
  ctx.fill();
}

function drawDietScene(ctx, x, y, width, height, palette) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + width * 0.5, y + height * 0.48, 128, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.16);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(x + width * 0.44, y + height * 0.44, 44, 78, -0.55, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette[0], 0.36);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + width * 0.58, y + height * 0.54, 40, 70, 0.62, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette[1], 0.32);
  ctx.fill();
}

function drawOracleScene(ctx, x, y, width, height, palette, rng) {
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.strokeStyle = withAlpha(i === 1 ? palette[0] : '#FFFFFF', 0.18 + i * 0.08);
    ctx.lineWidth = 3 + i;
    ctx.beginPath();
    ctx.ellipse(x + width * 0.5, y + height * 0.5, 120 + i * 52, 54 + i * 22, 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawRoundedRect(ctx, x + width * 0.41, y + height * 0.28, width * 0.18, height * 0.28, 18, withAlpha('#FFFFFF', 0.08), 'rgba(255,255,255,0.16)');
  ctx.save();
  ctx.translate(x + width * 0.5, y + height * 0.42);
  ctx.rotate(0.24);
  drawRoundedRect(ctx, -58, -76, 116, 152, 14, withAlpha(palette[0], 0.18), withAlpha('#FFFFFF', 0.16));
  ctx.restore();
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(x + width * 0.2 + rng() * width * 0.6, y + height * 0.18 + rng() * height * 0.54, 2 + rng() * 3, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha('#FFFFFF', 0.22 + rng() * 0.3);
    ctx.fill();
  }
}

function drawGenericScene(ctx, x, y, width, height, palette, rng) {
  drawWindowScene(ctx, x, y, width, height, palette, rng, true);
  drawRoundedRect(ctx, x + width * 0.22, y + height * 0.72, width * 0.2, 16, 8, 'rgba(255,255,255,0.1)');
  drawRoundedRect(ctx, x + width * 0.58, y + height * 0.7, width * 0.16, 52, 18, withAlpha(palette[0], 0.12), 'rgba(255,255,255,0.1)');
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawSceneIllustration(ctx, meta, posterImage = null) {
  const x = OUTER_MARGIN;
  const y = HERO_TOP;
  const width = CONTENT_WIDTH;
  const height = HERO_HEIGHT;
  const rng = mulberry32(meta.sceneSeed || hashString(meta.posterSceneId || meta.headline || 'scene'));
  const palette = buildPalette(meta.questionFamily, meta.tone);

  drawSceneCard(ctx, x, y, width, height, palette, meta.tone);

  ctx.save();
  roundRect(ctx, x, y, width, height, 42);
  ctx.clip();

  const light = ctx.createRadialGradient(x + width * 0.72, y + height * 0.22, 18, x + width * 0.72, y + height * 0.22, width * 0.42);
  light.addColorStop(0, withAlpha(palette[0], 0.36));
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light;
  ctx.fillRect(x, y, width, height);

  if (posterImage) {
    drawCoverImage(ctx, posterImage, x, y, width, height);
    const imageWash = ctx.createLinearGradient(x, y, x, y + height);
    imageWash.addColorStop(0, meta.tone === 'sarcastic' ? 'rgba(40,0,18,0.22)' : 'rgba(3,12,28,0.12)');
    imageWash.addColorStop(1, 'rgba(3,5,14,0.38)');
    ctx.fillStyle = imageWash;
    ctx.fillRect(x, y, width, height);
  } else {
    switch (meta.questionFamily) {
      case 'eat_today':
        drawBowlScene(ctx, x, y, width, height, palette, rng);
        break;
      case 'drink_today':
        drawCupScene(ctx, x, y, width, height, palette);
        break;
      case 'wear_today':
        drawMirrorScene(ctx, x, y, width, height, palette);
        break;
      case 'wash_hair':
        drawBubbleScene(ctx, x, y, width, height, palette, rng);
        break;
      case 'sleep_early':
        drawMoonScene(ctx, x, y, width, height, palette);
        break;
      case 'go_out':
        drawDoorScene(ctx, x, y, width, height, palette);
        break;
      case 'send_msg':
        drawPhoneScene(ctx, x, y, width, height, palette);
        break;
      case 'buy_it':
        drawBagScene(ctx, x, y, width, height, palette);
        break;
      case 'date':
        drawRoseScene(ctx, x, y, width, height, palette, rng);
        break;
      case 'fitness':
        drawFitnessScene(ctx, x, y, width, height, palette);
        break;
      case 'study':
        drawStudyScene(ctx, x, y, width, height, palette);
        break;
      case 'diet':
        drawDietScene(ctx, x, y, width, height, palette);
        break;
      case 'oracle':
        drawOracleScene(ctx, x, y, width, height, palette, rng);
        break;
      default:
        drawGenericScene(ctx, x, y, width, height, palette, rng);
        break;
    }
  }

  const vignette = ctx.createLinearGradient(x, y, x, y + height);
  vignette.addColorStop(0, 'rgba(0,0,0,0.02)');
  vignette.addColorStop(0.7, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(3,5,14,0.74)');
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function buildSections(payload) {
  const sections = [];
  if (payload.firstPrinciplesReason || payload.reason) {
    sections.push({
      label: payload.reasonLabel || '判断依据',
      text: payload.firstPrinciplesReason || payload.reason,
    });
  }
  if (payload.comfortLine) {
    sections.push({
      label: '情绪提醒',
      text: payload.comfortLine,
      tone: 'comfort',
    });
  }
  if (payload.nextStep || payload.action) {
    sections.push({
      label: payload.actionLabel || '下一步怎么做',
      text: payload.nextStep || payload.action,
      tone: 'action',
    });
  }
  if (payload.shareHook) {
    sections.push({
      label: payload.shareLabel || '这张图适合发给',
      text: payload.shareHook,
      tone: 'share',
    });
  }
  if (payload.risk) {
    sections.push({
      label: '风险提示',
      text: payload.risk,
      tone: 'risk',
    });
  }
  return sections;
}

function getTextColorBySection(section) {
  if (section.tone === 'action') return BASE_COLORS.gold;
  if (section.tone === 'share') return '#C4B5FD';
  if (section.tone === 'comfort') return '#D1FAE5';
  if (section.tone === 'risk') return '#FCA5A5';
  return BASE_COLORS.text;
}

function calculatePosterLayout(ctx, payload) {
  const bodyWidth = CONTENT_WIDTH - 80;
  const headline = measureTextBlock(
    ctx,
    payload.headline || payload.title || '',
    bodyWidth,
    '700 62px "Noto Serif SC","Source Han Serif SC","Songti SC",serif',
    82
  );
  const subhead = measureTextBlock(
    ctx,
    payload.subhead || '',
    bodyWidth,
    '500 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    46
  );

  const sections = buildSections(payload).map((section) => {
    const labelBox = measureTextBlock(
      ctx,
      section.label,
      bodyWidth,
      '600 20px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      28
    );
    const textBox = measureTextBlock(
      ctx,
      section.text,
      bodyWidth,
      '500 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
      46
    );
    return { ...section, labelBox, textBox };
  });

  const bodyInnerHeight =
    56 +
    headline.height +
    (subhead.height ? subhead.height + 30 : 0) +
    32 +
    sections.reduce((sum, section) => sum + section.labelBox.height + 10 + section.textBox.height + 28, 0) +
    16 +
    BOTTOM_BLOCK_HEIGHT;

  const rawPanelHeight = Math.max(920, bodyInnerHeight);
  const targetHeight = clamp(BODY_TOP + rawPanelHeight + 52, POSTER_MIN_HEIGHT, POSTER_MAX_HEIGHT);
  const finalHeight = Math.max(targetHeight, POSTER_DEFAULT_HEIGHT);
  // panelHeight 必须不超过 canvas 可用空间，否则底部二维码会被裁切
  const panelHeight = Math.min(rawPanelHeight, finalHeight - BODY_TOP - 52);
  return {
    headline,
    subhead,
    sections,
    panelHeight,
    height: finalHeight,
  };
}

function drawContentPanel(ctx, layout, payload, qrImage) {
  const panelY = BODY_TOP;
  const panelHeight = layout.panelHeight;
  const panelX = OUTER_MARGIN;
  const panelWidth = CONTENT_WIDTH;
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 42, BASE_COLORS.panel, BASE_COLORS.panelBorder);

  let cursorY = panelY + 56;
  const textX = panelX + 40;
  const textWidth = panelWidth - 80;

  setFont(ctx, '700 62px "Noto Serif SC","Source Han Serif SC","Songti SC",serif');
  drawLinesWithShadow(ctx, layout.headline.lines, textX, cursorY, 82, BASE_COLORS.text, 'left', {
    color: 'rgba(0,0,0,0.28)',
    blur: 22,
    offsetY: 8,
  });
  cursorY += layout.headline.height + 18;

  if (layout.subhead.height) {
    setFont(ctx, '500 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
    drawLinesWithShadow(ctx, layout.subhead.lines, textX, cursorY, 46, BASE_COLORS.muted, 'left', {
      color: 'rgba(0,0,0,0.22)',
      blur: 12,
      offsetY: 4,
    });
    cursorY += layout.subhead.height + 30;
  }

  const bottomY = panelY + panelHeight - BOTTOM_BLOCK_HEIGHT;
  // 安全区：section 内容不能侵入底部二维码区域（留 16px 缓冲）
  const safeBottomY = bottomY - 16;

  // 先画分隔线（如果还没到底部安全区）
  if (cursorY < safeBottomY - 30) {
    ctx.save();
    ctx.strokeStyle = BASE_COLORS.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textX, cursorY);
    ctx.lineTo(textX + textWidth, cursorY);
    ctx.stroke();
    ctx.restore();
    cursorY += 30;
  }

  layout.sections.forEach((section) => {
    // 边界保护：剩余空间不足时跳过该 section，保证二维码区域干净
    const sectionNeeded = section.labelBox.height + 10 + section.textBox.height + 28;
    if (cursorY + sectionNeeded > safeBottomY) return;

    setFont(ctx, '600 20px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
    drawLines(ctx, section.labelBox.lines, textX, cursorY, 28, BASE_COLORS.soft, 'left');
    cursorY += section.labelBox.height + 10;

    setFont(ctx, '500 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
    drawLinesWithShadow(ctx, section.textBox.lines, textX, cursorY, 46, getTextColorBySection(section), 'left', {
      color: 'rgba(0,0,0,0.16)',
      blur: 10,
      offsetY: 3,
    });
    cursorY += section.textBox.height + 28;
  });
  drawRoundedRect(
    ctx,
    panelX + 24,
    bottomY + 10,
    panelWidth - 48,
    BOTTOM_BLOCK_HEIGHT - 34,
    32,
    'rgba(255,255,255,0.04)',
    'rgba(255,255,255,0.08)'
  );

  const qrSize = 172;
  const qrX = panelX + panelWidth - qrSize - 48;
  const qrY = bottomY + 24;
  drawRoundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 28, 'rgba(255,255,255,0.96)');

  if (qrImage) {
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } else {
    drawRoundedRect(ctx, qrX, qrY, qrSize, qrSize, 24, '#FFFFFF');
    setFont(ctx, '600 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
    drawLines(ctx, ['awkn.cn/god'], qrX + 22, qrY + 72, 30, '#111827', 'left');
  }

  const ctaTitle = payload.ctaLabel || '扫码测你自己的版本';
  const ctaBody = payload.shareUrl ? payload.shareUrl.replace(/^https?:\/\//, '') : 'awkn.cn/god';
  const hookLines = measureTextBlock(
    ctx,
    payload.shareHook || '这张图适合发给那个嘴硬但其实也在纠结的人。',
    panelWidth - qrSize - 152,
    '500 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    36
  );

  setFont(ctx, '700 30px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  drawLines(ctx, [ctaTitle], panelX + 48, qrY + 10, 36, BASE_COLORS.gold, 'left');
  setFont(ctx, '500 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  drawLines(ctx, hookLines.lines.slice(0, 2), panelX + 48, qrY + 58, 36, BASE_COLORS.text, 'left');
  setFont(ctx, '500 20px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  drawLines(ctx, [ctaBody], panelX + 48, qrY + 142, 28, BASE_COLORS.soft, 'left');

  const footerText = payload.resultId ? `结果编号 ${payload.resultId}` : '今日答案已生成';
  setFont(ctx, '500 18px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
  drawLines(ctx, [footerText], panelX + 48, panelY + panelHeight - 26, 22, 'rgba(255,255,255,0.34)', 'left');
}

function drawHeroTexts(ctx, payload) {
  const heroX = OUTER_MARGIN + 34;
  const titleY = HERO_TOP + HERO_HEIGHT - 152;
  const width = CONTENT_WIDTH - 68;
  const oneLiner = payload.oneLiner || payload.shortQuestion || '';
  const oneLinerBox = measureTextBlock(
    ctx,
    oneLiner,
    width,
    '600 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    34
  );
  if (oneLinerBox.height) {
    drawRoundedRect(ctx, heroX, HERO_TOP + 24, Math.min(620, width), 52, 26, 'rgba(5,10,28,0.72)', 'rgba(255,255,255,0.1)');
    setFont(ctx, '600 24px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif');
    drawLinesWithShadow(ctx, oneLinerBox.lines.slice(0, 1), heroX + 20, HERO_TOP + 36, 30, BASE_COLORS.text, 'left', {
      color: 'rgba(0,0,0,0.25)',
      blur: 10,
      offsetY: 3,
    });
  }

  const fade = ctx.createLinearGradient(0, HERO_TOP + HERO_HEIGHT - 236, 0, HERO_TOP + HERO_HEIGHT);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(3,5,14,0.92)');
  ctx.fillStyle = fade;
  ctx.fillRect(OUTER_MARGIN, HERO_TOP + HERO_HEIGHT - 236, CONTENT_WIDTH, 236);

  const headline = payload.headline || payload.title || '';
  setFont(ctx, '700 58px "Noto Serif SC","Source Han Serif SC","Songti SC",serif');
  const titleLines = wrapLines(ctx, headline, width);
  drawLinesWithShadow(ctx, titleLines.slice(0, 2), heroX, titleY - 8, 72, '#FFFFFF', 'left', {
    color: 'rgba(0,0,0,0.4)',
    blur: 26,
    offsetY: 8,
  });
}

function loadImage(source) {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.src = source;
  });
}

export function generateQrDataUrl(shareUrl, size = 240) {
  if (!shareUrl || typeof window === 'undefined' || typeof window.qrcode !== 'function') {
    return null;
  }
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(shareUrl);
    qr.make();
    const cellSize = Math.max(2, Math.floor(size / 32));
    return qr.createDataURL(cellSize, 0);
  } catch (error) {
    console.warn('[share] QR generate failed', error);
    return null;
  }
}

export async function preloadAllIllustrations() {
  return Promise.resolve();
}

export async function generateShareCard(options = {}) {
  const payload = {
    questionFamily: options.questionFamily || options.templateId || 'generic',
    tone: normalizeTone(options.tone),
    headline: options.headline || options.title || '',
    subhead: options.subhead || '',
    firstPrinciplesReason: options.firstPrinciplesReason || options.reason || '',
    comfortLine: options.comfortLine || '',
    nextStep: options.nextStep || options.action || '',
    shareHook: options.shareHook || '',
    reasonLabel: options.reasonLabel || '判断依据',
    actionLabel: options.actionLabel || '下一步怎么做',
    shareLabel: options.shareLabel || '这张图适合发给',
    ctaLabel: options.ctaLabel || '扫码测你自己的版本',
    resultId: options.resultId || '',
    posterSceneId: options.posterSceneId || '',
    posterVariant: 'long',
    oneLiner: options.oneLiner || options.shortQuestion || '',
    shortQuestion: options.shortQuestion || options.question || '',
    risk: options.risk || '',
    shareUrl: options.shareUrl || 'https://awkn.cn/god/',
    posterImageSrc: options.posterImageSrc || '',
    sceneSeed: options.sceneSeed || hashString(`${options.posterSceneId || ''}|${options.headline || options.title || ''}`),
    question: options.question || '',
    title: options.title || options.headline || '',
    reason: options.reason || options.firstPrinciplesReason || '',
    action: options.action || options.nextStep || '',
  };

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const scratch = document.createElement('canvas');
  scratch.width = POSTER_WIDTH;
  scratch.height = POSTER_DEFAULT_HEIGHT;
  const scratchCtx = scratch.getContext('2d');
  const layout = calculatePosterLayout(scratchCtx, payload);

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  const palette = buildPalette(payload.questionFamily, payload.tone);
  const qrDataUrl = generateQrDataUrl(payload.shareUrl, 220);
  const qrImage = qrDataUrl ? await loadImage(qrDataUrl) : null;
  const posterImage = payload.posterImageSrc ? await loadImage(payload.posterImageSrc).catch(() => null) : null;

  drawBackdrop(ctx, layout.height, palette, mulberry32(payload.sceneSeed || 1));
  drawBrandHeader(ctx, payload.questionFamily, payload.tone);
  drawQuestionStrip(ctx, payload.question);
  drawSceneIllustration(ctx, payload, posterImage);
  drawHeroTexts(ctx, payload);
  drawContentPanel(ctx, layout, payload, qrImage);

  return canvas.toDataURL('image/png');
}

export async function saveOrShareImage(dataUrl, filename = '上帝帮你掷骰子.png') {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
