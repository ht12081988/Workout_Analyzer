'use client';

import React, { useRef, useEffect, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseData } from '../../lib/exercise-engine/types';

interface WebcamTrackerProps {
  onPose: (pose: PoseData) => void;
  onVideoSize?: (size: { width: number; height: number }) => void;
  children?: React.ReactNode;
  width?: number;
  height?: number;
  modelId?: 'lite' | 'full' | 'heavy';
  onFPS?: (fps: number) => void;
}

const LANDMARK_NAMES = [
  'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
  'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW',
  'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY', 'LEFT_INDEX', 'RIGHT_INDEX',
  'LEFT_THUMB', 'RIGHT_THUMB', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE',
  'LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
];

export const WebcamTracker: React.FC<WebcamTrackerProps> = ({
  onPose,
  onVideoSize,
  children,
  width = 640,
  height = 480,
  modelId = 'full',
  onFPS
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onPoseRef = useRef(onPose);
  const onVideoSizeRef = useRef(onVideoSize);
  const onFPSRef = useRef(onFPS);

  useEffect(() => {
    onPoseRef.current = onPose;
  }, [onPose]);

  useEffect(() => {
    onVideoSizeRef.current = onVideoSize;
  }, [onVideoSize]);

  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initLandmarker() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelId}/float16/1/pose_landmarker_${modelId}.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });
      setLandmarker(poseLandmarker);
      setIsLoading(false);
    }
    initLandmarker();
  }, [modelId]);

  useEffect(() => {
    if (!landmarker || !videoRef.current) return;

    const video = videoRef.current;

    // Request camera
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width, 
        height,
        frameRate: { ideal: 30, max: 60 }
      } 
    }).then((stream) => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        onVideoSizeRef.current?.({
          width: video.videoWidth,
          height: video.videoHeight,
        });
        video.play();
      };
    });

    let lastVideoTime = -1;
    let animationId: number;
    let frameCount = 0;
    let lastFpsUpdateTime = performance.now();

    const renderLoop = () => {
      if (video.currentTime !== lastVideoTime && video.videoWidth > 0 && video.videoHeight > 0) {
        lastVideoTime = video.currentTime;
        try {
          const results = landmarker.detectForVideo(video, performance.now());

          if (results.landmarks && results.landmarks.length > 0) {
            frameCount++;
            const now = performance.now();
            if (now - lastFpsUpdateTime >= 1000) {
              const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
              onFPS?.(fps);
              frameCount = 0;
              lastFpsUpdateTime = now;
            }

            const pose: PoseData = {};
            results.landmarks[0].forEach((landmark, idx) => {
              const name = LANDMARK_NAMES[idx];

              pose[name] = {
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
                visibility: landmark.visibility
              };
            });
            onPoseRef.current(pose);
          }
        } catch (error) {
          console.error("MediaPipe detection error:", error);
        }
      }
      animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [landmarker, width, height]);

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gray-900 border-4 border-white/5 shadow-2xl w-full aspect-[4/3]" style={{ maxWidth: `${width}px`, maxHeight: `${height}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-cyan-400 font-bold tracking-widest text-sm uppercase">Loading AI Models...</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-contain scale-x-[-1]"
        playsInline
        muted
      />
      {children}
    </div>
  );
};
