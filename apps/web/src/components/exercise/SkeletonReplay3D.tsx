'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';

const POSE_CONNECTIONS = [
  // Torso
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],

  // Legs
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

  // Head and Neck are handled manually

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
  landmarks: any;
  frame_number?: number;
  timestamp?: string;
  cumulativeMs?: number;
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

// Helper to parse landmarks if they come as string from DB
const getParsedLandmarks = (frame: Frame | undefined): PoseData => {
  if (!frame || !frame.landmarks) {
    return {};
  }
  let lms = frame.landmarks;
  while (typeof lms === 'string') {
    try {
      lms = JSON.parse(lms);
    } catch (e) {
      return {};
    }
  }
  return typeof lms === 'object' && lms !== null ? lms : {};
};

const SCALE = 2.5;

function convertTo3D(lm: Landmark): THREE.Vector3 {
  // Center roughly on (0.5, 0.5) and scale
  // Invert Y because MediaPipe Y goes down, WebGL Y goes up
  // MediaPipe Z is roughly in the same scale as X
  return new THREE.Vector3(
    (lm.x - 0.5) * SCALE,
    -(lm.y - 0.5) * SCALE,
    -(lm.z || 0) * SCALE
  );
}

// Interpolate between two poses
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

// Component to render the actual skeleton
const SkeletonScene = ({
  frames,
  angles,
  isPlaying,
  onComplete,
  isPaused,
  timestampRef,
  leftMetricsRef,
  rightMetricsRef,
  baseMs
}: {
  frames: Frame[],
  angles?: any[],
  isPlaying: boolean,
  onComplete?: () => void,
  isPaused: boolean,
  timestampRef?: React.RefObject<HTMLDivElement>,
  leftMetricsRef?: React.RefObject<HTMLDivElement>,
  rightMetricsRef?: React.RefObject<HTMLDivElement>,
  baseMs?: number
}) => {
  const { scene } = useThree();

  const anglesByFrame = useMemo(() => {
    const map = new Map<number, any[]>();
    if (!angles) return map;
    angles.forEach(a => {
      const fn = a.frame_number;
      if (!map.has(fn)) map.set(fn, []);
      map.get(fn)!.push(a);
    });
    return map;
  }, [angles]);

  // References to our instantiated meshes
  const jointMeshes = useRef<Record<string, THREE.Mesh>>({});
  const boneMeshes = useRef<Record<string, THREE.Mesh>>({});

  // Create geometries and materials once
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.05, 16, 16), []); // Thick joints
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.045, 1, 16), []); // Thick bones
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.12, 32, 32), []); // Large round head
  
  const boneMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffa500', // Bright orange
    emissive: '#ff7700',
    emissiveIntensity: 0.1,
    roughness: 0.8,
    metalness: 0.0
  }), []);

  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#06b6d4', // Cyan joints
    emissive: '#06b6d4',
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.2
  }), []);

  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#06b6d4', // Cyan for facial pointers
    emissive: '#06b6d4',
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.2
  }), []);

  // Initialize meshes
  useEffect(() => {
    // Collect all unique landmark keys
    const allKeys = new Set<string>();
    frames.forEach(f => Object.keys(getParsedLandmarks(f)).forEach(k => allKeys.add(k)));

    // Create joint meshes
    const faceKeys = ['NOSE', 'LEFT_EYE', 'RIGHT_EYE', 'LEFT_EAR', 'RIGHT_EAR'];
    allKeys.forEach(key => {
      if (!jointMeshes.current[key]) {
        const mat = faceKeys.includes(key) ? faceMat : jointMat;
        // Make face points slightly smaller so they look like dots on the head
        const geo = faceKeys.includes(key) ? new THREE.SphereGeometry(0.03, 16, 16) : sphereGeo;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        scene.add(mesh);
        jointMeshes.current[key] = mesh;
      }
    });

    // Add round head mesh
    if (!jointMeshes.current['HEAD_CENTER']) {
      const mesh = new THREE.Mesh(headGeo, boneMat);
      mesh.castShadow = true;
      scene.add(mesh);
      jointMeshes.current['HEAD_CENTER'] = mesh;
    }

    // Add neck bone mesh
    if (!boneMeshes.current['NECK']) {
      const mesh = new THREE.Mesh(cylinderGeo, boneMat);
      mesh.castShadow = true;
      scene.add(mesh);
      boneMeshes.current['NECK'] = mesh;
    }

    // Create bone meshes
    POSE_CONNECTIONS.forEach((connection, idx) => {
      const key = `${connection[0]}_${connection[1]}`;
      if (!boneMeshes.current[key]) {
        const mesh = new THREE.Mesh(cylinderGeo, boneMat);
        mesh.castShadow = true;
        scene.add(mesh);
        boneMeshes.current[key] = mesh;
      }
    });

    return () => {
      // Cleanup meshes
      Object.values(jointMeshes.current).forEach(m => scene.remove(m));
      Object.values(boneMeshes.current).forEach(m => scene.remove(m));
      jointMeshes.current = {};
      boneMeshes.current = {};
    };
  }, [frames, scene, sphereGeo, cylinderGeo, headGeo, boneMat, jointMat, faceMat]);

  // Animation state
  const stateRef = useRef({
    startTime: 0,
    currentFrameIdx: 0,
    active: false,
    pausedTime: 0,
    lastPauseStart: 0
  });

  useEffect(() => {
    if (isPlaying && !isPaused) {
      if (!stateRef.current.active || stateRef.current.currentFrameIdx >= frames.length - 1) {
        // Start fresh
        stateRef.current = {
          startTime: performance.now(),
          currentFrameIdx: 0,
          active: true,
          pausedTime: 0,
          lastPauseStart: 0
        };
      } else {
        // Resume from pause
        stateRef.current.pausedTime += performance.now() - stateRef.current.lastPauseStart;
      }
    } else if (isPaused && stateRef.current.active) {
      stateRef.current.lastPauseStart = performance.now();
    } else if (!isPlaying) {
      stateRef.current.active = false;
      stateRef.current.currentFrameIdx = 0;
      updateSkeleton(getParsedLandmarks(frames[0]));
    }
  }, [isPlaying, isPaused, frames]);

  const updateSkeleton = (pose: PoseData) => {
    // 1. Calculate Head Center (from ears)
    const leftEar = pose['LEFT_EAR'];
    const rightEar = pose['RIGHT_EAR'];
    let headCenterPos: THREE.Vector3 | null = null;
    
    if (leftEar && rightEar) {
      const visLEar = leftEar.visibility !== undefined ? leftEar.visibility : 1;
      const visREar = rightEar.visibility !== undefined ? rightEar.visibility : 1;
      if (visLEar > 0.1 && visREar > 0.1) {
        const vL = convertTo3D(leftEar);
        const vR = convertTo3D(rightEar);
        headCenterPos = vL.clone().add(vR).divideScalar(2);
        headCenterPos.y += 0.04; // Move it slightly up from the exact ear line
      }
    }

    // 2. Position round head
    const headMesh = jointMeshes.current['HEAD_CENTER'];
    if (headMesh) {
      if (headCenterPos) {
        headMesh.position.copy(headCenterPos);
        headMesh.scale.setScalar(1); // Force original 0.12 radius
        headMesh.visible = true;
      } else {
        headMesh.visible = false;
      }
    }

    // 3. Update joints (snap face points to head surface)
    Object.entries(pose).forEach(([key, lm]) => {
      const mesh = jointMeshes.current[key];
      if (mesh && key !== 'HEAD_CENTER') {
        const vis = lm.visibility !== undefined ? lm.visibility : 1;
        if (vis > 0.1) {
          mesh.visible = true;
          const pos = convertTo3D(lm);
          
          const isFacePoint = ['NOSE', 'LEFT_EYE', 'RIGHT_EYE', 'LEFT_EAR', 'RIGHT_EAR'].includes(key);
          if (isFacePoint && headCenterPos) {
            // Project the face points onto the surface of the head sphere
            // The head radius is 0.12, place them at 0.125 so they stick out slightly
            const dir = pos.clone().sub(headCenterPos).normalize();
            mesh.position.copy(headCenterPos.clone().add(dir.multiplyScalar(0.125)));
          } else {
            mesh.position.copy(pos);
          }
        } else {
          mesh.visible = false;
        }
      }
    });

    // Update bones
    POSE_CONNECTIONS.forEach(connection => {
      const [key1, key2] = connection;
      const lm1 = pose[key1];
      const lm2 = pose[key2];
      const meshKey = `${key1}_${key2}`;
      const mesh = boneMeshes.current[meshKey];

      if (mesh) {
        const vis1 = lm1?.visibility !== undefined ? lm1.visibility : 1;
        const vis2 = lm2?.visibility !== undefined ? lm2.visibility : 1;

        if (lm1 && lm2 && vis1 > 0.1 && vis2 > 0.1) {
          mesh.visible = true;
          const v1 = convertTo3D(lm1);
          const v2 = convertTo3D(lm2);

          const distance = v1.distanceTo(v2);
          const position = v2.clone().add(v1).divideScalar(2);

          mesh.position.copy(position);
          mesh.scale.set(1, distance, 1);

          // Orient cylinder from v1 to v2
          const quaternion = new THREE.Quaternion();
          // Cylinder points UP (Y axis) by default. Rotate to match vector v2-v1
          const dir = new THREE.Vector3().subVectors(v2, v1).normalize();
          quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          mesh.setRotationFromQuaternion(quaternion);
        } else {
          mesh.visible = false;
        }
      }
    });

    // Custom Neck Bone
    const neckMesh = boneMeshes.current['NECK'];
    if (neckMesh) {
      const leftShoulder = pose['LEFT_SHOULDER'];
      const rightShoulder = pose['RIGHT_SHOULDER'];
      const visL = leftShoulder?.visibility !== undefined ? leftShoulder.visibility : 1;
      const visR = rightShoulder?.visibility !== undefined ? rightShoulder.visibility : 1;

      if (leftShoulder && rightShoulder && headCenterPos && visL > 0.1 && visR > 0.1) {
        neckMesh.visible = true;
        const vLShoulder = convertTo3D(leftShoulder);
        const vRShoulder = convertTo3D(rightShoulder);
        const midShoulder = vLShoulder.clone().add(vRShoulder).divideScalar(2);

        const distance = midShoulder.distanceTo(headCenterPos);
        const position = headCenterPos.clone().add(midShoulder).divideScalar(2);

        neckMesh.position.copy(position);
        neckMesh.scale.set(1, distance, 1);

        const quaternion = new THREE.Quaternion();
        const dir = new THREE.Vector3().subVectors(headCenterPos, midShoulder).normalize();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        neckMesh.setRotationFromQuaternion(quaternion);
      } else {
        neckMesh.visible = false;
      }
    }
  };

  useFrame((state) => {
    if (!stateRef.current.active || isPaused) return;

    const { startTime, currentFrameIdx, pausedTime } = stateRef.current;
    const now = performance.now() - pausedTime;
    const elapsed = now - startTime;

    if (frames.length === 0) return;
    const totalDuration = frames[frames.length - 1].cumulativeMs || 0;

    if (elapsed >= totalDuration) {
      // Reached end
      stateRef.current.active = false;
      updateSkeleton(getParsedLandmarks(frames[frames.length - 1]));
      if (onComplete) onComplete();
      return;
    }

    // Find current and next frame
    let currentIdx = 0;
    for (let i = 0; i < frames.length - 1; i++) {
      const currMs = frames[i].cumulativeMs || 0;
      const nextMs = frames[i + 1].cumulativeMs || 0;
      if (elapsed >= currMs && elapsed < nextMs) {
        currentIdx = i;
        break;
      }
    }

    if (currentIdx >= frames.length - 1) return;

    const currFrame = frames[currentIdx];
    const nextFrame = frames[currentIdx + 1];

    const currMs = currFrame.cumulativeMs || 0;
    const nextMs = nextFrame.cumulativeMs || 0;

    const segmentDuration = nextMs - currMs;
    const timeIntoSegment = elapsed - currMs;
    const progress = segmentDuration > 0 ? timeIntoSegment / segmentDuration : 0;

    const currentLms = getParsedLandmarks(currFrame);
    const nextLms = getParsedLandmarks(nextFrame);

    const interpolated = interpolatePose(currentLms, nextLms, progress);
    updateSkeleton(interpolated);

    if (timestampRef?.current && baseMs) {
      const ms = baseMs + elapsed;
      const d = new Date(ms);
      const pad = (n: number, width = 2) => String(n).padStart(width, '0');
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      timestampRef.current.innerText = `${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)} ${ampm}`;
    }

    if (leftMetricsRef?.current || rightMetricsRef?.current) {
      const currentAngles = anglesByFrame.get(currFrame.frame_number || 0) || [];
      let leftHTML = '';
      let rightHTML = '';
      
      currentAngles.forEach(a => {
        const name = a.angle_name || '';
        const val = parseFloat(a.angle_value).toFixed(1) + '°';
        
        const isLeft = name.toLowerCase().startsWith('l');
        const isRight = name.toLowerCase().startsWith('r');
        
        // Clean up the name to just be the joint name, e.g., "leftKnee" -> "KNEE"
        const cleanName = name.replace(/^left|^right/i, '').replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        
        const html = `
          <div class="bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5 shadow-lg w-full flex flex-col justify-center">
            <div class="text-[9px] text-white/50 font-bold tracking-wider">${cleanName}</div>
            <div class="text-sm font-mono text-cyan-400 font-bold leading-tight">${val}</div>
          </div>
        `;
        
        if (isLeft) leftHTML += html;
        else if (isRight) rightHTML += html;
        else leftHTML += html;
      });
      
      if (leftMetricsRef?.current) leftMetricsRef.current.innerHTML = leftHTML;
      if (rightMetricsRef?.current) rightMetricsRef.current.innerHTML = rightHTML;
    }
  });

  return null;
};

export const SkeletonReplay3D: React.FC<SkeletonReplayProps> = ({
  frames,
  angles,
  width = 600,
  height = 400,
  repTiming,
  feedback,
  autoPlay = false,
  onComplete,
  onNext,
  onPrev
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timestampRef = useRef<HTMLDivElement>(null);
  const leftMetricsRef = useRef<HTMLDivElement>(null);
  const rightMetricsRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const baseMs = repTiming?.start ? new Date(repTiming.start).getTime() : undefined;

  const sortedFrames = useMemo(() => {
    const sorted = [...frames].sort((a, b) => (a.frame_number || 0) - (b.frame_number || 0));
    if (sorted.length === 0) return [];

    // The camera feeds frames at exactly 30fps. The frame_number corresponds to this 30fps clock.
    // E.g. frame_number 90 = exactly 3 seconds into the attempt.
    const FPS = 30;

    return sorted.map(frame => ({
      ...frame,
      cumulativeMs: ((frame.frame_number || 0) / FPS) * 1000
    }));
  }, [frames]);

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
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const playReplay = () => {
    setIsPlaying(true);
    setIsPaused(false);
  };

  const togglePause = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsPaused(!isPaused);
  };

  useEffect(() => {
    setIsPlaying(false);
    setIsPaused(false);
    if (autoPlay && sortedFrames.length > 0) {
      playReplay();
    }
  }, [frames, autoPlay]);

  if (!sortedFrames || sortedFrames.length === 0) {
    return <div className="text-white/40 text-sm">No skeletal data saved for this rep.</div>;
  }

  return (
    <div className={`relative flex flex-col items-center ${isFullscreen ? 'w-full h-full' : ''}`}>
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all ${isFullscreen ? 'w-screen h-screen flex flex-col justify-center items-center bg-[#1e232b]' : 'bg-[#15181e] border border-white/10'}`}
        style={!isFullscreen ? { width, height } : undefined}
      >
        <Canvas shadows camera={{ position: [0, 0, 4], fov: 45 }}>
          <color attach="background" args={['#1e232b']} />
          <ambientLight intensity={0.5} />
          <spotLight position={[5, 5, 5]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-5, -5, -5]} intensity={0.5} />

          <SkeletonScene
            frames={sortedFrames}
            angles={angles}
            isPlaying={isPlaying}
            isPaused={isPaused}
            timestampRef={timestampRef as any}
            leftMetricsRef={leftMetricsRef as any}
            rightMetricsRef={rightMetricsRef as any}
            baseMs={baseMs}
            onComplete={() => {
              setIsPlaying(false);
              setIsPaused(false);
              if (onComplete) onComplete();
            }}
          />

          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            target={[0, -0.5, 0]} // Roughly target the center of the skeleton
          />

          {/* Ground environment */}
          <Grid
            position={[0, -1.2, 0]} // Position slightly below feet
            infiniteGrid
            fadeDistance={10}
            cellColor="#333333"
            sectionColor="#444444"
          />
          <ContactShadows position={[0, -1.19, 0]} opacity={0.5} scale={10} blur={2} far={4} />
        </Canvas>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-4 right-4 z-20 p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all backdrop-blur-md"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
          )}
        </button>

        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
          {/* Timestamp Indicator */}
          <div
            ref={timestampRef}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-black/60 text-white backdrop-blur-md border border-white/10 font-mono empty:hidden w-fit pointer-events-auto"
          />
          {feedback && (
            <div className="px-4 py-3 text-sm font-bold rounded-xl bg-black/80 text-white backdrop-blur-md border border-white/10 max-w-[300px] min-h-[48px] flex items-center shadow-lg pointer-events-auto">
              {feedback}
            </div>
          )}
        </div>

        {/* Live Left/Right Metrics Overlays */}
        <div 
          ref={leftMetricsRef}
          className="absolute left-8 sm:left-16 lg:left-[20%] top-1/3 z-20 flex flex-col gap-2 pointer-events-none w-28 empty:hidden"
        />
        <div 
          ref={rightMetricsRef}
          className="absolute right-8 sm:right-16 lg:right-[20%] top-1/3 z-20 flex flex-col gap-2 pointer-events-none w-28 items-end text-right empty:hidden"
        />

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

        {/* Play Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all hover:bg-black/20 group pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); playReplay(); }}
              className="pointer-events-auto w-16 h-16 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] group-hover:scale-110 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </div>
        )}

        {/* Pause/Play Controls */}
        {isPlaying && (
          <div className="absolute top-4 right-4 z-20">
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
          <span className="text-xs font-black uppercase tracking-widest">Replaying 3D Analysis...</span>
        </div>
      )}
    </div>
  );
};
