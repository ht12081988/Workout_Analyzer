import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '../theme';

interface FrameData {
  frame_number: number;
  landmarks: Record<string, { x: number; y: number; z: number; visibility: number }>;
  frame_type: string;
  timestamp?: string;
}

type PoseData = Record<string, { x: number; y: number; z: number; visibility: number }>;

interface SkeletonReplayProps {
  frames: FrameData[];
  angles?: any[];
  attemptText?: string;
  feedback?: string;
  onComplete?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const POSE_CONNECTIONS = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
  ['LEFT_ANKLE', 'LEFT_HEEL'],
  ['RIGHT_ANKLE', 'RIGHT_HEEL'],
  ['LEFT_HEEL', 'LEFT_FOOT_INDEX'],
  ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX'],
  ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX']
];

export function SkeletonReplay({ frames, angles = [], attemptText, feedback, exerciseName, onComplete, onNext, onPrev }: SkeletonReplayProps & { exerciseName?: string }) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0); // This is now a "virtual" frame index
  const [isPlaying, setIsPlaying] = useState(true);
  const [interpolatedLandmarks, setInterpolatedLandmarks] = useState<PoseData | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');
  const [interpolatedAngles, setInterpolatedAngles] = useState<Record<string, number>>({});
  const [containerSize, setContainerSize] = useState({ width: Dimensions.get('window').width, height: 400 });
  const animationRef = useRef<number | null>(null);

  // Parse landmarks to ensure they are objects
  const getParsedLandmarks = (frame: FrameData | undefined): PoseData => {
    if (!frame || !frame.landmarks) return {};
    let lms = frame.landmarks;
    while (typeof lms === 'string') {
      try { lms = JSON.parse(lms); } catch(e) { return {}; }
    }
    return typeof lms === 'object' && lms !== null ? lms : {};
  };

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

  const sortedFrames = frames ? [...frames].sort((a, b) => a.frame_number - b.frame_number) : [];
  const maxFrameNumber = sortedFrames.length > 0 ? sortedFrames[sortedFrames.length - 1].frame_number : 0;

  useEffect(() => {
    if (sortedFrames.length === 0) return;
    
    // Reset to start if frames array changes
    setCurrentFrameIndex(0);
    setInterpolatedLandmarks(getParsedLandmarks(sortedFrames[0]));
    setIsPlaying(true);
  }, [frames]);

  useEffect(() => {
    if (!isPlaying || sortedFrames.length === 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let lastTime = performance.now();
    const fpsInterval = 1000 / 30; // Target 30fps = 1 virtual frame per 33ms

    const animate = (time: number) => {
      const elapsed = time - lastTime;
      
      if (elapsed > fpsInterval) {
        lastTime = time - (elapsed % fpsInterval);
        
        setCurrentFrameIndex(prev => {
          const nextVirtualFrame = prev + 1;

          if (nextVirtualFrame > maxFrameNumber) {
            return prev;
          }

          // Find the surrounding recorded frames for interpolation
          let prevRecordedFrame = sortedFrames[0];
          let nextRecordedFrame = sortedFrames[sortedFrames.length - 1];

          for (let i = 0; i < sortedFrames.length - 1; i++) {
            if (sortedFrames[i].frame_number <= nextVirtualFrame && sortedFrames[i+1].frame_number >= nextVirtualFrame) {
              prevRecordedFrame = sortedFrames[i];
              nextRecordedFrame = sortedFrames[i+1];
              break;
            }
          }

          const currentLms = getParsedLandmarks(prevRecordedFrame);
          const nextLms = getParsedLandmarks(nextRecordedFrame);
          
          // Get angles for the surrounding frames
          const prevAnglesMap: Record<string, number> = {};
          const nextAnglesMap: Record<string, number> = {};
          angles.filter(a => Number(a.frame_number) === prevRecordedFrame.frame_number).forEach(a => { prevAnglesMap[a.angle_name] = Number(a.angle_value); });
          angles.filter(a => Number(a.frame_number) === nextRecordedFrame.frame_number).forEach(a => { nextAnglesMap[a.angle_name] = Number(a.angle_value); });

          let progress = 0;
          const range = nextRecordedFrame.frame_number - prevRecordedFrame.frame_number;
          if (range > 0) {
            progress = (nextVirtualFrame - prevRecordedFrame.frame_number) / range;
          } else {
            progress = 1;
          }

          const interpolated = interpolatePose(currentLms, nextLms, progress);
          setInterpolatedLandmarks(interpolated);

          // Interpolate Angles
          const interpAngles: Record<string, number> = {};
          const allAngleKeys = new Set([...Object.keys(prevAnglesMap), ...Object.keys(nextAnglesMap)]);
          for (const key of allAngleKeys) {
            const s = prevAnglesMap[key];
            const t = nextAnglesMap[key];
            if (s === undefined && t === undefined) continue;
            if (s === undefined) { interpAngles[key] = t; continue; }
            if (t === undefined) { interpAngles[key] = s; continue; }
            interpAngles[key] = s + (t - s) * progress;
          }
          setInterpolatedAngles(interpAngles);

          // Interpolate timestamp if available
          const totalMs = nextVirtualFrame * 33.333;
          const startTimestamp = sortedFrames.length > 0 && sortedFrames[0].timestamp ? new Date(sortedFrames[0].timestamp).getTime() : new Date().getTime();
          const currentRealTime = new Date(startTimestamp + totalMs);
          let hours = currentRealTime.getHours();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          const pad = (n: number, w = 2) => String(n).padStart(w, '0');
          setCurrentTimestamp(`${pad(hours)}:${pad(currentRealTime.getMinutes())}:${pad(currentRealTime.getSeconds())}.${pad(currentRealTime.getMilliseconds(), 3)} ${ampm}`);

          return nextVirtualFrame;
        });
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, frames]);

  useEffect(() => {
    if (sortedFrames.length > 0 && currentFrameIndex >= maxFrameNumber && isPlaying) {
      setIsPlaying(false);
      if (onComplete) {
        // Use setTimeout to ensure this runs outside the current render cycle
        setTimeout(() => onComplete(), 0);
      }
    }
  }, [currentFrameIndex, maxFrameNumber, isPlaying, onComplete]);

  const handlePlayPause = () => {
    if (currentFrameIndex >= maxFrameNumber) {
      // Replay from start
      setCurrentFrameIndex(0);
      setInterpolatedLandmarks(getParsedLandmarks(sortedFrames[0]));
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  if (!frames || frames.length === 0) {
    return (
      <View style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialIcons name="videocam-off" size={48} color={Colors.outlineVariant} />
        <Text style={styles.emptyText}>No tracking data available for this attempt</Text>
      </View>
    );
  }

  const landmarks = interpolatedLandmarks;

  return (
    <View 
      style={[styles.container, { flex: 1 }]}
      onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <View style={{ flex: 1, paddingBottom: 60, paddingTop: 40 }}>
        <Svg width="100%" height="100%" viewBox="0 0 1 1">
          {/* Draw connections */}
        {landmarks && POSE_CONNECTIONS.map(([start, end], idx) => {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          if (!p1 || !p2 || p1.visibility < 0.5 || p2.visibility < 0.5) return null;

          return (
            <Line
              key={`line-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={Colors.primary}
              strokeWidth="0.015"
              strokeLinecap="round"
            />
          );
        })}

        {/* Draw keypoints */}
        {landmarks && Object.entries(landmarks).map(([name, point]) => {
          // Only draw main joints to avoid clutter
          if (!['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'].includes(name)) return null;
          if (point.visibility < 0.5) return null;

          return (
            <Circle
              key={`point-${name}`}
              cx={point.x}
              cy={point.y}
              r="0.02"
              fill={Colors.secondary}
            />
          );
        })}

      </Svg>

      {/* Draw Angles Overlays (Must be outside Svg because they are React Native Text elements) */}
      {Object.entries(interpolatedAngles).map(([name, val]) => {
        const lowerName = name.toLowerCase();
        
        // Filter angles based on exercise
        if (exerciseName) {
          const ex = exerciseName.toLowerCase();
          if (ex.includes('plie') || ex.includes('pile')) {
            if (!['lkneeangle', 'rkneeangle', 'torsoangle', 'lhipangle', 'rhipangle'].includes(lowerName)) return null;
          } else if (ex.includes('split') || ex.includes('lunge')) {
            if (!['lkneeangle', 'rkneeangle', 'torsoangle', 'lhipangle', 'rhipangle'].includes(lowerName)) return null;
          } else if (ex.includes('squat')) {
            if (!['lkneeangle', 'rkneeangle', 'torsoangle', 'lhipangle', 'rhipangle'].includes(lowerName)) return null;
          } else if (ex.includes('calf')) {
            if (!['torsoangle', 'foottilt', 'tilt'].includes(lowerName)) return null;
          } else if (ex.includes('curl') || ex.includes('press') || ex.includes('raise')) {
            if (!['lelbowangle', 'relbowangle', 'lshoulderangle', 'rshoulderangle'].includes(lowerName)) return null;
          }
        } else {
          // Fallback if no exerciseName is passed
          if (!['lkneeangle', 'rkneeangle', 'torsoangle', 'kneeangle', 'lelbowangle', 'relbowangle', 'lhipangle', 'rhipangle', 'lshoulderangle', 'rshoulderangle', 'lfootangle', 'rfootangle'].includes(lowerName)) return null;
        }

        const angleAnchors: Record<string, string[]> = {
          'kneeangle': ['LEFT_KNEE', 'RIGHT_KNEE'],
          'lkneeangle': ['LEFT_KNEE'],
          'rkneeangle': ['RIGHT_KNEE'],
          'torsoratio': ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP'],
          'torsoangle': ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP'],
          'foottilt': ['LEFT_ANKLE', 'LEFT_FOOT_INDEX', 'RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
          'valgusratio': ['LEFT_ANKLE', 'RIGHT_ANKLE'],
          'stanceratio': ['LEFT_HEEL', 'RIGHT_HEEL'],
          'lelbowangle': ['LEFT_ELBOW'],
          'relbowangle': ['RIGHT_ELBOW'],
          'lhipangle': ['LEFT_HIP'],
          'rhipangle': ['RIGHT_HIP'],
          'lshoulderangle': ['LEFT_SHOULDER'],
          'rshoulderangle': ['RIGHT_SHOULDER'],
          'lfootangle': ['LEFT_FOOT_INDEX', 'LEFT_HEEL'],
          'rfootangle': ['RIGHT_FOOT_INDEX', 'RIGHT_HEEL']
        };

        const offsets: Record<string, number> = {
          'kneeangle': 0.05,
          'lkneeangle': 0.05,
          'rkneeangle': 0.05,
          'torsoratio': 0,
          'torsoangle': 0,
          'foottilt': -0.05,
          'valgusratio': 0.05,
          'stanceratio': -0.05,
          'lelbowangle': 0.05,
          'relbowangle': 0.05,
          'lhipangle': 0,
          'rhipangle': 0,
          'lshoulderangle': -0.05,
          'rshoulderangle': -0.05,
          'lfootangle': 0.05,
          'rfootangle': 0.05
        };

        const anchors = angleAnchors[lowerName];
        if (!anchors || !landmarks) return null;

        let sumX = 0, sumY = 0, count = 0;
        for (const a of anchors) {
          const lm = landmarks[a];
          if (lm && lm.visibility > 0.1) {
            sumX += lm.x; sumY += lm.y; count++;
          }
        }

        if (count === 0) return null;

        const x = sumX / count;
        const y = (sumY / count) + (offsets[lowerName] || 0);
        
        let text = '';
        if (lowerName === 'kneeangle') text = `Knee: ${Math.round(val)}°`;
        else if (lowerName === 'lkneeangle') text = `L Knee: ${Math.round(val)}°`;
        else if (lowerName === 'rkneeangle') text = `R Knee: ${Math.round(val)}°`;
        else if (lowerName === 'torsoangle') text = `Torso: ${Math.round(val)}°`;
        else if (lowerName === 'foottilt' || lowerName === 'tilt') text = `Tilt: ${Math.round(val)}°`;
        else if (lowerName === 'valgusratio') text = `Valgus: ${val.toFixed(2)}`;
        else if (lowerName === 'stanceratio') text = `Stance: ${val.toFixed(2)}`;
        else if (lowerName === 'lelbowangle') text = `L Elbow: ${Math.round(val)}°`;
        else if (lowerName === 'relbowangle') text = `R Elbow: ${Math.round(val)}°`;
        else if (lowerName === 'lhipangle') text = `L Hip: ${Math.round(val)}°`;
        else if (lowerName === 'rhipangle') text = `R Hip: ${Math.round(val)}°`;
        else if (lowerName === 'lshoulderangle') text = `L Shoulder: ${Math.round(val)}°`;
        else if (lowerName === 'rshoulderangle') text = `R Shoulder: ${Math.round(val)}°`;
        else if (lowerName === 'lfootangle') text = `L Foot: ${Math.round(val)}°`;
        else if (lowerName === 'rfootangle') text = `R Foot: ${Math.round(val)}°`;
        else text = `${name}: ${Math.round(val)}`;

        return (
          <React.Fragment key={`angle-${name}`}>
            <Text 
              style={{ 
                position: 'absolute', 
                left: x * containerSize.width - 40, 
                top: 40 + (y * Math.max(10, containerSize.height - 100)) - 10,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#00f2fe',
                fontSize: 10,
                fontWeight: 'bold',
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
                overflow: 'hidden',
                textAlign: 'center'
              }}
            >
              {text}
            </Text>
          </React.Fragment>
        );
      })}
      </View>

      {/* Navigation Arrows */}
      {onPrev && (
        <TouchableOpacity style={styles.navButtonLeft} onPress={onPrev}>
          <MaterialIcons name="chevron-left" size={32} color="#fff" />
        </TouchableOpacity>
      )}
      {onNext && (
        <TouchableOpacity style={styles.navButtonRight} onPress={onNext}>
          <MaterialIcons name="chevron-right" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Top Header Information */}
      <View style={styles.header}>
        {attemptText && (
          <View style={styles.attemptBadge}>
            <Text style={styles.attemptText}>{attemptText}</Text>
          </View>
        )}
        {currentTimestamp ? (
          <View style={styles.timestampBadge}>
            <Text style={styles.timestampText}>{currentTimestamp}</Text>
          </View>
        ) : null}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <MaterialIcons 
            name={currentFrameIndex >= maxFrameNumber ? 'replay' : isPlaying ? 'pause' : 'play-arrow'} 
            size={24} 
            color={Colors.onPrimary} 
          />
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(currentFrameIndex / Math.max(1, maxFrameNumber)) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.timeText}>
            {(currentFrameIndex / 30).toFixed(1)}s / {(maxFrameNumber / 30).toFixed(1)}s
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'column',
    alignItems: 'center',
  },
  attemptBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
    maxWidth: '90%',
  },
  attemptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timestampBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  timestampText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: Colors.outlineVariant,
    marginTop: Spacing.md,
    fontSize: 14,
  },
  navButtonLeft: {
    position: 'absolute',
    left: Spacing.md,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  navButtonRight: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  }
});
