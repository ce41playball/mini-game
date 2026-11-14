/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverOverlay, PauseOverlay, TitleOverlay } from './components/GameModals';
import { patisserieAudio } from './game/audio';
import { PatisserieEngine } from './game/engine';
import { getFlavorForIndex } from './game/flavors';
import { HudSnapshot } from './game/types';

const AMBIENT_BACKDROP_SRC = '/src/assets/images/patisserie_ambient_backdrop_1794663946043.jpg';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  score: 0,
  layers: 0,
  combo: 0,
  maxCombo: 0,
  bestScore: 0,
  bestLayers: 0,
  isNewRecord: false,
  currentFlavorName: getFlavorForIndex(1).nameZh,
  perfectStreakProgress: 0,
  widthRecoveredCount: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PatisserieEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [isMuted, setIsMuted] = useState<boolean>(() => patisserieAudio.isMuted());
  const [ambientFailed, setAmbientFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PatisserieEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.startLoop();

    const handleResize = () => {
      engine.resize();
    };

    const handleWindowBlur = () => {
      if (engine.getGameState() === 'PLAYING') {
        engine.pauseGame();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleWindowBlur);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = patisserieAudio.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleCanvasPointerDown = useCallback(() => {
    engineRef.current?.handleDropInput();
  }, []);

  // Keyboard shortcuts: Space / Enter to drop or start, Escape to pause/resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const engine = engineRef.current;
      if (!engine) return;

      const state = engine.getGameState();

      if (e.code === 'Space' || e.code === 'Enter') {
        if (state === 'PLAYING') {
          e.preventDefault();
          engine.handleDropInput();
        } else if (state === 'TITLE_MENU' || state === 'GAME_OVER') {
          e.preventDefault();
          engine.startNewGame();
        }
      } else if (e.code === 'Escape') {
        if (state === 'PLAYING') {
          e.preventDefault();
          engine.pauseGame();
        } else if (state === 'PAUSED') {
          e.preventDefault();
          engine.resumeGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="relative flex h-dvh w-screen items-center justify-center overflow-hidden bg-[#241712]">
      {/* Desktop Ambient Patisserie Backdrop */}
      <div aria-hidden="true" className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
        {!ambientFailed ? (
          <img
            src={AMBIENT_BACKDROP_SRC}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setAmbientFailed(true)}
            className="h-full w-full object-cover scale-105 blur-[10px] opacity-55"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#3A2319] via-[#2B1A13] to-[#1A0F0B]" />
        )}
        <div className="absolute inset-0 bg-radial from-transparent via-[#241712]/45 to-[#180E0A]/85" />
      </div>

      {/* Centered Mobile Portrait Game Frame (full viewport on mobile, 9:16 portrait frame on desktop) */}
      <section
        aria-label="法式甜點疊疊樂遊戲視窗"
        onPointerDown={handleCanvasPointerDown}
        className="relative h-full w-full sm:h-[min(92dvh,820px)] sm:w-auto sm:aspect-[9/16] sm:max-w-[440px] sm:rounded-[28px] sm:shadow-[0_28px_80px_rgba(0,0,0,0.58)] sm:ring-1 sm:ring-[#FFFDF9]/15 overflow-hidden bg-[#FDF8F2] touch-manipulation"
      >
        {/* Isolated 60fps Canvas */}
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-pointer"
        />

        {/* First-drop subtle cue */}
        {hud.gameState === 'PLAYING' && hud.layers === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
            <span className="text-xs font-semibold tracking-wide text-[#FFFDF9]/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]">
              點擊畫面或按 Space 放下蛋糕
            </span>
          </div>
        )}

        {/* World-Matched Low-Occlusion HUD */}
        <GameHud
          hud={hud}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
        />

        {/* Title Screen */}
        {hud.gameState === 'TITLE_MENU' && (
          <TitleOverlay
            bestScore={hud.bestScore}
            bestLayers={hud.bestLayers}
            isMuted={isMuted}
            onStart={handleStart}
            onToggleMute={handleToggleMute}
          />
        )}

        {/* Pause & Game Over Modals */}
        <PauseOverlay
          hud={hud}
          onResume={handleResume}
          onRestart={handleStart}
          onReturnTitle={handleReturnTitle}
        />

        <GameOverOverlay
          hud={hud}
          onRestart={handleStart}
          onReturnTitle={handleReturnTitle}
        />
      </section>
    </main>
  );
}
