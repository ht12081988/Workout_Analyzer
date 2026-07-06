'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseData } from '@workout/shared';

// Use same names as WebCamTracker
const LANDMARK_NAMES = [
  'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
  'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW',
  'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY', 'LEFT_INDEX', 'RIGHT_INDEX',
  'LEFT_THUMB', 'RIGHT_THUMB', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE',
  'LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
];

export interface TelemetryFrame {
  frameIndex: number;
  timeMs: number;
  pose: PoseData;
}

interface VideoExtractorProps {
  onExtractionComplete: (telemetry: TelemetryFrame[]) => void;
  onTimeUpdate: (timeMs: number) => void;
  scrubTimeMs?: number; // Allows parent to scrub the video
}

export const VideoExtractor: React.FC<VideoExtractorProps> = ({
  onExtractionComplete,
  onTimeUpdate,
  scrubTimeMs
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  // 1. Initialize MediaPipe Model
  useEffect(() => {
    async function initLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setLandmarker(poseLandmarker);
        setIsModelLoading(false);
      } catch (err) {
        console.error("Failed to load MediaPipe model", err);
      }
    }
    initLandmarker();
  }, []);

  // 2. Handle Parent Scrubbing
  useEffect(() => {
    if (videoRef.current && scrubTimeMs !== undefined && !isExtracting) {
      // Don't scrub if currently playing normally
      if (videoRef.current.paused) {
        videoRef.current.currentTime = scrubTimeMs / 1000;
      }
    }
  }, [scrubTimeMs, isExtracting]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  // 3. Extraction Engine (Frame by Frame seeking)
  const startExtraction = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !landmarker) return;

    setIsExtracting(true);
    setProgress(0);
    video.pause();

    const fps = 30; // Standard extraction rate
    const frameDuration = 1 / fps;
    const duration = video.duration;
    const totalFrames = Math.floor(duration * fps);
    
    const telemetryData: TelemetryFrame[] = [];
    let currentFrame = 0;

    // Helper to seek and wait for 'seeked' event
    const seekToFrame = (timeSeconds: number): Promise<void> => {
      return new Promise((resolve) => {
        const handleSeeked = () => {
          video.removeEventListener('seeked', handleSeeked);
          resolve();
        };
        video.addEventListener('seeked', handleSeeked);
        video.currentTime = timeSeconds;
      });
    };

    while (currentFrame <= totalFrames) {
      const timeSeconds = currentFrame * frameDuration;
      
      // Ensure we don't seek past duration
      if (timeSeconds > duration) break;

      await seekToFrame(timeSeconds);

      // Process frame
      const timeMs = timeSeconds * 1000;
      const results = landmarker.detectForVideo(video, performance.now());

      if (results.landmarks && results.landmarks.length > 0) {
        const pose: PoseData = {};
        results.landmarks[0].forEach((lm, idx) => {
          const name = LANDMARK_NAMES[idx];
          pose[name] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
        });

        telemetryData.push({
          frameIndex: currentFrame,
          timeMs: timeMs,
          pose
        });
      }

      currentFrame++;
      setProgress(Math.round((currentFrame / totalFrames) * 100));
    }

    setIsExtracting(false);
    onExtractionComplete(telemetryData);
    
    // Reset video to start
    video.currentTime = 0;
  }, [landmarker, onExtractionComplete]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h3 className="text-sm tracking-wider font-extrabold text-slate-200 uppercase flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
          Step 1: Video Extraction Engine
        </h3>
        
        {!videoUrl && (
          <label className="bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 px-3 py-1.5 rounded cursor-pointer transition">
            Upload Golden Rep Video
            <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileUpload} />
          </label>
        )}
      </div>

      <div className="relative w-full aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
        {isModelLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-blue-400 font-bold text-xs uppercase">Loading Vision AI...</p>
          </div>
        )}

        {isExtracting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-20 backdrop-blur-sm">
            <div className="text-4xl mb-2">⚙️</div>
            <p className="text-blue-400 font-bold text-sm uppercase mb-3">Extracting Biomechanics</p>
            <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-100" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs mt-2">{progress}% Complete</p>
          </div>
        )}

        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            controls={!isExtracting}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime * 1000)}
          />
        ) : (
          <p className="text-slate-500 text-sm">No video loaded. Upload a video to begin.</p>
        )}
      </div>

      {videoUrl && !isExtracting && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">Video loaded successfully.</p>
          <button 
            onClick={startExtraction}
            disabled={isModelLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded shadow transition"
          >
            Run Full Frame Extraction
          </button>
        </div>
      )}
    </div>
  );
};
