'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

const POSE_CONNECTIONS = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
  ['LEFT_ANKLE', 'LEFT_HEEL'],
  ['RIGHT_ANKLE', 'RIGHT_HEEL'],
  ['LEFT_HEEL', 'LEFT_FOOT_INDEX'],
  ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX'],
  ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
  ['LEFT_EYE', 'RIGHT_EYE'],
  ['LEFT_EYE', 'LEFT_EAR'],
  ['RIGHT_EYE', 'RIGHT_EAR'],
  
  // Arms
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['LEFT_WRIST', 'LEFT_INDEX'],
  ['LEFT_WRIST', 'LEFT_PINKY'],
  ['LEFT_WRIST', 'LEFT_THUMB'],
  ['LEFT_PINKY', 'LEFT_INDEX'],

  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['RIGHT_WRIST', 'RIGHT_INDEX'],
  ['RIGHT_WRIST', 'RIGHT_PINKY'],
  ['RIGHT_WRIST', 'RIGHT_THUMB'],
  ['RIGHT_PINKY', 'RIGHT_INDEX']
];

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

type PoseData = Record<string, Landmark>;

interface Frame {
  id: number;
  frame_type: 'start' | 'top' | 'end';
  landmarks: any; // Stored as JSON string or object
  frame_number?: number;
}

interface SkeletonReplayProps {
  frames: any[];
  angles?: any[];
  width?: number;
  height?: number;
  defaultShowAngles?: boolean;
  onToggleAngles?: (show: boolean) => void;
  exerciseName?: string;
  repTiming?: { start?: string | null, top?: string | null, end?: string | null };
  feedback?: string;
  autoPlay?: boolean;
  onComplete?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const SkeletonReplay: React.FC<SkeletonReplayProps> = ({ 
  frames, 
  angles = [], 
  width = 600, 
  height = 400,
  defaultShowAngles = true,
  onToggleAngles,
  exerciseName,
  repTiming,
  feedback,
  autoPlay = false,
  onComplete,
  onNext,
  onPrev
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timestampRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAngles, setShowAngles] = useState(defaultShowAngles);
  const [isPaused, setIsPaused] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 600, height: 400 });
  const currentLandmarksRef = useRef<PoseData>({});
  const currentAnglesRef = useRef<Record<string, number>>({});
  const showAnglesRef = useRef(showAngles);
  const currentAnimationRef = useRef<any>(null);

  useEffect(() => {
    showAnglesRef.current = showAngles;
  }, [showAngles]);

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Give canvas time to resize
      setTimeout(() => {
        drawSkeleton(currentLandmarksRef.current);
      }, 50);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const currentWidth = isFullscreen ? windowSize.width : width;
  const currentHeight = isFullscreen ? windowSize.height : height;

  useEffect(() => {
    drawSkeleton(currentLandmarksRef.current);
  }, [currentWidth, currentHeight]);

  // Support N-frames dynamically
  const sortedFrames = [...frames].sort((a, b) => a.frame_number - b.frame_number);
  const startFrame = sortedFrames[0];
  const topFrame = sortedFrames.find(f => f.frame_type === 'top');
  const endFrame = sortedFrames[sortedFrames.length - 1]; 

  // Helper to parse landmarks if they come as string from DB
  const getParsedLandmarks = (frame: Frame | undefined): PoseData => {
    if (!frame || !frame.landmarks) {
      return {};
    }
    
    let lms = frame.landmarks;
    while (typeof lms === 'string') {
      try {
        lms = JSON.parse(lms);
      } catch(e) {
        return {};
      }
    }
    
    // Return the object dictionary
    return typeof lms === 'object' && lms !== null ? lms : {};
  };

  // Initialization: Draw start frame immediately
  useEffect(() => {
    const lms = getParsedLandmarks(startFrame);
    if (Object.keys(lms).length > 0) {
      currentLandmarksRef.current = JSON.parse(JSON.stringify(lms));
      drawSkeleton(currentLandmarksRef.current, {});
    }
  }, [startFrame]);

  const drawSkeleton = (landmarks: PoseData, angles: Record<string, number> = {}, timestampText?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const keys = Object.keys(landmarks);
    if (keys.length === 0) {
      return;
    }

    // Create a bounding box to automatically scale and center the skeleton
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (const key of keys) {
      const lm = landmarks[key];
      if (!lm) continue;
      const vis = lm.visibility !== undefined ? lm.visibility : 1;
      if (vis > 0.1) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }
    }

    // Fallback if all points were filtered out
    if (minX === Infinity) {
      minX = 0; maxX = 1; minY = 0; maxY = 1;
    }

    const skelWidth = maxX - minX;
    const skelHeight = maxY - minY;
    
    // Add 20% padding
    const padding = 0.2;
    let paddedMinX = minX - (skelWidth * padding);
    let paddedMaxX = maxX + (skelWidth * padding);
    let paddedMinY = minY - (skelHeight * padding);
    let paddedMaxY = maxY + (skelHeight * padding);
    
    let rangeX = (paddedMaxX - paddedMinX) || 1;
    let rangeY = (paddedMaxY - paddedMinY) || 1;

    // Fix Aspect Ratio to match canvas to prevent stretching
    const canvasRatio = canvas.width / canvas.height;
    const skelRatio = rangeX / rangeY;

    if (skelRatio > canvasRatio) {
      // Skeleton is wider, expand rangeY
      const newRangeY = rangeX / canvasRatio;
      const diff = (newRangeY - rangeY) / 2;
      paddedMinY -= diff;
      paddedMaxY += diff;
      rangeY = newRangeY;
    } else {
      // Skeleton is taller, expand rangeX
      const newRangeX = rangeY * canvasRatio;
      const diff = (newRangeX - rangeX) / 2;
      paddedMinX -= diff;
      paddedMaxX += diff;
      rangeX = newRangeX;
    }

    // Convert normalized coordinates to canvas coordinates
    const toCanvasCoords = (landmark: Landmark) => {
      // Normalize to our padded bounding box instead of raw 0-1 to ensure it fills the canvas
      const normX = (landmark.x - paddedMinX) / rangeX;
      const normY = (landmark.y - paddedMinY) / rangeY;
      
      return {
        x: normX * canvas.width,
        y: normY * canvas.height
      };
    };

    // --- DRAW VIRTUAL ENVIRONMENT ---
    const cx = canvas.width / 2;
    // Find the lowest point of the actual skeleton on the canvas to set floor height
    let lowestFootY = 0;
    const footKeys = ['LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'];
    for (const key of footKeys) {
      if (landmarks[key] && (landmarks[key].visibility !== undefined ? landmarks[key].visibility : 1) > 0.1) {
        const py = toCanvasCoords(landmarks[key]).y;
        if (py > lowestFootY) lowestFootY = py;
      }
    }
    
    // Set floor level slightly below the lowest foot, default to 85% if no feet found
    const floorY = lowestFootY > 0 ? lowestFootY + 12 : canvas.height * 0.85;

    // 1. Draw glowing horizon line
    const horizonGrad = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, canvas.width / 1.5);
    horizonGrad.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
    horizonGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, floorY - 50, canvas.width, 100);

    // 2. Draw sharp floor boundary
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(canvas.width, floorY);
    ctx.stroke();

    // 3. Draw 3D perspective grid on the floor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    // Vertical perspective lines
    for (let i = -15; i <= 15; i++) {
      const startX = cx + (i * 25);
      const endX = cx + (i * 120);
      ctx.moveTo(startX, floorY);
      ctx.lineTo(endX, canvas.height);
    }
    // Horizontal perspective lines
    for (let i = 1; i < 8; i++) {
      const y = floorY + Math.pow(i, 1.4) * 12;
      if (y > canvas.height) break;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // 4. Draw ambient drop shadows under each foot
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    for (const key of footKeys) {
      if (landmarks[key] && (landmarks[key].visibility !== undefined ? landmarks[key].visibility : 1) > 0.1) {
        const pos = toCanvasCoords(landmarks[key]);
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(pos.x, floorY, 18, 5, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(pos.x, floorY, 10, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    // --- END VIRTUAL ENVIRONMENT ---

    // Draw connections
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.8)'; // Neon green
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    POSE_CONNECTIONS.forEach(([name1, name2]) => {
      const p1 = landmarks[name1];
      const p2 = landmarks[name2];

      if (p1 && p2) {
        const vis1 = p1.visibility !== undefined ? p1.visibility : 1;
        const vis2 = p2.visibility !== undefined ? p2.visibility : 1;

        if (vis1 > 0.1 && vis2 > 0.1) {
          const c1 = toCanvasCoords(p1);
          const c2 = toCanvasCoords(p2);

          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();
        }
      }
    });

    // Draw joints
    ctx.fillStyle = '#ffffff';
    for (const key of keys) {
      const lm = landmarks[key];
      if (lm) {
        const vis = lm.visibility !== undefined ? lm.visibility : 1;
        if (vis > 0.1) {
          const c = toCanvasCoords(lm);
          ctx.beginPath();
          ctx.arc(c.x, c.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    // Draw Angles
    if (showAnglesRef.current && Object.keys(angles).length > 0) {
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const angleAnchors: Record<string, string[]> = {
        'kneeangle': ['LEFT_KNEE', 'RIGHT_KNEE'],
        'lkneeangle': ['LEFT_KNEE'],
        'rkneeangle': ['RIGHT_KNEE'],
        'torsoratio': ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP'],
        'torsoangle': ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP'],
        'foottilt': ['LEFT_ANKLE', 'LEFT_FOOT_INDEX', 'RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
        'tilt': ['LEFT_ANKLE', 'LEFT_FOOT_INDEX', 'RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
        'valgusratio': ['LEFT_ANKLE', 'RIGHT_ANKLE'],
        'stanceratio': ['LEFT_HEEL', 'RIGHT_HEEL'],
        'lfootangle': ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
        'rfootangle': ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX']
      };

      // Define some vertical offsets so they don't overlap if they share the same anchor
      const offsets: Record<string, number> = {
        'kneeangle': -20,
        'torsoratio': 0,
        'torsoangle': 0,
        'foottilt': 30,
        'valgusratio': -20,
        'stanceratio': 20,
        'lfootangle': 10,
        'rfootangle': 10
      };

      for (const [name, val] of Object.entries(angles)) {
        const lowerName = name.toLowerCase();
        
        // Filter based on exercise
        let shouldShow = true;
        if (exerciseName) {
          const ex = exerciseName.toLowerCase();
          shouldShow = false;
          if (ex.includes('plie') || ex.includes('pile')) {
            if (['lkneeangle', 'rkneeangle', 'torsoangle'].includes(lowerName)) shouldShow = true;
          } else if (ex.includes('split') || ex.includes('lunge')) {
            if (['lkneeangle', 'rkneeangle', 'torsoangle'].includes(lowerName)) shouldShow = true;
          } else if (ex.includes('squat')) {
            if (['lkneeangle', 'rkneeangle', 'torsoangle'].includes(lowerName)) shouldShow = true;
          } else if (ex.includes('calf')) {
            if (['torsoangle', 'foottilt', 'tilt'].includes(lowerName)) shouldShow = true;
          } else {
            if (['lkneeangle', 'rkneeangle', 'torsoangle', 'kneeangle'].includes(lowerName)) shouldShow = true;
          }
        } else {
          // Fallback
          if (!['lkneeangle', 'rkneeangle', 'torsoangle', 'kneeangle'].includes(lowerName)) shouldShow = false;
        }

        if (!shouldShow) continue;

        const anchors = angleAnchors[lowerName];
        
        if (anchors) {
          let sumX = 0, sumY = 0, count = 0;
          for (const a of anchors) {
            const lm = landmarks[a];
            if (lm) {
              const vis = lm.visibility !== undefined ? lm.visibility : 1;
              if (vis > 0.1) {
                const c = toCanvasCoords(lm);
                sumX += c.x; sumY += c.y; count++;
              }
            }
          }
          if (count > 0) {
            const x = sumX / count;
            const y = (sumY / count) + (offsets[lowerName] || 0);
            
            const numericVal = Number(val);
            
            // Format text
            let text = '';
            if (lowerName === 'kneeangle') text = `Knee: ${Math.round(numericVal)}°`;
            else if (lowerName === 'lkneeangle') text = `L Knee: ${Math.round(numericVal)}°`;
            else if (lowerName === 'rkneeangle') text = `R Knee: ${Math.round(numericVal)}°`;
            else if (lowerName === 'torsoratio') text = `Torso: ${numericVal.toFixed(2)}`;
            else if (lowerName === 'torsoangle') text = `Torso: ${Math.round(numericVal)}°`;
            else if (lowerName === 'foottilt' || lowerName === 'tilt') text = `Tilt: ${Math.round(numericVal)}°`;
            else if (lowerName === 'valgusratio') text = `Valgus: ${numericVal.toFixed(2)}`;
            else if (lowerName === 'stanceratio') text = `Stance: ${numericVal.toFixed(2)}`;
            else if (lowerName === 'lfootangle') text = `L-Foot: ${Math.round(numericVal)}°`;
            else if (lowerName === 'rfootangle') text = `R-Foot: ${Math.round(numericVal)}°`;
            else text = `${name}: ${Math.round(numericVal)}`;

            const textWidth = ctx.measureText(text).width;
            
            // Background pill
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x - (textWidth + 12) / 2, y - 10, textWidth + 12, 20, 10);
            } else {
              ctx.rect(x - (textWidth + 12) / 2, y - 10, textWidth + 12, 20);
            }
            ctx.fill();
            
            // Text
            ctx.fillStyle = '#00f2fe'; // Cyan text
            ctx.fillText(text, x, y + 1); // +1 visual correction for baseline
          }
        }
      }

      if (timestampText && timestampRef.current) {
        timestampRef.current.innerText = timestampText;
      }
    }
  };

  const animationIdRef = useRef(0);

  const playReplay = async () => {
    const currentId = ++animationIdRef.current;

    if (sortedFrames.length < 2) {
      console.warn('Not enough frames for replay');
      if (onComplete) onComplete();
      return;
    }
    setIsPlaying(true);
    setIsPaused(false);

    // Initial state
    currentLandmarksRef.current = JSON.parse(JSON.stringify(getParsedLandmarks(sortedFrames[0])));

    const toAngleMap = (frameNum: number) => {
      const arr = angles.filter(a => Number(a.frame_number) === Number(frameNum));
      const map: Record<string, number> = {};
      arr.forEach(a => { map[a.angle_name] = Number(a.angle_value); });
      return map;
    };

    currentAnglesRef.current = toAngleMap(sortedFrames[0].frame_number);
    
    // Helper to interpolate between two PoseData objects
    const interpolatePose = (start: PoseData, target: PoseData, progress: number): PoseData => {
      const result: PoseData = {};
      const allKeys = new Set([...Object.keys(start), ...Object.keys(target)]);
      
      for (const key of allKeys) {
        const s = start[key];
        const t = target[key];
        
        if (!s && !t) continue;
        if (!s) { result[key] = { ...t }; continue; }
        if (!t) { result[key] = { ...s }; continue; }
        
        result[key] = {
          ...s,
          x: s.x + (t.x - s.x) * progress,
          y: s.y + (t.y - s.y) * progress,
          z: (s.z || 0) + ((t.z || 0) - (s.z || 0)) * progress,
        };
      }
      return result;
    };

    const interpolateAngles = (start: Record<string, number>, target: Record<string, number>, progress: number) => {
      const result: Record<string, number> = {};
      const allKeys = new Set([...Object.keys(start), ...Object.keys(target)]);
      for (const key of allKeys) {
        const s = start[key];
        const t = target[key];
        if (s === undefined && t === undefined) continue;
        if (s === undefined) { result[key] = t; continue; }
        if (t === undefined) { result[key] = s; continue; }
        result[key] = s + (t - s) * progress;
      }
      return result;
    };

    const formatMs = (ms: number) => {
      if (!ms) return '';
      const d = new Date(ms);
      const pad = (n: number, width = 2) => String(n).padStart(width, '0');
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)} ${ampm}`;
    };

    // Animate through all frames sequentially
    for (let i = 0; i < sortedFrames.length - 1; i++) {
      if (animationIdRef.current !== currentId) return; // Cancelled

      const currentFrame = sortedFrames[i];
      const nextFrame = sortedFrames[i + 1];

      const currentLms = getParsedLandmarks(currentFrame);
      const nextLms = getParsedLandmarks(nextFrame);
      const currentAnglesMap = toAngleMap(currentFrame.frame_number);
      const nextAnglesMap = toAngleMap(nextFrame.frame_number);

      // The camera feeds frames at exactly 30fps. The frame_number corresponds to this 30fps clock.
      let duration = 0.033;
      if (nextFrame.frame_number !== undefined && currentFrame.frame_number !== undefined) {
         duration = (nextFrame.frame_number - currentFrame.frame_number) / 30;
      }
      duration = Math.min(Math.max(duration, 0.01), 3.0); // Clamp between 0.01s and 3.0s

      const startMs = currentFrame.timestamp ? new Date(currentFrame.timestamp).getTime() : 0;
      const endMs = nextFrame.timestamp ? new Date(nextFrame.timestamp).getTime() : 0;

      const anim = animate(0, 1, {
        duration: duration,
        ease: "linear", // linear makes it smooth across multiple keyframes
        onUpdate: (progress) => {
          const interpolated = interpolatePose(currentLms, nextLms, progress);
          const interpolatedAngles = interpolateAngles(currentAnglesMap, nextAnglesMap, progress);
          currentLandmarksRef.current = interpolated;
          currentAnglesRef.current = interpolatedAngles;
          
          let currentMsDisplay;
          if (startMs && endMs) {
             currentMsDisplay = startMs + (endMs - startMs) * progress;
          }
          drawSkeleton(interpolated, interpolatedAngles, currentMsDisplay ? formatMs(currentMsDisplay) : undefined);
        }
      });
      currentAnimationRef.current = anim;
      await anim;

      // Optional: Pause briefly at the top
      if (nextFrame.frame_type === 'top') {
         await new Promise(r => setTimeout(r, 200));
      }
    }

    if (animationIdRef.current !== currentId) return;

    currentAnimationRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    if (onComplete) onComplete();
  };

  const togglePause = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!currentAnimationRef.current) return;
    
    if (isPaused) {
      currentAnimationRef.current.play();
      setIsPaused(false);
    } else {
      currentAnimationRef.current.pause();
      setIsPaused(true);
    }
  };

  // Ensure we cancel any running animation if the component is actually unmounted for good
  useEffect(() => {
    return () => {
      animationIdRef.current = -1; 
    };
  }, []);

  useEffect(() => {
    if (currentAnimationRef.current) {
      currentAnimationRef.current.stop();
      currentAnimationRef.current = null;
    }
    animationIdRef.current++;
    setIsPlaying(false);
    setIsPaused(false);
  }, [startFrame]);

  useEffect(() => {
    if (autoPlay && startFrame && topFrame && endFrame && !isPlaying) {
      playReplay();
    }
  }, [autoPlay, startFrame, topFrame, endFrame, isPlaying]);

  useEffect(() => {
    drawSkeleton(currentLandmarksRef.current, currentAnglesRef.current);
  }, [currentWidth, currentHeight, showAngles]);

  if (!startFrame) {
    return <div className="text-white/40 text-sm">No skeletal data saved for this rep.</div>;
  }

  return (
    <div className={`relative flex flex-col items-center ${isFullscreen ? 'w-full h-full' : ''}`}>
      <div 
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all ${isFullscreen ? 'w-screen h-screen flex flex-col justify-center items-center bg-[#1e232b]' : 'bg-transparent border border-white/10'}`}
        style={isFullscreen ? { backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' } : undefined}
      >
        {/* Fullscreen Toggle */}
        <button 
          onClick={toggleFullscreen}
          className="absolute bottom-4 right-4 z-20 p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all backdrop-blur-md"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          )}
        </button>

        {/* Controls Row (Angles + Timestamp + Feedback) */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {/* Angles Toggle */}
            <button 
              onClick={() => {
                const nextShow = !showAngles;
                setShowAngles(nextShow);
                if (onToggleAngles) onToggleAngles(nextShow);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all backdrop-blur-md border ${showAngles ? 'bg-cyan-500/30 text-cyan-400 border-cyan-500/50' : 'bg-black/50 text-white/60 border-white/10 hover:bg-white/10'}`}
            >
              {showAngles ? 'Hide Angles' : 'Show Angles'}
            </button>

            {/* Timestamp Indicator */}
            <div 
              ref={timestampRef}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-black/60 text-white backdrop-blur-md border border-white/10 font-mono empty:hidden"
            />
          </div>
          
          {/* Attempt Feedback Comment */}
          {feedback && (
            <div className="px-4 py-3 text-sm font-bold rounded-xl bg-black/80 text-white backdrop-blur-md border border-white/10 max-w-[300px] min-h-[48px] flex items-center shadow-lg">
              {feedback}
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {onPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/10 backdrop-blur-md hover:bg-white/20 transition-all opacity-50 hover:opacity-100"
            title="Previous Rep"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
        )}
        
        {onNext && (
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/10 backdrop-blur-md hover:bg-white/20 transition-all opacity-50 hover:opacity-100"
            title="Next Rep"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        )}

        <canvas 
          ref={canvasRef} 
          width={currentWidth} 
          height={currentHeight}
          className="max-w-full aspect-video object-contain"
        />
        
        {/* Play Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all hover:bg-black/40 group">
            <button 
              onClick={playReplay}
              className="w-16 h-16 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] group-hover:scale-110 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        )}

        {/* Pause/Play Controls */}
        {isPlaying && (
          <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={togglePause}
              className="w-10 h-10 rounded-xl bg-black/60 text-white flex items-center justify-center border border-white/20 backdrop-blur-md hover:bg-white/20 transition-all shadow-lg"
              title={isPaused ? "Resume" : "Pause"}
            >
              <span className="material-symbols-outlined text-xl">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
            </button>
          </div>
        )}
      </div>
      
      {isPlaying && (
        <div className="mt-4 flex items-center gap-2 text-cyan-400 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          <span className="text-xs font-black uppercase tracking-widest">Replaying Analysis...</span>
        </div>
      )}
    </div>
  );
};
