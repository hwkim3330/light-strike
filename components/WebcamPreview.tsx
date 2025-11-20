
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useEffect, useRef } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { COLORS } from '../types';

interface WebcamPreviewProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    resultsRef: React.MutableRefObject<HandLandmarkerResult | null>;
    isCameraReady: boolean;
}

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], 
    [0, 5], [5, 6], [6, 7], [7, 8], 
    [0, 9], [9, 10], [10, 11], [11, 12], 
    [0, 13], [13, 14], [14, 15], [15, 16], 
    [0, 17], [17, 18], [18, 19], [19, 20], 
    [5, 9], [9, 13], [13, 17], [0, 5], [0, 17] 
];

const WebcamPreview: React.FC<WebcamPreviewProps> = ({ videoRef, resultsRef, isCameraReady }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isCameraReady) return;
        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const video = videoRef.current;

            if (canvas && video && video.readyState >= 2) { 
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
                    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // 1. Draw Video Feed
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);
                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    ctx.restore();
                    ctx.globalAlpha = 1.0;

                    // 2. Draw Landmarks
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        for (let i = 0; i < resultsRef.current.landmarks.length; i++) {
                            const landmarks = resultsRef.current.landmarks[i];
                            const handInfo = resultsRef.current.handedness[i];
                            if (!handInfo || !handInfo[0]) continue;

                            const handedness = handInfo[0];
                            const isRight = handedness.categoryName === 'Right';
                            const color = isRight ? COLORS.right : COLORS.left;

                            ctx.strokeStyle = color;
                            ctx.fillStyle = color;
                            ctx.lineWidth = 4;
                            ctx.lineCap = 'round';

                            ctx.beginPath();
                            for (const [start, end] of HAND_CONNECTIONS) {
                                const p1 = landmarks[start];
                                const p2 = landmarks[end];
                                ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
                                ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
                            }
                            ctx.stroke();

                            for (const lm of landmarks) {
                                ctx.beginPath();
                                ctx.arc((1 - lm.x) * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                            
                            // Tip
                            const tip = landmarks[8];
                            ctx.beginPath();
                            ctx.fillStyle = 'white';
                            ctx.arc((1 - tip.x) * canvas.width, tip.y * canvas.height, 6, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isCameraReady, videoRef, resultsRef]);

    if (!isCameraReady) return null;

    return (
        <div className="fixed bottom-4 right-4 w-64 h-48 bg-white/50 border-2 border-pink-100 rounded-2xl overflow-hidden backdrop-blur-lg z-50 shadow-lg transition-opacity duration-500">
            <div className="absolute top-0 left-0 right-0 bg-white/60 text-[10px] text-pink-500 px-3 py-1 font-bold uppercase tracking-widest border-b border-pink-100">
                Camera Feed
            </div>
            <canvas ref={canvasRef} className="w-full h-full object-cover mt-2" />
        </div>
    );
};

export default WebcamPreview;
