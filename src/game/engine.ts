import { patisserieAudio } from './audio';
import { getFlavorForIndex } from './flavors';
import {
  BASE_CAKE_WIDTH,
  CAKE_HEIGHT,
  CakeFlavor,
  CakeLayer,
  DropPhase,
  FallingCake,
  FallingPiece,
  FloatingText,
  GameState,
  HudSnapshot,
  ImpactRing,
  PERFECT_TOLERANCE,
  Particle,
  WIDTH_RECOVERY_AMOUNT,
  WIDTH_RECOVERY_STREAK,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './types';

const BEST_SCORE_KEY = 'patisserie_stack_best_score_v1';
const BEST_LAYERS_KEY = 'patisserie_stack_best_layers_v1';

const GROUND_SCREEN_Y = 588;
const PEDESTAL_HEIGHT = 44;
const PIVOT_X = WORLD_WIDTH / 2;
const PIVOT_Y = 26;
const ARM_LENGTH = 136;
const GRAVITY = 2250;

export class PatisserieEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudChange: (snapshot: HudSnapshot) => void;

  private rafId: number | null = null;
  private lastTimestamp: number = 0;

  private gameState: GameState = 'TITLE_MENU';
  private dropPhase: DropPhase = 'SWINGING';

  private stack: CakeLayer[] = [];
  private fallingCake: FallingCake | null = null;
  private fallingPieces: FallingPiece[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private impactRings: ImpactRing[] = [];

  // Pendulum state
  private swingTime: number = 0;
  private pendulumAngle: number = 0;
  private hookOpen: number = 0; // 0 = closed holding cake, 1 = open
  private nextFlavor: CakeFlavor = getFlavorForIndex(1);
  private nextSeed: number = 17;

  // Camera & Juice
  private cameraY: number = 0;
  private targetCameraY: number = 0;
  private shakeTimer: number = 0;
  private shakeMagnitude: number = 0;
  private hitstopTimer: number = 0;
  private missTimer: number = 0;
  private clockTime: number = 0;

  // Scoring & Progression
  private score: number = 0;
  private layersStacked: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private bestScore: number = 0;
  private bestLayers: number = 0;
  private isNewRecord: boolean = false;
  private widthRecoveredCount: number = 0;

  constructor(canvas: HTMLCanvasElement, onHudChange: (snapshot: HudSnapshot) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.onHudChange = onHudChange;

    this.loadRecords();
    this.setupInitialTower();
    this.resize();
    this.emitHud();
  }

  private loadRecords(): void {
    try {
      this.bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) || 0) || 0;
      this.bestLayers = Number(localStorage.getItem(BEST_LAYERS_KEY) || 0) || 0;
    } catch {
      this.bestScore = 0;
      this.bestLayers = 0;
    }
  }

  private saveRecords(): void {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      localStorage.setItem(BEST_LAYERS_KEY, String(this.bestLayers));
    } catch {
      // Ignore storage restrictions
    }
  }

  public resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = WORLD_WIDTH * dpr;
    this.canvas.height = WORLD_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private setupInitialTower(): void {
    this.stack = [
      {
        index: 0,
        x: WORLD_WIDTH / 2,
        y: PEDESTAL_HEIGHT,
        width: BASE_CAKE_WIDTH,
        displayWidth: BASE_CAKE_WIDTH,
        height: CAKE_HEIGHT,
        flavor: getFlavorForIndex(0),
        squash: 0,
        goldGlow: 0,
        toppingSeed: 1,
      },
    ];
    this.fallingCake = null;
    this.fallingPieces = [];
    this.particles = [];
    this.floatingTexts = [];
    this.impactRings = [];

    this.dropPhase = 'SWINGING';
    this.swingTime = 0;
    this.pendulumAngle = 0;
    this.hookOpen = 0;
    this.nextFlavor = getFlavorForIndex(1);
    this.nextSeed = 23;

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
    this.hitstopTimer = 0;
    this.missTimer = 0;

    this.score = 0;
    this.layersStacked = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isNewRecord = false;
    this.widthRecoveredCount = 0;
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public startNewGame(): void {
    patisserieAudio.unlock();
    patisserieAudio.playButton();
    this.setupInitialTower();
    this.gameState = 'PLAYING';
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.emitHud();
    }
  }

  public resumeGame(): void {
    if (this.gameState === 'PAUSED') {
      this.lastTimestamp = performance.now();
      this.gameState = 'PLAYING';
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    patisserieAudio.playButton();
    this.setupInitialTower();
    this.gameState = 'TITLE_MENU';
    this.emitHud();
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public handleDropInput(): void {
    if (this.gameState !== 'PLAYING') return;
    if (this.dropPhase !== 'SWINGING') return;

    patisserieAudio.unlock();
    patisserieAudio.playHookRelease();

    const topLayer = this.stack[this.stack.length - 1];
    const tip = this.getPendulumTip();
    const cakeTopScreenY = tip.y + 8;
    const cakeBottomScreenY = cakeTopScreenY + CAKE_HEIGHT;
    const cakeBottomWorldY = GROUND_SCREEN_Y - cakeBottomScreenY + this.cameraY;

    this.fallingCake = {
      x: tip.x,
      y: cakeBottomWorldY,
      width: topLayer.width,
      height: CAKE_HEIGHT,
      vy: 135,
      angle: this.pendulumAngle * 0.35,
      flavor: this.nextFlavor,
      toppingSeed: this.nextSeed,
    };

    this.dropPhase = 'FALLING';
    this.hookOpen = 1;
  }

  private getSwingParameters(): { speed: number; maxAngle: number } {
    // Smooth difficulty ramp with reasonable ceiling
    const speed = Math.min(2.05 + this.layersStacked * 0.055, 4.15);
    const maxAngle = Math.min(0.62 + this.layersStacked * 0.008, 0.84);
    return { speed, maxAngle };
  }

  private getPendulumTip(): { x: number; y: number } {
    return {
      x: PIVOT_X + Math.sin(this.pendulumAngle) * ARM_LENGTH,
      y: PIVOT_Y + Math.cos(this.pendulumAngle) * ARM_LENGTH,
    };
  }

  private update(dt: number): void {
    this.clockTime += dt;

    if (this.gameState === 'PAUSED') {
      return;
    }

    // Gentle idle animation on title screen
    if (this.gameState === 'TITLE_MENU') {
      this.swingTime += dt;
      this.pendulumAngle = 0.45 * Math.sin(this.swingTime * 1.6);
      return;
    }

    // Brief hitstop on slice/heavy impact while letting shake decay
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    // Camera easing
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * 6.5);

    // Hook smooth close when swinging
    const targetHookOpen = this.dropPhase === 'SWINGING' ? 0 : 1;
    this.hookOpen += (targetHookOpen - this.hookOpen) * Math.min(1, dt * 14);

    // Pendulum swing always progresses during PLAYING
    if (this.gameState === 'PLAYING') {
      const { speed, maxAngle } = this.getSwingParameters();
      this.swingTime += dt;
      this.pendulumAngle = maxAngle * Math.sin(this.swingTime * speed);
    }

    // Update squash & gold glow & displayWidth on existing layers
    for (const layer of this.stack) {
      if (layer.squash > 0) {
        layer.squash = Math.max(0, layer.squash - dt * 2.8);
      }
      if (layer.goldGlow > 0) {
        layer.goldGlow = Math.max(0, layer.goldGlow - dt * 1.4);
      }
      if (Math.abs(layer.displayWidth - layer.width) > 0.2) {
        layer.displayWidth += (layer.width - layer.displayWidth) * Math.min(1, dt * 14);
      } else {
        layer.displayWidth = layer.width;
      }
    }

    // Update active falling cake
    if (this.fallingCake && this.dropPhase === 'FALLING') {
      this.fallingCake.vy += GRAVITY * dt;
      this.fallingCake.y -= this.fallingCake.vy * dt;
      // Straighten cake tilt smoothly during fall
      this.fallingCake.angle *= Math.max(0, 1 - dt * 10);

      const topLayer = this.stack[this.stack.length - 1];
      const landingWorldY = topLayer.y + topLayer.height;

      if (this.fallingCake.y <= landingWorldY) {
        this.resolveCakeLanding(topLayer, landingWorldY);
      }
    }

    // Miss timer countdown to GAME_OVER
    if (this.dropPhase === 'MISS_FALLING' && this.gameState === 'PLAYING') {
      this.missTimer -= dt;
      if (this.missTimer <= 0) {
        this.gameState = 'GAME_OVER';
        this.emitHud();
      }
    }

    // Update sliced / missed falling pieces
    for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
      const p = this.fallingPieces[i];
      p.vy += GRAVITY * dt;
      p.y -= p.vy * dt;
      p.x += p.vx * dt;
      p.angle += p.angularVelocity * dt;
      if (this.worldToScreenY(p.y) > WORLD_HEIGHT + 160) {
        this.fallingPieces.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.vy -= pt.gravity * dt; // upward positive in worldY, gravity pulls down
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.rotation += pt.rotSpeed * dt;
    }

    // Update impact rings
    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      const ring = this.impactRings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        this.impactRings.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += 38 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private resolveCakeLanding(topLayer: CakeLayer, landingWorldY: number): void {
    const cake = this.fallingCake;
    if (!cake) return;

    const delta = cake.x - topLayer.x;
    const absDelta = Math.abs(delta);

    const targetLeft = topLayer.x - topLayer.width / 2;
    const targetRight = topLayer.x + topLayer.width / 2;
    const fallingLeft = cake.x - cake.width / 2;
    const fallingRight = cake.x + cake.width / 2;

    const overlapLeft = Math.max(targetLeft, fallingLeft);
    const overlapRight = Math.min(targetRight, fallingRight);
    const overlapWidth = overlapRight - overlapLeft;

    // Case C: Complete Miss
    if (overlapWidth <= 2) {
      this.combo = 0;
      this.dropPhase = 'MISS_FALLING';
      this.missTimer = 0.68;
      this.shakeTimer = 0.25;
      this.shakeMagnitude = 7;
      patisserieAudio.playMiss();

      const deflectDir = delta >= 0 ? 1 : -1;
      this.fallingPieces.push({
        x: cake.x,
        y: landingWorldY,
        width: cake.width,
        height: cake.height,
        vx: deflectDir * 68,
        vy: cake.vy * 0.45,
        angle: cake.angle,
        angularVelocity: deflectDir * 4.2,
        flavor: cake.flavor,
        alpha: 1,
      });

      this.floatingTexts.push({
        x: Math.min(Math.max(cake.x, 76), WORLD_WIDTH - 76),
        y: landingWorldY + CAKE_HEIGHT + 16,
        text: '哎呀！掉下去了',
        color: '#C83E56',
        life: 0.9,
        maxLife: 0.9,
        scale: 1,
      });

      this.fallingCake = null;
      this.emitHud();
      return;
    }

    // Case A: Perfect Alignment
    if (absDelta <= PERFECT_TOLERANCE) {
      this.combo += 1;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }

      let finalWidth = topLayer.width;
      let recoveredWidth = false;

      if (this.combo % WIDTH_RECOVERY_STREAK === 0 && finalWidth < BASE_CAKE_WIDTH) {
        finalWidth = Math.min(BASE_CAKE_WIDTH, finalWidth + WIDTH_RECOVERY_AMOUNT);
        recoveredWidth = true;
        this.widthRecoveredCount += 1;
      }

      const newLayer: CakeLayer = {
        index: topLayer.index + 1,
        x: topLayer.x,
        y: landingWorldY,
        width: finalWidth,
        displayWidth: topLayer.width, // smoothly animates to finalWidth if recovered
        height: CAKE_HEIGHT,
        flavor: cake.flavor,
        squash: 0.9,
        goldGlow: recoveredWidth ? 1.4 : 1.0,
        toppingSeed: cake.toppingSeed,
      };
      this.stack.push(newLayer);
      this.layersStacked += 1;

      const bonusPoints = 10 + this.combo * 5 + (recoveredWidth ? 25 : 0);
      this.score += bonusPoints;

      patisserieAudio.playPerfect(this.combo, recoveredWidth);
      this.spawnPerfectParticles(newLayer.x, landingWorldY + CAKE_HEIGHT, finalWidth, recoveredWidth);

      this.impactRings.push({
        x: newLayer.x,
        y: landingWorldY + CAKE_HEIGHT / 2,
        width: finalWidth,
        life: 0.42,
        maxLife: 0.42,
        color: recoveredWidth ? '#D94E67' : '#E5A93C',
      });

      this.floatingTexts.push({
        x: newLayer.x,
        y: landingWorldY + CAKE_HEIGHT + 18,
        text: recoveredWidth ? `完美連擊 ×${this.combo}` : `PERFECT ×${this.combo}`,
        subText: recoveredWidth ? '蛋糕寬度回復！' : `+${bonusPoints}`,
        color: recoveredWidth ? '#D94E67' : '#C98419',
        life: 0.95,
        maxLife: 0.95,
        scale: recoveredWidth ? 1.15 : 1.0,
      });

      this.advanceToNextSwing(newLayer);
      return;
    }

    // Case B: Partial Overlap -> Slice excess
    this.combo = 0;
    const newCenterX = (overlapLeft + overlapRight) / 2;
    const overhangWidth = cake.width - overlapWidth;
    const cutSeamX = delta > 0 ? targetRight : targetLeft;
    const overhangCenterX =
      delta > 0 ? targetRight + overhangWidth / 2 : targetLeft - overhangWidth / 2;

    const newLayer: CakeLayer = {
      index: topLayer.index + 1,
      x: newCenterX,
      y: landingWorldY,
      width: overlapWidth,
      displayWidth: overlapWidth,
      height: CAKE_HEIGHT,
      flavor: cake.flavor,
      squash: 0.72,
      goldGlow: 0,
      toppingSeed: cake.toppingSeed,
    };
    this.stack.push(newLayer);
    this.layersStacked += 1;
    this.score += 10;

    // Spawn cut overhang falling piece
    const dir = delta > 0 ? 1 : -1;
    this.fallingPieces.push({
      x: overhangCenterX,
      y: landingWorldY,
      width: overhangWidth,
      height: CAKE_HEIGHT,
      vx: dir * (78 + Math.min(overhangWidth, 60) * 0.6),
      vy: 45,
      angle: 0,
      angularVelocity: dir * 3.6,
      flavor: cake.flavor,
      alpha: 1,
    });

    this.spawnSliceCrumbs(cutSeamX, landingWorldY + CAKE_HEIGHT * 0.5, cake.flavor);

    // Tactile hitstop & subtle shake
    this.hitstopTimer = 0.032;
    this.shakeTimer = 0.14;
    this.shakeMagnitude = 3.8;
    patisserieAudio.playSlice(overlapWidth / cake.width);

    this.advanceToNextSwing(newLayer);
  }

  private advanceToNextSwing(landedLayer: CakeLayer): void {
    this.fallingCake = null;
    this.dropPhase = 'SWINGING';

    // Update high scores live
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.isNewRecord = true;
    }
    if (this.layersStacked > this.bestLayers) {
      this.bestLayers = this.layersStacked;
    }
    if (this.isNewRecord) {
      this.saveRecords();
    }

    // Pan camera smoothly to keep top of stack comfortably at screenY ~465
    const stackTopWorldY = landedLayer.y + landedLayer.height;
    this.targetCameraY = Math.max(0, stackTopWorldY - 125);

    // Prepare next cake flavor
    this.nextFlavor = getFlavorForIndex(landedLayer.index + 1);
    this.nextSeed = (landedLayer.index + 2) * 37;

    this.emitHud();
  }

  private spawnPerfectParticles(x: number, y: number, width: number, isRecovery: boolean): void {
    const count = isRecovery ? 26 : 16;
    for (let i = 0; i < count; i++) {
      const offset = (Math.random() - 0.5) * width;
      const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.7;
      const speed = 75 + Math.random() * 145;
      this.particles.push({
        x: x + offset,
        y: y - 4,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.8 + (offset > 0 ? 30 : -30),
        vy: Math.sin(angle) * speed,
        size: isRecovery ? 4 + Math.random() * 4 : 3 + Math.random() * 3,
        color: isRecovery
          ? i % 2 === 0
            ? '#E5A93C'
            : '#D94E67'
          : i % 3 === 0
            ? '#FFFDF7'
            : '#E5A93C',
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        gravity: 340,
        shape: 'star',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }
  }

  private spawnSliceCrumbs(seamX: number, y: number, flavor: CakeFlavor): void {
    for (let i = 0; i < 15; i++) {
      const vx = (Math.random() - 0.5) * 140;
      const vy = 40 + Math.random() * 140;
      this.particles.push({
        x: seamX + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 18,
        vx,
        vy,
        size: 2.5 + Math.random() * 3.5,
        color: i % 3 === 0 ? flavor.frostingColor : flavor.crumbColor,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity: 680,
        shape: 'crumb',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  private worldToScreenY(worldY: number): number {
    return GROUND_SCREEN_Y - (worldY - this.cameraY);
  }

  private emitHud(): void {
    this.onHudChange({
      gameState: this.gameState,
      score: this.score,
      layers: this.layersStacked,
      combo: this.combo,
      maxCombo: this.maxCombo,
      bestScore: this.bestScore,
      bestLayers: this.bestLayers,
      isNewRecord: this.isNewRecord,
      currentFlavorName: this.nextFlavor.nameZh,
      perfectStreakProgress: this.combo % WIDTH_RECOVERY_STREAK,
      widthRecoveredCount: this.widthRecoveredCount,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();

    // Camera shake offset
    if (this.shakeTimer > 0) {
      const decay = this.shakeTimer / 0.25;
      const mag = this.shakeMagnitude * Math.min(1, decay);
      ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
    }

    this.drawScenery(ctx);
    this.drawWoodenCounterAndPedestal(ctx);
    this.drawShadowGuide(ctx);
    this.drawCakeStack(ctx);
    this.drawFallingCake(ctx);
    this.drawFallingPieces(ctx);
    this.drawImpactRings(ctx);
    this.drawParticles(ctx);
    this.drawPendulum(ctx);
    this.drawFloatingTexts(ctx);

    ctx.restore();
  }

  private drawScenery(ctx: CanvasRenderingContext2D): void {
    // Transition sky/wall tones smoothly based on camera elevation
    const altitudeProgress = Math.min(1, this.cameraY / 1100);

    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    if (altitudeProgress < 0.5) {
      grad.addColorStop(0, '#FBF3EA');
      grad.addColorStop(0.6, '#F7E7DA');
      grad.addColorStop(1, '#EED5C3');
    } else {
      grad.addColorStop(0, '#E9EEF6');
      grad.addColorStop(0.55, '#F9E6DF');
      grad.addColorStop(1, '#F6DFD1');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Subtle morning sunlight beam from upper right window
    ctx.save();
    const beamGrad = ctx.createLinearGradient(WORLD_WIDTH, 0, 80, WORLD_HEIGHT * 0.85);
    beamGrad.addColorStop(0, 'rgba(255, 248, 232, 0.45)');
    beamGrad.addColorStop(1, 'rgba(255, 248, 232, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(WORLD_WIDTH, 0);
    ctx.lineTo(WORLD_WIDTH, 320);
    ctx.lineTo(60, WORLD_HEIGHT);
    ctx.lineTo(0, WORLD_HEIGHT);
    ctx.lineTo(0, 420);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Wainscoting & wall molding in lower interior zone
    const wainscotTopScreenY = this.worldToScreenY(220);
    if (wainscotTopScreenY < WORLD_HEIGHT) {
      ctx.fillStyle = '#F2DDD0';
      ctx.fillRect(0, wainscotTopScreenY, WORLD_WIDTH, Math.max(0, GROUND_SCREEN_Y - wainscotTopScreenY + this.cameraY));

      // Molding rail
      ctx.fillStyle = '#DFC2B0';
      ctx.fillRect(0, wainscotTopScreenY, WORLD_WIDTH, 6);

      // Subtle vertical paneling stripes
      ctx.strokeStyle = 'rgba(196, 158, 136, 0.35)';
      ctx.lineWidth = 1.5;
      for (let px = 32; px < WORLD_WIDTH; px += 72) {
        ctx.strokeRect(px, wainscotTopScreenY + 20, 48, 130);
      }
    }

    // Arched bakery window backdrop at mid-lower elevation
    const windowBottomScreenY = this.worldToScreenY(260);
    if (windowBottomScreenY > -50 && windowBottomScreenY < WORLD_HEIGHT + 220) {
      ctx.save();
      const wx = 290;
      const wy = windowBottomScreenY - 170;
      ctx.fillStyle = 'rgba(255, 252, 246, 0.72)';
      ctx.strokeStyle = '#C9A88E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wx, wy + 50, 52, Math.PI, 0);
      ctx.lineTo(wx + 52, wy + 170);
      ctx.lineTo(wx - 52, wy + 170);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Window mullions
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 2);
      ctx.lineTo(wx, wy + 170);
      ctx.moveTo(wx - 52, wy + 64);
      ctx.lineTo(wx + 52, wy + 64);
      ctx.moveTo(wx - 52, wy + 116);
      ctx.lineTo(wx + 52, wy + 116);
      ctx.stroke();
      ctx.restore();
    }

    // Soft floating clouds when climbing into upper sky levels
    if (this.cameraY > 240) {
      const cloudAlpha = Math.min(0.65, (this.cameraY - 240) / 500);
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
      const cloudSeeds = [
        { x: 75, worldY: 640, r: 28 },
        { x: 315, worldY: 820, r: 34 },
        { x: 110, worldY: 1080, r: 30 },
        { x: 295, worldY: 1340, r: 36 },
        { x: 85, worldY: 1620, r: 32 },
      ];
      for (const c of cloudSeeds) {
        const sy = this.worldToScreenY(c.worldY);
        if (sy > -80 && sy < WORLD_HEIGHT + 80) {
          ctx.beginPath();
          ctx.arc(c.x, sy, c.r, 0, Math.PI * 2);
          ctx.arc(c.x + c.r * 0.7, sy + 4, c.r * 0.72, 0, Math.PI * 2);
          ctx.arc(c.x - c.r * 0.65, sy + 5, c.r * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Subtle height floor markers on the left margin every 5 layers
    ctx.save();
    ctx.font = '600 11px "Playfair Display", Georgia, serif';
    ctx.fillStyle = 'rgba(107, 68, 42, 0.32)';
    ctx.textAlign = 'left';
    for (let floor = 5; floor <= this.layersStacked + 12; floor += 5) {
      const wy = PEDESTAL_HEIGHT + floor * CAKE_HEIGHT;
      const sy = this.worldToScreenY(wy);
      if (sy > 80 && sy < GROUND_SCREEN_Y - 20) {
        ctx.fillRect(10, sy, 12, 1);
        ctx.fillText(`${floor}F`, 26, sy + 4);
      }
    }
    ctx.restore();
  }

  private drawWoodenCounterAndPedestal(ctx: CanvasRenderingContext2D): void {
    const counterTopY = this.worldToScreenY(0);

    // Draw walnut wooden counter if visible
    if (counterTopY < WORLD_HEIGHT + 40) {
      const counterHeight = WORLD_HEIGHT - counterTopY + 40;

      // Top counter lip
      const lipGrad = ctx.createLinearGradient(0, counterTopY, 0, counterTopY + 18);
      lipGrad.addColorStop(0, '#8C5B3C');
      lipGrad.addColorStop(1, '#6B442A');
      ctx.fillStyle = lipGrad;
      ctx.fillRect(0, counterTopY, WORLD_WIDTH, 18);

      // Brass trim line
      ctx.fillStyle = '#D6A85A';
      ctx.fillRect(0, counterTopY, WORLD_WIDTH, 2);

      // Main walnut cabinet body
      const bodyGrad = ctx.createLinearGradient(0, counterTopY + 18, 0, WORLD_HEIGHT);
      bodyGrad.addColorStop(0, '#5B3822');
      bodyGrad.addColorStop(1, '#3D2415');
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(0, counterTopY + 18, WORLD_WIDTH, counterHeight);

      // Decorative recessed wooden panels
      ctx.strokeStyle = 'rgba(229, 178, 120, 0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, counterTopY + 32, 164, 72);
      ctx.strokeRect(212, counterTopY + 32, 164, 72);
    }

    // Draw porcelain cake pedestal stand
    const pedestalTopY = this.worldToScreenY(PEDESTAL_HEIGHT);
    if (pedestalTopY < WORLD_HEIGHT + 50) {
      const cx = WORLD_WIDTH / 2;
      const plateW = BASE_CAKE_WIDTH + 34;

      // Pedestal shadow on wood
      ctx.fillStyle = 'rgba(35, 18, 10, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, counterTopY + 3, 62, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Foot base
      ctx.fillStyle = '#EFE7DC';
      ctx.beginPath();
      ctx.moveTo(cx - 52, counterTopY + 2);
      ctx.quadraticCurveTo(cx - 26, counterTopY - 12, cx - 18, pedestalTopY + 12);
      ctx.lineTo(cx + 18, pedestalTopY + 12);
      ctx.quadraticCurveTo(cx + 26, counterTopY - 12, cx + 52, counterTopY + 2);
      ctx.closePath();
      ctx.fill();

      // Stem highlight
      ctx.fillStyle = '#DFD3C3';
      ctx.fillRect(cx - 14, pedestalTopY + 12, 28, 14);

      // Top platter plate
      const plateGrad = ctx.createLinearGradient(cx - plateW / 2, 0, cx + plateW / 2, 0);
      plateGrad.addColorStop(0, '#E7DDD0');
      plateGrad.addColorStop(0.5, '#FFFDF9');
      plateGrad.addColorStop(1, '#E2D6C6');
      ctx.fillStyle = plateGrad;
      this.roundRect(ctx, cx - plateW / 2, pedestalTopY, plateW, 13, 6);
      ctx.fill();

      // Gold rim accent on porcelain plate
      ctx.strokeStyle = '#D9B166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - plateW / 2 + 8, pedestalTopY + 3);
      ctx.lineTo(cx + plateW / 2 - 8, pedestalTopY + 3);
      ctx.stroke();
    }
  }

  private drawShadowGuide(ctx: CanvasRenderingContext2D): void {
    if (this.gameState !== 'PLAYING' || this.dropPhase !== 'SWINGING') return;
    const topLayer = this.stack[this.stack.length - 1];
    const tip = this.getPendulumTip();

    const targetLeft = topLayer.x - topLayer.width / 2;
    const targetRight = topLayer.x + topLayer.width / 2;
    const hangLeft = tip.x - topLayer.width / 2;
    const hangRight = tip.x + topLayer.width / 2;

    const overlapLeft = Math.max(targetLeft, hangLeft);
    const overlapRight = Math.min(targetRight, hangRight);
    if (overlapRight <= overlapLeft) return;

    const shadowY = this.worldToScreenY(topLayer.y + topLayer.height);
    const overlapW = overlapRight - overlapLeft;
    const shadowX = (overlapLeft + overlapRight) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(45, 30, 24, 0.14)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY + 1, overlapW * 0.48, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCakeStack(ctx: CanvasRenderingContext2D): void {
    for (const layer of this.stack) {
      const bottomScreenY = this.worldToScreenY(layer.y);
      if (bottomScreenY < -60 || bottomScreenY - layer.height > WORLD_HEIGHT + 60) {
        continue;
      }
      const isTop = layer.index === this.stack.length - 1;
      this.drawCakeSlab(
        ctx,
        layer.x,
        bottomScreenY,
        layer.displayWidth,
        layer.height,
        0,
        layer.flavor,
        layer.squash,
        layer.goldGlow,
        layer.toppingSeed,
        isTop
      );
    }
  }

  private drawFallingCake(ctx: CanvasRenderingContext2D): void {
    if (!this.fallingCake) return;
    const bottomScreenY = this.worldToScreenY(this.fallingCake.y);
    this.drawCakeSlab(
      ctx,
      this.fallingCake.x,
      bottomScreenY,
      this.fallingCake.width,
      this.fallingCake.height,
      this.fallingCake.angle,
      this.fallingCake.flavor,
      0,
      0,
      this.fallingCake.toppingSeed,
      true
    );
  }

  private drawFallingPieces(ctx: CanvasRenderingContext2D): void {
    for (const p of this.fallingPieces) {
      const bottomScreenY = this.worldToScreenY(p.y);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      this.drawCakeSlab(
        ctx,
        p.x,
        bottomScreenY,
        p.width,
        p.height,
        p.angle,
        p.flavor,
        0,
        0,
        13,
        false
      );
      ctx.restore();
    }
  }

  private drawCakeSlab(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    bottomY: number,
    width: number,
    height: number,
    angle: number,
    flavor: CakeFlavor,
    squash: number,
    goldGlow: number,
    seed: number,
    showToppings: boolean
  ): void {
    if (width <= 1) return;

    ctx.save();
    ctx.translate(centerX, bottomY);
    if (angle !== 0) {
      ctx.rotate(angle);
    }

    // Squash & stretch anchored at bottom center
    if (squash > 0) {
      const s = Math.sin(squash * Math.PI);
      ctx.scale(1 + s * 0.08, 1 - s * 0.16);
    }

    const left = -width / 2;
    const top = -height;

    // Soft contact shadow at base
    ctx.fillStyle = 'rgba(45, 30, 24, 0.12)';
    ctx.fillRect(left + 3, -2, Math.max(0, width - 6), 3);

    // Gold recovery / perfect aura glow
    if (goldGlow > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(229, 169, 60, ${Math.min(1, goldGlow) * 0.85})`;
      ctx.lineWidth = 3;
      this.roundRect(ctx, left - 2, top - 2, width + 4, height + 4, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Sponge cake body gradient
    const spongeGrad = ctx.createLinearGradient(0, top + 8, 0, 0);
    spongeGrad.addColorStop(0, flavor.spongeTop);
    spongeGrad.addColorStop(1, flavor.spongeBottom);
    ctx.fillStyle = spongeGrad;
    this.roundRect(ctx, left, top + 4, width, height - 4, 5);
    ctx.fill();

    // Middle jam / cream filling layer
    ctx.fillStyle = flavor.fillingColor;
    ctx.fillRect(left + 1, top + height * 0.56, Math.max(0, width - 2), 5);

    // Subtle sponge crumb dots
    ctx.fillStyle = flavor.crumbColor;
    const dotCount = Math.max(2, Math.floor(width / 22));
    for (let i = 0; i < dotCount; i++) {
      const rx = ((seed * (i + 3) * 19) % 100) / 100;
      const ry = ((seed * (i + 7) * 31) % 100) / 100;
      const dx = left + 8 + rx * Math.max(4, width - 16);
      const dy = top + 16 + ry * (height - 22);
      ctx.beginPath();
      ctx.arc(dx, dy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frosting top cap with scalloped drips
    ctx.fillStyle = flavor.frostingColor;
    ctx.beginPath();
    ctx.moveTo(left, top + 9);
    ctx.quadraticCurveTo(left, top, left + 7, top);
    ctx.lineTo(left + width - 7, top);
    ctx.quadraticCurveTo(left + width, top, left + width, top + 9);

    // Scalloped drip wave along the front edge
    const dripCount = Math.max(2, Math.round(width / 20));
    const step = width / dripCount;
    for (let i = dripCount - 1; i >= 0; i--) {
      const xStart = left + (i + 1) * step;
      const xEnd = left + i * step;
      const xMid = (xStart + xEnd) / 2;
      const dripDepth = ((seed + i * 11) % 2 === 0 ? 15 : 11);
      ctx.quadraticCurveTo(xMid, top + dripDepth, xEnd, top + 9);
    }
    ctx.closePath();
    ctx.fill();

    // Glossy cream highlight stripe on top edge
    ctx.fillStyle = flavor.frostingHighlight;
    this.roundRect(ctx, left + 6, top + 2, Math.max(0, width - 12), 3, 1.5);
    ctx.fill();

    // Decorative fruit/chocolate pearls on top if wide enough
    if (showToppings && width >= 34) {
      const count = Math.min(5, Math.max(1, Math.floor(width / 38)));
      const span = width * 0.65;
      for (let i = 0; i < count; i++) {
        const bx = count === 1 ? 0 : -span / 2 + (span * i) / (count - 1);
        ctx.fillStyle = flavor.berryColor;
        ctx.beginPath();
        ctx.arc(bx, top - 2.5, 4.2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny berry specular glint
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(bx - 1.3, top - 3.8, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle crisp outline for 2D illustrated finish
    ctx.strokeStyle = 'rgba(74, 43, 29, 0.16)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, left, top, width, height, 5);
    ctx.stroke();

    ctx.restore();
  }

  private drawPendulum(ctx: CanvasRenderingContext2D): void {
    const tip = this.getPendulumTip();

    ctx.save();

    // Ceiling mount bracket
    ctx.fillStyle = '#9C7338';
    ctx.fillRect(PIVOT_X - 38, 0, 76, 10);

    // Brass pendulum arm
    ctx.strokeStyle = '#B88940';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Inner highlight on brass rod
    ctx.strokeStyle = '#E8C57B';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Ornate brass clock medallion at top pivot
    ctx.fillStyle = '#C79646';
    ctx.beginPath();
    ctx.arc(PIVOT_X, PIVOT_Y, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFF9EE';
    ctx.beginPath();
    ctx.arc(PIVOT_X, PIVOT_Y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9C7338';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Gently ticking clock hands
    const minAngle = this.clockTime * 0.4;
    const hourAngle = this.clockTime * 0.08;
    ctx.strokeStyle = '#4A2E20';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(PIVOT_X + Math.sin(minAngle) * 10, PIVOT_Y - Math.cos(minAngle) * 10);
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(PIVOT_X + Math.sin(hourAngle) * 6.5, PIVOT_Y - Math.cos(hourAngle) * 6.5);
    ctx.stroke();

    // Center rivet
    ctx.fillStyle = '#C79646';
    ctx.beginPath();
    ctx.arc(PIVOT_X, PIVOT_Y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Articulated brass pastry hook / tongs at pendulum tip
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(-this.pendulumAngle * 0.65);

    const openSpread = this.hookOpen * 0.55;
    ctx.strokeStyle = '#A67832';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Left prong
    ctx.beginPath();
    ctx.arc(0, 4, 9, Math.PI * 0.65 + openSpread, Math.PI * 1.35 + openSpread);
    ctx.stroke();

    // Right prong
    ctx.beginPath();
    ctx.arc(0, 4, 9, -Math.PI * 0.35 - openSpread, Math.PI * 0.35 - openSpread);
    ctx.stroke();

    // Hook joint ring
    ctx.fillStyle = '#DFB66A';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8A6024';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();

    // Draw hanging cake if swinging
    if (this.gameState === 'PLAYING' && this.dropPhase === 'SWINGING') {
      const topLayer = this.stack[this.stack.length - 1];
      const cakeBottomY = tip.y + 8 + CAKE_HEIGHT;
      this.drawCakeSlab(
        ctx,
        tip.x,
        cakeBottomY,
        topLayer.width,
        CAKE_HEIGHT,
        this.pendulumAngle * 0.35,
        this.nextFlavor,
        0,
        0,
        this.nextSeed,
        true
      );
    }

    ctx.restore();
  }

  private drawImpactRings(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.impactRings) {
      const progress = 1 - ring.life / ring.maxLife;
      const sy = this.worldToScreenY(ring.y);
      const expand = progress * 32;

      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.5 * (1 - progress * 0.5);
      this.roundRect(
        ctx,
        ring.x - ring.width / 2 - expand,
        sy - CAKE_HEIGHT / 2 - expand * 0.35,
        ring.width + expand * 2,
        CAKE_HEIGHT + expand * 0.7,
        8
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      const sy = this.worldToScreenY(pt.y);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pt.x, sy);
      ctx.rotate(pt.rotation);
      ctx.fillStyle = pt.color;

      if (pt.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * pt.size, Math.sin(a) * pt.size);
          ctx.lineTo(
            Math.cos(a + Math.PI / 4) * (pt.size * 0.4),
            Math.sin(a + Math.PI / 4) * (pt.size * 0.4)
          );
        }
        ctx.closePath();
        ctx.fill();
      } else if (pt.shape === 'crumb') {
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.85);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      const progress = 1 - ft.life / ft.maxLife;
      const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
      const sy = this.worldToScreenY(ft.y);

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(ft.x, sy);
      const pop = progress < 0.15 ? 0.85 + (progress / 0.15) * 0.25 : 1.0;
      ctx.scale(ft.scale * pop, ft.scale * pop);
      ctx.textAlign = 'center';

      ctx.font = '800 17px "Noto Sans TC", sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 250, 243, 0.94)';
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);

      if (ft.subText) {
        ctx.font = '700 13px "Noto Sans TC", sans-serif';
        ctx.strokeText(ft.subText, 0, 19);
        ctx.fillStyle = '#6B442A';
        ctx.fillText(ft.subText, 0, 19);
      }

      ctx.restore();
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
