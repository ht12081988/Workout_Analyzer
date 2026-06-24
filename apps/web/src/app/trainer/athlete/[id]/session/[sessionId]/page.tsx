'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, AreaChart, Area, Brush, ReferenceLine, ReferenceArea
} from 'recharts';
import { SkeletonReplay } from '@/components/exercise/SkeletonReplay';

type Rep = {
  id: string;
  rep_number: number;
  quality_score: number;
  duration_seconds: number;
  status: string;
  attempt_id?: string;
  start_frame_time?: any;
  top_frame_time?: any;
  end_frame_time?: any;
};

type Attempt = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
};

type SessionDetail = {
  id: string;
  exercise_name: string;
  exercise_category?: string;
  exercise_subcategory?: string;
  start_time: string;
  end_time: string | null;
  total_reps: number;
  average_accuracy: number;
  total_duration_seconds: number;
  status: string;
  reps: Rep[];
  attempts: Attempt[];
  deviations: any[];
};

const API_BASE_URL = '/api';
const AUTH_USER_STORAGE_KEY = 'visionfit.auth.trainer';

export default function SessionDetailPage() {
  const router = useRouter();
  const { id, sessionId } = useParams() || {};
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'performance' | 'attempts' | 'replay'>('performance');
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frames, setFrames] = useState<any[]>([]);
  const [angles, setAngles] = useState<any[]>([]);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const [globalShowAngles, setGlobalShowAngles] = useState(true);

  const [sessionReplay, setSessionReplay] = useState<{
    isOpen: boolean;
    currentAttemptIndex: number;
    activeAttempts: any[];
    isComplete: boolean;
  }>({
    isOpen: false,
    currentAttemptIndex: 0,
    activeAttempts: [],
    isComplete: false
  });

  const startSessionReplay = () => {
    const validAttempts = session?.attempts.filter(attempt => 
      frames.some(f => f.rep_id === attempt.id)
    );
    if (!validAttempts || validAttempts.length === 0) return;
    
    setSessionReplay({
      isOpen: true,
      currentAttemptIndex: 0,
      activeAttempts: validAttempts,
      isComplete: false
    });
  };

  const playNextSessionRep = () => {
    setSessionReplay(prev => {
      if (prev.currentAttemptIndex + 1 >= prev.activeAttempts.length) {
        return { ...prev, isComplete: true };
      }
      return { ...prev, currentAttemptIndex: prev.currentAttemptIndex + 1 };
    });
  };

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!storedUser) {
      router.push('/');
      return;
    }
    fetchSessionDetails();
    fetchAnalytics();
    fetchFrames();
    fetchAngles();
  }, [id, sessionId, router]);

  const fetchSessionDetails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Session not found');
      const data = await response.json();
      setSession(data);
    } catch (err) {
      setError('Could not retrieve session details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/analytics`);
      if (!response.ok) return;
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Analytics fetch failed', err);
    }
  };

  const fetchFrames = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/frames`);
      if (!response.ok) return;
      const data = await response.json();
      setFrames(data);
    } catch (err) {
      console.error('Frames fetch failed', err);
    }
  };

  const fetchAngles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/angles`);
      if (!response.ok) return;
      const data = await response.json();
      setAngles(data);
    } catch (err) {
      console.error('Angles fetch failed', err);
    }
  };


  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDetailedDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatFullDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const timelineRef = useRef<HTMLDivElement>(null);

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      timelineRef.current.scrollBy({
        left: direction === 'left' ? -250 : 250,
        behavior: 'smooth'
      });
    }
  };

  // Unified Timeline of all movements
  const timeline = useMemo(() => {
    if (!session) return [];

    return session.attempts.map((attempt, idx) => {
      const isSuccess = attempt.status === 'success';
      let associatedRep = null;

      if (isSuccess) {
        associatedRep = session.reps.find(r => r.attempt_id === attempt.id);
      }

      return {
        id: attempt.id,
        repId: associatedRep?.id,
        status: attempt.status,
        reason: attempt.reason,
        time: attempt.created_at,
        label: `Rep ${idx + 1}`
      };
    });
  }, [session]);

  const flawData = useMemo(() => {
    if (!session) return [];
    const data = session.attempts.map((attempt, index) => {
      // Filter out 'info' severity messages and movement sequence cues
      const deviations = session.deviations.filter(d => {
        if (d.rep_id !== attempt.id) return false;

        const msg = (d.feedback_message || '').toLowerCase();
        const severity = (d.severity || '').toLowerCase();

        // Strictly exclude instructional cues and sequence markers
        const isSequenceCue =
          msg.includes('ready') ||
          msg.includes('going down') ||
          msg.includes('great depth') ||
          msg.includes('now up') ||
          msg.includes('now down') ||
          msg.includes('hold still') ||
          msg.includes('calibration') ||
          msg.includes('searching for') ||
          msg.includes('stance locked') ||
          msg.includes('hold stance') ||
          msg.includes('stay still') ||
          msg.includes('sitting into') ||
          msg.includes('sitting back') ||
          msg.includes('driving back up') ||
          msg.includes('push through heels') ||
          msg.includes('drive through heels') ||
          msg.includes('step one leg forward') ||
          msg.includes('stand sideways') ||
          msg.includes('widen your stance') ||
          msg.includes('feet too wide') ||
          msg.includes('turn toes outward') ||
          msg.includes('toes out too far') ||
          msg.includes('take a wider step');

        if (isSequenceCue) return false;
        if (severity === 'info') return false;

        return true;
      });

      const labels = Array.from(new Set(deviations.map(d => d.feedback_message)));

      // Fallback for failed attempts without granular logs (usually the reason string contains flaws)
      if (attempt.status === 'failed' && labels.length === 0 && attempt.reason) {
        const reasons = attempt.reason.split(' & ').filter(r => r.trim().length > 0);
        labels.push(...reasons);
      }

      return {
        rep: `Rep ${index + 1}`,
        count: labels.length,
        labels: labels,
        status: attempt.status,
        attemptNum: index + 1
      };
    });

    if (data.length === 0) {
      return [{
        rep: 'Rep 1',
        count: 0,
        labels: [],
        status: 'success',
        attemptNum: 1
      }];
    }
    return data;
  }, [session]);

  const jointNames = useMemo(() => {
    if (!analytics.length) return [];
    return Array.from(new Set(analytics.map(a => a.name)));
  }, [analytics]);

  const chartGroups = useMemo(() => {
    if (!jointNames.length) return [];

    const groups: { name: string, joints: string[], isBilateral: boolean }[] = [];
    const processed = new Set<string>();

    // Detect Bilateral Pairs (lX and rX or leftX and rightX)
    jointNames.forEach(name => {
      if (processed.has(name)) return;

      let partnerName = '';
      let baseDisplayName = '';

      if (name.startsWith('l') && !name.startsWith('left') && jointNames.includes('r' + name.slice(1))) {
        partnerName = 'r' + name.slice(1);
        baseDisplayName = name.slice(1).replace(/([A-Z])/g, ' $1').trim();
      } else if (name.startsWith('left') && jointNames.includes(name.replace('left', 'right'))) {
        partnerName = name.replace('left', 'right');
        baseDisplayName = name.replace('left', '').replace(/([A-Z])/g, ' $1').trim();
      }

      if (partnerName) {
        groups.push({
          name: `${baseDisplayName} Symmetry`,
          joints: [name, partnerName],
          isBilateral: true
        });
        processed.add(name);
        processed.add(partnerName);
      }
    });

    // Add remaining individual joints
    jointNames.forEach(name => {
      if (!processed.has(name)) {
        groups.push({
          name: name.replace(/([A-Z])/g, ' $1').trim(),
          joints: [name],
          isBilateral: false
        });
      }
    });

    // Add Rhythm group at the end
    groups.push({
      name: 'Movement Rhythm',
      joints: ['tempo'],
      isBilateral: false
    });

    return groups;
  }, [jointNames]);

  const processedKinematics = useMemo(() => {
    if (!analytics.length || !session || !jointNames.length) return { data: [], markers: [], tickMap: new Map<number, string>() };

    const isAll = selectedAttemptIndex === -1;
    const primaryJoint = jointNames[0];

    const calculateMarkers = (data: any[], label: string = '') => {
      if (!data.length) return null;
      const start = data[0].frame;
      const end = data[data.length - 1].frame;

      // Calculate Mid frame based on the primary joint's extremum
      const primaryJoint = jointNames[0];
      let midFrame = data[Math.floor(data.length / 2)].frame;
      let extremeVal = data[0][primaryJoint];

      // Find if we should look for max or min (simple heuristic)
      const first = data[0][primaryJoint];
      const last = data[data.length - 1][primaryJoint];
      const middle = data[Math.floor(data.length / 2)][primaryJoint];

      const isSearchingMax = middle > first && middle > last;

      data.forEach(d => {
        if (isSearchingMax) {
          if (d[primaryJoint] > extremeVal) {
            extremeVal = d[primaryJoint];
            midFrame = d.frame;
          }
        } else {
          if (d[primaryJoint] < extremeVal) {
            extremeVal = d[primaryJoint];
            midFrame = d.frame;
          }
        }
      });

      return { start, mid: midFrame, end, label };
    };

    if (!isAll) {
      const selectedAttempt = timeline[selectedAttemptIndex];
      if (!selectedAttempt) return { data: [], markers: [], tickMap: new Map<number, string>() };

      const filteredAnalytics = analytics.filter(a =>
        a.rep_id === selectedAttempt.id || (selectedAttempt.repId && a.rep_id === selectedAttempt.repId)
      );

      const framesMap = new Map();
      filteredAnalytics.forEach(a => {
        if (!framesMap.has(a.frame_number)) {
          framesMap.set(a.frame_number, { frame: a.frame_number });
        }
        framesMap.get(a.frame_number)[a.name] = parseFloat(a.value);
      });

      const sortedData = Array.from(framesMap.values()).sort((a, b) => a.frame - b.frame);
      const markers = calculateMarkers(sortedData);

      // Calculate elapsed rep time for individual rep
      const dataWithTempo = sortedData.map((d, i) => {
        const tempo = (d.frame - (markers?.start || 0)) / 30;
        return { ...d, tempo };
      });

      const markersList = markers ? [markers] : [];

      const tickMap = new Map<number, string>();
      if (markers) {
        tickMap.set(markers.start, 'START');
        tickMap.set(markers.mid, 'MID');
        tickMap.set(markers.end, 'END');
      }

      return { data: dataWithTempo, markers: markersList, tickMap };
    } else {
      // Re-map frames for "ALL" view to ensure chronological rep sequence
      let globalOffset = 0;
      const allData: any[] = [];
      const markersList: any[] = [];
      const tickMap = new Map<number, string>();

      timeline.forEach((move) => {
        const moveIds = new Set([String(move.id), move.repId ? String(move.repId) : null].filter(Boolean));
        const moveAngles = analytics.filter(a => moveIds.has(String(a.rep_id)));

        if (moveAngles.length === 0) return;

        const framesMap = new Map();
        moveAngles.forEach(a => {
          const fNum = a.frame_number;
          if (!framesMap.has(fNum)) {
            framesMap.set(fNum, { _orig: fNum });
          }
          framesMap.get(fNum)[a.name] = parseFloat(a.value);
        });

        const sortedMoveFrames = Array.from(framesMap.values()).sort((a, b) => a._orig - b._orig);

        // Offset frames and prepare move data
        const mappedMoveData = sortedMoveFrames.map((d, dIdx) => ({
          ...d,
          frame: globalOffset + dIdx,
        }));

        const markers = calculateMarkers(mappedMoveData, move.label);
        if (markers) {
          // Calculate elapsed time into this specific rep (Sawtooth pattern)
          mappedMoveData.forEach(d => {
            d.tempo = (d.frame - markers.start) / 30;
          });

          const durationSec = (mappedMoveData.length / 30).toFixed(1);
          markersList.push({ ...markers, durationSec });

          // Labels for the X-Axis
          tickMap.set(markers.start, `${markers.start}`);
          tickMap.set(markers.end, `${markers.end}`);
          tickMap.set(markers.mid, `Rep ${markersList.length}`);
        }

        allData.push(...mappedMoveData);
        globalOffset += mappedMoveData.length + 20;
      });

      return { data: allData, markers: markersList, tickMap };
    }
  }, [analytics, timeline, selectedAttemptIndex, session, jointNames]);

  const { data: kinematicsData, markers: allMarkers, tickMap } = processedKinematics;
  const axisTicks = Array.from(tickMap.keys());

  const JOINT_COLORS = ['#003366', '#256b8b', '#00712D', '#D5F0C1', '#FFE31A'];
  const SYMMETRY_COLORS = { left: '#256b8b', right: '#FF9500' };

  const BottomXAxisTick = ({ x, y, payload }: any) => {
    const label = tickMap.get(payload.value);
    if (!label) return null;

    const isRep = typeof label === 'string' && label.startsWith('Rep');
    if (!isRep) return null;

    return (
      <g transform={`translate(${x},${y + 16})`}>
        <rect x={-22} y={-12} width={44} height={18} rx={9} fill="var(--color-primary)" fillOpacity={0.15} />
        <text x={0} y={1} textAnchor="middle" fill="var(--color-primary)" fontSize={9} fontWeight={900}>
          {label}
        </text>
      </g>
    );
  };

  const TopXAxisTick = ({ x, y, payload }: any) => {
    const label = tickMap.get(payload.value);
    if (!label) return null;

    const isRep = typeof label === 'string' && label.startsWith('Rep');
    if (isRep) return null;

    return (
      <g transform={`translate(${x},${y - 8})`}>
        <text x={0} y={0} textAnchor="middle" fill="var(--color-outline)" fontSize={9} fontWeight={800}>
          {label}
        </text>
      </g>
    );
  };



  const FlawTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { labels, count, rep } = payload[0].payload;
      return (
        <div className="rounded-[24px] bg-surface-container-highest p-5 shadow-2xl border border-outline-variant/10 backdrop-blur-xl">
          <p className="mb-3 font-headline text-xs uppercase tracking-widest text-primary font-black">
            {rep} Analysis
          </p>
          <div className="space-y-2">
            {labels.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-outline">Total Flaws</span>
                  <span className="text-xs font-black text-error bg-error/10 px-2 py-0.5 rounded-full">{count}</span>
                </div>
                {labels.map((flaw: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 bg-error/5 px-3 py-2 rounded-xl border border-error/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-error animate-pulse" />
                    <p className="font-body text-xs font-bold text-on-surface">{flaw}</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center py-2">
                <span className="material-symbols-outlined text-success text-3xl mb-1">verified</span>
                <p className="font-headline text-xs font-black text-success uppercase tracking-widest">Perfect Form</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="animate-pulse text-primary font-headline text-xl">Analyzing performance data...</div>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="text-error font-headline text-xl">Session not found.</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-surface pb-28 text-on-surface relative">
      <nav className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-surface/80 px-4 shadow-sm backdrop-blur-xl md:px-8 border-b border-outline-variant/10 mb-8">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 max-w-[35%] xs:max-w-[45%] mr-2">

          {session && (
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary hidden xs:flex">
                <span className="material-symbols-outlined text-lg sm:text-xl">directions_run</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="font-headline text-xs sm:text-sm font-black text-primary leading-none truncate">
                    {session.exercise_name}
                  </h2>
                  <span className="flex-shrink-0 bg-surface-container-highest text-primary/80 px-1 sm:px-1.5 py-0.5 rounded-full border border-outline-variant/10 text-[7px] sm:text-[8px] font-bold tracking-tight">
                    {selectedAttemptIndex === -1 ? 'ALL' : `REP ${selectedAttemptIndex + 1}`}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[8px] md:text-[9px] font-medium text-outline-variant mt-0.5 truncate">
                  <span>{formatDetailedDateTime(session.start_time)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
          <div className="inline-flex rounded-full bg-surface-container-high p-0.5 sm:p-1 shadow-inner">
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 transition-all ${activeTab === 'performance'
                ? 'bg-surface-container-lowest text-primary shadow-md'
                : 'text-on-surface-variant hover:text-primary'
                }`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">analytics</span>
              <span className="font-headline text-[10px] sm:text-xs font-bold">Analysis</span>
            </button>
            <button
              onClick={() => setActiveTab('attempts')}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 transition-all ${activeTab === 'attempts'
                ? 'bg-surface-container-lowest text-primary shadow-md'
                : 'text-on-surface-variant hover:text-primary'
                }`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">history_edu</span>
              <span className="font-headline text-[10px] sm:text-xs font-bold">Log</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('replay');
                if (!sessionReplay.isOpen) {
                  startSessionReplay();
                }
              }}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 transition-all ${activeTab === 'replay'
                ? 'bg-surface-container-lowest text-primary shadow-md'
                : 'text-on-surface-variant hover:text-primary'
                }`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">movie</span>
              <span className="font-headline text-[10px] sm:text-xs font-bold">Play Session</span>
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-end col-span-1" />
      </nav>

      <motion.section
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
        className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-16"
      >
        {/* Quick Stats Summary */}
        {activeTab !== 'replay' && (
          <motion.div
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-8"
          >
            {[
              { label: 'Total Attempts', value: session.attempts.length, icon: 'ads_click' },
              { label: 'Successful Attempts', value: session.attempts.filter(a => a.status === 'success').length, icon: 'check_circle' },
              { label: 'Failed Attempts', value: session.attempts.filter(a => a.status === 'failed').length, icon: 'error' },
              { label: 'Cancelled Attempts', value: session.attempts.filter(a => a.status === 'canceled').length, icon: 'cancel' },
              { label: 'Duration', value: `${Math.floor(session.total_duration_seconds / 60)}m ${session.total_duration_seconds % 60}s`, icon: 'timer' },
              { label: 'Form Flaws', value: flawData.reduce((acc, curr) => acc + curr.count, 0), icon: 'warning' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}
                whileHover={{ y: -5 }}
                className="rounded-[2.5rem] bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/10 text-center"
              >
                <span className="material-symbols-outlined text-primary mb-2 text-2xl">{stat.icon}</span>
                <p className="font-label text-[10px] uppercase tracking-widest text-outline font-bold truncate">{stat.label}</p>
                <p className="font-headline text-2xl font-bold text-primary">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Content Area */}

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === 'performance' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-2"
        >
          {activeTab === 'performance' && (
            <>
              {/* Biomechanical Breakdown - Elevated & Full Width */}
              <div className="lg:col-span-2 space-y-8">
                <div className="rounded-[3rem] bg-surface-container-low p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <h2 className="font-headline text-2xl font-bold text-primary">Biomechanical Breakdown</h2>
                      <p className="font-label text-[10px] uppercase tracking-widest text-outline">High-Resolution Joint Analysis</p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-4 py-1">
                      <span className="font-headline text-[10px] font-bold text-primary uppercase">Deep Dive Mode</span>
                    </div>
                  </div>

                  {/* Global Attempt Selector (Timeline) */}
                  <div className="relative mb-8 flex items-center border-b border-outline-variant/10 pb-4">
                    {timeline.length > 4 && (
                      <button
                        onClick={() => scrollTimeline('left')}
                        className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-md text-primary hover:bg-primary hover:text-on-primary transition-all border border-outline-variant/20"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                      </button>
                    )}

                    <div
                      ref={timelineRef}
                      className={`flex items-center gap-3 overflow-x-auto no-scrollbar w-full scroll-smooth ${timeline.length > 4 ? 'px-12' : 'px-2'}`}
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {/* ALL Option First */}
                      <button
                        onClick={() => setSelectedAttemptIndex(-1)}
                        className={`flex-shrink-0 rounded-full px-8 py-2 font-headline text-xs font-bold transition-all mb-2 ${selectedAttemptIndex === -1
                          ? 'bg-primary text-on-primary shadow-lg scale-105'
                          : 'bg-surface-container-highest text-outline hover:bg-surface-container-high'
                          }`}
                      >
                        ALL
                      </button>

                      {timeline.map((move, idx) => (
                        <button
                          key={move.id}
                          onClick={() => setSelectedAttemptIndex(idx)}
                          className={`flex-shrink-0 rounded-full px-6 py-2 font-headline text-xs font-bold transition-all mb-2 border ${selectedAttemptIndex === idx
                            ? 'bg-primary text-on-primary shadow-lg scale-105 border-transparent'
                            : move.status === 'success'
                              ? 'bg-success/10 text-success border-success/20 hover:bg-success/20'
                              : move.status === 'failed'
                                ? 'bg-error/10 text-error border-error/20 hover:bg-error/20'
                                : 'bg-surface-container-highest text-outline border-outline-variant/10 hover:bg-surface-container-high'
                            }`}
                        >
                          {move.label}
                        </button>
                      ))}
                    </div>

                    {timeline.length > 4 && (
                      <button
                        onClick={() => scrollTimeline('right')}
                        className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-md text-primary hover:bg-primary hover:text-on-primary transition-all border border-outline-variant/20"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                      </button>
                    )}
                  </div>

                  {/* Selected Attempt Summary */}
                  <div className="mb-12 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-3xl bg-surface-container-lowest p-5 border border-outline-variant/10">
                      <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-1 font-bold">Status</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${selectedAttemptIndex === -1 ? 'bg-primary' : (timeline[selectedAttemptIndex]?.status === 'success' ? 'bg-success' : 'bg-error')}`} />
                        <p className="font-headline text-xl font-bold capitalize text-primary">
                          {selectedAttemptIndex === -1 ? 'Full Session' : (timeline[selectedAttemptIndex]?.status || 'Unknown')}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-3xl bg-surface-container-lowest p-5 border border-outline-variant/10">
                      <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-1 font-bold">Quality</p>
                      <p className="font-headline text-xl font-bold text-primary">
                        {selectedAttemptIndex === -1
                          ? `${Math.round(session.average_accuracy)}%`
                          : (timeline[selectedAttemptIndex]?.status === 'success'
                            ? `${session.reps.find(r => r.id === timeline[selectedAttemptIndex].repId)?.quality_score || 'N/A'}%`
                            : 'N/A')}
                      </p>
                    </div>
                    <div className="md:col-span-2 rounded-3xl bg-surface-container-lowest p-5 border border-outline-variant/10">
                      <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-1 font-bold">Analysis</p>
                      <p className="font-body text-sm font-medium text-on-surface-variant">
                        {selectedAttemptIndex === -1
                          ? 'Reviewing entire session kinematics for consistency and rhythm.'
                          : (timeline[selectedAttemptIndex]?.status === 'failed'
                            ? `Reason: ${timeline[selectedAttemptIndex]?.reason}`
                            : timeline[selectedAttemptIndex]?.status === 'canceled'
                              ? `Canceled: ${timeline[selectedAttemptIndex]?.reason || 'Posture deviation detected.'}`
                              : 'Movement executed with optimal alignment and control.')}
                      </p>
                    </div>
                  </div>


                  {/* Joint Charts Loop */}
                  {chartGroups.length > 0 ? (
                    chartGroups.map((group, gIdx) => {
                      const isRhythm = group.name === 'Movement Rhythm';
                      const isAll = selectedAttemptIndex === -1;

                      // Special data handling for Rhythm
                      const chartData = (isRhythm && isAll) ? session.reps : kinematicsData;
                      const xKey = (isRhythm && isAll) ? 'rep_number' : 'frame';
                      const yKey = (isRhythm && isAll) ? 'duration_seconds' : group.joints[0];
                      const xLabel = (isRhythm && isAll) ? 'Rep Number' : 'Movement Frame';
                      const yLabel = isRhythm ? 'Pace / Time (s)' : 'Angle (Deg)';

                      return (
                        <motion.div
                          key={group.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: gIdx * 0.1 }}
                          className="rounded-[2.5rem] bg-surface-container-lowest p-8 border border-outline-variant/10 mb-8"
                        >
                          <div className="mb-6 flex items-center justify-between">
                            <div>
                              <h3 className="font-headline text-xl font-bold text-primary">{group.name}</h3>
                              <p className="font-label text-[10px] uppercase text-outline">
                                {isRhythm ? 'Rhythm & Consistency' : (group.isBilateral ? 'Bilateral Comparison' : 'Mechanical Range')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {!isRhythm && group.joints.map((j, jIdx) => {
                                const isLeft = j.startsWith('l') || j.startsWith('left');
                                const isRight = j.startsWith('r') || j.startsWith('right');
                                const color = group.isBilateral
                                  ? (isLeft ? SYMMETRY_COLORS.left : (isRight ? SYMMETRY_COLORS.right : JOINT_COLORS[(gIdx + jIdx) % JOINT_COLORS.length]))
                                  : JOINT_COLORS[(gIdx + jIdx) % JOINT_COLORS.length];

                                return (
                                  <div key={j} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                );
                              })}
                              {isRhythm && <div className="h-2 w-2 rounded-full bg-secondary" />}
                            </div>
                          </div>

                          <div className="h-[450px] w-full overflow-x-auto custom-scrollbar pb-4">
                            <div className="min-w-[700px] w-full h-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 40, bottom: 100 }}>
                                <defs>
                                  {isRhythm ? (
                                    <linearGradient id="grad-rhythm" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#256b8b" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="#256b8b" stopOpacity={0} />
                                    </linearGradient>
                                  ) : (
                                    group.joints.map((jointName, jIdx) => {
                                      const color = group.isBilateral ? (jIdx === 0 ? SYMMETRY_COLORS.left : SYMMETRY_COLORS.right) : JOINT_COLORS[jIdx % JOINT_COLORS.length];
                                      return (
                                        <linearGradient key={`grad-${gIdx}-${jointName}`} id={`grad-${gIdx}-${jointName}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={color === '#003366' ? '#256b8b' : color} stopOpacity={0.2} />
                                          <stop offset="95%" stopColor={color === '#003366' ? '#256b8b' : color} stopOpacity={0} />
                                        </linearGradient>
                                      );
                                    })
                                  )}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.1} />
                                <XAxis
                                  dataKey={xKey}
                                  axisLine={false}
                                  tickLine={false}
                                  ticks={!isRhythm ? axisTicks : undefined}
                                  tick={!isRhythm ? <BottomXAxisTick /> : { fill: 'var(--color-outline)', fontSize: 10, fontWeight: 600 }}
                                  label={isRhythm ? { value: xLabel, position: 'insideBottom', offset: -5, fontSize: 10, fill: 'var(--color-outline)' } : undefined}
                                />
                                {!isRhythm && (
                                  <XAxis
                                    xAxisId="top"
                                    dataKey={xKey}
                                    orientation="top"
                                    axisLine={false}
                                    tickLine={false}
                                    ticks={axisTicks}
                                    tick={<TopXAxisTick />}
                                  />
                                )}
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fill: 'var(--color-outline)', fontSize: 10, fontWeight: 600 }}
                                  label={{ value: yLabel, angle: -90, position: 'outside', offset: -20, fontSize: 10, fill: 'var(--color-outline)', fontWeight: 800 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: '24px',
                                    border: 'none',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                    backgroundColor: 'var(--color-surface-container-lowest)',
                                    padding: '16px'
                                  }}
                                />
                                <Brush
                                  dataKey={xKey}
                                  height={30}
                                  stroke="#003366"
                                  fill="var(--color-surface-container-low)"
                                  alwaysShowText={false}
                                  travellerWidth={12}
                                />
                                {isRhythm ? (
                                  <Area
                                    type="monotone"
                                    dataKey={yKey}
                                    stroke="#003366"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#grad-rhythm)"
                                    dot={isAll ? { r: 4, fill: '#003366' } : false}
                                  />
                                ) : (
                                  group.joints.map((jointName, jIdx) => {
                                    const color = group.isBilateral ? (jIdx === 0 ? SYMMETRY_COLORS.left : SYMMETRY_COLORS.right) : JOINT_COLORS[jIdx % JOINT_COLORS.length];
                                    return (
                                      <Area
                                        key={jointName}
                                        type="monotone"
                                        dataKey={jointName}
                                        stroke={color}
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill={`url(#grad-${gIdx}-${jointName})`}
                                        dot={false}
                                      />
                                    );
                                  })
                                )}


                                {/* Reference lines and Pills for markers (only for frame-based analysis) */}
                                {!isRhythm && allMarkers && (
                                  <>
                                    {allMarkers.map((m, mIdx) => (
                                      <React.Fragment key={mIdx}>
                                        {/* Start and End frames: Solid and darker */}
                                        <ReferenceLine x={m.start} stroke="var(--color-outline)" strokeWidth={1} strokeOpacity={0.8} />
                                        <ReferenceLine x={m.end} stroke="var(--color-outline)" strokeWidth={1} strokeOpacity={0.8} />

                                        {/* Mid frame: Dotted for peak visibility */}
                                        <ReferenceLine x={m.mid} stroke="var(--color-primary)" strokeDasharray="4 4" strokeWidth={1.5} />

                                        {/* Rep Background Area */}
                                        <ReferenceArea
                                          x1={m.start}
                                          x2={m.end}
                                          fill="#003366"
                                          fillOpacity={0.09}
                                        />

                                        {/* Inter-rep Gap: Shaded Light Red */}
                                        {mIdx < allMarkers.length - 1 && (
                                          <ReferenceArea
                                            x1={m.end}
                                            x2={allMarkers[mIdx + 1].start}
                                            fill="var(--color-error)"
                                            fillOpacity={0.07}
                                          />
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </>
                                )}
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="flex h-[400px] flex-col items-center justify-center text-outline opacity-50 px-12 text-center">
                      <span className="material-symbols-outlined text-7xl mb-4">biometrics</span>
                      <p className="font-headline text-lg font-bold">Biomechanical Sync Pending</p>
                      <p className="font-body text-sm max-w-md">
                        {timeline[selectedAttemptIndex]?.status === 'failed'
                          ? 'Biomechanical data was not captured for this historical failed attempt. All new attempts will include full diagnostic charting.'
                          : 'Select a repetition to view high-resolution joint analysis.'}
                      </p>
                    </div>
                  )}

                  {/* Form Flaws Distribution Chart */}
                  <div className="rounded-[2.5rem] bg-surface-container-lowest p-8 border border-outline-variant/10 mb-8">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <h3 className="font-headline text-xl font-bold text-primary">Form Flaw Distribution</h3>
                        <p className="font-label text-[10px] uppercase tracking-widest text-outline">Frequency Analysis per Repetition</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#003366' }}></div>
                          <span className="font-label text-[9px] uppercase font-black text-outline">Detected Flaws</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-[400px] w-full overflow-x-auto custom-scrollbar pb-4">
                      <div className="min-w-[500px] w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={flawData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                          <defs>
                            <linearGradient id="flaw-grad-blue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#256b8b" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#256b8b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.1} />
                          <XAxis
                            dataKey="rep"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-outline)', fontSize: 10, fontWeight: 800 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-outline)', fontSize: 10, fontWeight: 800 }}
                            allowDecimals={false}
                            label={{ value: 'Number of Flaws', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--color-outline)', fontWeight: 800 }}
                          />
                          <Tooltip
                            content={<FlawTooltip />}
                            cursor={{ fill: '#003366', opacity: 0.05 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#003366"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#flaw-grad-blue)"
                            dot={{ r: 6, stroke: '#003366', strokeWidth: 2, fill: 'var(--color-surface-container-lowest)' }}
                            activeDot={{ r: 8, stroke: '#003366', strokeWidth: 2, fill: '#003366' }}
                            animationDuration={1500}
                          />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </>
          )} {activeTab === 'attempts' && (
            <div className="lg:col-span-2 space-y-8">
              {/* Attempt Log - Full Width when in tab */}
              <div className="rounded-[3rem] bg-surface-container-low p-8">
                <h2 className="mb-8 font-headline text-2xl font-bold text-primary">Session Attempt History</h2>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                  {session.attempts.length === 0 ? (
                    <p className="font-body text-on-surface-variant italic">No setup attempts recorded.</p>
                  ) : (
                    session.attempts.map((attempt, index) => {
                      const associatedRep = session.reps?.find(r => r.attempt_id === attempt.id);
                      const attemptFrames = frames.filter(f => f.rep_id === attempt.id);
                      const hasReplay = attempt.status === 'success' && attemptFrames.length > 0;

                      return (
                        <div key={attempt.id} className="flex flex-col gap-4 rounded-[2rem] bg-surface-container-lowest p-6 transition-all border border-outline-variant/5 hover:border-outline-variant/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${attempt.status === 'success' ? 'bg-secondary-container text-secondary' :
                                attempt.status === 'canceled' ? 'bg-tertiary-fixed text-tertiary' : 'bg-error-container text-error'
                                }`}>
                                <span className="material-symbols-outlined">
                                  {attempt.status === 'success' ? 'check_circle' :
                                    attempt.status === 'canceled' ? 'cancel' : 'error'}
                                </span>
                              </div>
                              <div>
                                <p className="font-headline text-lg font-bold text-primary leading-tight">
                                  {attempt.reason || (attempt.status === 'success' ? 'Movement Detected' : 'Unknown reason')}
                                </p>
                                <p className={`font-label text-[10px] uppercase font-bold tracking-widest ${attempt.status === 'success' ? 'text-secondary' :
                                  attempt.status === 'canceled' ? 'text-outline' : 'text-error'
                                  }`}>
                                  {attempt.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {hasReplay && (
                                <button
                                  onClick={() => setActiveReplayId(activeReplayId === attempt.id ? null : attempt.id)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                                    activeReplayId === attempt.id 
                                      ? 'bg-surface-container-high text-primary' 
                                      : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-sm">{activeReplayId === attempt.id ? 'close' : 'play_circle'}</span>
                                  {activeReplayId === attempt.id ? 'Close Replay' : 'View Replay'}
                                </button>
                              )}
                              <span className="font-body text-xs text-outline">
                                {formatTime(attempt.created_at)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Replay Container */}
                          {activeReplayId === attempt.id && hasReplay && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-center overflow-hidden"
                            >
                              <div className="w-full max-w-2xl bg-black rounded-3xl p-4 shadow-2xl">
                                <SkeletonReplay 
                                  exerciseName={session.exercise_name}
                                  frames={attemptFrames} 
                                  angles={angles.filter(a => a.rep_id === attempt.id)}
                                  defaultShowAngles={globalShowAngles}
                                  onToggleAngles={setGlobalShowAngles}
                                  repTiming={{
                                    start: associatedRep?.start_frame_time,
                                    top: associatedRep?.top_frame_time,
                                    end: associatedRep?.end_frame_time
                                  }}
                                  feedback={`Rep ${index + 1} - ${attempt.reason || (attempt.status === 'success' ? 'Completed' : 'Failed')}`}
                                  width={800} 
                                  height={450} 
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'replay' && sessionReplay.activeAttempts.length > 0 && (
            <div className="lg:col-span-2 space-y-8">
              <div className="w-full max-w-4xl mx-auto bg-surface-container rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/20 flex flex-col">
                <div className="p-4 bg-surface-container-high flex items-center justify-between border-b border-outline-variant/20">
                  <div className="flex items-center gap-4">
                    <span className="font-headline font-bold text-lg text-primary">
                      Session Replay
                    </span>
                    <span className="px-3 py-1 bg-cyan-500/10 text-cyan-600 rounded-full text-xs font-bold uppercase tracking-widest">
                      Rep {sessionReplay.currentAttemptIndex + 1} of {sessionReplay.activeAttempts.length}
                    </span>
                  </div>
                </div>
                
                <div 
                  className="flex-1 bg-[#1e232b] relative flex flex-col items-center justify-center p-4 min-h-[500px]"
                  style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                >
                  {!sessionReplay.isComplete ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center">
                        <SkeletonReplay
                          exerciseName={session.exercise_name}
                          frames={frames.filter(f => f.rep_id === sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].id)}
                          angles={angles.filter(a => a.rep_id === sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].id)}
                          defaultShowAngles={globalShowAngles}
                          onToggleAngles={setGlobalShowAngles}
                          repTiming={{
                            start: session.reps?.find(r => r.attempt_id === sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].id)?.start_frame_time,
                            top: session.reps?.find(r => r.attempt_id === sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].id)?.top_frame_time,
                            end: session.reps?.find(r => r.attempt_id === sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].id)?.end_frame_time
                          }}
                          feedback={`Rep ${sessionReplay.currentAttemptIndex + 1} - ${sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].reason || (sessionReplay.activeAttempts[sessionReplay.currentAttemptIndex].status === 'success' ? 'Completed' : 'Failed')}`}
                          width={800}
                          height={450}
                          autoPlay={true}
                          onComplete={playNextSessionRep}
                          onNext={sessionReplay.currentAttemptIndex < sessionReplay.activeAttempts.length - 1 ? () => {
                            setSessionReplay(prev => ({ ...prev, currentAttemptIndex: prev.currentAttemptIndex + 1 }));
                          } : undefined}
                          onPrev={sessionReplay.currentAttemptIndex > 0 ? () => {
                            setSessionReplay(prev => ({ ...prev, currentAttemptIndex: prev.currentAttemptIndex - 1 }));
                          } : undefined}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-6 py-20">
                      <span className="material-symbols-outlined text-6xl text-cyan-500">task_alt</span>
                      <h2 className="text-2xl font-headline font-bold text-white">Session Replay Complete</h2>
                      <button 
                        onClick={() => setSessionReplay(prev => ({ ...prev, currentAttemptIndex: 0, isComplete: false }))}
                        className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold uppercase tracking-widest hover:bg-cyan-400 transition-colors"
                      >
                        <span className="material-symbols-outlined">replay</span>
                        Replay Sequence
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.section>
    </main>
  );
}
