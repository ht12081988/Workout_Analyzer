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
import { useRunOnJS } from 'react-native-worklets-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { MovementEngine, PoseData, Landmark, ExerciseState } from '@workout/shared';
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
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX']
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

// Custom component to render skeleton lines without SVG
const Line = ({ p1, p2, color }: { p1: { x: number, y: number }, p2: { x: number, y: number }, color: string }) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View style={{
      position: 'absolute',
      left: p1.x,
      top: p1.y,
      width: distance,
      height: 3,
      backgroundColor: color,
      transform: [
        { rotate: `${angle}deg` }
      ],
      transformOrigin: '0% 0%',
      opacity: 0.75,
      zIndex: 10,
    }} />
  );
};

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

  // Layout dimensions for rendering skeleton
  const [layoutSize, setLayoutSize] = useState({ width: 300, height: 500 });
  const [lastPose, setLastPose] = useState<PoseData | null>(null);
  const [seconds, setSeconds] = useState(0);

  // References to prevent double logs
  const lastAttemptIdRef = useRef<string | null>(null);
  const lastFinishedMovementIdRef = useRef<string | null>(null);

  // FPS Tracking
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

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

      const keyFrames = [
        { type: 'start', landmarks: stats.startFrameLandmarks, angles: stats.startFrameAngles, frameNumber: getFrameNumber(startMs), timestamp: stats.startTime },
        ...(stats.descendingFrame1Landmarks ? [{ type: 'desc_1', landmarks: stats.descendingFrame1Landmarks, angles: stats.descendingFrame1Angles, frameNumber: getFrameNumber(desc1Ms), timestamp: new Date(desc1Ms).toISOString() }] : []),
        ...(stats.descendingFrame2Landmarks ? [{ type: 'desc_2', landmarks: stats.descendingFrame2Landmarks, angles: stats.descendingFrame2Angles, frameNumber: getFrameNumber(desc2Ms), timestamp: new Date(desc2Ms).toISOString() }] : []),
        ...(stats.topFrameLandmarks ? [{ type: 'top', landmarks: stats.topFrameLandmarks, angles: stats.topFrameAngles, frameNumber: getFrameNumber(topMs), timestamp: stats.topTime }] : []),
        ...(stats.ascendingFrame1Landmarks ? [{ type: 'asc_1', landmarks: stats.ascendingFrame1Landmarks, angles: stats.ascendingFrame1Angles, frameNumber: getFrameNumber(asc1Ms), timestamp: new Date(asc1Ms).toISOString() }] : []),
        ...(stats.ascendingFrame2Landmarks ? [{ type: 'asc_2', landmarks: stats.ascendingFrame2Landmarks, angles: stats.ascendingFrame2Angles, frameNumber: getFrameNumber(asc2Ms), timestamp: new Date(asc2Ms).toISOString() }] : []),
        { type: 'end', landmarks: stats.endFrameLandmarks, angles: stats.endFrameAngles, frameNumber: getFrameNumber(endMs), timestamp: stats.endTime }
      ];

      for (const frame of keyFrames) {
        await fetch(`${API_BASE_URL}/sessions/${sid}/frames`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_id: attemptId,
            frame_number: frame.frameNumber,
            landmarks: frame.landmarks,
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

  // Process incoming frame data
  const handlePose = useCallback((pose: PoseData) => {
    // FPS tracking
    frameCountRef.current += 1;
    const now = Date.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    if (layoutSize.width === 0 || layoutSize.height === 0) return;

    setLastPose(pose);
    const newState = engine.processFrame(pose);

    setRepCount(newState.repCount);
    setAccuracyScore(newState.accuracyScore);
    setFeedback(newState.feedback);
    setAttemptLog(newState.attemptLog);
    setEnginePhase(newState.currentPhase);

    // 1. Detect New Attempts
    const latestAttempt = newState.attemptLog[0];
    if (latestAttempt && latestAttempt.id !== lastAttemptIdRef.current) {
      lastAttemptIdRef.current = latestAttempt.id;

      const isSuccess = latestAttempt.status === 'success' || (latestAttempt as any).success === true;
      if (isSuccess) {
        speech.speakRepCount(newState.repCount, 100);
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

    // 3. Detect Finished Movements
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
  }, [engine, logAttempt, logMovementData, speech]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      engine.stop();
    };
  }, [engine]);

  // Set up JS callback and frame processor
  const handlePoseJS = useRunOnJS(handlePose, [handlePose]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isStarted && detectPosePlugin != null) {
      const pose = detectPosePlugin.call(frame);
      if (pose != null) {
        handlePoseJS(pose as unknown as PoseData);
      }
    }
  }, [isStarted, handlePoseJS]);

  // Start the actual workout tracking session
  const startTracking = async () => {
    const sid = await saveSession('active');
    if (sid) {
      setSessionStartTime(Date.now());
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



  // Helper: map coordinate 0.0-1.0 to screen coordinates
  const getScreenPoint = (landmark: Landmark) => {
    // Standard camera frame aspect ratio is 16:9 (portrait)
    const frameAspect = 16 / 9;
    const viewAspect = layoutSize.height / layoutSize.width;

    let videoWidth = layoutSize.width;
    let videoHeight = layoutSize.height;
    let offsetX = 0;
    let offsetY = 0;

    // Calculate dimensions to mimic resizeMode="cover"
    if (viewAspect > frameAspect) {
      // Screen is taller than the video frame (crop sides)
      videoHeight = layoutSize.height;
      videoWidth = layoutSize.height / frameAspect;
      offsetX = (videoWidth - layoutSize.width) / 2;
    } else {
      // Screen is wider than the video frame (crop top/bottom)
      videoWidth = layoutSize.width;
      videoHeight = layoutSize.width * frameAspect;
      offsetY = (videoHeight - layoutSize.height) / 2;
    }

    let x = (landmark.x * videoWidth) - offsetX;
    let y = (landmark.y * videoHeight) - offsetY;

    // In front camera mode, horizontal coordinates are mirrored
    if (cameraPosition === 'front') {
      x = layoutSize.width - x;
    }

    return { x, y };
  };

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

      {/* Skeleton / Pose Points Overlay */}
      {isStarted && lastPose && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Draw connection lines */}
          {POSE_CONNECTIONS.map(([p1, p2], idx) => {
            const start = lastPose[p1];
            const end = lastPose[p2];
            if (start && end) {
              return (
                <Line
                  key={`line-${idx}`}
                  p1={getScreenPoint(start)}
                  p2={getScreenPoint(end)}
                  color="#39FF14"
                />
              );
            }
            return null;
          })}

          {/* Draw joint circles */}
          {ALL_LANDMARKS.map((name) => {
            const landmark = lastPose[name];
            if (landmark) {
              const pt = getScreenPoint(landmark);
              return (
                <View
                  key={`joint-${name}`}
                  style={[styles.jointDot, { left: pt.x - 7, top: pt.y - 7 }]}
                />
              );
            }
            return null;
          })}
        </View>
      )}

      {/* Countdown Overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownSubtitle}>Get Ready</Text>
          <Text style={styles.countdownNumber}>{countdown > 0 ? countdown : 'GO!'}</Text>
        </View>
      )}

      {/* HUD Controls / Details Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">

        {/* Title, FPS, and Play Button Row */}
        <View style={styles.titleRow} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
            <Text style={styles.titleText}>{exerciseType}</Text>
            <View style={styles.fpsBadge}>
              <Text style={styles.fpsText}>{fps} FPS</Text>
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

        {/* Latest Attempt Log Overlay */}
        {attemptLog.length > 0 && (
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

        {/* Left Side Vertical Summary Stats and Controls (Only visible when started) */}
        {isStarted && (
          <View style={styles.verticalStatsContainer} pointerEvents="box-none">
            <View style={styles.leftButtonsContainer}>
              <TouchableOpacity style={styles.leftControlBtn} onPress={() => toggleVoice(!isVoiceEnabled)}>
                <MaterialIcons name={isVoiceEnabled ? "volume-up" : "volume-off"} size={24} color={isDark ? "white" : colors.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.leftControlBtn, styles.btnPause]} onPress={handleToggleWorkout}>
                <MaterialIcons name="stop" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={[styles.verticalStatCircle, { marginBottom: 10 }]}>
              <Text style={styles.verticalStatLabel}>ATTEMPTS</Text>
              <Text style={styles.verticalStatVal}>{attemptLog.length}</Text>
            </View>
            <View style={[styles.verticalStatCircle, { marginBottom: 10 }]}>
              <Text style={styles.verticalStatLabel}>REPS</Text>
              <Text style={styles.verticalStatVal}>{repCount}</Text>
            </View>
            <View style={[styles.verticalStatCircle, { marginBottom: 10 }]}>
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
    marginLeft: 50, // To clear the back button
    justifyContent: 'space-between',
    zIndex: 10,
  },
  titleText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginRight: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  fpsBadge: {
    backgroundColor: 'rgba(40,110,100,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fpsText: {
    color: '#39FF14',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsPlayBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topFeedbackContainer: {
    marginTop: Spacing.md,
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    elevation: 10,
  },
  feedbackToast: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  feedbackSuccess: {
    backgroundColor: '#34A853', // Solid green from image
  },
  feedbackWarn: {
    backgroundColor: '#EA4335', // Solid red
  },
  feedbackToastText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    paddingVertical: Spacing.md,
    borderRadius: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logSuccessCard: {
    backgroundColor: '#34A853',
  },
  logFailCard: {
    backgroundColor: '#EA4335',
  },
  logCardTextNew: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  logBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    fontSize: 10,
    fontWeight: 'bold',
  },
  verticalStatsContainer: {
    position: 'absolute',
    left: 20,
    top: 360,
    flexDirection: 'column',
    zIndex: 100,
    elevation: 100,
  },
  verticalStatCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: isDark ? 'rgba(0, 20, 43, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  verticalStatLabel: {
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.onSurfaceVariant,
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  verticalStatVal: {
    color: isDark ? 'white' : colors.onSurface,
    fontSize: 18,
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
  leftButtonsContainer: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
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
  leftControlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
    backgroundColor: isDark ? 'rgba(0, 20, 43, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 6,
    elevation: 8,
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

