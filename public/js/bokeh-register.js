// bokeh-register.js
// Canvas FX2: soft bokeh circles (white / blue), L3 (prominent), S3 (faster)
// B1: canvas placed inside wrapper and sized to card area (so bokeh only behind card)

(function(){
  const canvas = document.getElementById('bokeh-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  // particle config (tuned for L3 + S3)
  const PARTICLE_COUNT = 28; // prominent but not overcrowded
  const PARTICLE_MIN_R = 24;
  const PARTICLE_MAX_R = 96;
  const SPEED_MULT = 0.9; // base speed (S3 a bit faster)
  const COLORS = [
    'rgba(220,235,255,0.95)', // white-blue cool
    'rgba(200,225,255,0.9)',
    'rgba(240,250,255,0.85)'
  ];

  let particles = [];
  let rect = { width: 600, height: 400, left: 0, top: 0 };

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function createParticles() {
    particles = [];
    for (let i=0;i<PARTICLE_COUNT;i++){
      const r = rand(PARTICLE_MIN_R, PARTICLE_MAX_R);
      particles.push({
        x: rand(rect.left + r, rect.left + rect.width - r),
        y: rand(rect.top + r, rect.top + rect.height - r),
        r: r,
        vx: rand(-0.6, 0.6) * SPEED_MULT,
        vy: rand(-0.45, 0.45) * SPEED_MULT,
        color: COLORS[Math.floor(Math.random()*COLORS.length)],
        pulse: rand(0.85, 1.25),
        pulseDir: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random()*Math.PI*2
      });
    }
  }

  function resizeCanvasToCard(){
    // find the register-card element to size canvas to its bounding box
    const card = document.querySelector('.register-card');
    if (!card) return;
    const box = card.getBoundingClientRect();
    rect = {
      width: Math.max(200, Math.floor(box.width)),
      height: Math.max(160, Math.floor(box.height)),
      left: 0,
      top: 0
    };
    // place canvas centered over card (we positioned it with translate(-50%, -50%))
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function onResize(){
    DPR = Math.max(1, window.devicePixelRatio || 1);
    resizeCanvasToCard();
    createParticles();
  }

  // draw
  let last = performance.now();
  function animate(now){
    const dt = Math.min(40, now - last);
    last = now;
    // clear with gentle alpha
    ctx.clearRect(0,0, rect.width, rect.height);

    // draw each particle as a soft radial gradient
    particles.forEach(p => {
      // update position
      p.x += p.vx * (dt / 16) * (1 + Math.sin(p.phase)*0.3);
      p.y += p.vy * (dt / 16) * (1 + Math.cos(p.phase)*0.3);

      // pulse
      p.phase += 0.02 * (1 + Math.abs(p.vx)+Math.abs(p.vy));

      // wrap-around edges to keep canvas filled
      if (p.x < -p.r) p.x = rect.width + p.r;
      if (p.x > rect.width + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = rect.height + p.r;
      if (p.y > rect.height + p.r) p.y = -p.r;

      const pr = p.r * (0.85 + 0.25 * Math.sin(p.phase)); // breathing
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr);
      // center bright, edges soft transparent
      g.addColorStop(0, p.color);
      g.addColorStop(0.4, p.color.replace(/[\d\.]+\)$/,'0.45)'));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI*2);
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }

  // init
  function init(){
    resizeCanvasToCard();
    createParticles();
    last = performance.now();
    requestAnimationFrame(animate);
  }

  // ensure init after DOM and styles applied
  window.addEventListener('load', init);
  window.addEventListener('resize', function(){
    // debounce small resize
    clearTimeout(window._bokehResize);
    window._bokehResize = setTimeout(onResize, 120);
  });
})();
