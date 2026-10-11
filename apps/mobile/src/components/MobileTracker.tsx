import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor, VisionCameraProxy } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Circle, Path, Line as SvgLine } from 'react-native-svg';
import { MovementEngine, PoseData, Landmark, ExerciseState, SpineCurvatureResult, compactSpine } from '@workout/shared';
import { Spacing, Radii } from '../theme';
import { useTheme } from '../ThemeContext';
import { API_BASE_URL } from '../config';
import { useVoiceGuide } from '../hooks/useVoiceGuide';
import { ConfirmModal } from './ConfirmModal';

interface MobileTrackerProps {
  exerciseType: string; // E.g., "Pile Squats", "Squats ", etc.
  mode?: 'self' | 'trainer';
  trainerId?: string;
}

// Initialize the native detectPose frame processor plugin
const detectPosePlugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});

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
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],

  // Arms & Hand Connections
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

const ALL_LANDMARKS = [
  "NOSE", "LEFT_EYE_INNER", "LEFT_EYE", "LEFT_EYE_OUTER",
  "RIGHT_EYE_INNER", "RIGHT_EYE", "RIGHT_EYE_OUTER",
  "LEFT_EAR", "RIGHT_EAR", "MOUTH_LEFT", "MOUTH_RIGHT",
  "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW",
  "LEFT_WRIST", "RIGHT_WRIST", "LEFT_PINKY", "RIGHT_PINKY",
  "LEFT_INDEX", "RIGHT_INDEX", "LEFT_THUMB", "RIGHT_THUMB",
  "LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE",
  "LEFT_ANKLE", "RIGHT_ANKLE", "LEFT_HEEL", "RIGHT_HEEL",
  "LEFT_FOOT_INDEX", "RIGHT_FOOT_INDEX"
];

// Helper to generate smooth quadratic Bezier SVG path from point array
const buildSmoothSvgPath = (points: Array<{ x: number; y: number }>): string => {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
  }
  d += ` L ${points[points.length - 1].x.toFixed(1)} ${points[points.length - 1].y.toFixed(1)}`;
  return d;
};

interface CircularHUDProps {
  progressPct: number;
  currentPhaseIndex: number;
  totalPhases: number;
  phaseName?: string;
  size?: number;
}

const CircularPhaseHUD = React.memo(({ progressPct, currentPhaseIndex, totalPhases, size = 48 }: CircularHUDProps) => {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, progressPct));
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  const ringColor = clampedPct >= 90
    ? '#10b981' // Emerald
    : clampedPct >= 40
      ? '#00f2fe' // Neon Cyan
      : '#38bdf8'; // Sky Blue

  const stageLabel = totalPhases > 0 ? `P${currentPhaseIndex + 1}` : 'REP';

  return (
    <View style={[hudStyles.wrapper, { width: size, height: size, marginBottom: 6 }]} pointerEvents="none">
      <View style={[hudStyles.circleBox, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="rgba(0, 20, 43, 0.85)"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="transparent"
          />
        </Svg>
        <View style={hudStyles.centerContent}>
          <Text style={[hudStyles.pctText, { color: ringColor }]}>
            {Math.round(clampedPct)}%
          </Text>
          <Text style={hudStyles.stageSub}>
            {stageLabel}
          </Text>
        </View>
      </View>
    </View>
  );
});

const hudStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  stageSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: -1,
  },
});

interface SkeletonOverlayViewProps {
  isStarted: boolean;
  pose: PoseData | null;
  spineData: SpineCurvatureResult | null;
  showSilhouette: boolean;
  showAngles: boolean;
  liveAngles: Record<string, number>;
  layoutSize: { width: number; height: number };
  cameraPosition: 'front' | 'back';
  styles: any;
}

const SkeletonOverlayView = React.memo(({
  isStarted,
  pose,
  spineData,
  showSilhouette,
  showAngles,
  liveAngles,
  layoutSize,
  cameraPosition,
  styles
}: SkeletonOverlayViewProps) => {
  if (!isStarted || !pose) return null;

  const getScreenPoint = (landmark: Landmark) => {
    const frameAspect = 16 / 9;
    const viewAspect = layoutSize.height / layoutSize.width;

    let videoWidth = layoutSize.width;
    let videoHeight = layoutSize.height;
    let offsetX = 0;
    let offsetY = 0;

    if (viewAspect > frameAspect) {
      videoHeight = layoutSize.height;
      videoWidth = layoutSize.height / frameAspect;
      offsetX = (videoWidth - layoutSize.width) / 2;
    } else {
      videoWidth = layoutSize.width;
      videoHeight = layoutSize.width * frameAspect;
      offsetY = (videoHeight - layoutSize.height) / 2;
    }

    let x = (landmark.x * videoWidth) - offsetX;
    let y = (landmark.y * videoHeight) - offsetY;

    if (cameraPosition === 'front') {
      x = layoutSize.width - x;
    }

    return { x, y };
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        {/* Draw connection lines */}
        {POSE_CONNECTIONS.map(([p1, p2], idx) => {
          const start = pose[p1];
          const end = pose[p2];
          if (start && end && (start.visibility === undefined || start.visibility > 0.35) && (end.visibility === undefined || end.visibility > 0.35)) {
            const pt1 = getScreenPoint(start);
            const pt2 = getScreenPoint(end);
            return (
              <SvgLine
                key={`bone-${idx}`}
                x1={pt1.x}
                y1={pt1.y}
                x2={pt2.x}
                y2={pt2.y}
                stroke="#39FF14"
                strokeWidth={2.6}
                strokeLinecap="round"
                opacity={0.85}
              />
            );
          }
          return null;
        })}

        {/* Draw joint circles */}
        {ALL_LANDMARKS.map((name) => {
          const landmark = pose[name];
          if (landmark && (landmark.visibility === undefined || landmark.visibility > 0.35)) {
            const pt = getScreenPoint(landmark);
            const isCenter = name.startsWith('NOSE') || name.includes('MOUTH');
            return (
              <Circle
                key={`joint-${name}`}
                cx={pt.x}
                cy={pt.y}
                r={isCenter ? 4.5 : 5}
                fill={isCenter ? '#ffffff' : '#39FF14'}
                stroke="#ffffff"
                strokeWidth={1.2}
              />
            );
          }
          return null;
        })}

        {/* Draw Cervical Spine Contour */}
        {showSilhouette && spineData && spineData.cervicalContourPoints && spineData.cervicalContourPoints.length > 1 && (() => {
          const neckPts = spineData.cervicalContourPoints.map((p: any) => getScreenPoint(p));
          const pathD = buildSmoothSvgPath(neckPts);
          return (
            <React.Fragment key="cervical-spine-overlay">
              <Path
                d={pathD}
                stroke="rgba(236, 72, 153, 0.95)"
                strokeWidth={3}
                strokeDasharray="6 4"
                strokeLinecap="round"
                fill="none"
              />
              {neckPts.map((pt: any, idx: number) => (
                <Circle
                  key={`cervical-vertebra-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.2}
                  fill="#ec4899"
                  stroke="#ffffff"
                  strokeWidth={0.8}
                />
              ))}
            </React.Fragment>
          );
        })()}

        {/* Draw Thoracic & Lumbar Spine Contour */}
        {showSilhouette && spineData && (spineData.contourPoints || spineData.splinePoints) && ((spineData.contourPoints || spineData.splinePoints)!.length > 1) && (() => {
          const rawPts = spineData.contourPoints || spineData.splinePoints!;
          const thoracicPts = rawPts.map((p: any) => getScreenPoint(p));
          const pathD = buildSmoothSvgPath(thoracicPts);
          return (
            <React.Fragment key="thoracic-spine-overlay">
              <Path
                d={pathD}
                stroke="rgba(0, 242, 254, 0.95)"
                strokeWidth={3}
                strokeDasharray="6 4"
                strokeLinecap="round"
                fill="none"
              />
              {thoracicPts.map((pt: any, idx: number) => (
                <Circle
                  key={`thoracic-vertebra-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.2}
                  fill="#00f2fe"
                  stroke="#ffffff"
                  strokeWidth={0.8}
                />
              ))}
            </React.Fragment>
          );
        })()}
      </Svg>

      {/* Live Joint Angle Badges when showAngles is true */}
      {showAngles && (
        <>
          {pose['LEFT_KNEE'] && liveAngles['LEFT_KNEE_FLEXION'] !== undefined && (
            <View style={[styles.anglePill, {
              left: getScreenPoint(pose['LEFT_KNEE']).x - 26,
              top: getScreenPoint(pose['LEFT_KNEE']).y - 12
            }]}>
              <Text style={styles.anglePillText}>
                {Math.round(liveAngles['LEFT_KNEE_FLEXION'])}°
              </Text>
            </View>
          )}
          {pose['LEFT_HIP'] && liveAngles['LEFT_HIP_ABDUCTION'] !== undefined && liveAngles['LEFT_HIP_ABDUCTION'] > 5 && (
            <View style={[styles.anglePill, {
              left: getScreenPoint(pose['LEFT_HIP']).x - 42,
              top: getScreenPoint(pose['LEFT_HIP']).y - 12
            }]}>
              <Text style={styles.anglePillText}>
                ABD {Math.round(liveAngles['LEFT_HIP_ABDUCTION'])}°
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
});

export function MobileTracker({ exerciseType, mode = 'self', trainerId }: MobileTrackerProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  useKeepAwake();
  const navigation = useNavigation<any>();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);

  // Engine & local states
  const [engine] = useState(() => new MovementEngine());
  const [isStarted, setIsStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);

  // API sync states
  const [userId, setUserId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Live session statistics
  const [repCount, setRepCount] = useState(0);
  const [accuracyScore, setAccuracyScore] = useState(100);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [attemptLog, setAttemptLog] = useState<any[]>([]);

  const { speech, isVoiceEnabled, toggleVoice } = useVoiceGuide(exerciseId);
  const [enginePhase, setEnginePhase] = useState('INITIALIZING');
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [totalPhases, setTotalPhases] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [phaseName, setPhaseName] = useState('');
  const [showAngles, setShowAngles] = useState(false);
  const [showSilhouette, setShowSilhouette] = useState(false);
  const [liveAngles, setLiveAngles] = useState<Record<string, number>>({});

  // Layout dimensions for rendering skeleton
  const [layoutSize, setLayoutSize] = useState({ width: 300, height: 500 });
  const [lastPose, setLastPose] = useState<PoseData | null>(null);
  const [spineData, setSpineData] = useState<SpineCurvatureResult | null>(null);
  const [seconds, setSeconds] = useState(0);

  // References to prevent double logs
  const lastAttemptIdRef = useRef<string | null>(null);
  const lastFinishedMovementIdRef = useRef<string | null>(null);

  // FPS Tracking
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // Performance optimization refs to prevent redundant React re-renders on every frame
  const lastRepCountRef = useRef(0);
  const lastPhaseIndexRef = useRef(-1);
  const lastProgressPctRef = useRef(-1);
  const lastActiveCueRef = useRef<string | null>(null);
  const lastAccuracyRef = useRef(100);
  const lastPhaseNameRef = useRef('');

  // Request permissions
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Load current user from AsyncStorage
  useEffect(() => {
    async function loadUser() {
      try {
        const userJson = await AsyncStorage.getItem('visionfit.auth.user');
        if (userJson) {
          const user = JSON.parse(userJson);
          setUserId(user.id);
        }
      } catch (err) {
        console.error('Failed to load user in MobileTracker:', err);
      }
    }
    loadUser();
  }, []);

  // Fetch exercise ID and rules from the database
  useEffect(() => {
    async function fetchExerciseDetails() {
      if (!userId) return; // Wait until we have the userId to fetch custom rules

      try {
        const res = await fetch(`${API_BASE_URL}/exercises`);
        if (!res.ok) return;
        const exercises = await res.json();

        // Match name
        const match = exercises.find(
          (e: any) => e.name.toLowerCase().trim() === exerciseType.toLowerCase().trim()
        );

        if (match) {
          setExerciseId(match.id);
          engine.setExercise(match.name);

          // Fetch custom rules using the appropriate mode
          let rulesUrl = `${API_BASE_URL}/exercises/${match.id}/rules?mode=${mode}&customer_id=${userId}`;
          if (mode === 'trainer' && trainerId) {
            rulesUrl += `&trainer_id=${trainerId}`;
          }

          const rulesRes = await fetch(rulesUrl);
          if (rulesRes.ok) {
            const rules = await rulesRes.json();
            engine.setRules(rules);
          }
        }
      } catch (err) {
        console.error('Failed to fetch exercise details/rules:', err);
      }
    }
    fetchExerciseDetails();
  }, [exerciseType, engine, userId, mode, trainerId]);

  // Active workout timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isStarted) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStarted]);

  // API Persistence: Create / Update Session
  const saveSession = async (status: string = 'active') => {
    if (!userId || !exerciseId) {
      console.warn('Cannot save session: user or exercise context is missing.');
      return null;
    }

    try {
      if (!sessionIdRef.current) {
        // Create session
        const res = await fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customer_id: userId, 
            exercise_id: exerciseId,
            recorded_mode: mode,
            trainer_id: trainerId || null
          })
        });
        if (!res.ok) return null;

        const data = await res.json();
        if (data.session_id) {
          setSessionId(data.session_id);
          sessionIdRef.current = data.session_id;
          return data.session_id;
        }
        return null;
      } else {
        // Update session stats
        const duration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : seconds;
        await fetch(`${API_BASE_URL}/sessions/${sessionIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_reps: repCount,
            average_accuracy: accuracyScore,
            total_duration_seconds: duration,
            status
          })
        });
        return sessionIdRef.current;
      }
    } catch (err) {
      console.error('Error saving session:', err);
      return null;
    }
  };

  // API Persistence: Log Attempts
  const logAttempt = useCallback(async (attempt: any) => {
    const sid = sessionIdRef.current;
    if (!sid || !exerciseId) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sid}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exerciseId,
          status: attempt.status,
          reason: attempt.reason
        })
      });
      const data = await res.json();
      return data.attempt_id;
    } catch (err) {
      console.error('Error logging attempt:', err);
      return null;
    }
  }, [exerciseId]);

  // API Persistence: Log keyframes and deviations
  const logMovementData = useCallback(async (stats: any, attemptId: string) => {
    const sid = sessionIdRef.current;
    if (!sid || !attemptId) return;

    try {
      // 1. Log Start, Top, End, and intermediate frames
      const startMs = new Date(stats.startTime).getTime();
      const topMs = stats.topTime ? new Date(stats.topTime).getTime() : startMs + 1000;
      const endMs = stats.endTime ? new Date(stats.endTime).getTime() : topMs + 1000;
      
      const getFrameNumber = (ms: number) => {
        if (!sessionStartTime) return Math.round((ms - startMs) / 33.333) + 1;
        return Math.round((ms - sessionStartTime) / 33.333);
      };

      // Interpolate time for descending and ascending frames to maintain realistic velocity
      const desc1Ms = startMs + (topMs - startMs) * 0.33;
      const desc2Ms = startMs + (topMs - startMs) * 0.66;
      const asc1Ms = topMs + (endMs - topMs) * 0.33;
      const asc2Ms = topMs + (endMs - topMs) * 0.66;

      const keyFrames = (stats.phaseFrames && stats.phaseFrames.length > 0)
        ? stats.phaseFrames
        : [
            { type: 'start', landmarks: stats.startFrameLandmarks, angles: stats.startFrameAngles, frameNumber: getFrameNumber(startMs), timestamp: stats.startTime },
            ...(stats.descendingFrame1Landmarks ? [{ type: 'desc_1', landmarks: stats.descendingFrame1Landmarks, angles: stats.descendingFrame1Angles, frameNumber: getFrameNumber(desc1Ms), timestamp: new Date(desc1Ms).toISOString() }] : []),
            ...(stats.descendingFrame2Landmarks ? [{ type: 'desc_2', landmarks: stats.descendingFrame2Landmarks, angles: stats.descendingFrame2Angles, frameNumber: getFrameNumber(desc2Ms), timestamp: new Date(desc2Ms).toISOString() }] : []),
            ...(stats.topFrameLandmarks ? [{ type: 'top', landmarks: stats.topFrameLandmarks, angles: stats.topFrameAngles, frameNumber: getFrameNumber(topMs), timestamp: stats.topTime }] : []),
            ...(stats.ascendingFrame1Landmarks ? [{ type: 'asc_1', landmarks: stats.ascendingFrame1Landmarks, angles: stats.ascendingFrame1Angles, frameNumber: getFrameNumber(asc1Ms), timestamp: new Date(asc1Ms).toISOString() }] : []),
            ...(stats.ascendingFrame2Landmarks ? [{ type: 'asc_2', landmarks: stats.ascendingFrame2Landmarks, angles: stats.ascendingFrame2Angles, frameNumber: getFrameNumber(asc2Ms), timestamp: new Date(asc2Ms).toISOString() }] : []),
            { type: 'end', landmarks: stats.endFrameLandmarks, angles: stats.endFrameAngles, frameNumber: getFrameNumber(endMs), timestamp: stats.endTime }
          ];

      for (const frame of keyFrames) {
        const landmarks = (frame as any).spine
          ? { ...frame.landmarks, __spine: (frame as any).spine }
          : frame.landmarks;
        await fetch(`${API_BASE_URL}/sessions/${sid}/frames`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_id: attemptId,
            frame_number: frame.frameNumber,
            landmarks,
            frame_type: frame.type,
            angles: Object.entries(frame.angles || {}).map(([name, value]) => ({ name, value }))
          })
        });
      }

      // 2. Log form deviations
      for (const dev of stats.deviations) {
        await fetch(`${API_BASE_URL}/sessions/${sid}/deviations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_id: attemptId,
            deviation_type: dev.type,
            feedback_message: dev.message,
            severity: dev.severity,
            frame_number: dev.frameNumber
          })
        });
      }

      // 3. Log to reps table if valid
      if (stats.status === 'valid') {
        await fetch(`${API_BASE_URL}/sessions/${sid}/reps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_number: stats.repNumber,
            start_frame_time: stats.startTime,
            top_frame_time: stats.topTime,
            end_frame_time: stats.endTime,
            quality_score: stats.qualityScore,
            duration_seconds: stats.durationSeconds,
            status: stats.status,
            attempt_id: attemptId,
            frame_data: JSON.stringify(stats.frameData)
          })
        });
      }
    } catch (err) {
      console.error('Error logging detailed movement data:', err);
    }
  }, []);

  // Point 2: In-flight frame dropper lock via worklet shared value
  const isProcessing = useSharedValue(false);

  // Process incoming frame data
  const handlePose = useCallback((pose: PoseData) => {
    try {
      // FPS tracking
      frameCountRef.current += 1;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      if (layoutSize.width === 0 || layoutSize.height === 0) return;

      // Always stream pose coordinates to the memoized SkeletonOverlay
      setLastPose(pose);
      const newState = engine.processFrame(pose);

      // Point 3: Only trigger heavy React re-renders when workout values actually change
      if (newState.repCount !== lastRepCountRef.current) {
        lastRepCountRef.current = newState.repCount;
        setRepCount(newState.repCount);
      }
      if (newState.accuracyScore !== lastAccuracyRef.current) {
        lastAccuracyRef.current = newState.accuracyScore;
        setAccuracyScore(newState.accuracyScore);
      }
      const currentActiveCue = newState.feedback[0] || null;
      if (currentActiveCue !== lastActiveCueRef.current) {
        lastActiveCueRef.current = currentActiveCue;
        setFeedback(newState.feedback);
      }
      if (newState.currentPhase !== lastPhaseNameRef.current) {
        lastPhaseNameRef.current = newState.currentPhase;
        setEnginePhase(newState.currentPhase);
        setPhaseName(newState.phaseName || newState.currentPhase);
      }
      const nextPhaseIdx = newState.currentPhaseIndex ?? 0;
      if (nextPhaseIdx !== lastPhaseIndexRef.current) {
        lastPhaseIndexRef.current = nextPhaseIdx;
        setCurrentPhaseIndex(nextPhaseIdx);
        setTotalPhases(newState.totalPhases ?? 0);
      }
      const newProgress = Math.round(newState.progressPct ?? 0);
      if (Math.abs(newProgress - lastProgressPctRef.current) >= 1) {
        lastProgressPctRef.current = newProgress;
        setProgressPct(newProgress);
      }
      if (showSilhouette) {
        setSpineData(newState.spineData || null);
      }
      if (showAngles && (newState as any).angles) {
        setLiveAngles((newState as any).angles);
      }

      // 1. Detect New Attempts
      const latestAttempt = newState.attemptLog[0];
      if (latestAttempt && latestAttempt.id !== lastAttemptIdRef.current) {
        lastAttemptIdRef.current = latestAttempt.id;
        setAttemptLog(newState.attemptLog);

        const isSuccess = latestAttempt.status === 'success' || (latestAttempt as any).success === true;
        if (isSuccess) {
          speech.speakRepCount(newState.repCount, latestAttempt.qualityScore || 100);
        } else {
          speech.speakFailure(latestAttempt.reason || 'deep');
        }

        logAttempt(latestAttempt).then(dbId => {
          if (dbId) {
            (latestAttempt as any).dbId = dbId;

            const finishedStats = engine.getLastMovementStats();
            if (finishedStats) {
              const isMatch = (finishedStats.status === 'valid' ? latestAttempt.status === 'success' : latestAttempt.status === 'failed') &&
                Math.abs(Date.now() - new Date(finishedStats.endTime).getTime()) < 5000;
              if (isMatch) {
                logMovementData(finishedStats, dbId);
              }
            }
          }
        });
      }

      // 2. Play ongoing live feedback (debounced by SpeechManager)
      if (newState.feedback.length > 0) {
        const activeCue = newState.feedback[0];
        speech.speak(activeCue, false, newState.repCount);
      }

      // 3. Phase entry cue: fires once when transitioning into a new phase
      if (newState.isStarted && newState.pendingEntryCue) {
        speech.speak(newState.pendingEntryCue, true);
      }

      // 4. Detect Finished Movements
      const currentStats = engine.getLastMovementStats();
      if (currentStats && (currentStats as any).startTime !== lastFinishedMovementIdRef.current) {
        lastFinishedMovementIdRef.current = (currentStats as any).startTime;

        const matchingAttempt = newState.attemptLog.find(a =>
          (currentStats.status === 'valid' ? a.status === 'success' : a.status === 'failed') &&
          Math.abs(Date.now() - a.timestamp) < 5000
        );

        if (matchingAttempt && (matchingAttempt as any).dbId) {
          logMovementData(currentStats, (matchingAttempt as any).dbId);
        }
      }
    } finally {
      // Release in-flight lock so next frame is immediately processed without queue backlog
      isProcessing.value = false;
    }
  }, [engine, logAttempt, logMovementData, speech, showSilhouette, showAngles, layoutSize, isProcessing]);

  // Abandon a half-done rep and reset to phase 0
  const resetRep = () => {
    if (!isStarted) return;
    isProcessing.value = false;
    const partial = engine.resetRep();
    speech.speak('Rep reset. Return to start position.', true);

    if (partial) {
      lastAttemptIdRef.current = partial.attempt.id;
      logAttempt(partial.attempt).then(dbId => {
        if (dbId) {
          (partial.attempt as any).dbId = dbId;
          logMovementData(partial.stats, dbId);
        }
      });
    }
    const state = engine.getState();
    lastRepCountRef.current = state.repCount;
    lastPhaseIndexRef.current = state.currentPhaseIndex ?? 0;
    lastProgressPctRef.current = state.progressPct ?? 0;
    lastPhaseNameRef.current = state.currentPhase;
    setAttemptLog(state.attemptLog);
    setEnginePhase(state.currentPhase);
    setCurrentPhaseIndex(state.currentPhaseIndex ?? 0);
    setProgressPct(state.progressPct ?? 0);
    setPhaseName(state.phaseName || state.currentPhase);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      engine.stop();
      if (sessionIdRef.current) {
        saveSession('completed');
      }
    };
  }, []);

  // Set up JS callback and frame processor
  const handlePoseJS = useRunOnJS(handlePose, [handlePose]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!isStarted || detectPosePlugin == null) return;
    if (isProcessing.value) {
      // Drop frame to prevent queue backlog and lag
      return;
    }
    isProcessing.value = true;
    const pose = detectPosePlugin.call(frame);
    if (pose != null) {
      handlePoseJS(pose as unknown as PoseData);
    } else {
      isProcessing.value = false;
    }
  }, [isStarted, handlePoseJS, isProcessing]);

  // Start the actual workout tracking session
  const startTracking = async () => {
    const sid = await saveSession('active');
    if (sid) {
      setSessionStartTime(Date.now());
      isProcessing.value = false;
      lastRepCountRef.current = 0;
      lastPhaseIndexRef.current = -1;
      lastProgressPctRef.current = -1;
      lastActiveCueRef.current = null;
      lastAccuracyRef.current = 100;
      lastPhaseNameRef.current = '';
      engine.start();
      setIsStarted(true);
    } else {
      alert('Failed to initialize workout session. Please make sure the API server is connected.');
    }
  };

  // Toggle countdown before starting workout
  const handleToggleWorkout = async () => {
    if (isStarted) {
      setShowStopModal(true);
    } else {
      setCountdown(5);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      speech.speak(String(countdown), true);
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      speech.speak('Go!', true);
      setCountdown(null);
      startTracking();
    }
  }, [countdown, speech]);




  const onLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize({ width, height });
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>Requesting Camera Permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="camera-alt" size={48} color={colors.outline} />
        <Text style={styles.text}>No Camera Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Camera Viewfinder */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        pixelFormat="yuv"
        frameProcessor={frameProcessor}
      />

      {/* Skeleton / Pose Points Overlay (Memoized to prevent full UI re-renders) */}
      <SkeletonOverlayView
        isStarted={isStarted}
        pose={lastPose}
        spineData={spineData}
        showSilhouette={showSilhouette}
        showAngles={showAngles}
        liveAngles={liveAngles}
        layoutSize={layoutSize}
        cameraPosition={cameraPosition}
        styles={styles}
      />

      {/* Countdown Overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownSubtitle}>Get Ready</Text>
          <Text style={styles.countdownNumber}>{countdown > 0 ? countdown : 'GO!'}</Text>
        </View>
      )}

      {/* HUD Controls / Details Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">

        {/* Title and FPS Row */}
        <View style={styles.titleRow} pointerEvents="box-none">
          <View style={{ flex: 1, marginRight: 8 }} pointerEvents="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.titleText} numberOfLines={1}>{exerciseType}</Text>
              <View style={styles.fpsBadge}>
                <Text style={styles.fpsText}>{fps} FPS</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Live Coaching Cues Toasts */}
        {isStarted && feedback.length > 0 && (
          <View style={styles.topFeedbackContainer} pointerEvents="none">
            <View style={[
              styles.feedbackToast,
              speech.getCueType(feedback[0]) === 'warning'
                ? styles.feedbackWarn
                : styles.feedbackSuccess
            ]}>
              <Text style={styles.feedbackToastText}>
                {speech.getDisplayCue(feedback[0])}
              </Text>
            </View>
          </View>
        )}

        {/* Latest Attempt Log Overlay (renders when not showing active live feedback) */}
        {attemptLog.length > 0 && (!isStarted || feedback.length === 0) && (
          <View style={styles.logContainer} pointerEvents="box-none">
            {attemptLog.slice(0, 1).map((log, index) => {
              const attemptNumber = attemptLog.length;
              const isSuccess = log.status === 'success' || log.success === true;

              return (
                <View key={index} style={[styles.logCardNew, isSuccess ? styles.logSuccessCard : styles.logFailCard]}>
                  <Text style={styles.logCardTextNew}>
                    {attemptNumber}. {speech.getDisplayCue(log.reason) || (isSuccess ? 'Good form' : 'Deviation detected')}
                  </Text>
                  <View style={[styles.logBadge, isSuccess ? styles.logBadgeSuccess : styles.logBadgeFail]}>
                    <Text style={styles.logBadgeText}>{isSuccess ? 'SUCCESS' : 'FAILED'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Left Side: Circular Phase Progress HUD & Vertical Telemetry Stats */}
        {isStarted && (
          <View style={styles.leftStatsContainer} pointerEvents="box-none">
            {/* Circular Phase HUD (0% P1) directly above Attempts */}
            <CircularPhaseHUD
              progressPct={progressPct}
              currentPhaseIndex={currentPhaseIndex}
              totalPhases={totalPhases}
              size={48}
            />

            <View style={styles.verticalStatCircle}>
              <Text style={styles.verticalStatLabel}>ATTEMPTS</Text>
              <Text style={styles.verticalStatVal}>{attemptLog.length}</Text>
            </View>
            <View style={styles.verticalStatCircle}>
              <Text style={styles.verticalStatLabel}>REPS</Text>
              <Text style={styles.verticalStatVal}>{repCount}</Text>
            </View>
            <View style={styles.verticalStatCircle}>
              <Text style={styles.verticalStatLabel}>ACCURACY</Text>
              <Text style={styles.verticalStatVal}>{Math.round(accuracyScore)}%</Text>
            </View>
            <View style={styles.verticalStatCircle}>
              <Text style={styles.verticalStatLabel}>TIME</Text>
              <Text style={styles.verticalStatVal}>
                {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        )}

        {/* Right Side: 6 Action Controls Dock in a single vertical column centered under Circular HUD */}
        {isStarted && (
          <View style={styles.rightControlsContainer} pointerEvents="box-none">
            {/* 1. Voice Guide Toggle */}
            <TouchableOpacity style={styles.controlBtn} onPress={() => toggleVoice(!isVoiceEnabled)}>
              <MaterialIcons name={isVoiceEnabled ? "volume-up" : "volume-off"} size={20} color={isDark ? "white" : colors.onSurface} />
            </TouchableOpacity>

            {/* 2. Camera Flip */}
            <TouchableOpacity style={styles.controlBtn} onPress={() => setCameraPosition(p => p === 'front' ? 'back' : 'front')}>
              <MaterialIcons name="flip-camera-ios" size={20} color="white" />
            </TouchableOpacity>

            {/* 3. Live Angles Toggle */}
            <TouchableOpacity style={[styles.controlBtn, showAngles && styles.btnActive]} onPress={() => setShowAngles(!showAngles)}>
              <MaterialIcons name="timeline" size={20} color={showAngles ? "#00f2fe" : "white"} />
            </TouchableOpacity>

            {/* 4. Skeleton / Spine Overlay Toggle */}
            <TouchableOpacity style={[styles.controlBtn, showSilhouette && styles.btnActive]} onPress={() => setShowSilhouette(!showSilhouette)}>
              <MaterialIcons name="accessibility" size={20} color={showSilhouette ? "#00f2fe" : "white"} />
            </TouchableOpacity>

            {/* 5. Reset Rep (Abandon) */}
            <TouchableOpacity style={[styles.controlBtn, styles.btnWarn]} onPress={resetRep}>
              <MaterialIcons name="replay" size={20} color="#f59e0b" />
            </TouchableOpacity>

            {/* 6. Stop Workout */}
            <TouchableOpacity style={[styles.controlBtn, styles.btnPause]} onPress={handleToggleWorkout}>
              <MaterialIcons name="stop" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Big Center Play Button (Only visible before starting) */}
        {!isStarted && countdown === null && (
          <View style={styles.centerPlayOverlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.centerPlayBtn} onPress={handleToggleWorkout}>
              <MaterialIcons name="play-arrow" size={64} color={isDark ? "white" : colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        <ConfirmModal
          visible={showStopModal}
          title="Stop Practice"
          message="Are you sure you want to stop this practice session?"
          confirmText="Stop"
          isDestructive={true}
          onCancel={() => setShowStopModal(false)}
          onConfirm={async () => {
            setShowStopModal(false);
            engine.stop();
            setIsStarted(false);
            await saveSession('completed');
            setSessionId(null);
            sessionIdRef.current = null;
            setLastPose(null);
            navigation.navigate('Dashboard');
          }}
        />
      </View>
    </View>
  );
}



const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#00142B' : colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? '#00142B' : colors.background,
  },
  text: {
    color: 'white',
    fontSize: 16,
    marginTop: Spacing.md,
  },
  jointDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3333',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    zIndex: 20,
  },
  countdownOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 20, 43, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: Spacing.md,
  },
  countdownNumber: {
    color: 'white',
    fontSize: 120,
    fontWeight: '900',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: Spacing.lg,
    paddingTop: 54, // Align with back button which is at top: 50
    justifyContent: 'flex-start',
    zIndex: 100,
    elevation: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 44, // To clear the back button
    justifyContent: 'space-between',
    zIndex: 10,
  },
  titleText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  phaseSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  anglePill: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#39FF14',
    zIndex: 30,
  },
  anglePillText: {
    color: '#39FF14',
    fontSize: 11,
    fontWeight: '900',
  },
  fpsBadge: {
    backgroundColor: 'rgba(40,110,100,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topFeedbackContainer: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    elevation: 10,
  },
  feedbackToast: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    minHeight: 84,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    width: '92%',
    maxWidth: 370,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#34A853', // Solid green from image
  },
  feedbackWarn: {
    backgroundColor: '#EA4335', // Solid red
  },
  feedbackToastText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logContainer: {
    marginTop: Spacing.sm,
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  logCardNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    minHeight: 84,
    borderRadius: 20,
    width: '92%',
    maxWidth: 370,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  logSuccessCard: {
    backgroundColor: '#34A853',
  },
  logFailCard: {
    backgroundColor: '#EA4335',
  },
  logCardTextNew: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flex: 1,
  },
  logBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: Spacing.sm,
  },
  logBadgeSuccess: {
    backgroundColor: '#2ca02c',
  },
  logBadgeFail: {
    backgroundColor: 'red',
  },
  logBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  leftStatsContainer: {
    position: 'absolute',
    left: 14,
    top: 295,
    alignItems: 'center',
    flexDirection: 'column',
    zIndex: 100,
    elevation: 100,
  },
  verticalStatCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(0, 20, 43, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.2,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  verticalStatLabel: {
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.onSurfaceVariant,
    fontSize: 6.5,
    fontWeight: 'bold',
    marginBottom: 1,
    letterSpacing: 0.3,
  },
  verticalStatVal: {
    color: isDark ? 'white' : colors.onSurface,
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  fpsText: {
    color: '#00ffcc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topHUD: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
  },
  statsBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 20, 43, 0.85)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  hudStat: {
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statVal: {
    color: '#39FF14',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  hudSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rightControlsContainer: {
    position: 'absolute',
    right: 14,
    top: 295,
    width: 44,
    alignItems: 'center',
    flexDirection: 'column',
    gap: 8,
    zIndex: 100,
    elevation: 100,
  },
  hudButton: {
    backgroundColor: 'rgba(0,20,43,0.75)',
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simActiveButton: {
    borderColor: '#39FF14',
    backgroundColor: 'rgba(57, 255, 20, 0.15)',
  },
  simText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statsPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
    backgroundColor: isDark ? 'rgba(0, 20, 43, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  btnActive: {
    borderColor: '#00f2fe',
    backgroundColor: 'rgba(0, 242, 254, 0.2)',
  },
  btnWarn: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  btnStart: {
    backgroundColor: isDark ? '#002855' : colors.primaryContainer,
  },
  btnPause: {
    backgroundColor: '#FF3B30', // Keep pause red
  },
  centerPlayOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  centerPlayBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(0, 40, 85, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.6 : 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  topStartBadgeBtn: {
    backgroundColor: 'rgba(57, 255, 20, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#39FF14',
  },
  topStopBadgeBtn: {
    backgroundColor: 'rgba(255, 51, 51, 0.2)',
    borderColor: '#FF3333',
  },
  topStartBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  centerPhaseContainer: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPhaseTag: {
    backgroundColor: 'rgba(0, 20, 43, 0.6)',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(57, 255, 20, 0.5)',
  },
  centerPhaseText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  bottomHUD: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
});

