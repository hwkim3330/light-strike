
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader, useProgress } from '@react-three/drei';
import { GameStatus, NoteData } from './types';
import { DEMO_CHART, SONG_URL, SONG_BPM } from './constants';
import { useMediaPipe } from './hooks/useMediaPipe';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import HandCursor from './components/HandCursor';
import { Play, RefreshCw, VideoOff, Hand, Sparkles, Heart, Music } from 'lucide-react';

// --- Audio Synth for Cute SFX ---
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const playPopSound = (pitch = 1.0) => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // "Triangle" wave sounds a bit more like 8-bit/cute games than Sine
    osc.type = 'triangle';
    
    // Higher base frequency for "cuteness"
    const freq = 600 * pitch + (Math.random() * 50); 
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
};

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [health, setHealth] = useState(100);

  // Audio element for timing, but we will mute it
  const audioRef = useRef<HTMLAudioElement>(new Audio(SONG_URL));
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { isCameraReady, handPositionsRef, lastResultsRef, error: cameraError } = useMediaPipe(videoRef);
  const { progress } = useProgress(); 

  useEffect(() => {
      // Mute the song so we only hear SFX
      if(audioRef.current) {
          audioRef.current.volume = 0;
      }
  }, []);

  // Game Logic Handlers
  const handleNoteHit = useCallback((note: NoteData, goodCut: boolean) => {
     let points = 100;
     if (goodCut) points += 50; 

     if (navigator.vibrate) {
         navigator.vibrate(goodCut ? 40 : 20);
     }
     
     // Play Pop SFX
     playPopSound(goodCut ? 1.2 : 0.8);

     setCombo(c => {
       const newCombo = c + 1;
       if (newCombo > 30) setMultiplier(8);
       else if (newCombo > 20) setMultiplier(4);
       else if (newCombo > 10) setMultiplier(2);
       else setMultiplier(1);
       return newCombo;
     });

     setScore(s => s + (points * multiplier));
     setHealth(h => Math.min(100, h + 2));
  }, [multiplier]);

  const handleNoteMiss = useCallback((note: NoteData) => {
      setCombo(0);
      setMultiplier(1);
      setHealth(h => {
          const newHealth = h - 15;
          if (newHealth <= 0) {
             setTimeout(() => endGame(false), 0);
             return 0;
          }
          return newHealth;
      });
  }, []);

  const startGame = async () => {
    if (!isCameraReady) return;
    
    // Resume Audio Context if needed
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(100);

    DEMO_CHART.forEach(n => { n.hit = false; n.missed = false; });

    try {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          // We play the audio to drive the game clock, but it is muted
          await audioRef.current.play();
          setGameStatus(GameStatus.PLAYING);
      }
    } catch (e) {
        console.error("Audio play failed", e);
        alert("Could not start game timer. Please interact with the page first.");
    }
  };

  const endGame = (victory: boolean) => {
      setGameStatus(victory ? GameStatus.VICTORY : GameStatus.GAME_OVER);
      if (audioRef.current) {
          audioRef.current.pause();
      }
  };

  useEffect(() => {
      if (gameStatus === GameStatus.LOADING && isCameraReady) {
          setGameStatus(GameStatus.IDLE);
      }
  }, [isCameraReady, gameStatus]);

  return (
    <div className="relative w-full h-screen bg-pink-50 overflow-hidden font-sans selection:bg-pink-200">
      <style>{`
        /* Animation for the cursor progress ring */
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
        }
        /* Style for button being hovered by hand */
        button.data-hand-hover {
            transform: scale(1.1) !important;
            box-shadow: 0 0 20px rgba(255, 92, 141, 0.5) !important;
        }
      `}</style>

      {/* Hidden Video for Processing */}
      <video 
        ref={videoRef} 
        className="absolute opacity-0 pointer-events-none"
        playsInline
        muted
        autoPlay
        style={{ width: '640px', height: '480px' }}
      />

      {/* 3D Canvas */}
      <Canvas shadows dpr={[1, 2]}>
          {gameStatus !== GameStatus.LOADING && (
             <GameScene 
                gameStatus={gameStatus}
                audioRef={audioRef}
                handPositionsRef={handPositionsRef}
                chart={DEMO_CHART}
                onNoteHit={handleNoteHit}
                onNoteMiss={handleNoteMiss}
                onSongEnd={() => endGame(true)}
             />
          )}
      </Canvas>

      {/* Webcam Mini-Map Preview */}
      <WebcamPreview 
          videoRef={videoRef} 
          resultsRef={lastResultsRef} 
          isCameraReady={isCameraReady} 
      />
      
      {/* Hand Cursor Layer */}
      {gameStatus !== GameStatus.PLAYING && (
          <HandCursor resultsRef={lastResultsRef} isCameraReady={isCameraReady} />
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
          
          {/* HUD (Top) */}
          <div className="flex justify-between items-start w-full">
             {/* Health Bar */}
             <div className="w-1/3 max-w-xs bg-white/50 p-3 rounded-2xl backdrop-blur-sm shadow-sm border border-white">
                 <div className="flex items-center gap-2 mb-1 text-pink-500 font-bold text-sm uppercase tracking-wider">
                     <Heart className="w-4 h-4 fill-current" /> Sparkle Power
                 </div>
                 <div className="h-4 bg-pink-100 rounded-full overflow-hidden border border-pink-200">
                     <div 
                        className={`h-full transition-all duration-300 ease-out bg-gradient-to-r from-pink-400 to-purple-400`}
                        style={{ width: `${health}%` }}
                     />
                 </div>
             </div>

             {/* Score & Combo */}
             <div className="text-center">
                 <h1 className="text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-pink-500 to-purple-600 drop-shadow-sm">
                     {score.toLocaleString()}
                 </h1>
                 <div className="mt-2 flex flex-col items-center">
                     <p className={`text-2xl font-bold ${combo > 10 ? 'text-blue-500 scale-110' : 'text-slate-400'} transition-all`}>
                         {combo} COMBO
                     </p>
                     {multiplier > 1 && (
                         <span className="text-sm px-3 py-1 bg-yellow-300 text-yellow-800 rounded-full mt-1 font-bold animate-bounce shadow-sm">
                             x{multiplier} BONUS!
                         </span>
                     )}
                 </div>
             </div>
             
             <div className="w-1/3"></div>
          </div>

          {/* Menus (Centered) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              
              {gameStatus === GameStatus.LOADING && (
                  <div className="bg-white/80 p-10 rounded-3xl flex flex-col items-center border border-pink-100 shadow-xl backdrop-blur-md">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-400 mb-6"></div>
                      <h2 className="text-2xl text-slate-700 font-bold mb-2">Warming Up...</h2>
                      <p className="text-slate-500">{!isCameraReady ? "Looking for camera..." : "Polishing stars..."}</p>
                      {cameraError && <p className="text-red-500 mt-4 max-w-xs text-center bg-red-50 p-2 rounded">{cameraError}</p>}
                  </div>
              )}

              {gameStatus === GameStatus.IDLE && (
                  <div className="bg-white/80 p-12 rounded-[2.5rem] text-center border border-white shadow-2xl backdrop-blur-xl max-w-lg transition-transform">
                      <div className="mb-4 flex justify-center">
                         <div className="bg-pink-100 p-4 rounded-full animate-bounce-slow">
                            <Sparkles className="w-12 h-12 text-pink-500" />
                         </div>
                      </div>
                      <h1 className="text-6xl font-black text-slate-800 mb-2 tracking-tight">
                          Tempo<span className="text-pink-500">Strike</span>
                      </h1>
                      <p className="text-slate-400 font-medium mb-8 uppercase tracking-widest text-sm">Cute Edition</p>
                      
                      <div className="space-y-3 text-slate-600 mb-8 text-lg">
                          <p className="flex items-center justify-center gap-2">
                              <Hand className="w-5 h-5 text-purple-400" /> 
                              <span>Use your hands!</span>
                          </p>
                          <p>Hover over the button to start.</p>
                      </div>

                      {!isCameraReady ? (
                           <div className="flex items-center justify-center text-amber-600 gap-2 bg-amber-50 p-4 rounded-xl border border-amber-100">
                               <VideoOff size={20} /> Waiting for camera permissions...
                           </div>
                      ) : (
                          <button 
                              onClick={startGame}
                              className="group relative bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white text-2xl font-bold py-6 px-16 rounded-full transition-all transform hover:scale-105 hover:shadow-[0_10px_40px_rgba(236,72,153,0.4)] flex items-center justify-center mx-auto gap-3"
                          >
                              <span className="relative z-10 flex items-center gap-3">
                                <Play fill="currentColor" className="w-8 h-8 group-hover:scale-110 transition-transform" /> 
                                START GAME
                              </span>
                          </button>
                      )}

                      <div className="text-slate-400 text-xs text-center mt-8 font-medium">
                           Created by <a href="https://x.com/ammaar" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition-colors">@ammaar</a>
                      </div>
                  </div>
              )}

              {(gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
                  <div className="bg-white/90 p-12 rounded-[2.5rem] text-center border border-white shadow-2xl backdrop-blur-xl">
                      <div className="mb-6 flex justify-center">
                          {gameStatus === GameStatus.VICTORY ? 
                              <Sparkles className="w-20 h-20 text-yellow-400 animate-pulse" /> : 
                              <div className="text-6xl animate-bounce">😅</div>
                          }
                      </div>
                      <h2 className={`text-5xl font-black mb-2 ${gameStatus === GameStatus.VICTORY ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500' : 'text-slate-700'}`}>
                          {gameStatus === GameStatus.VICTORY ? "LEVEL CLEAR!" : "OOPS!"}
                      </h2>
                      <p className="text-slate-500 text-xl mb-8">{gameStatus === GameStatus.VICTORY ? "Amazing rhythm!" : "Don't give up!"}</p>
                      
                      <div className="bg-slate-50 rounded-2xl p-6 mb-8">
                          <p className="text-slate-400 text-sm uppercase tracking-widest mb-1">Final Score</p>
                          <p className="text-4xl font-black text-slate-800">{score.toLocaleString()}</p>
                      </div>

                      <button 
                          onClick={() => setGameStatus(GameStatus.IDLE)}
                          className="bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold py-5 px-12 rounded-full flex items-center justify-center mx-auto gap-3 transition-all shadow-xl hover:scale-105 hover:shadow-slate-400/50"
                      >
                          <RefreshCw className="w-6 h-6" /> Play Again
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default App;
