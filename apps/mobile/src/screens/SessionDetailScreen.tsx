import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  FlatList,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { Colors, Spacing, Radii } from '../theme';
import { API_BASE_URL } from '../config';

type Rep = {
  id: string;
  rep_number: number;
  quality_score: number;
  duration_seconds: number;
  status: string;
  attempt_id?: string;
};

type Attempt = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
};

type Deviation = {
  id: string;
  rep_id: string;
  deviation_type: string;
  feedback_message: string;
  severity: string;
  frame_number: number;
};

type SessionDetail = {
  id: string;
  exercise_name: string;
  exercise_category?: string;
  exercise_subcategory?: string;
  start_time: string;
  end_time: string | null;
  total_reps: number;
  average_accuracy: number | string;
  total_duration_seconds: number;
  status: string;
  reps: Rep[];
  attempts: Attempt[];
  deviations: Deviation[];
};

type Analytic = {
  name: string;
  value: string | number;
  frame_number: number;
  rep_id: string;
};

export function SessionDetailScreen({ route, navigation }: any) {
  const { sessionId } = route.params;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [analytics, setAnalytics] = useState<Analytic[]>([]);
  const [activeTab, setActiveTab] = useState<'analysis' | 'log'>('analysis');
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const timelineRef = useRef<ScrollView>(null);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Session Summary (Reps, Attempts, Deviations)
      const resSession = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
      if (!resSession.ok) throw new Error('Session not found');
      const dataSession = await resSession.json();
      setSession(dataSession);

      // 2. Fetch Time-Series Analytics
      const resAnalytics = await fetch(`${API_BASE_URL}/sessions/${sessionId}/analytics`);
      if (resAnalytics.ok) {
        const dataAnalytics = await resAnalytics.json();
        setAnalytics(dataAnalytics);
      }
    } catch (err) {
      console.error(err);
      setError('Could not retrieve workout details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatAccuracy = (accuracy: any) => {
    if (accuracy === null || accuracy === undefined) return 'N/A';
    const val = parseFloat(accuracy);
    const pct = val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
    return `${pct}%`;
  };

  const formatJointName = (name: string) => {
    switch (name) {
      case 'kneeAngle': return 'Knee Flexion';
      case 'torsoAngle': return 'Torso Lean';
      case 'footTilt': return 'Foot Tilt';
      case 'valgusRatio': return 'Knee Valgus Ratio';
      case 'torsoRatio': return 'Torso Ratio';
      case 'rFootAngle': return 'Right Foot Angle';
      case 'lFootAngle': return 'Left Foot Angle';
      case 'symmetry': return 'Bilateral Symmetry';
      case 'stanceRatio': return 'Stance Width Ratio';
      default: return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
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

  const jointNames = useMemo(() => {
    if (!analytics || !analytics.length) return [];
    const names = analytics
      .map(a => a?.name)
      .filter(n => typeof n === 'string' && n.trim().length > 0) as string[];
    return Array.from(new Set(names));
  }, [analytics]);

  const chartGroups = useMemo(() => {
    if (!jointNames || !jointNames.length) return [];

    const groups: { name: string, joints: string[], isBilateral: boolean }[] = [];
    const processed = new Set<string>();

    jointNames.forEach(name => {
      try {
        if (!name || typeof name !== 'string') return;
        if (processed.has(name)) return;
        
        let partnerName = '';
        let baseDisplayName = '';
        
        const isLStart = name.charAt(0) === 'l' && name.indexOf('left') !== 0;
        const isLeftStart = name.indexOf('left') === 0;

        if (isLStart && jointNames.indexOf('r' + name.substring(1)) !== -1) {
          partnerName = 'r' + name.substring(1);
          baseDisplayName = name.substring(1).replace(/([A-Z])/g, ' $1').trim();
        } else if (isLeftStart && jointNames.indexOf(name.replace('left', 'right')) !== -1) {
          partnerName = name.replace('left', 'right');
          baseDisplayName = name.replace('left', '').replace(/([A-Z])/g, ' $1').trim();
        }

        if (partnerName) {
          groups.push({ name: `${baseDisplayName} Symmetry`, joints: [name, partnerName], isBilateral: true });
          processed.add(name);
          processed.add(partnerName);
        }
      } catch (err) {
        console.warn('Error processing joint name:', name, err);
      }
    });

    jointNames.forEach(name => {
      try {
        if (!name || typeof name !== 'string') return;
        if (!processed.has(name)) {
          groups.push({ name: formatJointName(name), joints: [name], isBilateral: false });
        }
      } catch (err) {
        console.warn('Error formatting joint name:', name, err);
      }
    });

    groups.push({ name: 'Movement Rhythm', joints: ['tempo'], isBilateral: false });
    return groups;
  }, [jointNames]);

  const processedKinematics = useMemo(() => {
    if (!analytics.length || !session || !jointNames.length) return { data: [], tickMap: new Map<number, string>() };

    const isAll = selectedAttemptIndex === -1;

    if (!isAll) {
      const selectedAttempt = timeline[selectedAttemptIndex];
      if (!selectedAttempt) return { data: [], tickMap: new Map<number, string>() };

      const filteredAnalytics = analytics.filter(a =>
        a.rep_id === selectedAttempt.id || (selectedAttempt.repId && a.rep_id === selectedAttempt.repId)
      );

      const framesMap = new Map();
      filteredAnalytics.forEach(a => {
        if (!framesMap.has(a.frame_number)) {
          framesMap.set(a.frame_number, { frame: a.frame_number });
        }
        framesMap.get(a.frame_number)[a.name] = parseFloat(a.value as string);
      });

      const sortedData = Array.from(framesMap.values()).sort((a, b) => a.frame - b.frame);
      const start = sortedData.length ? sortedData[0].frame : 0;
      
      const dataWithTempo = sortedData.map((d) => ({ ...d, tempo: (d.frame - start) / 30 }));
      const tickMap = new Map<number, string>();
      if (sortedData.length > 0) {
        tickMap.set(sortedData[0].frame, 'START');
        tickMap.set(sortedData[Math.floor(sortedData.length / 2)].frame, 'MID');
        tickMap.set(sortedData[sortedData.length - 1].frame, 'END');
      }

      return { data: dataWithTempo, tickMap };
    } else {
      let globalOffset = 0;
      const allData: any[] = [];
      const tickMap = new Map<number, string>();

      timeline.forEach((move, idx) => {
        const moveIds = new Set([String(move.id), move.repId ? String(move.repId) : null].filter(Boolean));
        const moveAngles = analytics.filter(a => moveIds.has(String(a.rep_id)));
        if (moveAngles.length === 0) return;

        const framesMap = new Map();
        moveAngles.forEach(a => {
          const fNum = a.frame_number;
          if (!framesMap.has(fNum)) framesMap.set(fNum, { _orig: fNum });
          framesMap.get(fNum)[a.name] = parseFloat(a.value as string);
        });

        const sortedMoveFrames = Array.from(framesMap.values()).sort((a, b) => a._orig - b._orig);
        const startOrig = sortedMoveFrames[0]?._orig || 0;

        const mappedMoveData = sortedMoveFrames.map((d, dIdx) => ({
          ...d,
          frame: globalOffset + dIdx,
          tempo: (d._orig - startOrig) / 30
        }));

        if (mappedMoveData.length > 0) {
          tickMap.set(mappedMoveData[0].frame, `${mappedMoveData[0].frame}`);
          tickMap.set(mappedMoveData[Math.floor(mappedMoveData.length / 2)].frame, `Rep ${idx + 1}`);
        }

        allData.push(...mappedMoveData);
        globalOffset += mappedMoveData.length + 20;
      });

      return { data: allData, tickMap };
    }
  }, [analytics, timeline, selectedAttemptIndex, session, jointNames]);

  // Filtered deviations / flaws
  const filteredDeviations = useMemo(() => {
    if (!session) return [];
    
    // Filter out informational or system notifications
    const getCloserDevs = (devs: Deviation[]) => {
      return devs.filter(d => {
        const msg = (d.feedback_message || '').toLowerCase();
        const isSequence = msg.includes('ready') || msg.includes('going down') || msg.includes('now up') || msg.includes('calibration');
        return !isSequence && d.severity !== 'info';
      });
    };

    if (selectedAttemptIndex === -1) {
      return getCloserDevs(session.deviations);
    } else {
      const selectedAttempt = timeline[selectedAttemptIndex];
      const moveIds = [selectedAttempt.id, selectedAttempt.repId].filter(Boolean);
      return getCloserDevs(session.deviations.filter(d => moveIds.includes(d.rep_id)));
    }
  }, [session, timeline, selectedAttemptIndex]);

  const flawData = useMemo(() => {
    if (!session) return [];
    const data = session.attempts.map((attempt, index) => {
      const deviations = session.deviations.filter(d => {
        if (d.rep_id !== attempt.id) return false;

        const msg = (d.feedback_message || '').toLowerCase();
        const severity = (d.severity || '').toLowerCase();

        const isSequenceCue =
          msg.includes('ready') || msg.includes('going down') || msg.includes('great depth') ||
          msg.includes('now up') || msg.includes('now down') || msg.includes('hold still') ||
          msg.includes('calibration') || msg.includes('searching for') || msg.includes('stance locked') ||
          msg.includes('hold stance') || msg.includes('stay still') || msg.includes('sitting into') ||
          msg.includes('sitting back') || msg.includes('driving back up') || msg.includes('push through heels') ||
          msg.includes('drive through heels') || msg.includes('step one leg forward') || msg.includes('stand sideways') ||
          msg.includes('widen your stance') || msg.includes('feet too wide') || msg.includes('turn toes outward') ||
          msg.includes('toes out too far') || msg.includes('take a wider step');

        if (isSequenceCue) return false;
        if (severity === 'info') return false;

        return true;
      });

      const labels = Array.from(new Set(deviations.map(d => d.feedback_message)));

      if (attempt.status === 'failed' && labels.length === 0 && attempt.reason) {
        const reasons = attempt.reason.split(' & ').filter(r => r.trim().length > 0);
        labels.push(...reasons);
      }

      return {
        label: `Rep ${index + 1}`,
        value: labels.length,
      };
    });

    if (data.length === 0) {
      return [{ label: 'Rep 1', value: 0 }];
    }
    return data;
  }, [session]);

  const formatJointValue = (name: string, val: number) => {
    if (name.toLowerCase().includes('ratio') || name.toLowerCase().includes('symmetry')) {
      const pct = val <= 1 && val > 0 ? Math.round(val * 100) : Math.round(val);
      return `${pct}%`;
    }
    return `${Math.round(val)}°`;
  };

  const renderChartGroup = (group: { name: string, joints: string[], isBilateral: boolean }, gIdx: number) => {
    const isRhythm = group.name === 'Movement Rhythm';
    const isAll = selectedAttemptIndex === -1;
    
    const chartData = processedKinematics.data;
    if (!chartData || chartData.length === 0) return null;

    const data1 = chartData.map(d => ({ 
      value: isRhythm ? d.tempo : (d[group.joints[0]] || 0), 
      label: processedKinematics.tickMap.has(d.frame) ? processedKinematics.tickMap.get(d.frame) : ''
    }));

    let data2;
    if (group.isBilateral && group.joints.length > 1) {
      data2 = chartData.map(d => ({ value: d[group.joints[1]] || 0 }));
    }

    const color1 = group.isBilateral ? '#256b8b' : Colors.primary;
    const color2 = '#FF9500';

    return (
      <View key={group.name} style={styles.chartCard}>
        <Text style={styles.chartTitle}>{group.name}</Text>
        <Text style={styles.chartSubtitle}>
          {isRhythm ? 'Rhythm & Consistency' : (group.isBilateral ? 'Bilateral Comparison' : 'Mechanical Range')}
        </Text>
        
        <View style={styles.chartWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={{ paddingRight: 40, paddingBottom: 10 }}>
              <LineChart
                data={data1}
                data2={data2}
                areaChart
                curved
                startFillColor={color1}
                startFillColor2={color2}
                startOpacity={0.2}
                endOpacity={0}
                color={color1}
                color2={color2}
                hideRules
                xAxisColor={Colors.outlineVariant}
                yAxisColor={Colors.outlineVariant}
                yAxisTextStyle={{ color: Colors.outline, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: Colors.outline, fontSize: 10, width: 60, textAlign: 'center', marginLeft: -30 }}
                noOfSections={4}
                height={200}
                spacing={35}
                isAnimated
                thickness={2}
                dataPointsRadius={0}
                scrollToEnd
              />
            </View>
          </ScrollView>
        </View>
        
        {group.isBilateral && (
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color1 }]} />
              <Text style={styles.legendText}>Left Side</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color2 }]} />
              <Text style={styles.legendText}>Right Side</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading session analysis...</Text>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Session not found.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const flawless = filteredDeviations.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{session.exercise_name}</Text>
          <Text style={styles.headerSubtitle}>{formatDate(session.start_time)}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{session.exercise_category || 'Workout'}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'analysis' && styles.tabActive]}
          onPress={() => setActiveTab('analysis')}
        >
          <MaterialIcons name="analytics" size={20} color={activeTab === 'analysis' ? Colors.primary : Colors.outline} />
          <Text style={[styles.tabText, activeTab === 'analysis' && styles.tabTextActive]}>Analysis</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'log' && styles.tabActive]}
          onPress={() => setActiveTab('log')}
        >
          <MaterialIcons name="history-edu" size={20} color={activeTab === 'log' ? Colors.primary : Colors.outline} />
          <Text style={[styles.tabText, activeTab === 'log' && styles.tabTextActive]}>Attempts Log</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'analysis' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialIcons name="ads-click" size={20} color={Colors.primary} />
              <Text style={styles.statLabel}>Attempts</Text>
              <Text style={styles.statValue}>{session.attempts.length}</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="check-circle" size={20} color={Colors.secondary} />
              <Text style={styles.statLabel}>Accuracy</Text>
              <Text style={styles.statValue}>{formatAccuracy(session.average_accuracy)}</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="timer" size={20} color="#d35400" />
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{formatDuration(session.total_duration_seconds)}</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialIcons name="warning" size={20} color={Colors.error} />
              <Text style={styles.statLabel}>Flaws</Text>
              <Text style={styles.statValue}>{session.deviations.filter(d => d.severity !== 'info').length}</Text>
            </View>
          </View>

          {/* Rep Selector Timeline */}
          <Text style={styles.sectionTitle}>Movement Timeline</Text>
          <View style={styles.timelineWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              ref={timelineRef}
              contentContainerStyle={styles.timelineContainer}
            >
              <TouchableOpacity
                style={[styles.repButton, selectedAttemptIndex === -1 && styles.repButtonActive]}
                onPress={() => setSelectedAttemptIndex(-1)}
              >
                <Text style={[styles.repButtonText, selectedAttemptIndex === -1 && styles.repButtonTextActive]}>ALL</Text>
              </TouchableOpacity>
              {timeline.map((move, idx) => (
                <TouchableOpacity
                  key={move.id}
                  style={[
                    styles.repButton, 
                    selectedAttemptIndex === idx && styles.repButtonActive,
                    selectedAttemptIndex !== idx && move.status === 'success' && styles.repButtonSuccess,
                    selectedAttemptIndex !== idx && move.status === 'failed' && styles.repButtonFailed,
                  ]}
                  onPress={() => setSelectedAttemptIndex(idx)}
                >
                  <Text style={[
                    styles.repButtonText, 
                    selectedAttemptIndex === idx && styles.repButtonTextActive,
                    selectedAttemptIndex !== idx && move.status === 'success' && styles.repButtonTextSuccess,
                    selectedAttemptIndex !== idx && move.status === 'failed' && styles.repButtonTextFailed,
                  ]}>
                    {move.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Selected Rep Summary Card */}
          <View style={styles.selectedRepCard}>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.repCardTitle}>
                  {selectedAttemptIndex === -1 ? 'Full Session Summary' : `Repetition ${selectedAttemptIndex + 1}`}
                </Text>
                <Text style={styles.repCardSubtitle}>
                  {selectedAttemptIndex === -1 ? 'Average stats across all reps' : `Status: ${timeline[selectedAttemptIndex]?.status || 'completed'}`}
                </Text>
              </View>
              {selectedAttemptIndex !== -1 && (
                <View style={[
                  styles.statusBadge, 
                  timeline[selectedAttemptIndex]?.status === 'success' ? styles.badgeSuccess : styles.badgeFailed
                ]}>
                  <Text style={[
                    styles.badgeText,
                    timeline[selectedAttemptIndex]?.status === 'success' ? styles.badgeTextSuccess : styles.badgeTextFailed
                  ]}>
                    {timeline[selectedAttemptIndex]?.status}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.repReasonText}>
              {selectedAttemptIndex === -1 
                ? 'Reviewing full-session bio-mechanic performance parameters below.'
                : timeline[selectedAttemptIndex]?.status === 'failed'
                  ? `Failure reason: ${timeline[selectedAttemptIndex]?.reason || 'Incorrect posture detected.'}`
                  : 'Repetition successfully completed with correct form.'
              }
            </Text>
          </View>

          {/* Joint Biomechanics Charts */}
          {chartGroups.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Biomechanical Breakdown</Text>
              <View style={styles.analyticsSection}>
                {chartGroups.map((group, idx) => renderChartGroup(group, idx))}
              </View>
            </>
          )}

          {/* Form Flaws Distribution Chart */}
          <Text style={styles.sectionTitle}>Form Flaw Distribution</Text>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Detected Flaws</Text>
            <Text style={styles.chartSubtitle}>Frequency Analysis per Repetition</Text>
            <View style={styles.chartWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <View style={{ paddingRight: 40, paddingBottom: 10 }}>
                  <LineChart
                    data={flawData}
                    areaChart
                    startFillColor={Colors.error}
                    startOpacity={0.2}
                    endOpacity={0}
                    color={Colors.error}
                    hideRules
                    xAxisColor={Colors.outlineVariant}
                    yAxisColor={Colors.outlineVariant}
                    yAxisTextStyle={{ color: Colors.outline, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: Colors.outline, fontSize: 10, width: 60, textAlign: 'center', marginLeft: -30 }}
                    noOfSections={Math.max(1, Math.max(...flawData.map(d => Number(d.value) || 0)))}
                    height={200}
                    spacing={60}
                    isAnimated
                    thickness={3}
                    dataPointsRadius={4}
                    dataPointsColor={Colors.error}
                    scrollToEnd
                  />
                </View>
              </ScrollView>
            </View>
          </View>

        </ScrollView>
      ) : (
        /* Log List of Attempts */
        <FlatList
          data={timeline}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.logListContent}
          renderItem={({ item, index }) => (
            <View style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <Text style={styles.logRepNumber}>Attempt #{index + 1}</Text>
                <View style={[
                  styles.statusBadge, 
                  item.status === 'success' ? styles.badgeSuccess : styles.badgeFailed
                ]}>
                  <Text style={[
                    styles.badgeText,
                    item.status === 'success' ? styles.badgeTextSuccess : styles.badgeTextFailed
                  ]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.logReasonText}>
                {item.status === 'success' 
                  ? 'Successful movement attempt.' 
                  : `Feedback: ${item.reason || 'Incorrect form or alignment.'}`
                }
              </Text>
              <Text style={styles.logTimeText}>{new Date(item.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="history" size={48} color={Colors.outlineVariant} />
              <Text style={styles.emptyText}>No attempt logs found for this session.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.onSurfaceVariant,
    fontSize: 16,
  },
  errorText: {
    marginTop: Spacing.md,
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
  },
  backBtnText: {
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backIcon: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
  },
  tag: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    padding: 4,
    borderRadius: Radii.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.outline,
    marginLeft: 6,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.outline,
    textTransform: 'uppercase',
    marginTop: 6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  timelineWrapper: {
    marginVertical: Spacing.xs,
  },
  timelineContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  repButton: {
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  repButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: 'transparent',
  },
  repButtonSuccess: {
    backgroundColor: 'rgba(36, 105, 90, 0.1)',
    borderColor: 'rgba(36, 105, 90, 0.2)',
  },
  repButtonFailed: {
    backgroundColor: 'rgba(186, 26, 26, 0.1)',
    borderColor: 'rgba(186, 26, 26, 0.2)',
  },
  repButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.outline,
  },
  repButtonTextActive: {
    color: Colors.onPrimary,
  },
  repButtonTextSuccess: {
    color: Colors.secondary,
  },
  repButtonTextFailed: {
    color: Colors.error,
  },
  selectedRepCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  repCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  repCardSubtitle: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.round,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(36, 105, 90, 0.12)',
  },
  badgeFailed: {
    backgroundColor: 'rgba(186, 26, 26, 0.12)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  badgeTextSuccess: {
    color: Colors.secondary,
  },
  badgeTextFailed: {
    color: Colors.error,
  },
  repReasonText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  analyticsSection: {
    paddingHorizontal: Spacing.md,
  },
  jointCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  jointName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: Spacing.sm,
  },
  chartCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  chartSubtitle: {
    fontSize: 11,
    color: Colors.outline,
    marginBottom: Spacing.md,
  },
  chartWrapper: {
    marginTop: Spacing.sm,
    alignItems: 'center',
    marginLeft: -20,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: Colors.outline,
  },
  deviationsSection: {
    paddingHorizontal: Spacing.md,
  },
  perfectFormCard: {
    backgroundColor: 'rgba(36, 105, 90, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(36, 105, 90, 0.15)',
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  perfectFormTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginTop: Spacing.sm,
  },
  perfectFormSubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
  deviationCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(186, 26, 26, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.1)',
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  devIcon: {
    marginRight: Spacing.sm,
  },
  devInfo: {
    flex: 1,
  },
  devMsg: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  devSub: {
    fontSize: 11,
    color: Colors.outline,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  logListContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  logCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logRepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.onSurface,
  },
  logReasonText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  logTimeText: {
    fontSize: 10,
    color: Colors.outline,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: Colors.outline,
  },
});
