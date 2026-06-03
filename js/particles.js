/**
 * particles.js - 星空粒子背景
 * "上帝帮你掷骰子" 视觉效果模块
 */

/**
 * 初始化粒子背景
 * @param {string} canvasId - Canvas元素ID
 */
export function initParticles(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`[particles] Canvas #${canvasId} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Canvas 尺寸 ----------
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();

  // ---------- 粒子 ----------
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 40 : 80;
  const particles = [];

  function createParticle() {
    const isGold = Math.random() < 0.08; // 8% 概率淡金色
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 0.5 + Math.random() * 1.5,          // 0.5 - 2px
      opacity: 0.3 + Math.random() * 0.7,        // 0.3 - 1.0
      twinkleSpeed: 0.005 + Math.random() * 0.02,
      twinklePhase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.4,           // 漂移速度 -0.2 ~ 0.2
      vy: (Math.random() - 0.5) * 0.4,
      color: isGold ? 'rgba(201,169,110,' : 'rgba(255,255,255,',
    };
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle());
  }

  // ---------- 流星 ----------
  const meteors = [];
  let nextMeteorTime = performance.now() + 3000 + Math.random() * 5000;

  function createMeteor() {
    const startX = Math.random() * canvas.width;
    const startY = Math.random() * canvas.height * 0.4;
    const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
    const speed = 6 + Math.random() * 6;
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 1.0 / (30 + Math.random() * 30), // 0.5-1 秒消亡
      tailLength: 60 + Math.random() * 80,
    };
  }

  // ---------- 绘制 ----------
  function drawParticle(p, time) {
    const twinkle = 0.5 + 0.5 * Math.sin(time * p.twinkleSpeed + p.twinklePhase);
    const alpha = p.opacity * twinkle;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color + alpha.toFixed(3) + ')';
    ctx.fill();
  }

  function drawMeteor(m) {
    const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.tailLength * m.life;
    const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.tailLength * m.life;

    const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
    grad.addColorStop(0, `rgba(255,255,255,${(m.life * 0.9).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tailX, tailY);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 流星头部光点
    ctx.beginPath();
    ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${(m.life * 0.8).toFixed(3)})`;
    ctx.fill();
  }

  // ---------- 动画循环 ----------
  let animId = null;

  function animate(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制粒子
    for (const p of particles) {
      drawParticle(p, time);

      // 漂移
      if (!prefersReducedMotion) {
        p.x += p.vx;
        p.y += p.vy;

        // 边界循环
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
        if (p.y < -5) p.y = canvas.height + 5;
        if (p.y > canvas.height + 5) p.y = -5;
      }
    }

    // 流星生成
    if (!prefersReducedMotion && time >= nextMeteorTime) {
      meteors.push(createMeteor());
      nextMeteorTime = time + 3000 + Math.random() * 5000; // 3-8 秒间隔
    }

    // 绘制 & 更新流星
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      drawMeteor(m);
      m.x += m.vx;
      m.y += m.vy;
      m.life -= m.decay;
      if (m.life <= 0) {
        meteors.splice(i, 1);
      }
    }

    animId = requestAnimationFrame(animate);
  }

  // 如果用户偏好减少动画，只绘制一帧静态星空
  if (prefersReducedMotion) {
    for (const p of particles) {
      drawParticle(p, 0);
    }
  } else {
    animId = requestAnimationFrame(animate);
  }

  // ---------- 响应 resize ----------
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      // 重新分布粒子到新尺寸
      for (const p of particles) {
        if (p.x > canvas.width) p.x = Math.random() * canvas.width;
        if (p.y > canvas.height) p.y = Math.random() * canvas.height;
      }
    }, 150);
  });

  // ---------- 销毁方法 ----------
  return {
    destroy() {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
