
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';

interface HandCursorProps {
    resultsRef: React.MutableRefObject<HandLandmarkerResult | null>;
    isCameraReady: boolean;
}

interface CursorState {
    x: number;
    y: number;
    active: boolean;
    progress: number; // 0 to 1
    hovering: boolean;
    color: string;
}

const HOVER_THRESHOLD_MS = 1000; // Time to trigger click
const CURSOR_OFFSET_Y = -20; // Slight offset so the finger doesn't hide the cursor

const HandCursor: React.FC<HandCursorProps> = ({ resultsRef, isCameraReady }) => {
    // We track two cursors (left/right hand)
    const [cursors, setCursors] = useState<CursorState[]>([
        { x: 0, y: 0, active: false, progress: 0, hovering: false, color: '#ff5c8d' }, // Left (Pink)
        { x: 0, y: 0, active: false, progress: 0, hovering: false, color: '#2de1fc' }  // Right (Blue)
    ]);

    // Refs for animation loop to avoid React render lag in logic
    const internalState = useRef([
        { startTime: 0, lastTarget: null as Element | null },
        { startTime: 0, lastTarget: null as Element | null }
    ]);

    const requestRef = useRef<number>(0);

    useEffect(() => {
        if (!isCameraReady) return;

        const updateLoop = () => {
            if (resultsRef.current && resultsRef.current.landmarks) {
                const nextCursors = [...cursors];
                let needsUpdate = false;

                // Process up to 2 hands
                for (let i = 0; i < 2; i++) {
                    const landmarks = resultsRef.current.landmarks[i];
                    const handedness = resultsRef.current.handedness[i]?.[0];
                    
                    if (landmarks && handedness) {
                        const isRight = handedness.categoryName === 'Right';
                        const cursorIdx = isRight ? 1 : 0; // 0=Left(Pink), 1=Right(Blue)

                        // Tip of Index Finger (Landmark 8)
                        const tip = landmarks[8];
                        
                        // Mirror X coordinate for intuitive movement
                        // x: 0 (left) -> 1 (right). Screen: (1-x) * width
                        const screenX = (1 - tip.x) * window.innerWidth;
                        const screenY = tip.y * window.innerHeight;

                        const currentState = nextCursors[cursorIdx];
                        currentState.active = true;
                        currentState.x = screenX;
                        currentState.y = screenY + CURSOR_OFFSET_Y;

                        // --- Hit Testing ---
                        // We temporarily hide the cursor element via pointer-events-none in CSS so elementFromPoint works
                        const el = document.elementFromPoint(screenX, screenY);
                        const targetButton = el?.closest('button');

                        const state = internalState.current[cursorIdx];

                        if (targetButton && !targetButton.hasAttribute('disabled')) {
                            currentState.hovering = true;
                            
                            // Add visual hover effect class to button
                            targetButton.classList.add('data-hand-hover');

                            if (state.lastTarget !== targetButton) {
                                // New target
                                state.lastTarget = targetButton;
                                state.startTime = performance.now();
                                currentState.progress = 0;
                            } else {
                                // Still holding same target
                                const elapsed = performance.now() - state.startTime;
                                currentState.progress = Math.min(1, elapsed / HOVER_THRESHOLD_MS);

                                if (currentState.progress >= 1) {
                                    // CLICK!
                                    targetButton.click();
                                    // Reset to prevent multi-click
                                    state.startTime = performance.now() + 500; // Cooldown
                                    currentState.progress = 0;
                                    
                                    // Visual Pop
                                    const ripple = document.createElement('div');
                                    ripple.className = 'absolute inset-0 bg-white/50 rounded-full animate-ping pointer-events-none';
                                    targetButton.appendChild(ripple);
                                    setTimeout(() => ripple.remove(), 500);
                                }
                            }
                        } else {
                            // Lost target
                            if (state.lastTarget) {
                                state.lastTarget.classList.remove('data-hand-hover');
                            }
                            state.lastTarget = null;
                            currentState.hovering = false;
                            currentState.progress = 0;
                        }
                        
                        needsUpdate = true;
                    } else {
                        // Hand lost
                        if (i < 2) {
                             // Check if we should hide it (only if it was active)
                             if (nextCursors[i].active) {
                                 nextCursors[i].active = false;
                                 nextCursors[i].hovering = false;
                                 internalState.current[i].lastTarget = null;
                                 needsUpdate = true;
                             }
                        }
                    }
                }
                
                if (needsUpdate) {
                    setCursors(nextCursors);
                }
            }
            requestRef.current = requestAnimationFrame(updateLoop);
        };

        requestRef.current = requestAnimationFrame(updateLoop);

        return () => {
            cancelAnimationFrame(requestRef.current);
            // Cleanup hover classes
            document.querySelectorAll('.data-hand-hover').forEach(el => el.classList.remove('data-hand-hover'));
        };
    }, [isCameraReady]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            {cursors.map((cursor, idx) => (
                <div
                    key={idx}
                    className="absolute flex items-center justify-center transition-opacity duration-200"
                    style={{
                        left: cursor.x,
                        top: cursor.y,
                        opacity: cursor.active ? 1 : 0,
                        transform: `translate(-50%, -50%) scale(${cursor.hovering ? 1.5 : 1})`
                    }}
                >
                    {/* Progress Ring */}
                    {cursor.hovering && (
                        <svg className="absolute w-16 h-16 animate-spin-slow" viewBox="0 0 36 36">
                            <path
                                className="text-white/30"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="text-white drop-shadow-md transition-all duration-75 ease-linear"
                                strokeDasharray={`${cursor.progress * 100}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={cursor.color}
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}

                    {/* Cursor Center (Sparkle) */}
                    <div 
                        className="w-6 h-6 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] flex items-center justify-center"
                        style={{ backgroundColor: cursor.color }}
                    >
                         <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default HandCursor;
