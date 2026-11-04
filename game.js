// 스카이 헌터: 플라잉 타겟 메인 게임 로직
(function() {
  'use strict';

  // --- 캔버스 및 기본 변수 ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // DOM 요소
  const hud = document.getElementById('hud');
  const scoreValEl = document.getElementById('scoreVal');
  const timerValEl = document.getElementById('timerVal');
  const timerBarEl = document.getElementById('timerBar');
  const comboValEl = document.getElementById('comboVal');
  const multiplierValEl = document.getElementById('multiplierVal');
  const ammoBulletsEl = document.getElementById('ammoBullets');
  const quickNoticeEl = document.getElementById('quickNotice');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const startHighScoreEl = document.getElementById('startHighScore');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const bgmToggleBtn = document.getElementById('bgmToggleBtn');

  // 게임 오버 통계 요소
  const finalScoreEl = document.getElementById('finalScore');
  const recordScoreEl = document.getElementById('recordScore');
  const accuracyValEl = document.getElementById('accuracyVal');
  const maxComboValEl = document.getElementById('maxComboVal');
  const destroyedCountEl = document.getElementById('destroyedCount');
  const rankBadgeEl = document.getElementById('rankBadge');
  const rankTitleEl = document.getElementById('rankTitle');

  // 버튼
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const menuBtn = document.getElementById('menuBtn');
  const resumeBtn = document.getElementById('resumeBtn');

  // --- 게임 상태 상수 ---
  const STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  };

  let gameState = STATE.MENU;
  let lastTime = 0;
  let dpr = 1;

  // 마우스 위치 및 조준점
  const mouse = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isInside: true,
    recoil: 0
  };

  // 탄약 시스템
  const MAX_AMMO = 6;
  let currentAmmo = MAX_AMMO;
  let isReloading = false;
  let reloadProgress = 0;
  const RELOAD_TIME = 0.55; // 초

  // 총기 이펙트 (총구 섬광 & 궤적)
  let muzzleFlashTime = 0;
  let bulletTracers = [];

  // 게임 플레이 통계
  let score = 0;
  let gameTime = 60; // 60초
  const INITIAL_TIME = 60;
  let combo = 0;
  let maxCombo = 0;
  let totalShots = 0;
  let totalHits = 0;
  let destroyedTargets = 0;
  let lastWarningSecond = -1;

  // 오브젝트 풀 및 리스트
  let targets = [];
  let particles = [];
  let floatingTexts = [];
  let clouds = [];
  let birds = [];

  // 스폰 타이머
  let spawnTimer = 0;
  let nextSpawnInterval = 1.0;

  // 화면 흔들림 효과 (카메라 셰이크)
  let shakeIntensity = 0;

  // 최고 점수 로컬스토리지 키
  const STORAGE_KEY = 'sky_hunter_highscore';
  let highScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  startHighScoreEl.textContent = highScore.toLocaleString();

  // --- 캔버스 리사이즈 & 해상도 최적화 ---
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    initBackgroundObjects();
  }
  window.addEventListener('resize', resizeCanvas);

  // --- 배경 요소 초기화 (구름 & 원경 새) ---
  function initBackgroundObjects() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    clouds = [];
    for (let i = 0; i < 7; i++) {
      clouds.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.45) + 20,
        width: Math.random() * 140 + 100,
        height: Math.random() * 40 + 30,
        speed: Math.random() * 12 + 8,
        opacity: Math.random() * 0.2 + 0.1
      });
    }

    birds = [];
    for (let i = 0; i < 4; i++) {
      birds.push({
        x: Math.random() * w,
        y: Math.random() * (h * 0.35) + 30,
        vx: Math.random() * 25 + 30,
        size: Math.random() * 4 + 4,
        wingAngle: Math.random() * Math.PI * 2
      });
    }
  }

  // --- 탄약 HUD 업데이트 ---
  function updateAmmoUI() {
    ammoBulletsEl.innerHTML = '';
    for (let i = 0; i < MAX_AMMO; i++) {
      const bullet = document.createElement('div');
      bullet.classList.add('bullet-icon');
      if (isReloading) {
        bullet.classList.add('reloading');
      } else if (i >= currentAmmo) {
        bullet.classList.add('spent');
      }
      ammoBulletsEl.appendChild(bullet);
    }
  }

  // --- 재장전 동작 ---
  function startReload() {
    if (isReloading || currentAmmo === MAX_AMMO) return;
    isReloading = true;
    reloadProgress = 0;
    updateAmmoUI();
    window.soundSystem.playReload();
    showQuickNotice('RELOADING...', '#00f0ff');
  }

  // --- 퀵 노티스 팝업 알림 (콤보 등) ---
  let noticeTimeout = null;
  function showQuickNotice(text, color = '#ffdf00') {
    quickNoticeEl.textContent = text;
    quickNoticeEl.style.color = color;
    quickNoticeEl.classList.add('show');
    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => {
      quickNoticeEl.classList.remove('show');
    }, 600);
  }

  // --- 배율 계산 ---
  function getMultiplier() {
    if (combo >= 20) return 3.0;
    if (combo >= 15) return 2.5;
    if (combo >= 10) return 2.0;
    if (combo >= 5) return 1.5;
    return 1.0;
  }

  function updateHUD() {
    scoreValEl.textContent = Math.floor(score).toLocaleString();
    const ceilSec = Math.max(0, Math.ceil(gameTime));
    timerValEl.textContent = ceilSec;
    const pct = Math.max(0, Math.min(100, (gameTime / INITIAL_TIME) * 100));
    timerBarEl.style.width = pct + '%';

    // 10초 이하 카운트다운 긴급 연출
    const timerContainer = document.querySelector('.hud-timer');
    if (gameTime <= 10 && gameTime > 0) {
      timerContainer.classList.add('urgent');
      if (ceilSec !== lastWarningSecond) {
        lastWarningSecond = ceilSec;
        window.soundSystem.playWarningBeep();
      }
    } else {
      timerContainer.classList.remove('urgent');
    }

    comboValEl.textContent = combo;
    const mult = getMultiplier();
    multiplierValEl.textContent = 'x' + mult.toFixed(1);
    if (mult > 1.0) {
      multiplierValEl.style.color = '#ffaa00';
      multiplierValEl.style.borderColor = 'rgba(255, 170, 0, 0.5)';
    } else {
      multiplierValEl.style.color = '#a855f7';
      multiplierValEl.style.borderColor = 'rgba(168, 85, 247, 0.4)';
    }
  }

  // --- 표적(Target) 클래스 정의 ---
  const TARGET_TYPES = {
    NORMAL: {
      type: 'NORMAL',
      radius: 28,
      baseSpeed: 230,
      points: 100,
      hp: 1,
      color: '#ff4757',
      label: 'DRONE'
    },
    GOLD: {
      type: 'GOLD',
      radius: 20,
      baseSpeed: 380,
      points: 300,
      hp: 1,
      color: '#ffd700',
      label: 'GOLD'
    },
    ARMORED: {
      type: 'ARMORED',
      radius: 34,
      baseSpeed: 170,
      points: 500,
      hp: 3,
      color: '#00d2ff',
      label: 'ARMOR'
    },
    TIME: {
      type: 'TIME',
      radius: 24,
      baseSpeed: 220,
      points: 50,
      hp: 1,
      timeBonus: 3,
      color: '#00ff88',
      label: '+3 SEC'
    },
    BOMB: {
      type: 'BOMB',
      radius: 26,
      baseSpeed: 190,
      points: -200,
      timePenalty: 5,
      hp: 1,
      color: '#ff3838',
      label: 'DANGER'
    }
  };

  class Target {
    constructor(typeDef, startSide, pattern) {
      this.def = typeDef;
      this.type = typeDef.type;
      this.radius = typeDef.radius;
      this.maxHp = typeDef.hp;
      this.hp = this.maxHp;
      this.color = typeDef.color;
      this.pattern = pattern; // 'ARC', 'HORIZONTAL', 'WAVE'
      this.markedForDeletion = false;
      this.animTime = Math.random() * 10;
      this.rotation = 0;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // 난이도 상승 계수 (시간이 지날수록 속도 증가)
      const difficultyFactor = 1 + (1 - Math.max(0, gameTime) / INITIAL_TIME) * 0.45;
      const speed = typeDef.baseSpeed * difficultyFactor;

      if (this.pattern === 'ARC') {
        // 정교한 포물선 클레이 사격 궤적
        const dir = startSide === 'LEFT' ? 1 : -1;
        this.x = startSide === 'LEFT' ? Math.random() * (w * 0.2) + 20 : w - (Math.random() * (w * 0.2) + 20);
        this.y = h + this.radius;

        // 정점 높이: 화면 상단 18% ~ 45% 사이
        const apexY = Math.random() * (h * 0.28) + h * 0.16;
        const deltaH = (h + this.radius) - apexY;
        this.gravity = 560;
        this.vy = -Math.sqrt(2 * this.gravity * deltaH);

        const timeUp = -this.vy / this.gravity;
        const totalFlightTime = timeUp * 1.95;
        const travelDistX = w * (0.65 + Math.random() * 0.25);
        this.vx = (travelDistX / totalFlightTime) * dir;
      } else if (this.pattern === 'WAVE') {
        // 물결치며 수평 횡단
        const dir = startSide === 'LEFT' ? 1 : -1;
        this.x = startSide === 'LEFT' ? -this.radius * 2 : w + this.radius * 2;
        this.y = Math.random() * (h * 0.45) + h * 0.12;
        this.baseY = this.y;
        this.vx = speed * dir;
        this.vy = 0;
        this.gravity = 0;
        this.waveAmplitude = Math.random() * 50 + 25;
        this.waveFreq = Math.random() * 2.5 + 1.8;
      } else {
        // 수평 및 완만한 대각선 비행
        const dir = startSide === 'LEFT' ? 1 : -1;
        this.x = startSide === 'LEFT' ? -this.radius * 2 : w + this.radius * 2;
        this.y = Math.random() * (h * 0.42) + h * 0.14;
        this.vx = speed * 1.05 * dir;
        this.vy = (Math.random() * 70 - 35);
        this.gravity = 0;
      }
    }

    update(dt) {
      this.animTime += dt;
      this.rotation += dt * (this.type === 'GOLD' ? 5 : 3);

      if (this.pattern === 'ARC') {
        this.vy += this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else if (this.pattern === 'WAVE') {
        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.animTime * this.waveFreq) * this.waveAmplitude;
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }

      // 화면 완전히 벗어남 감지
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margin = 100;
      if (this.x < -margin || this.x > w + margin || this.y > h + margin + 40) {
        this.markedForDeletion = true;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      switch(this.type) {
        case 'NORMAL':
          this.drawNormalDrone(ctx);
          break;
        case 'GOLD':
          this.drawGoldSpeeder(ctx);
          break;
        case 'ARMORED':
          this.drawArmoredTarget(ctx);
          break;
        case 'TIME':
          this.drawTimeCapsule(ctx);
          break;
        case 'BOMB':
          this.drawBombDrone(ctx);
          break;
      }

      ctx.restore();
    }

    // 1. 일반 드론
    drawNormalDrone(ctx) {
      const r = this.radius;
      ctx.shadowColor = '#ff4757';
      ctx.shadowBlur = 12;

      // 바깥 링
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.fill();

      // 중간 화이트 링
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 중심 레드 코어
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.fill();

      // 회전 십자 크로스라인
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.rotate(this.rotation);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 0); ctx.lineTo(r * 1.15, 0);
      ctx.moveTo(0, -r * 1.15); ctx.lineTo(0, r * 1.15);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 황금 스피더
    drawGoldSpeeder(ctx) {
      const r = this.radius;
      ctx.shadowColor = '#ffbe26';
      ctx.shadowBlur = 20;

      ctx.save();
      ctx.rotate(this.rotation * 1.5);

      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r * 1.3 : r * 0.7;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();

      // 중심 코어
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // 3. 철갑 타겟
    drawArmoredTarget(ctx) {
      const r = this.radius;
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur = 14;

      // 헥사곤 장갑판
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#103050';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#00d2ff';
      ctx.stroke();

      // 체력 링
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#0a192f';
      ctx.fill();

      // 남은 HP 표시 도트
      for (let i = 0; i < this.maxHp; i++) {
        const ang = (i * Math.PI * 2) / this.maxHp - Math.PI / 2;
        const hx = Math.cos(ang) * (r * 0.35);
        const hy = Math.sin(ang) * (r * 0.35);
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = i < this.hp ? '#00f0ff' : '#445566';
        ctx.fill();
      }
    }

    // 4. 타임 캡슐
    drawTimeCapsule(ctx) {
      const r = this.radius;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 16;

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#052a1a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00ff88';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.fill();

      // 시계 침
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.45);
      ctx.moveTo(0, 0); ctx.lineTo(r * 0.35, 0);
      ctx.stroke();

      ctx.font = 'bold 11px Chakra Petch';
      ctx.fillStyle = '#00ff88';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+3s', 0, r * 0.38);
    }

    // 5. 폭탄 드론
    drawBombDrone(ctx) {
      const r = this.radius;
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 18;

      const pulse = Math.sin(this.animTime * 10) * 2.5;
      const curR = r + pulse;

      // 스파이크 돌기
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const sx = Math.cos(angle) * (curR * 1.3);
        const sy = Math.sin(angle) * (curR * 1.3);
        ctx.moveTo(0, 0);
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1114';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ff3838';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffdddd';
      ctx.lineWidth = 3;
      const xSize = curR * 0.38;
      ctx.beginPath();
      ctx.moveTo(-xSize, -xSize); ctx.lineTo(xSize, xSize);
      ctx.moveTo(xSize, -xSize); ctx.lineTo(-xSize, xSize);
      ctx.stroke();
    }
  }

  // --- 파티클 & 플로팅 텍스트 이펙트 ---
  function spawnExplosionParticles(x, y, color, count = 18, isBomb = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isBomb ? 380 : 260) + 60;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 300,
        color: isBomb ? (Math.random() > 0.5 ? '#ff2222' : '#ff9900') : color,
        size: Math.random() * (isBomb ? 6 : 4) + 2,
        alpha: 1,
        life: Math.random() * 0.4 + 0.35
      });
    }
  }

  function addFloatingText(x, y, text, color = '#ffffff', fontSize = 20) {
    floatingTexts.push({
      x,
      y,
      text,
      color,
      fontSize,
      vy: -75,
      alpha: 1,
      life: 0.85
    });
  }

  // --- 표적 스폰 로직 ---
  function spawnTarget() {
    const startSide = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
    const rand = Math.random();

    let typeDef;
    if (rand < 0.46) {
      typeDef = TARGET_TYPES.NORMAL;
    } else if (rand < 0.66) {
      typeDef = TARGET_TYPES.ARMORED;
    } else if (rand < 0.80) {
      typeDef = TARGET_TYPES.GOLD;
    } else if (rand < 0.91) {
      typeDef = TARGET_TYPES.BOMB;
    } else {
      typeDef = TARGET_TYPES.TIME;
    }

    const patterns = ['ARC', 'WAVE', 'HORIZONTAL'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    targets.push(new Target(typeDef, startSide, pattern));
  }

  // --- 마우스 사격 처리 ---
  function shoot(x, y) {
    if (gameState !== STATE.PLAYING) return;

    // 탄약 확인
    if (isReloading) {
      window.soundSystem.playEmpty();
      return;
    }

    if (currentAmmo <= 0) {
      window.soundSystem.playEmpty();
      showQuickNotice('EMPTY! PRESS R', '#ff3366');
      return;
    }

    // 탄약 소비
    currentAmmo--;
    totalShots++;
    updateAmmoUI();

    // 발사 반동 & 사운드 & 총구 섬광
    mouse.recoil = 14;
    shakeIntensity = 5;
    muzzleFlashTime = 0.08;
    window.soundSystem.playGunshot();

    // 총알 궤적 (총구 위치(화면 우하단)에서 클릭 지점까지 광선 발사)
    const gunX = window.innerWidth * 0.65;
    const gunY = window.innerHeight;
    bulletTracers.push({
      x1: gunX,
      y1: gunY,
      x2: x,
      y2: y,
      alpha: 0.85
    });

    // 탄착 지점 스파크
    spawnExplosionParticles(x, y, '#ffea00', 6);

    // 판정 체크 (표적 피격)
    let hitIndex = -1;
    let minDist = Infinity;

    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist <= t.radius + 6 && dist < minDist) {
        minDist = dist;
        hitIndex = i;
      }
    }

    if (hitIndex !== -1) {
      // 명중!
      totalHits++;
      const target = targets[hitIndex];
      handleTargetHit(target, hitIndex, x, y);
    } else {
      // 빗나감 (미스) -> 콤보 리셋
      if (combo > 0) {
        showQuickNotice('MISS!', '#9cb2d4');
      }
      combo = 0;
      updateHUD();
    }

    // 탄약 소진 시 자동 재장전 유도
    if (currentAmmo === 0) {
      setTimeout(() => {
        if (currentAmmo === 0 && !isReloading && gameState === STATE.PLAYING) {
          startReload();
        }
      }, 180);
    }
  }

  // --- 표적 피격 시 처리 로직 ---
  function handleTargetHit(target, index, hitX, hitY) {
    target.hp--;

    if (target.hp <= 0) {
      // 완파
      target.markedForDeletion = true;
      destroyedTargets++;

      if (target.type === 'BOMB') {
        // 폭탄 명중 페널티!
        shakeIntensity = 18;
        window.soundSystem.playBombExplosion();
        spawnExplosionParticles(target.x, target.y, '#ff3366', 35, true);

        gameTime = Math.max(0, gameTime - target.def.timePenalty);
        score = Math.max(0, score + target.def.points);
        combo = 0;
        addFloatingText(target.x, target.y, `-5 SEC / -200`, '#ff3366', 24);
        showQuickNotice('WARNING! BOMB DETONATED', '#ff3366');
      } else {
        // 정상 타겟 격추
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        const mult = getMultiplier();
        const earnedScore = Math.round(target.def.points * mult);
        score += earnedScore;

        if (target.type === 'GOLD') {
          window.soundSystem.playGoldHit();
          spawnExplosionParticles(target.x, target.y, '#ffd700', 30);
          addFloatingText(target.x, target.y, `+${earnedScore} (GOLD!)`, '#ffd700', 26);
          showQuickNotice(`PERFECT GOLD! +${earnedScore}`, '#ffd700');
        } else if (target.type === 'TIME') {
          window.soundSystem.playTimeBonus();
          gameTime = Math.min(INITIAL_TIME, gameTime + target.def.timeBonus);
          spawnExplosionParticles(target.x, target.y, '#00ff88', 25);
          addFloatingText(target.x, target.y, `+3 SEC!`, '#00ff88', 24);
          showQuickNotice('TIME EXTENDED! +3s', '#00ff88');
        } else if (target.type === 'ARMORED') {
          window.soundSystem.playArmorBreak();
          spawnExplosionParticles(target.x, target.y, '#00d2ff', 30);
          addFloatingText(target.x, target.y, `+${earnedScore}`, '#00d2ff', 24);
        } else {
          window.soundSystem.playHit();
          spawnExplosionParticles(target.x, target.y, target.color, 20);
          addFloatingText(target.x, target.y, `+${earnedScore}`, '#ffffff', 20);
        }

        window.soundSystem.playComboSound(combo);

        if (combo % 5 === 0 && combo > 0) {
          showQuickNotice(`${combo} COMBO!`, '#ffaa00');
        }
      }
    } else {
      // 장갑판 피격
      window.soundSystem.playArmorRicochet();
      spawnExplosionParticles(hitX, hitY, '#00d2ff', 8);
      addFloatingText(hitX, hitY, 'HIT!', '#00f0ff', 16);
      shakeIntensity = 4;
    }

    updateHUD();
  }

  // --- 게임 시작 및 리셋 ---
  function startGame() {
    gameState = STATE.PLAYING;
    score = 0;
    gameTime = INITIAL_TIME;
    combo = 0;
    maxCombo = 0;
    totalShots = 0;
    totalHits = 0;
    destroyedTargets = 0;
    currentAmmo = MAX_AMMO;
    isReloading = false;
    reloadProgress = 0;
    targets = [];
    particles = [];
    floatingTexts = [];
    bulletTracers = [];
    lastWarningSecond = -1;

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    pauseScreen.classList.remove('active');

    updateAmmoUI();
    updateHUD();

    window.soundSystem.init();
    if (window.soundSystem.bgmEnabled) {
      window.soundSystem.startBGM();
    }
  }

  // --- 게임 오버 및 랭킹 산정 ---
  function endGame() {
    gameState = STATE.GAMEOVER;
    window.soundSystem.stopBGM();
    window.soundSystem.playGameOver();

    const accuracy = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0;

    if (score > highScore) {
      highScore = score;
      localStorage.setItem(STORAGE_KEY, highScore);
    }

    let rank = 'C';
    let title = '신병 슈터';
    let color = '#a0c4ff';

    if (score >= 6000 && accuracy >= 70) {
      rank = 'S';
      title = '전설의 명사수 (Legendary)';
      color = '#ffd700';
    } else if (score >= 4000) {
      rank = 'A';
      title = '탑건 스나이퍼 (Top Gun)';
      color = '#00f0ff';
    } else if (score >= 2200) {
      rank = 'B';
      title = '숙련된 헌터 (Expert)';
      color = '#00ff88';
    } else if (score >= 1000) {
      rank = 'C';
      title = '준수한 사수 (Marksman)';
      color = '#ffaa00';
    } else {
      rank = 'D';
      title = '연습생 사수 (Trainee)';
      color = '#ff5577';
    }

    finalScoreEl.textContent = score.toLocaleString();
    recordScoreEl.textContent = highScore.toLocaleString();
    accuracyValEl.textContent = accuracy + '%';
    maxComboValEl.textContent = maxCombo;
    destroyedCountEl.textContent = destroyedTargets + ' 개';

    rankBadgeEl.textContent = rank;
    rankBadgeEl.style.background = `radial-gradient(circle, ${color} 30%, #ff8800 100%)`;
    rankTitleEl.textContent = title;
    rankTitleEl.style.color = color;

    gameOverScreen.classList.add('active');
  }

  // --- 일시정지 제어 ---
  function togglePause() {
    if (gameState === STATE.PLAYING) {
      gameState = STATE.PAUSED;
      pauseScreen.classList.add('active');
    } else if (gameState === STATE.PAUSED) {
      gameState = STATE.PLAYING;
      pauseScreen.classList.remove('active');
    }
  }

  // --- 배경 렌더링 ---
  function drawSkyBackground(w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a0d1e');
    skyGrad.addColorStop(0.35, '#1b1c3b');
    skyGrad.addColorStop(0.68, '#3d2552');
    skyGrad.addColorStop(0.86, '#70305d');
    skyGrad.addColorStop(1, '#a64a66');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.95, 10, w * 0.5, h * 0.95, w * 0.55);
    sunGrad.addColorStop(0, 'rgba(255, 190, 80, 0.45)');
    sunGrad.addColorStop(0.4, 'rgba(255, 90, 100, 0.2)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    drawMountainSilhouette(w, h);
  }

  function drawMountainSilhouette(w, h) {
    ctx.fillStyle = 'rgba(20, 12, 32, 0.65)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.78);
    ctx.lineTo(w * 0.18, h * 0.72);
    ctx.lineTo(w * 0.38, h * 0.81);
    ctx.lineTo(w * 0.6, h * 0.69);
    ctx.lineTo(w * 0.82, h * 0.77);
    ctx.lineTo(w, h * 0.74);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0b0818';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.86);
    ctx.lineTo(w * 0.25, h * 0.82);
    ctx.lineTo(w * 0.5, h * 0.89);
    ctx.lineTo(w * 0.75, h * 0.83);
    ctx.lineTo(w, h * 0.87);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  function updateAndDrawClouds(dt, w, h) {
    clouds.forEach(cloud => {
      cloud.x += cloud.speed * dt;
      if (cloud.x - cloud.width > w) {
        cloud.x = -cloud.width;
        cloud.y = Math.random() * (h * 0.45) + 20;
      }
      ctx.fillStyle = `rgba(255, 230, 240, ${cloud.opacity})`;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.width * 0.5, cloud.height * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - cloud.width * 0.25, cloud.y + 4, cloud.width * 0.35, cloud.height * 0.35, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + cloud.width * 0.25, cloud.y + 2, cloud.width * 0.35, cloud.height * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateAndDrawBirds(dt, w, h) {
    birds.forEach(bird => {
      bird.x += bird.vx * dt;
      bird.wingAngle += dt * 8;
      if (bird.x > w + 20) {
        bird.x = -20;
        bird.y = Math.random() * (h * 0.35) + 30;
      }
      const wingY = Math.sin(bird.wingAngle) * bird.size * 0.7;
      ctx.strokeStyle = 'rgba(20, 10, 30, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bird.x - bird.size, bird.y + wingY);
      ctx.quadraticCurveTo(bird.x - bird.size * 0.5, bird.y - bird.size * 0.5, bird.x, bird.y);
      ctx.quadraticCurveTo(bird.x + bird.size * 0.5, bird.y - bird.size * 0.5, bird.x + bird.size, bird.y + wingY);
      ctx.stroke();
    });
  }

  // --- 커스텀 조준선 (Crosshair) 렌더링 ---
  function drawCrosshair(mx, my) {
    if (!mouse.isInside) return;
    const recoilOffset = mouse.recoil;
    const baseRadius = 20 + recoilOffset;

    ctx.save();
    ctx.translate(mx, my);

    // 1. 외부 점선 링
    ctx.strokeStyle = isReloading ? '#ff3366' : 'rgba(0, 240, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 십자 크로스라인
    const gap = 6 + recoilOffset * 0.5;
    const length = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -gap); ctx.lineTo(0, -gap - length);
    ctx.moveTo(0, gap); ctx.lineTo(0, gap + length);
    ctx.moveTo(-gap, 0); ctx.lineTo(-gap - length, 0);
    ctx.moveTo(gap, 0); ctx.lineTo(gap + length, 0);
    ctx.stroke();

    // 3. 중심 정밀 도트
    ctx.fillStyle = isReloading ? '#ff3366' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // 4. 재장전 진행도 링 표시
    if (isReloading) {
      const reloadPct = Math.min(1, reloadProgress / RELOAD_TIME);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * reloadPct));
      ctx.stroke();

      ctx.font = 'bold 10px Chakra Petch';
      ctx.fillStyle = '#ffbe26';
      ctx.textAlign = 'center';
      ctx.fillText('RELOAD', 0, baseRadius + 20);
    }

    ctx.restore();
  }

  // --- 메인 게임 루프 ---
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 화면 셰이크 감쇠
    let shakeX = 0;
    let shakeY = 0;
    if (shakeIntensity > 0) {
      shakeX = (Math.random() * 2 - 1) * shakeIntensity;
      shakeY = (Math.random() * 2 - 1) * shakeIntensity;
      shakeIntensity = Math.max(0, shakeIntensity - dt * 25);
    }

    // 반동 감쇠
    if (mouse.recoil > 0) {
      mouse.recoil = Math.max(0, mouse.recoil - dt * 45);
    }

    // 재장전 진행
    if (isReloading) {
      reloadProgress += dt;
      if (reloadProgress >= RELOAD_TIME) {
        isReloading = false;
        currentAmmo = MAX_AMMO;
        updateAmmoUI();
      }
    }

    // 캔버스 클리어 및 카메라 변환
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(shakeX, shakeY);

    // 1. 배경
    drawSkyBackground(w, h);
    updateAndDrawClouds(dt, w, h);
    updateAndDrawBirds(dt, w, h);

    // 2. 게임 중 로직 업데이트
    if (gameState === STATE.PLAYING) {
      gameTime -= dt;
      if (gameTime <= 0) {
        gameTime = 0;
        updateHUD();
        endGame();
      } else {
        updateHUD();
      }

      // 표적 스폰
      spawnTimer += dt;
      if (spawnTimer >= nextSpawnInterval) {
        spawnTimer = 0;
        spawnTarget();
        const progress = 1 - Math.max(0, gameTime) / INITIAL_TIME;
        nextSpawnInterval = Math.max(0.5, 1.0 - progress * 0.55 + (Math.random() * 0.3 - 0.15));
      }
    }

    // 3. 표적 업데이트 & 그리기
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      if (gameState === STATE.PLAYING) {
        target.update(dt);
      }
      target.draw(ctx);
      if (target.markedForDeletion) {
        targets.splice(i, 1);
      }
    }

    // 4. 총알 궤적 (Tracers) 렌더링
    for (let i = bulletTracers.length - 1; i >= 0; i--) {
      const bt = bulletTracers[i];
      bt.alpha -= dt * 10;
      if (bt.alpha <= 0) {
        bulletTracers.splice(i, 1);
      } else {
        ctx.strokeStyle = `rgba(255, 230, 150, ${bt.alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bt.x1, bt.y1);
        ctx.lineTo(bt.x2, bt.y2);
        ctx.stroke();
      }
    }

    // 5. 총구 섬광 (Muzzle Flash)
    if (muzzleFlashTime > 0) {
      muzzleFlashTime -= dt;
      const flashGrad = ctx.createRadialGradient(w * 0.65, h, 10, w * 0.65, h, 140);
      flashGrad.addColorStop(0, 'rgba(255, 240, 180, 0.7)');
      flashGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
      ctx.fillStyle = flashGrad;
      ctx.fillRect(w * 0.5, h - 140, 280, 140);
    }

    // 6. 파티클 업데이트 & 그리기
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.alpha -= dt / p.life;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 7. 플로팅 텍스트
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt / ft.life;

      if (ft.alpha <= 0) {
        floatingTexts.splice(i, 1);
      } else {
        ctx.save();
        ctx.font = `800 ${ft.fontSize}px Chakra Petch`;
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    ctx.restore(); // 카메라 셰이크 복원

    // 8. 조준선 그리기
    if (gameState === STATE.PLAYING) {
      drawCrosshair(mouse.x, mouse.y);
    }
  }

  // --- 마우스 및 키보드 이벤트 핸들링 ---
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.isInside = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.isInside = false;
  });

  window.addEventListener('mouseenter', () => {
    mouse.isInside = true;
  });

  // 좌클릭: 사격
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      if (e.target.closest('button') || e.target.closest('.modal-card')) {
        return;
      }
      shoot(e.clientX, e.clientY);
    } else if (e.button === 2) {
      e.preventDefault();
      startReload();
    }
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      startReload();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    }
  });

  // 버튼 이벤트 연결
  startBtn.addEventListener('click', () => {
    startGame();
  });

  restartBtn.addEventListener('click', () => {
    startGame();
  });

  menuBtn.addEventListener('click', () => {
    gameOverScreen.classList.remove('active');
    startScreen.classList.add('active');
    gameState = STATE.MENU;
    startHighScoreEl.textContent = highScore.toLocaleString();
  });

  resumeBtn.addEventListener('click', () => {
    togglePause();
  });

  soundToggleBtn.addEventListener('click', () => {
    const enabled = window.soundSystem.toggleSFX();
    soundToggleBtn.textContent = enabled ? '🔊' : '🔇';
    soundToggleBtn.style.opacity = enabled ? '1' : '0.5';
  });

  bgmToggleBtn.addEventListener('click', () => {
    const enabled = window.soundSystem.toggleBGM();
    bgmToggleBtn.textContent = enabled ? '🎵' : '🔇';
    bgmToggleBtn.style.opacity = enabled ? '1' : '0.5';
  });

  // 초기화 실행
  resizeCanvas();
  updateAmmoUI();
  requestAnimationFrame(gameLoop);

})();
