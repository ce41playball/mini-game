import { Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, WIDTH_RECOVERY_STREAK } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

export function GameHud({ hud, isMuted, onToggleMute, onPause }: GameHudProps) {
  if (hud.gameState !== 'PLAYING') return null;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-3 pb-2">
      <div className="flex items-start justify-between gap-2">
        {/* Left: Score & Flavor */}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[11px] font-medium text-[#7A5C4F] leading-none">
            分數
          </span>
          <span className="font-display text-3xl font-bold text-[#2D1E18] tabular-nums leading-tight tracking-tight">
            {hud.score}
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-[#8C5B3C] truncate max-w-[140px]">
            {hud.currentFlavorName}
          </span>
        </div>

        {/* Center-Right: Layers + Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col items-end pr-2 mr-1 border-r border-[#2D1E18]/15">
            <span className="text-[11px] font-medium text-[#7A5C4F] leading-none">
              層數
            </span>
            <span className="font-display text-2xl font-bold text-[#2D1E18] tabular-nums leading-tight">
              {hud.layers}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={isMuted ? '開啟音效' : '靜音'}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl bg-[#FFFDF9]/90 border border-[#6B442A]/15 text-[#2D1E18] shadow-sm active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E67]"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="暫停遊戲"
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl bg-[#FFFDF9]/90 border border-[#6B442A]/15 text-[#2D1E18] shadow-sm active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D94E67]"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Subtle Combo & Width Recovery Progress Strip (only visible during active streak) */}
      {hud.combo > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs font-bold text-[#D94E67] tabular-nums">
            連擊 ×{hud.combo}
          </span>
          <span aria-hidden="true" className="text-[#7A5C4F]/40 text-xs">
            ·
          </span>
          <div className="flex items-center gap-1" aria-label="完美回寬進度">
            {Array.from({ length: WIDTH_RECOVERY_STREAK }).map((_, idx) => {
              const filled =
                hud.perfectStreakProgress === 0
                  ? true
                  : idx < hud.perfectStreakProgress;
              return (
                <span
                  key={idx}
                  className={`block w-2 h-2 rounded-xs transition-colors duration-150 ${
                    filled ? 'bg-[#E5A93C]' : 'bg-[#6B442A]/18'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-medium text-[#7A5C4F]">
            回寬
          </span>
        </div>
      )}
    </header>
  );
}
