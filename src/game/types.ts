export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type DropPhase = 'SWINGING' | 'FALLING' | 'MISS_FALLING';

export interface CakeFlavor {
  id: string;
  nameZh: string;
  spongeTop: string;
  spongeBottom: string;
  fillingColor: string;
  frostingColor: string;
  frostingHighlight: string;
  berryColor: string;
  crumbColor: string;
}

export interface CakeLayer {
  index: number;
  x: number; // center x in world coordinates
  y: number; // bottom y in world coordinates (increases upward as positive height, or worldY up)
  width: number;
  displayWidth: number;
  height: number;
  flavor: CakeFlavor;
  squash: number; // 0..1 compression animation on landing
  goldGlow: number; // 0..1 shimmer when perfect or width recovered
  toppingSeed: number; // deterministic decorative berry/pistachio positions
}

export interface FallingCake {
  x: number;
  y: number; // bottom y in world coordinates
  width: number;
  height: number;
  vy: number;
  angle: number;
  flavor: CakeFlavor;
  toppingSeed: number;
}

export interface FallingPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  flavor: CakeFlavor;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  shape: 'circle' | 'star' | 'crumb';
  rotation: number;
  rotSpeed: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  subText?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ImpactRing {
  x: number;
  y: number;
  width: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface HudSnapshot {
  gameState: GameState;
  score: number;
  layers: number;
  combo: number;
  maxCombo: number;
  bestScore: number;
  bestLayers: number;
  isNewRecord: boolean;
  currentFlavorName: string;
  perfectStreakProgress: number; // 0..4 out of 5 toward width recovery
  widthRecoveredCount: number;
}

export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 711;
export const BASE_CAKE_WIDTH = 176;
export const CAKE_HEIGHT = 36;
export const PERFECT_TOLERANCE = 5.0;
export const WIDTH_RECOVERY_STREAK = 5;
export const WIDTH_RECOVERY_AMOUNT = 18;
