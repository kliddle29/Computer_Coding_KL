// What does the player do?
// Steers a small interceptor along the bottom of the screen and fires bullets
// up into falling meteors, trying to destroy 25 of them before the line breaks.
//
// What is trying to stop them?
// A meteor storm falling from the top of the screen. It starts slow and sparse,
// then spawns faster and falls faster the longer the player survives — and a
// direct hit on the ship costs a life just like a meteor reaching the ground.
//
// What does it feel like when they lose?
// The line breaks: a red flash and a hard screen shake as the last life goes,
// the HUD goes quiet, and "IMPACT / LINE BREACHED" fills the screen — blunt but
// not punishing, just a clear invitation to relaunch and try again.

(function(){
  "use strict";

  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scoreVal = document.getElementById('score-val');
  const waveVal = document.getElementById('wave-val');
  const livesIcons = document.getElementById('lives-icons');
  const progressFill = document.getElementById('progress-fill');
  const progressCaptionNum = document.getElementById('progress-caption-num');

  const overlay = document.getElementById('overlay');
  const startCard = document.getElementById('start-card');
  const winCard = document.getElementById('win-card');
  const loseCard = document.getElementById('lose-card');
  const startBtn = document.getElementById('start-btn');
  const winBtn = document.getElementById('win-btn');
  const loseBtn = document.getElementById('lose-btn');

  const WIN_SCORE = 25;
  const START_LIVES = 5;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize(){
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- state ----------
  let state = 'start'; // start | playing | win | lose
  let score = 0;
  let lives = START_LIVES;
  let elapsed = 0;
  let lastTime = 0;
  let spawnTimer = 0;
  let shakeT = 0, shakeMag = 0;
  let invulnT = 0;

  const keys = { left:false, right:false, fire:false };
  let pointerActive = false;
  let pointerX = null;
  let shootHeld = false;
  let fireCooldown = 0;
  const FIRE_INTERVAL = 0.17;

  const ship = { x: 0, y: 0, w: 40, h: 30, speed: 460, vx: 0 };
  let bullets = [];
  let meteors = [];
  let particles = [];
  let stars = [];

  function initStars(){
    stars = [];
    const layers = [
      { n: 40, speed: 12, size: [0.6,1.2], alpha: 0.35 },
      { n: 28, speed: 26, size: [1,1.8], alpha: 0.55 },
      { n: 16, speed: 46, size: [1.4,2.4], alpha: 0.8 },
    ];
    layers.forEach(layer=>{
      for(let i=0;i<layer.n;i++){
        stars.push({
          x: Math.random()*2000,
          y: Math.random()*2000,
          speed: layer.speed,
          r: layer.size[0] + Math.random()*(layer.size[1]-layer.size[0]),
          a: layer.alpha * (0.6 + Math.random()*0.4),
        });
      }
    });
  }
  initStars();

  function resetGame(){
    score = 0; lives = START_LIVES; elapsed = 0; spawnTimer = 0;
    bullets = []; meteors = []; particles = [];
    ship.x = W/2; ship.y = H - 64; ship.vx = 0;
    shakeT = 0; invulnT = 0;
    updateHUD();
  }

  function updateHUD(){
    scoreVal.textContent = score;
    const wave = Math.min(Math.floor(score/5)+1, 6);
    waveVal.textContent = wave;
    const pct = Math.max(0, Math.min(1, score / WIN_SCORE));
    progressFill.style.width = (pct*100).toFixed(1) + '%';
    progressCaptionNum.textContent = Math.min(score,WIN_SCORE) + ' / ' + WIN_SCORE;

    livesIcons.innerHTML = '';
    for(let i=0;i<START_LIVES;i++){
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 16 16');
      svg.setAttribute('class','life-icon');
      const active = i < lives;
      svg.innerHTML = '<path d="M8 1 L10.2 5.6 L15 6.3 L11.5 9.6 L12.4 14.4 L8 12 L3.6 14.4 L4.5 9.6 L1 6.3 L5.8 5.6 Z" fill="'+(active? 'var(--cyan-bright)':'rgba(139,147,184,0.22)')+'" stroke="'+(active? 'var(--cyan)':'var(--panel-line)')+'" stroke-width="0.6"/>';
      livesIcons.appendChild(svg);
    }
  }

  // ---------- input ----------
  window.addEventListener('keydown', (e)=>{
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if(e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if(e.code === 'Space'){ keys.fire = true; e.preventDefault(); }
    if(e.code === 'Enter'){
      if(state==='start') startGame();
      else if(state==='win') startGame();
      else if(state==='lose') startGame();
    }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if(e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if(e.code === 'Space') keys.fire = false;
  });

  function pointerToX(clientX){
    const rect = canvas.getBoundingClientRect();
    return clientX - rect.left;
  }
  canvas.addEventListener('pointerdown', (e)=>{
    pointerActive = true; shootHeld = true;
    pointerX = pointerToX(e.clientX);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(pointerActive) pointerX = pointerToX(e.clientX);
  });
  window.addEventListener('pointerup', ()=>{ pointerActive = false; shootHeld = false; });
  canvas.addEventListener('pointercancel', ()=>{ pointerActive = false; shootHeld = false; });

  startBtn.addEventListener('click', startGame);
  winBtn.addEventListener('click', startGame);
  loseBtn.addEventListener('click', startGame);

  function startGame(){
    resetGame();
    state = 'playing';
    overlay.classList.add('hidden');
  }

  function showOverlay(which){
    startCard.style.display = which==='start' ? '' : 'none';
    winCard.style.display = which==='win' ? '' : 'none';
    loseCard.style.display = which==='lose' ? '' : 'none';
    overlay.classList.remove('hidden');
  }

  // ---------- entities ----------
  function spawnMeteor(){
    const t = Math.min(score / WIN_SCORE, 1);
    const radius = 16 + Math.random()*26;
    const speedBase = lerp(78, 200, t);
    const speed = speedBase * lerp(1.25, 0.8, (radius-16)/26);
    meteors.push({
      x: Math.random()*(W-60)+30,
      y: -40,
      r: radius,
      vy: speed,
      vx: (Math.random()-0.5)*20,
      rot: Math.random()*Math.PI*2,
      rotSpeed: (Math.random()-0.5)*2,
      hp: radius > 34 ? 2 : 1,
      hue: 12 + Math.random()*18,
    });
  }

  function fireBullet(){
    bullets.push({ x: ship.x, y: ship.y - ship.h*0.5, vy: -620 });
    if(!reduceMotion) spawnParticles(ship.x, ship.y-ship.h*0.5, 2, 'var(--cyan-bright)', 60, 0.15);
  }

  function spawnParticles(x,y,count,color,speed,life){
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const s = speed*(0.4+Math.random()*0.6);
      particles.push({
        x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
        life: life*(0.7+Math.random()*0.6), t:0, color, size: 1.5+Math.random()*2.5
      });
    }
  }

  function lerp(a,b,t){ return a+(b-a)*t; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function triggerShake(mag){
    if(reduceMotion) return;
    shakeMag = Math.max(shakeMag, mag);
    shakeT = 0.35;
  }

  // ---------- update ----------
  function update(dt){
    elapsed += dt;

    // ship movement
    let dir = 0;
    if(keys.left) dir -= 1;
    if(keys.right) dir += 1;
    if(dir !== 0){
      ship.x += dir * ship.speed * dt;
      pointerActive = false; // keyboard overrides pointer steering
    }
    if(pointerActive && pointerX !== null){
      ship.x += (pointerX - ship.x) * Math.min(1, dt*14);
    }
    ship.x = clamp(ship.x, ship.w*0.6, W - ship.w*0.6);
    ship.y = H - 64;

    // firing
    fireCooldown -= dt;
    if((keys.fire || shootHeld) && fireCooldown <= 0){
      fireBullet();
      fireCooldown = FIRE_INTERVAL;
    }

    // spawn meteors
    const t = Math.min(score / WIN_SCORE, 1);
    const spawnInterval = lerp(1.25, 0.55, t);
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnMeteor();
      spawnTimer = spawnInterval * (0.8 + Math.random()*0.4);
    }

    // bullets
    for(let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.y += b.vy*dt;
      if(b.y < -20) bullets.splice(i,1);
    }

    // meteors
    for(let i=meteors.length-1;i>=0;i--){
      const m = meteors[i];
      m.y += m.vy*dt;
      m.x += m.vx*dt;
      m.rot += m.rotSpeed*dt;
      if(m.x < m.r) { m.x = m.r; m.vx *= -1; }
      if(m.x > W-m.r) { m.x = W-m.r; m.vx *= -1; }

      if(m.y - m.r > H){
        meteors.splice(i,1);
        loseLife();
        continue;
      }
      // collide with ship
      if(invulnT<=0){
        const dx = m.x-ship.x, dy = m.y-ship.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < m.r + ship.w*0.4){
          meteors.splice(i,1);
          spawnParticles(m.x,m.y,18,'var(--ember-bright)',140,0.5);
          triggerShake(10);
          loseLife();
          continue;
        }
      }
    }

    // bullet-meteor collisions
    for(let i=meteors.length-1;i>=0;i--){
      const m = meteors[i];
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        const dx = m.x-b.x, dy=m.y-b.y;
        if(dx*dx+dy*dy < (m.r+4)*(m.r+4)){
          bullets.splice(j,1);
          m.hp -= 1;
          spawnParticles(b.x,b.y,6,'var(--ember-bright)',90,0.3);
          if(m.hp<=0){
            meteors.splice(i,1);
            spawnParticles(m.x,m.y,22,'var(--ember-bright)',160,0.55);
            score += 1;
            updateHUD();
            if(score >= WIN_SCORE){ win(); }
          }
          break;
        }
      }
    }

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.t += dt;
      if(p.t > p.life){ particles.splice(i,1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vx *= 0.94; p.vy *= 0.94;
    }

    // stars
    stars.forEach(s=>{
      s.y += s.speed*dt;
      if(s.y > H+10){ s.y = -10; s.x = Math.random()*W; }
      if(s.x > W+10) s.x = 0;
    });

    if(shakeT>0){ shakeT -= dt; if(shakeT<=0) shakeMag=0; }
    if(invulnT>0) invulnT -= dt;
  }

  function loseLife(){
    lives -= 1;
    invulnT = 1.0;
    triggerShake(6);
    updateHUD();
    if(lives <= 0) lose();
  }

  function win(){
    state = 'win';
    document.getElementById('win-score').textContent = score;
    document.getElementById('win-time').textContent = Math.round(elapsed) + 's';
    document.getElementById('win-lives').textContent = lives;
    showOverlay('win');
  }
  function lose(){
    state = 'lose';
    document.getElementById('lose-score').textContent = score;
    document.getElementById('lose-wave').textContent = waveVal.textContent;
    showOverlay('lose');
  }

  // ---------- render ----------
  function resolveVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name.slice(4,-1)).trim();
  }
  const colorCache = {};
  function col(v){
    if(v.startsWith('var(')){
      if(!colorCache[v]) colorCache[v] = resolveVar(v);
      return colorCache[v];
    }
    return v;
  }

  function drawStars(){
    ctx.save();
    stars.forEach(s=>{
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawShip(){
    ctx.save();
    ctx.translate(ship.x, ship.y);
    if(invulnT>0 && Math.floor(invulnT*14)%2===0) ctx.globalAlpha = 0.35;
    ctx.fillStyle = col('var(--cyan-bright)');
    ctx.shadowColor = col('var(--cyan)');
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -ship.h*0.6);
    ctx.lineTo(ship.w*0.5, ship.h*0.5);
    ctx.lineTo(0, ship.h*0.28);
    ctx.lineTo(-ship.w*0.5, ship.h*0.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = col('var(--ember-bright)');
    const flick = 0.6 + Math.random()*0.4;
    ctx.beginPath();
    ctx.moveTo(-ship.w*0.16, ship.h*0.42);
    ctx.lineTo(ship.w*0.16, ship.h*0.42);
    ctx.lineTo(0, ship.h*(0.42+0.5*flick));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBullets(){
    ctx.save();
    ctx.fillStyle = col('var(--cyan-bright)');
    ctx.shadowColor = col('var(--cyan)');
    ctx.shadowBlur = 10;
    bullets.forEach(b=>{
      ctx.fillRect(b.x-2, b.y-9, 4, 14);
    });
    ctx.restore();
  }

  function drawMeteors(){
    ctx.save();
    meteors.forEach(m=>{
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      const grad = ctx.createRadialGradient(-m.r*0.3,-m.r*0.3,m.r*0.1, 0,0,m.r);
      grad.addColorStop(0, 'hsl('+m.hue+', 90%, 68%)');
      grad.addColorStop(0.55, 'hsl('+(m.hue-4)+', 85%, 46%)');
      grad.addColorStop(1, 'hsl('+(m.hue-8)+', 70%, 22%)');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'hsl('+m.hue+',90%,55%)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      const spikes = 7;
      for(let i=0;i<spikes;i++){
        const a = (i/spikes)*Math.PI*2;
        const rr = m.r * (0.82 + 0.18*Math.sin(i*2.1+m.x));
        const px = Math.cos(a)*rr, py = Math.sin(a)*rr;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  function drawParticles(){
    ctx.save();
    particles.forEach(p=>{
      const alpha = 1 - p.t/p.life;
      ctx.globalAlpha = Math.max(0,alpha);
      ctx.fillStyle = col(p.color);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGroundLine(){
    ctx.save();
    const grad = ctx.createLinearGradient(0,H-6,0,H);
    grad.addColorStop(0, 'rgba(255,106,53,0)');
    grad.addColorStop(1, 'rgba(255,106,53,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,H-6,W,6);
    ctx.restore();
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shakeT>0){
      const mag = shakeMag * (shakeT/0.35);
      ctx.translate((Math.random()-0.5)*mag, (Math.random()-0.5)*mag);
    }
    drawStars();
    drawGroundLine();
    drawMeteors();
    drawBullets();
    drawParticles();
    drawShip();
    ctx.restore();
  }

  function frame(ts){
    if(!lastTime) lastTime = ts;
    let dt = (ts - lastTime)/1000;
    lastTime = ts;
    dt = Math.min(dt, 0.05);

    if(state === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  ship.x = W/2; ship.y = H-64;
  updateHUD();
  requestAnimationFrame(frame);
})();
