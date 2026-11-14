import { useState } from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { PatisserieTitleLockup } from './PatisserieTitleLockup';

const TITLE_ART_SRC = '/src/assets/images/patisserie_title_keyart_1794663946528.jpg';

interface TitleOverlayProps {
  bestScore: number;
  bestLayers: number;
  isMuted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleOverlay({
  bestScore,
  bestLayers,
  isMuted,
  onStart,
  onToggleMute,
}: TitleOverlayProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between overflow-hidden bg-[#FDF8F2]">
      {/* Illustrated Key-Art Backdrop with fallback */}
      {!imgFailed ? (
        <img
          src={TITLE_ART_SRC}
          alt="法式甜點屋背景插畫"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-bottom"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#FDF8F2] via-[#F7E7DA] to-[#6B442A]"
        />
      )}

      {/* Soft top-to-bottom readability gradient over calm upper sky/wall */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#FDF8F2]/85 via-[#FDF8F2]/50 to-[#241712]/70 pointer-events-none"
      />

      {/* Top Mute Utility */}
      <div className="relative z-10 flex justify-end px-4 pt-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? '開啟音效' : '靜音'}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#FFFDF9]/90 border border-[#6B442A]/15 text-[#2D1E18] shadow-sm active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E67]"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Calm Negative Space Title Lockup */}
      <div className="relative z-10 flex flex-col items-center px-6 -mt-8">
        <PatisserieTitleLockup />
        <p className="mt-3 text-sm font-medium text-[#5B3D31] text-center max-w-[270px] leading-relaxed">
          抓準擺鐘弧線釋放蛋糕，精準對齊累積連擊與完美回寬。
        </p>

        {bestScore > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#6B442A] tabular-nums">
            <span>最佳分數 {bestScore}</span>
            <span aria-hidden="true">·</span>
            <span>最高 {bestLayers} 層</span>
          </div>
        )}
      </div>

      {/* Bottom CTA & Single Control Hint */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-8 pt-6">
        <button
          type="button"
          onClick={onStart}
          className="w-full max-w-[260px] min-h-[52px] px-6 py-3 rounded-xl bg-[#D94E67] hover:bg-[#C63D56] active:scale-[0.98] text-white font-bold text-base tracking-wide shadow-[0_10px_24px_rgba(217,78,103,0.38)] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>開始疊蛋糕</span>
        </button>

        <p className="mt-3.5 text-xs font-medium text-[#FDF8F2]/90 tracking-wide whitespace-nowrap">
          點擊畫面或按 Space 落下 · Esc 暫停
        </p>
      </div>
    </div>
  );
}

interface PauseOverlayProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseOverlay({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseOverlayProps) {
  if (hud.gameState !== 'PAUSED') return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#241712]/60 px-6"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[310px] rounded-2xl bg-[#FFFDF9] border border-[#6B442A]/15 p-6 shadow-xl text-center">
        <p className="text-xs font-semibold tracking-widest text-[#8C5B3C] font-display">
          PAUSE
        </p>
        <h2 className="mt-1 text-2xl font-bold text-[#2D1E18]">遊戲暫停</h2>

        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[#7A5C4F] tabular-nums">
          <span>目前 {hud.score} 分</span>
          <span aria-hidden="true">·</span>
          <span>已疊 {hud.layers} 層</span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D94E67] hover:bg-[#C63D56] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>繼續遊戲</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F5EDE3] hover:bg-[#EADCCF] active:scale-[0.98] text-[#2D1E18] font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重新開始</span>
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[44px] px-5 py-2 text-[#7A5C4F] hover:text-[#2D1E18] font-medium text-sm flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>返回主畫面</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverOverlayProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameOverOverlay({
  hud,
  onRestart,
  onReturnTitle,
}: GameOverOverlayProps) {
  if (hud.gameState !== 'GAME_OVER') return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#241712]/65 px-6"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-[324px] rounded-2xl bg-[#FFFDF9] border border-[#6B442A]/15 p-6 shadow-2xl text-center">
        {hud.isNewRecord ? (
          <p className="text-xs font-bold tracking-wider text-[#D94E67]">
            新紀錄達成
          </p>
        ) : (
          <p className="text-xs font-semibold tracking-widest text-[#8C5B3C] font-display">
            BON APPÉTIT
          </p>
        )}

        <h2 className="mt-1 text-2xl font-bold text-[#2D1E18]">烘焙結束</h2>

        <div className="mt-4 py-4 border-y border-[#6B442A]/12">
          <div className="text-xs font-medium text-[#7A5C4F]">最終分數</div>
          <div className="font-display text-5xl font-extrabold text-[#D94E67] tabular-nums mt-1">
            {hud.score}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[11px] font-medium text-[#7A5C4F]">疊高層數</div>
            <div className="text-lg font-bold text-[#2D1E18] tabular-nums mt-0.5">
              {hud.layers} 層
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#7A5C4F]">最高連擊</div>
            <div className="text-lg font-bold text-[#2D1E18] tabular-nums mt-0.5">
              ×{hud.maxCombo}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#7A5C4F]">完美回寬</div>
            <div className="text-lg font-bold text-[#2D1E18] tabular-nums mt-0.5">
              {hud.widthRecoveredCount} 次
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs font-medium text-[#7A5C4F] tabular-nums">
          歷史最佳 {hud.bestScore} 分 · 最高 {hud.bestLayers} 層
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D94E67] hover:bg-[#C63D56] active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_8px_20px_rgba(217,78,103,0.28)] transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>再玩一次</span>
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[44px] px-5 py-2 text-[#7A5C4F] hover:text-[#2D1E18] font-medium text-sm flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>返回主畫面</span>
          </button>
        </div>
      </div>
    </div>
  );
}
