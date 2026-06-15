'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WebcamTracker } from '../../../components/exercise/WebcamTracker';
import { SkeletonOverlay } from '../../../components/exercise/SkeletonOverlay';
import { MovementEngine, ExerciseState, PoseData, RepStats, SpeechManager } from '@workout/shared';
import { ChevronLeft, Play, Square, AlertTriangle, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useRef, useEffect } from 'react';

const AUTH_USER_STORAGE_KEY = 'visionfit.auth.user';
const API_BASE_URL = '/api';

const HeaderStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[100px] group hover:bg-white/5 transition-all duration-300">
    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-1 group-hover:text-white/50 transition-colors">{label}</span>
    <span className={`text-xl font-black ${color} tracking-tight tabular-nums`}>{value}</span>
  </div>
);

export default function TrackPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [engine] = useState(() => new MovementEngine());
  const [speech] = useState(() => new SpeechManager());
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  useEffect(() => {
    setIsVoiceEnabled(speech.getIsEnabled());
  }, [speech]);

  // Clean up speech on page unmount
  useEffect(() => {
    return () => {
      speech.stop();
    };
  }, [speech]);

  const toggleVoice = () => {
    const nextVal = !isVoiceEnabled;
    setIsVoiceEnabled(nextVal);
    speech.setEnabled(nextVal);
  };

  const [state, setState] = useState<ExerciseState>(engine.getState());
  const [pose, setPose] = useState<PoseData | null>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [exerciseName, setExerciseName] = useState('Loading...');
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [trackingModel, setTrackingModel] = useState<'lite' | 'full' | 'heavy'>('full');
  const [uiSmoothing, setUiSmoothing] = useState(0.3);
  const [fps, setFps] = useState<number>(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    handleResize(); // Initialize on mount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen?.().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state.isStarted) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.isStarted]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  useEffect(() => {
    const fetchExerciseDetails = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/exercises/${exerciseId}`);
        const data = await res.json();
        if (data && data.name) {
          setExerciseName(data.name);
          engine.setExercise(data.name);
          if (data.tracking_model) {
            setTrackingModel(data.tracking_model);
            console.log(`Setting tracking model to: ${data.tracking_model}`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch exercise details', err);
      }
    };

    const fetchTrackingConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/tracking-config`);
        const config = await res.json();
        if (config) {
          if (config.model_type) setTrackingModel(config.model_type);
          if (config.ui_smoothing) setUiSmoothing(Number(config.ui_smoothing));
          console.log('Global tracking config loaded:', config);
        }
      } catch (err) {
        console.error('Failed to fetch tracking config', err);
      }
    };

    const fetchRules = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/exercises/${exerciseId}/rules`);
        const rules = await res.json();
        if (rules && Array.isArray(rules)) {
          engine.setRules(rules);
          console.log('Successfully synced rules from DB');
        }
      } catch (err) {
        console.error('Failed to fetch rules', err);
      }
    };

    const fetchVoiceConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/voice-config`);
        const voiceData = await res.json();
        if (voiceData) {
          speech.initializeConfig(voiceData, exerciseId);
        }
      } catch (err) {
        console.error('Failed to fetch voice configuration', err);
      }
    };

    fetchExerciseDetails();
    fetchRules();
    fetchTrackingConfig();
    fetchVoiceConfig();
  }, [exerciseId, engine, speech]);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.id) {
          setUserId(user.id);
        } else {
          router.replace('/');
        }
      } catch (e) {
        console.error("Failed to parse stored user", e);
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  }, [router]);
  // API Persistence
  const saveSession = async (status: string = 'active') => {
    if (!userId) {
      console.error('No userId found, cannot save session');
      return null;
    }

    const customerId = userId;

    try {
      if (!sessionIdRef.current) {
        const res = await fetch(`${API_BASE_URL}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customerId, exercise_id: exerciseId })
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('Backend error creating session:', errorData);
          return null;
        }

        const data = await res.json();
        if (data.session_id) {
          setSessionId(data.session_id);
          sessionIdRef.current = data.session_id;
          return data.session_id;
        }
        return null;
      } else {
        const res = await fetch(`${API_BASE_URL}/sessions/${sessionIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_reps: state.repCount,
            average_accuracy: state.accuracyScore,
            total_duration_seconds: Math.floor((Date.now() - (state.startTime || 0)) / 1000),
            status
          })
        });

        if (!res.ok) {
          console.error('Backend error updating session:', res.statusText);
        }

        return sessionIdRef.current;
      }
    } catch (error) {
      console.error('Network error saving session:', error);
      return null;
    }
  };

  const logMovementData = async (stats: RepStats, attemptId: string) => {
    const sid = sessionIdRef.current;
    if (!sid || !attemptId) return;

    try {
      // 1. Log key frames (Start, Top, End) against the ATTEMPT ID
      const keyFrames = [
        { type: 'start', landmarks: stats.startFrameLandmarks, angles: stats.startFrameAngles, frameNumber: 1 },
        ...(stats.topFrameLandmarks ? [{ type: 'top', landmarks: stats.topFrameLandmarks, angles: stats.topFrameAngles, frameNumber: Math.floor(stats.durationSeconds * 15) }] : []),
        { type: 'end', landmarks: stats.endFrameLandmarks, angles: stats.endFrameAngles, frameNumber: Math.floor(stats.durationSeconds * 30) }
      ];

      for (const frame of keyFrames) {
        await fetch(`${API_BASE_URL}/sessions/${sid}/frames`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_id: attemptId, // Using attemptId as the universal movement key
            frame_number: frame.frameNumber,
            landmarks: frame.landmarks,
            frame_type: frame.type,
            angles: Object.entries(frame.angles || {}).map(([name, value]) => ({ name, value }))
          })
        });
      }

      // 2. Log deviations against the ATTEMPT ID
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

      // 3. If it was a success, ALSO log to the rep_logs table for legacy/summary views
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
            attempt_id: attemptId // Link them
          })
        });
      }
    } catch (error) {
      console.error("Failed to log detailed movement data", error);
    }
  };

  const logAttempt = useCallback(async (attempt: any) => {
    const sid = sessionIdRef.current;
    if (!sid) return null;

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
    } catch (error) {
      console.error('Error logging attempt:', error);
      return null;
    }
  }, [exerciseId]);

  const lastAttemptIdRef = useRef<string | null>(null);
  const lastFinishedMovementIdRef = useRef<string | null>(null);
  const lastLoggedRepCount = useRef(0);

  const handlePose = useCallback((newPose: PoseData) => {
    setPose(newPose);
    const newState = engine.processFrame(newPose);

    // 1. Detect New Attempts (Start of movement)
    const latestAttempt = newState.attemptLog[0];
    if (latestAttempt && latestAttempt.id !== lastAttemptIdRef.current) {
      lastAttemptIdRef.current = latestAttempt.id;
      // We log the attempt immediately to get the DB ID
      logAttempt(latestAttempt).then(dbId => {
        if (dbId) {
          (latestAttempt as any).dbId = dbId;
          
          // CRITICAL FIX: If this attempt and movement finished in the same frame,
          // the dbId was not yet resolved when finished movement detection ran.
          // We check here and log the movement data immediately.
          const finishedStats = engine.getLastMovementStats();
          if (finishedStats) {
            const isMatch = (finishedStats.status === 'valid' ? latestAttempt.status === 'success' : latestAttempt.status === 'failed') &&
              Math.abs(new Date(latestAttempt.timestamp).getTime() - new Date(finishedStats.endTime).getTime()) < 5000;
            if (isMatch) {
              console.log('Asynchronously logging movement data after attempt DB ID resolved:', dbId);
              logMovementData(finishedStats, dbId);
            }
          }
        }
      });
    }

    // 2. Detect Finished Movements (Success or Fail)
    const currentStats = engine.getLastMovementStats();
    if (currentStats && (currentStats as any).startTime !== lastFinishedMovementIdRef.current) {
      lastFinishedMovementIdRef.current = (currentStats as any).startTime;

      // Find the corresponding attempt in our log to get the dbId (match by status and within 5 seconds of the rep's end time)
      const matchingAttempt = newState.attemptLog.find(a =>
        (currentStats.status === 'valid' ? a.status === 'success' : a.status === 'failed') &&
        Math.abs(new Date(a.timestamp).getTime() - new Date(currentStats.endTime).getTime()) < 5000
      );

      // If the dbId has already resolved (e.g. attempt logged at start of movement), log it immediately.
      // Otherwise, the asynchronous .then() handler in block 1 will log it once the ID resolves.
      if (matchingAttempt && (matchingAttempt as any).dbId) {
        console.log('Synchronously logging movement data (DB ID already resolved):', (matchingAttempt as any).dbId);
        logMovementData(currentStats, (matchingAttempt as any).dbId);
      }

      // Handle celebrations for success
      if (newState.isStarted) {
        if (currentStats.status === 'valid') {
          speech.speakRepCount(newState.repCount, currentStats.qualityScore);
          if (currentStats.qualityScore > 80) {
            confetti({
              particleCount: 40,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#00f2fe', '#fff', '#7000ff']
            });
          }
        } else if (currentStats.status === 'failed') {
          const failureReason = matchingAttempt?.reason || (currentStats.deviations && currentStats.deviations.length > 0 ? currentStats.deviations[0].message : 'rep failed');
          speech.speakFailure(failureReason);
        }
      }
    }

    // Voice guidance for active real-time warnings
    if (newState.isStarted && newState.feedback && newState.feedback.length > 0) {
      const activeCue = newState.feedback[0];
      // Avoid repetitive body searching prompts unless standing position initializes
      if (activeCue !== 'Searching for body...' || newState.currentPhase === 'INITIALIZING') {
        speech.speak(activeCue, false, newState.repCount);
      }
    }

    setState(newState);
  }, [engine, logAttempt, speech]);
  // Removed state.repCount dependency to avoid frequent recreations

  const startTrackingActual = useCallback(async () => {
    const sid = await saveSession('active');
    if (sid) {
      lastLoggedRepCount.current = 0;
      engine.start();
      setState({ ...engine.getState() });
      console.log('Tracking started successfully with session:', sid);
    } else {
      console.error('Failed to start session, tracking aborted');
      alert('Failed to initialize session. Please try again.');
    }
  }, [engine, userId]);

  // Countdown effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      speech.speak(String(countdown), true);
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      speech.speak('Go!', true);
      setCountdown(null);
      // Use a small delay to ensure state has settled before starting
      setTimeout(() => {
        startTrackingActual();
      }, 100);
    }
  }, [countdown, startTrackingActual, speech]);

  const toggleWorkout = async () => {
    if (state.isStarted) {
      engine.stop();
      speech.stop();
      setCountdown(null);
      await saveSession('completed');
      setSessionId(null);
      sessionIdRef.current = null;
      setState({ ...engine.getState() });
    } else {
      if (!userId) {
        alert('User not identified. Please refresh the page.');
        return;
      }
      // Start countdown
      setCountdown(5);
    }
  };

  const handleBack = () => {
    setShowConfirmBack(true);
  };

  const confirmBack = async () => {
    speech.stop();
    setCountdown(null);
    if (state.isStarted) {
      engine.stop();
      await saveSession('completed');
      setSessionId(null);
      sessionIdRef.current = null;
    }
    router.replace('/');
  };


  return (
    <main className="min-h-screen lg:h-screen bg-[#00142B] text-white overflow-y-auto lg:overflow-hidden flex flex-col font-[family-name:var(--font-inter)]">
      {/* Header */}
      <div className="max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-center py-4 px-6 flex-none">
        {/* Left: Title & Engine (7 Cols) */}
        <div className="lg:col-span-7 flex items-center gap-4 lg:gap-6">
          <button
            onClick={handleBack}
            className="p-3 lg:p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </button>

          <div className="flex flex-col min-w-0">
             <div className="flex flex-wrap items-center gap-2 lg:gap-3">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight leading-none truncate">
                {exerciseName}
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-lg bg-white/5 border border-white/10">
                <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[9px] lg:text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                  Live Analysis
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-[9px] lg:text-[10px] font-black text-red-500 uppercase tracking-widest">
                  {fps} FPS
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 lg:mt-2.5">
              <span className="text-[9px] lg:text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">AI Movement Analysis</span>
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <span className="text-[9px] lg:text-[10px] font-black text-cyan-400/60 uppercase tracking-widest truncate">
                Engine: {state.currentPhase === 'INITIALIZING' ? 'Loading...' : (engine as any).rule?.constructor.name || 'Default'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stats & Action (5 Cols) */}
        <div className="lg:col-span-5 flex items-center gap-3">
          <button
            onClick={toggleVoice}
            className={`p-3.5 rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center flex-none hidden lg:flex ${
              isVoiceEnabled
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-cyan-500/20'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
            }`}
            title={isVoiceEnabled ? 'Mute Voice Guide' : 'Unmute Voice Guide'}
          >
            {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <div className="flex-1 grid grid-cols-3 gap-2">
            <HeaderStat
              label="Attempts"
              value={state.attemptCount.toString()}
              color="text-blue-400"
            />
            <HeaderStat
              label="Reps"
              value={state.repCount.toString()}
              color="text-cyan-400"
            />
            <HeaderStat
              label="Timer"
              value={formatTime(seconds)}
              color="text-yellow-400"
            />
          </div>

          <button
            onClick={toggleWorkout}
            className={`group relative flex items-center gap-2.5 px-6 py-4 rounded-2xl font-black transition-all duration-300 overflow-hidden flex-none hidden lg:flex ${state.isStarted
              ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20'
              : 'bg-white text-black hover:scale-105 active:scale-95 shadow-xl shadow-cyan-500/20'
              }`}
          >
            <div className="relative z-10 flex items-center gap-2">
              {state.isStarted ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span className="uppercase tracking-widest text-[11px]">
                {state.isStarted ? 'Stop' : 'Start'}
              </span>
            </div>
            {!state.isStarted && (
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10" />
            )}
          </button>
        </div>
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center">
            <p className="text-white/40 font-bold uppercase tracking-[0.3em] mb-4">Get Ready</p>
            <div className="text-[12rem] font-black leading-none bg-gradient-to-b from-white to-white/20 bg-clip-text text-transparent">
              {countdown > 0 ? countdown : 'GO!'}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start px-6 flex-1 overflow-y-auto lg:overflow-hidden pb-28 lg:pb-6">
        {/* Left Column - Video */}
        <div className="lg:col-span-7 flex justify-center lg:justify-end lg:h-full w-full max-w-full">
          <div className="relative group w-full lg:w-fit h-full flex flex-col justify-center items-center">
            {/* Frame - Clean Border */}
            <div className={`absolute -inset-px border border-white/10 rounded-[32px] pointer-events-none ${isFullscreen ? 'hidden' : ''}`}></div>

            <div ref={videoContainerRef} className={`relative flex justify-center bg-[#00142B] ${isFullscreen ? 'w-screen h-screen items-center [&>div]:!max-w-none [&>div]:!max-h-none [&>div]:!w-full [&>div]:!h-full [&>div]:!aspect-auto [&>div]:!rounded-none [&>div]:!border-none' : 'w-full max-w-full rounded-[32px] overflow-hidden'}`}>
              <WebcamTracker
                onPose={handlePose}
                onVideoSize={setVideoSize}
                width={isFullscreen ? windowSize.width : 800}
                height={isFullscreen ? windowSize.height : 600}
                modelId={trackingModel}
                onFPS={setFps}
              >
                <SkeletonOverlay
                  pose={pose}
                  videoSize={videoSize}
                  width={isFullscreen ? windowSize.width : 800}
                  height={isFullscreen ? windowSize.height : 600}
                  smoothing={uiSmoothing}
                />

                {/* Overlay Indicators */}
                <div className="absolute top-4 lg:top-6 left-4 lg:left-6 flex gap-3">
                  <div className={`px-3 lg:px-4 py-1 lg:py-1.5 rounded-full backdrop-blur-xl border border-white/10 flex items-center gap-2 transition-all duration-300 ${state.isStarted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${state.isStarted ? 'bg-red-500 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em]">{state.isStarted ? 'Live' : 'Idle'}</span>
                  </div>
                </div>

                {/* Top-Right Feedback Overlay */}
                {state.feedback.length > 0 && (
                  <div className="absolute top-4 lg:top-6 right-4 lg:right-6 z-30 flex flex-col items-end gap-2 w-full max-w-[200px] sm:max-w-[300px] pointer-events-none">
                    {state.feedback.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`bg-black/60 backdrop-blur-xl border px-4 py-2 lg:px-6 lg:py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300 flex flex-col items-end gap-0.5 ${msg.includes('Keep') || msg.includes('Widen') || msg.includes('Turn') || msg.includes('Push') || msg.includes('Knees')
                          ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
                          : 'border-[#39FF14]/30 shadow-[0_0_20px_rgba(57,255,20,0.1)]'
                          }`}
                      >
                        <span className={`font-black text-xl sm:text-2xl lg:text-3xl tracking-tight text-right leading-tight drop-shadow-[0_0_8px_rgba(57,255,20,0.5)] ${msg.includes('Keep') || msg.includes('Widen') || msg.includes('Turn') || msg.includes('Push') || msg.includes('Knees')
                          ? 'text-orange-500'
                          : 'text-[#39FF14]'
                          }`}>
                          {msg}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#39FF14]/60 text-[9px] font-black uppercase tracking-[0.2em]">{state.currentPhase.replace('_', ' ')}</span>
                          <div className="w-1 h-1 rounded-full bg-[#39FF14] animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute bottom-4 lg:bottom-6 right-4 lg:right-6 p-2 lg:p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all text-white/80 hover:text-white z-50 shadow-lg"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </WebcamTracker>
            </div>
          </div>
        </div>

        {/* Right Column - Attempt Log */}
        <div className="lg:col-span-5 h-full overflow-hidden w-full max-w-full">
          <div className="flex flex-col gap-4 h-full">
            {/* Attempt Log Panel */}
            <div className="flex-1 overflow-hidden bg-white/[0.02] border border-white/10 rounded-[32px] flex flex-col shadow-2xl min-h-[350px] lg:h-full lg:min-h-0">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                <h3 className="font-black text-sm uppercase tracking-[0.2em] text-white/60">Attempt Log</h3>
                <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-white/40 uppercase tracking-widest">All Attempts</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide max-h-[300px] lg:max-h-none">
                {state.attemptLog && state.attemptLog.length > 0 ? (
                  state.attemptLog.map((attempt) => (
                    <div key={attempt.id} className="p-5 rounded-[24px] bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all duration-300">
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${attempt.status === 'success' ? 'text-emerald-400' :
                          attempt.status === 'canceled' ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                          {attempt.status}
                        </span>
                        <span className="text-base font-bold text-white/90 leading-tight">{attempt.reason}</span>
                      </div>
                      <span className="text-[10px] font-bold text-white/20 tabular-nums">
                        {new Date(attempt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-20">
                    <div className="w-16 h-16 border-2 border-dashed border-white/40 rounded-full mb-6 animate-[spin_10s_linear_infinite]" />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">Waiting for first rep</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Controls - Sticky Bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#00142b]/95 border-t border-white/10 p-4 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-4">
        <button
          onClick={toggleVoice}
          className={`p-4 rounded-2xl border transition-all duration-300 active:scale-95 flex items-center justify-center flex-1 ${
            isVoiceEnabled
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : 'bg-white/5 text-white/40 border-white/10'
          }`}
        >
          {isVoiceEnabled ? (
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400" />
              <span className="uppercase tracking-widest text-[10px] font-black text-cyan-400">Voice On</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <VolumeX className="w-5 h-5 text-white/40" />
              <span className="uppercase tracking-widest text-[10px] font-black text-white/40">Voice Off</span>
            </div>
          )}
        </button>

        <button
          onClick={toggleWorkout}
          className={`group relative flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-black transition-all duration-300 overflow-hidden flex-[2] ${
            state.isStarted
              ? 'bg-red-500/10 text-red-500 border border-red-500/50'
              : 'bg-white text-black shadow-xl shadow-cyan-500/20'
          }`}
        >
          <div className="relative z-10 flex items-center gap-2">
            {state.isStarted ? <Square className="w-5 h-5 fill-current text-red-500" /> : <Play className="w-5 h-5 fill-current text-black" />}
            <span className="uppercase tracking-widest text-[11px]">
              {state.isStarted ? 'Stop Workout' : 'Start Workout'}
            </span>
          </div>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmBack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#00142B] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black mb-2 text-white">End Session?</h2>
            <p className="text-white/60 mb-8 leading-relaxed text-sm">
              Are you sure you want to leave? Your current workout progress will be saved and you&apos;ll be returned to the dashboard.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmBack(false)}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBack}
                className="flex-1 px-6 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>

  );
}
