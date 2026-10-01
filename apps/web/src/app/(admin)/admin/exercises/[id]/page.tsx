'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PhaseConfigurator, RuleConfig, ConfigTab } from '../builder/components/PhaseConfigurator';
import { VideoExtractor, TelemetryFrame } from '../builder/components/VideoExtractor';
import { MetricExtractModal, MetricItem } from '../builder/components/MetricExtractModal';
import { MetricSelectionPanel } from '../builder/components/MetricSelectionPanel';
import {
  DynamicRule,
  PoseData,
  predictMetricOperatorAndBuffer
} from '@workout/shared';

export default function EditExerciseRulesPage() {
  const params = useParams();
  const router = useRouter();
  const [exercise, setExercise] = useState<any>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [category, setCategory] = useState('AI Generated');
  const [subcategory, setSubcategory] = useState('');
  const [cameraAngle, setCameraAngle] = useState('FRONT');
  const [imagePath, setImagePath] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [phasesConfig, setPhasesConfig] = useState<Record<string, { entryConditions: RuleConfig[], formChecks: RuleConfig[], isSetupPhase?: boolean, entryCue?: string, entryCueEnabled?: boolean }>>({});
  const [loading, setLoading] = useState(true);

  // To allow navigating phases without a timeline
  const [activePhaseName, setActivePhaseName] = useState<string | null>(null);

  // Video Assistant Sub-tab & Persistent Selected Metrics
  const [configTab, setConfigTab] = useState<ConfigTab>('transitions');
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>(['KNEE_ANGLE', 'HIP_HINGE_ANGLE']);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const id = params?.id as string;
        const saved = (id && localStorage.getItem(`visionfit_exercise_${id}_metrics`)) || localStorage.getItem('visionfit_builder_selected_metrics');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedMetricKeys(parsed);
          }
        }
      } catch (e) {}
    }
  }, [params?.id]);

  const toggleSelectedMetricKey = (key: string) => {
    setSelectedMetricKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (typeof window !== 'undefined') {
        try {
          const id = params?.id as string;
          if (id) localStorage.setItem(`visionfit_exercise_${id}_metrics`, JSON.stringify(next));
          localStorage.setItem('visionfit_builder_selected_metrics', JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const clearSelectedMetricKeys = () => {
    setSelectedMetricKeys([]);
    if (typeof window !== 'undefined') {
      try {
        const id = params?.id as string;
        if (id) localStorage.setItem(`visionfit_exercise_${id}_metrics`, JSON.stringify([]));
        localStorage.setItem('visionfit_builder_selected_metrics', JSON.stringify([]));
      } catch (e) {}
    }
  };

  // Metric Extraction Modal State
  const [availableMetrics, setAvailableMetrics] = useState<MetricItem[]>([]);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [currentExtractPose, setCurrentExtractPose] = useState<PoseData | null>(null);
  const [previousExtractPose, setPreviousExtractPose] = useState<PoseData | null>(null);
  const [previousMarkerLabel, setPreviousMarkerLabel] = useState<string>('');

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableMetrics(data.map((m: any) => ({
            metric_key: m.metric_key,
            metric_name: m.metric_name || m.name || m.metric_key,
            name: m.metric_name || m.name || m.metric_key,
            description: m.description,
            min_val: m.min_val,
            max_val: m.max_val,
            category: m.category,
            unit: m.unit
          })));
        }
      })
      .catch(err => console.error("Failed to load metrics library", err));
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: 'flame' | 'err';
    hideCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const showAlert = (message: string, isError = false) => {
    return new Promise<void>((resolve) => {
      setConfirmModal({
        isOpen: true,
        title: isError ? 'Error' : 'Message',
        hideCancel: true,
        message,
        confirmText: 'OK',
        confirmStyle: isError ? 'err' : 'flame',
        onConfirm: () => {
          setConfirmModal(null);
          resolve();
        }
      });
    });
  };

  // Video Assistant State
  const [telemetry, setTelemetry] = useState<TelemetryFrame[]>([]);
  const [markers, setMarkers] = useState<{id: string, timeMs: number, label: string}[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [showVideoAssistant, setShowVideoAssistant] = useState(true);

  const handleExtractionComplete = (data: TelemetryFrame[]) => {
    setTelemetry(data);
  };

  const handleAddMarker = (timeMs: number) => {
    const newName = `Phase ${Object.keys(phasesConfig).length + 1}`;
    const newMarker = { id: newName, timeMs, label: newName };
    setMarkers([...markers, newMarker]);
    setPhasesConfig(prev => ({ ...prev, [newName]: { entryConditions: [], formChecks: [] } }));
    setActivePhaseName(newName);
    setConfigTab('transitions');
  };

  const handleRemoveMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id));
    if (activePhaseName === id) {
      const remaining = Object.keys(phasesConfig).filter(n => n !== id);
      setActivePhaseName(remaining.length > 0 ? remaining[0] : null);
    }
    setPhasesConfig(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleAutoMagicExtract = () => {
    if (!showVideoAssistant) {
      // MANUAL MODE: Add selected metrics directly into active phase without video
      if (!activePhaseName || !phasesConfig[activePhaseName]) {
        showAlert("Please select a phase from the tabs above before adding metrics.", true);
        return;
      }

      if (selectedMetricKeys.length === 0) {
        setConfigTab('metrics');
        showAlert("No metrics are selected! Please select at least one metric from the list below.", true);
        return;
      }

      const generatedRules: RuleConfig[] = selectedMetricKeys.map(key => {
        const meta = availableMetrics.find(m => m.metric_key === key);
        const min = meta?.min_val !== undefined ? Number(meta.min_val) : 0;
        const max = meta?.max_val !== undefined ? Number(meta.max_val) : 180;
        const defaultVal = Math.round(((min + max) / 2) * 10) / 10;
        return {
          id: `rule_${key}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          metric: key,
          operator: '<',
          value: defaultVal,
          isBlocking: true
        };
      });

      setPhasesConfig(prev => {
        const currentPhase = prev[activePhaseName] || { entryConditions: [], formChecks: [] };
        const existing = (currentPhase.entryConditions || []).filter(e => !selectedMetricKeys.includes(e.metric));
        return {
          ...prev,
          [activePhaseName]: {
            ...currentPhase,
            entryConditions: [...existing, ...generatedRules]
          }
        };
      });

      setConfigTab('transitions');
      showAlert(`Successfully added ${generatedRules.length} metric(s) to ${activePhaseName}! You can now adjust their operators and values below.`, false);
      return;
    }

    if (telemetry.length === 0) {
      showAlert("Please run 'Full Frame Extraction' on the video first so we have the 3D data!", true);
      return;
    }

    if (!activePhaseName || !phasesConfig[activePhaseName]) {
      showAlert("Please select a phase marker first before extracting metrics.", true);
      return;
    }

    if (selectedMetricKeys.length === 0) {
      setConfigTab('metrics');
      showAlert("No metrics are selected! Please select at least one metric from the 'Metric Selection' tab.", true);
      return;
    }

    let closestFrame = telemetry[0];
    let minDiff = Infinity;
    for (const frame of telemetry) {
      const diff = Math.abs(frame.timeMs - currentTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    // Find previous marker in chronological timeline
    const sortedMarkers = [...markers].sort((a, b) => a.timeMs - b.timeMs);
    const currentIdx = sortedMarkers.findIndex(m => m.id === activePhaseName);
    let prevPose: PoseData | null = null;
    let prevLabel = '';

    if (currentIdx > 0) {
      const prevMarker = sortedMarkers[currentIdx - 1];
      prevLabel = prevMarker.label;
      let prevMinDiff = Infinity;
      for (const f of telemetry) {
        const diff = Math.abs(f.timeMs - prevMarker.timeMs);
        if (diff < prevMinDiff) {
          prevMinDiff = diff;
          prevPose = f.pose;
        }
      }
    } else if (telemetry.length > 0) {
      prevPose = telemetry[0].pose;
      prevLabel = 'Start of Video';
    }

    const mockState = { timeMs: currentTimeMs, baseTorsoHeight: 0.5 };
    const generatedRules: RuleConfig[] = [];
    const summaryLines: string[] = [];

    for (const key of selectedMetricKeys) {
      const currVal = DynamicRule.calculateMetric(key, closestFrame.pose, mockState);
      const prevVal = prevPose ? DynamicRule.calculateMetric(key, prevPose, mockState) : currVal;
      const pred = predictMetricOperatorAndBuffer(key, prevVal, currVal);

      generatedRules.push({
        id: `rule_${key}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        metric: key,
        operator: pred.operator,
        value: pred.targetValue,
        isBlocking: true
      });

      const mMeta = availableMetrics.find(m => m.metric_key === key);
      const name = mMeta?.metric_name || mMeta?.name || key;
      const unit = key.includes('RATIO') ? '' : '°';
      summaryLines.push(`• ${name}: ${pred.operator} ${pred.targetValue}${unit} (${pred.movementType})`);
    }

    // Update phase configuration persistently
    setPhasesConfig(prev => {
      const currentPhase = prev[activePhaseName] || { entryConditions: [], formChecks: [] };
      const existing = (currentPhase.entryConditions || []).filter(e => !selectedMetricKeys.includes(e.metric));
      return {
        ...prev,
        [activePhaseName]: {
          ...currentPhase,
          entryConditions: [...existing, ...generatedRules]
        }
      };
    });

    setConfigTab('transitions');
    showAlert(`Extracted to ${activePhaseName} (compared to ${prevLabel || 'Start'}):\n\n${summaryLines.join('\n')}`, false);
  };

  const handleApplyExtractedMetrics = (rules: RuleConfig[], targetType: 'entry' | 'formCheck') => {
    if (!activePhaseName) return;

    setPhasesConfig(prev => {
      const currentPhase = prev[activePhaseName] || { entryConditions: [], formChecks: [] };
      if (targetType === 'entry') {
        const existing = (currentPhase.entryConditions || []).filter(e => !rules.some(r => r.metric === e.metric));
        return {
          ...prev,
          [activePhaseName]: {
            ...currentPhase,
            entryConditions: [...existing, ...rules]
          }
        };
      } else {
        const existing = (currentPhase.formChecks || []).filter(e => !rules.some(r => r.metric === e.metric));
        return {
          ...prev,
          [activePhaseName]: {
            ...currentPhase,
            formChecks: [...existing, ...rules]
          }
        };
      }
    });

    showAlert(`Successfully added ${rules.length} metric(s) with auto-operators to ${activePhaseName}!`, false);
  };

  useEffect(() => {
    async function load() {
      try {
        const [exRes, rulesRes] = await Promise.all([
          fetch(`/api/exercises/${params?.id}`),
          fetch(`/api/exercises/${params?.id}/rules`)
        ]);
        
        const exData = await exRes.json();
        const rulesData = await rulesRes.json();
        
        setExercise(exData);
        setExerciseName(exData.name || '');
        setExerciseDescription(exData.description || '');
        setCategory(exData.category || 'AI Generated');
        setSubcategory(exData.subcategory || '');
        setCameraAngle(exData.camera_angle || 'FRONT');
        setImagePath(exData.image_path || '');
        setVideoPath(exData.video_path || '');
        
        // Load Dynamic Profile Rule (Phases & Conditions)
        const dynamicRule = rulesData.find((r: any) => r.rule_name === 'DYNAMIC_PROFILE' && r.creator_type === 'system');
        if (dynamicRule && dynamicRule.threshold_value) {
          const profile = typeof dynamicRule.threshold_value === 'string' ? JSON.parse(dynamicRule.threshold_value) : dynamicRule.threshold_value;
          
          const newPhasesConfig: Record<string, any> = {};
          if (profile.phases && Array.isArray(profile.phases)) {
            profile.phases.forEach((p: any) => {
              newPhasesConfig[p.name] = {
                isSetupPhase: p.isSetupPhase || false,
                entryConditions: p.entryConditions || [],
                formChecks: p.formChecks || [],
                entryCue: p.entryCue || '',
                entryCueEnabled: p.entryCueEnabled || false,
              };
            });
            setPhasesConfig(newPhasesConfig);
            if (profile.phases.length > 0) {
              setActivePhaseName(profile.phases[0].name);
            }

            const existingMetrics = new Set<string>();
            profile.phases.forEach((p: any) => {
              (p.entryConditions || []).forEach((c: any) => { if (c.metric) existingMetrics.add(c.metric); });
              (p.formChecks || []).forEach((c: any) => { if (c.metric) existingMetrics.add(c.metric); });
            });
            if (existingMetrics.size > 0 && typeof window !== 'undefined' && !localStorage.getItem(`visionfit_exercise_${params?.id}_metrics`)) {
              setSelectedMetricKeys(Array.from(existingMetrics));
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params?.id]);

  const handleSave = async () => {
    try {
      const phases = Object.keys(phasesConfig).map(name => ({
        name,
        isSetupPhase: phasesConfig[name].isSetupPhase || false,
        entryConditions: phasesConfig[name].entryConditions,
        formChecks: phasesConfig[name].formChecks,
        entryCue: phasesConfig[name].entryCue || '',
        entryCueEnabled: phasesConfig[name].entryCueEnabled || false,
      }));

      const bodyPayload: any = {
        name: exerciseName,
        description: exerciseDescription,
        category,
        subcategory,
        camera_angle: cameraAngle,
        image_path: imagePath,
        video_path: videoPath,
        trackingMode: 'phases',
        dynamicProfile: { phases }
      };

      const res = await fetch(`/api/admin/exercises/${params?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      
      if (!res.ok) {
        let msg = "Failed to save";
        try {
          const errData = await res.json();
          if (errData.message) msg = errData.message;
        } catch (e) {}
        throw new Error(msg);
      }
      
      showAlert("Exercise rules updated successfully!", false);
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || "Error updating exercise.", true);
    }
  };

  const handleDuplicatePhase = (phaseName: string) => {
    if (!phasesConfig[phaseName]) return;
    
    let newName = `${phaseName} (Copy)`;
    let counter = 1;
    while (phasesConfig[newName]) {
      newName = `${phaseName} (Copy ${counter})`;
      counter++;
    }
    
    setPhasesConfig(prev => ({
      ...prev,
      [newName]: JSON.parse(JSON.stringify(prev[phaseName]))
    }));
    
    const origMarker = markers.find(m => m.id === phaseName);
    if (origMarker) {
      setMarkers([...markers, { id: newName, timeMs: origMarker.timeMs, label: newName }]);
    } else {
      setMarkers([...markers, { id: newName, timeMs: -1, label: newName }]);
    }
    
    setActivePhaseName(newName);
  };

  if (loading) return <div className="p-8 flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!exercise) return <div className="p-8 text-center text-red-500">Exercise not found.</div>;

  const phaseNames = Object.keys(phasesConfig);

  return (
    <div className="px-10 py-10 w-full space-y-6 pb-32">
      {/* Exercise Details Card */}
      <div className="flex flex-col gap-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-surface-card p-8 rounded-xl border border-border shadow-card">
          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Exercise Name <span className="text-err">*</span></label>
            <input 
              type="text" 
              placeholder="e.g. Russian Twist"
              value={exerciseName}
              onChange={e => setExerciseName(e.target.value)}
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Short Description</label>
            <input 
              type="text" 
              placeholder="Brief description of the movement"
              value={exerciseDescription}
              onChange={e => setExerciseDescription(e.target.value)}
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Category <span className="text-err">*</span></label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            >
              <option value="AI Generated">AI Generated</option>
              <option value="Lower Body">Lower Body</option>
              <option value="Upper Body">Upper Body</option>
              <option value="Core">Core</option>
              <option value="Full Body">Full Body</option>
              <option value="Cardio">Cardio</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Subcategory</label>
            <input 
              type="text" 
              placeholder="e.g. Quadriceps"
              value={subcategory}
              onChange={e => setSubcategory(e.target.value)}
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Camera Angle <span className="text-err">*</span></label>
            <select 
              value={cameraAngle} 
              onChange={e => setCameraAngle(e.target.value)} 
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            >
              <option value="FRONT">FRONT</option>
              <option value="SIDE">SIDE</option>
              <option value="45 DEGREE">45 DEGREE</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="kicker text-fg-mute">Thumbnail URL</label>
            <input 
              type="text" 
              placeholder="/images/thumb.png"
              value={imagePath}
              onChange={e => setImagePath(e.target.value)}
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="kicker text-fg-mute">Reference Video URL</label>
            <input 
              type="text" 
              placeholder="https://.../video.mp4"
              value={videoPath}
              onChange={e => setVideoPath(e.target.value)}
              className="border border-border bg-bg text-fg text-sm p-3 rounded-lg focus:border-flame outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Movement Phases */}
      {phaseNames.length === 0 ? (
        <div className="bg-surface-card border border-border p-8 text-center rounded-xl text-fg-mute shadow-sm mt-6 flex flex-col items-center gap-4">
          <p>This exercise does not have movement phases configured yet.</p>
          <button
            onClick={() => handleAddMarker(currentTimeMs)}
            className="px-5 py-2.5 bg-flame text-on-dark rounded-xl text-sm font-bold shadow-flame hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Phase 1
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-6">
          <h3 className="kicker">Movement Phases</h3>
          <div className="flex items-center gap-4 mb-2 min-w-0 overflow-hidden">
            <div className="flex items-center bg-surface-elev border border-border p-1.5 rounded-2xl shrink-0">
              <button
                onClick={() => setShowVideoAssistant(false)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  !showVideoAssistant 
                    ? 'bg-flame text-on-dark shadow-flame' 
                    : 'text-fg-mute hover:text-fg hover:bg-surface-raised'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span> Manual
              </button>
              <button
                onClick={() => setShowVideoAssistant(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  showVideoAssistant 
                    ? 'bg-flame text-on-dark shadow-flame' 
                    : 'text-fg-mute hover:text-fg hover:bg-surface-raised'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span> Video
              </button>
            </div>

            {/* Horizontal Tabs Container */}
            <div className="flex items-center bg-surface-elev border border-border p-1.5 rounded-2xl flex-1 min-w-0">
              <div className="flex items-center overflow-x-auto flex-nowrap whitespace-nowrap min-w-0 flex-1 thin-scrollbar">
                {phaseNames.map(name => (
                  <div key={name} className="relative group flex shrink-0">
                    <button
                      onClick={() => setActivePhaseName(name)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all pr-[72px] flex items-center ${
                        activePhaseName === name 
                          ? 'bg-flame text-on-dark shadow-flame' 
                          : 'text-fg-mute hover:text-fg hover:bg-surface-raised'
                      }`}
                    >
                      <span>{name}</span>
                    </button>

                    {/* Actions Container */}
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePhase(name);
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                          activePhaseName === name
                            ? 'hover:bg-white/20 text-on-dark'
                            : 'hover:bg-surface-elev text-fg-mute hover:text-flame'
                        }`}
                        title="Duplicate Phase"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMarker(name);
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                          activePhaseName === name
                            ? 'hover:bg-white/20 text-on-dark'
                            : 'hover:bg-surface-elev text-fg-mute hover:text-err'
                        }`}
                        title="Delete Phase"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleAddMarker(currentTimeMs)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-raised hover:bg-surface-card text-fg border border-border/80 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 ml-2"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Phase
              </button>
            </div>
          </div>

          {/* Main Workspace: 2-Column Side-by-Side (Video Indicator on Left, Phase Rules on Right) */}
          <div className={`grid grid-cols-1 ${showVideoAssistant ? 'lg:grid-cols-12' : ''} gap-6 items-start`}>
            {/* Left Column: Video Assistant */}
            {showVideoAssistant && (
              <div className="lg:col-span-5 flex flex-col gap-4">
                <VideoExtractor
                  initialVideoUrl={videoPath}
                  onVideoChange={(url) => setVideoPath(url)}
                  onExtractionComplete={handleExtractionComplete}
                  onTimeUpdate={(t) => setCurrentTimeMs(t)}
                />
              </div>
            )}

            {/* Right Column: Phase Transitions & Live Form Checks */}
            <div className={`${showVideoAssistant ? 'lg:col-span-7' : 'w-full'} flex flex-col gap-6`}>
              <PhaseConfigurator
                key={activePhaseName || 'none'}
                phaseName={activePhaseName || ''}
                isSetupPhase={activePhaseName && phasesConfig[activePhaseName] ? phasesConfig[activePhaseName].isSetupPhase : false}
                entryConditions={activePhaseName && phasesConfig[activePhaseName] ? phasesConfig[activePhaseName].entryConditions || [] : []}
                formChecks={activePhaseName && phasesConfig[activePhaseName] ? phasesConfig[activePhaseName].formChecks || [] : []}
                entryCue={activePhaseName && phasesConfig[activePhaseName] ? (phasesConfig[activePhaseName].entryCue || '') : ''}
                entryCueEnabled={activePhaseName && phasesConfig[activePhaseName] ? (phasesConfig[activePhaseName].entryCueEnabled || false) : false}
                onUpdateSetupPhase={(isSetup) => {
                  if (!activePhaseName) return;
                  setPhasesConfig(prev => ({
                    ...prev,
                    [activePhaseName]: { ...prev[activePhaseName], isSetupPhase: isSetup }
                  }));
                }}
                onUpdateEntryConditions={(rules) => {
                  if (!activePhaseName) return;
                  setPhasesConfig(prev => ({
                    ...prev,
                    [activePhaseName]: { ...prev[activePhaseName], entryConditions: rules }
                  }));
                }}
                onUpdateFormChecks={(rules) => {
                  if (!activePhaseName) return;
                  setPhasesConfig(prev => ({
                    ...prev,
                    [activePhaseName]: { ...prev[activePhaseName], formChecks: rules }
                  }));
                }}
                onUpdateEntryCue={(cue) => {
                  if (!activePhaseName) return;
                  setPhasesConfig(prev => ({
                    ...prev,
                    [activePhaseName]: { ...prev[activePhaseName], entryCue: cue }
                  }));
                }}
                onUpdateEntryCueEnabled={(enabled) => {
                  if (!activePhaseName) return;
                  setPhasesConfig(prev => ({
                    ...prev,
                    [activePhaseName]: { ...prev[activePhaseName], entryCueEnabled: enabled }
                  }));
                }}
                onUpdatePhaseName={(newName) => {
                  if (!activePhaseName) return;
                  if (newName !== activePhaseName) {
                    setPhasesConfig(prev => {
                      const next = { ...prev };
                      next[newName] = next[activePhaseName];
                      delete next[activePhaseName];
                      return next;
                    });
                    setMarkers(markers.map(m => m.id === activePhaseName ? { ...m, id: newName, label: newName } : m));
                    setActivePhaseName(newName);
                  }
                }}
                availableMetrics={availableMetrics}
                selectedMetricKeys={selectedMetricKeys}
                onToggleMetric={toggleSelectedMetricKey}
                onClearAllMetrics={clearSelectedMetricKeys}
                activeTab={configTab}
                onTabChange={setConfigTab}
                onExtractMetrics={handleAutoMagicExtract}
                isManualMode={!showVideoAssistant}
              />
              {activePhaseName && (
                <div className="bg-surface-card border border-flame/30 rounded-xl p-5 flex justify-between items-center shadow-sm">
                  <p className="text-sm text-fg-mute font-medium">Ready to update this exercise?</p>
                  <button 
                    onClick={handleSave}
                    className="bg-flame text-on-dark font-bold px-6 py-2 rounded-full shadow-flame hover:scale-[1.03] transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal?.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-card p-6 sm:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl border border-border relative">
            <button 
              onClick={() => setConfirmModal(null)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-surface-elev text-fg-mute hover:text-fg hover:bg-surface-elev-hover transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <h3 className="h3 text-fg mb-2 pr-8">{confirmModal.title}</h3>
            <p className="text-fg-mute mb-8 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmModal.onConfirm}
                className={`w-full py-3 text-on-dark rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-transform ${
                  confirmModal.confirmStyle === 'flame' 
                    ? 'bg-flame shadow-flame' 
                    : 'bg-err hover:bg-err/90 shadow-lg'
                }`}
              >
                {confirmModal.confirmText}
              </button>
              {!confirmModal.hideCancel && (
                <button
                  onClick={() => setConfirmModal(null)}
                  className="w-full py-3 bg-surface-elev text-fg-mute rounded-xl font-bold hover:bg-surface-elev-hover transition-colors mt-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Metric Extraction Modal with Auto-Operator Prediction */}
      {isExtractModalOpen && currentExtractPose && (
        <MetricExtractModal
          isOpen={isExtractModalOpen}
          onClose={() => setIsExtractModalOpen(false)}
          targetPhaseName={activePhaseName || 'Current Phase'}
          currentTimeMs={currentTimeMs}
          availableMetrics={availableMetrics}
          currentPose={currentExtractPose}
          previousPose={previousExtractPose}
          previousPhaseName={previousMarkerLabel}
          onApply={handleApplyExtractedMetrics}
        />
      )}
    </div>
  );
}
