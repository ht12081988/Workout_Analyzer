'use client';

import { createPortal } from 'react-dom';
import React, { useState, useEffect } from 'react';
import { VideoExtractor, TelemetryFrame } from './components/VideoExtractor';
import { PhaseConfigurator, RuleConfig, ConfigTab } from './components/PhaseConfigurator';
import { MetricExtractModal, MetricItem } from './components/MetricExtractModal';
import { MetricSelectionPanel } from './components/MetricSelectionPanel';
import {
  DynamicRule,
  PoseData,
  predictMetricOperatorAndBuffer
} from '@workout/shared';
import { useRouter } from 'next/navigation';

export default function NoCodeBuilderPage() {
  const router = useRouter();
  const [telemetry, setTelemetry] = useState<TelemetryFrame[]>([]);
  const [markers, setMarkers] = useState<{id: string, timeMs: number, label: string}[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [showVideoAssistant, setShowVideoAssistant] = useState(true);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Master Configuration State
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [category, setCategory] = useState('AI Generated');
  const [subcategory, setSubcategory] = useState('');
  const [cameraAngle, setCameraAngle] = useState('FRONT');
  const [imagePath, setImagePath] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [phasesConfig, setPhasesConfig] = useState<Record<string, { entryConditions: RuleConfig[], formChecks: RuleConfig[], isSetupPhase?: boolean, entryCue?: string, entryCueEnabled?: boolean }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Video Assistant Sub-tab & Persistent Selected Metrics
  const [configTab, setConfigTab] = useState<ConfigTab>('transitions');
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>(['KNEE_ANGLE', 'HIP_HINGE_ANGLE']);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('visionfit_builder_selected_metrics');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedMetricKeys(parsed);
          }
        }
      } catch (e) {}
    }
  }, []);

  const toggleSelectedMetricKey = (key: string) => {
    setSelectedMetricKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (typeof window !== 'undefined') {
        try {
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

  const handleReorderMarkers = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const fromMarker = markers[fromIdx];
    const toMarker = markers[toIdx];
    if (!fromMarker || !toMarker) return;

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Phase Reordering',
      message: `Are you sure you want to move "${fromMarker.label}" to position ${toIdx + 1}? This will update the movement tracking sequence for this exercise.`,
      confirmText: 'Reorder Phase',
      confirmStyle: 'flame',
      hideCancel: false,
      onConfirm: () => {
        setMarkers(prev => {
          const updated = [...prev];
          const [moved] = updated.splice(fromIdx, 1);
          updated.splice(toIdx, 0, moved);
          return updated;
        });
        setConfirmModal(null);
      }
    });
  };

  const handleGenerateAIBlueprint = async () => {
    if (!exerciseName) {
      showAlert("Please enter an Exercise Name first!", true);
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseName, category })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const newMarkers: typeof markers = [];
      const newPhasesConfig: typeof phasesConfig = {};
      
      let baseTimeMs = 0;
      
      data.phases.forEach((phase: any, index: number) => {
         const newId = Date.now().toString() + index;
         newMarkers.push({
           id: newId,
           timeMs: baseTimeMs + (index * 1000),
           label: phase.label || `Phase ${index + 1}`
         });
         
         const entryConditions = (phase.entryConditions || []).map((r: any, rIdx: number) => ({ ...r, id: `ec-${newId}-${rIdx}` }));
         const formChecks = (phase.formChecks || []).map((r: any, rIdx: number) => ({ ...r, id: `fc-${newId}-${rIdx}` }));

         newPhasesConfig[newId] = {
           entryConditions,
           formChecks,
           isSetupPhase: phase.isSetupPhase || false
         };
      });
      
      setMarkers(newMarkers);
      setPhasesConfig(newPhasesConfig);
      if (newMarkers.length > 0) {
        setSelectedMarkerId(newMarkers[0].id);
      }
      
    } catch (e: any) {
      showAlert("Failed to generate AI blueprint: " + e.message, true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtractionComplete = (data: TelemetryFrame[]) => {
    setTelemetry(data);
  };

  const handleAddMarker = (timeMs: number) => {
    const newMarker = {
      id: Date.now().toString(),
      timeMs,
      label: `Phase ${markers.length + 1}`
    };
    setMarkers([...markers, newMarker]);
    setSelectedMarkerId(newMarker.id);
    setPhasesConfig(prev => ({
      ...prev,
      [newMarker.id]: {
        entryConditions: [],
        formChecks: []
      }
    }));
    setConfigTab('transitions');
  };

  const handleAutoMagicExtract = () => {
    if (!showVideoAssistant) {
      // MANUAL MODE: Add selected metrics directly into active phase without video
      if (!selectedMarkerId || !phasesConfig[selectedMarkerId]) {
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
        const currentPhase = prev[selectedMarkerId] || { entryConditions: [], formChecks: [] };
        const existing = (currentPhase.entryConditions || []).filter(e => !selectedMetricKeys.includes(e.metric));
        return {
          ...prev,
          [selectedMarkerId]: {
            ...currentPhase,
            entryConditions: [...existing, ...generatedRules]
          }
        };
      });

      const phaseLabel = markers.find(m => m.id === selectedMarkerId)?.label || 'Current Phase';
      setConfigTab('transitions');
      showAlert(`Successfully added ${generatedRules.length} metric(s) to ${phaseLabel}! You can now adjust their operators and values below.`, false);
      return;
    }

    if (telemetry.length === 0) {
      showAlert("Please run 'Full Frame Extraction' on the video first so we have the 3D data!", true);
      return;
    }

    if (!selectedMarkerId || !phasesConfig[selectedMarkerId]) {
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

    // Find previous marker in configured phase sequence
    const currentIdx = markers.findIndex(m => m.id === selectedMarkerId);
    let prevPose: PoseData | null = null;
    let prevLabel = '';

    if (currentIdx > 0) {
      const prevMarker = markers[currentIdx - 1];
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
      const currentPhase = prev[selectedMarkerId] || { entryConditions: [], formChecks: [] };
      const existing = (currentPhase.entryConditions || []).filter(e => !selectedMetricKeys.includes(e.metric));
      return {
        ...prev,
        [selectedMarkerId]: {
          ...currentPhase,
          entryConditions: [...existing, ...generatedRules]
        }
      };
    });

    const phaseLabel = markers.find(m => m.id === selectedMarkerId)?.label || 'Current Phase';
    setConfigTab('transitions');
    showAlert(`Extracted to ${phaseLabel} (compared to ${prevLabel || 'Start'}):\n\n${summaryLines.join('\n')}`, false);
  };

  const handleApplyExtractedMetrics = (rules: RuleConfig[], targetType: 'entry' | 'formCheck') => {
    if (!selectedMarkerId) return;

    setPhasesConfig(prev => {
      const currentPhase = prev[selectedMarkerId] || { entryConditions: [], formChecks: [] };
      if (targetType === 'entry') {
        const existing = (currentPhase.entryConditions || []).filter(e => !rules.some(r => r.metric === e.metric));
        return {
          ...prev,
          [selectedMarkerId]: {
            ...currentPhase,
            entryConditions: [...existing, ...rules]
          }
        };
      } else {
        const existing = (currentPhase.formChecks || []).filter(e => !rules.some(r => r.metric === e.metric));
        return {
          ...prev,
          [selectedMarkerId]: {
            ...currentPhase,
            formChecks: [...existing, ...rules]
          }
        };
      }
    });

    showAlert(`Successfully added ${rules.length} metric(s) with auto-operators to ${markers.find(m => m.id === selectedMarkerId)?.label || 'phase'}!`, false);
  };

  const handleRemoveMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  const handleSave = async () => {
    if (!exerciseName) return showAlert("Please enter an exercise name", true);

    try {
      const bodyPayload: any = {
        name: exerciseName,
        description: exerciseDescription,
        category,
        subcategory,
        camera_angle: cameraAngle,
        image_path: imagePath,
        video_path: videoPath,
        trackingMode: 'phases'
      };

      if (markers.length === 0) return showAlert("Please create at least one phase", true);

      const phases = markers.map((m, idx) => ({
        name: m.label.startsWith(`Phase ${idx + 1}`) ? m.label : `Phase ${idx + 1}: ${m.label}`,
        isSetupPhase: phasesConfig[m.id]?.isSetupPhase || false,
        entryConditions: phasesConfig[m.id]?.entryConditions || [],
        formChecks: phasesConfig[m.id]?.formChecks || [],
        entryCue: phasesConfig[m.id]?.entryCue || '',
        entryCueEnabled: phasesConfig[m.id]?.entryCueEnabled || false,
      }));
      bodyPayload.dynamicProfile = { phases };

      const res = await fetch('/api/admin/exercises', {
        method: 'POST',
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
      
      const data = await res.json();
      await showAlert("Exercise created successfully!", false);
      router.push(`/admin/exercises/${data.exercise_id}`);
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || "Error saving exercise. Make sure backend is running.", true);
    }
  };

  const handleDuplicatePhase = (markerId: string) => {
    const originalMarker = markers.find(m => m.id === markerId);
    if (!originalMarker) return;
    
    const newId = `marker-${Date.now()}`;
    const newLabel = `${originalMarker.label} (Copy)`;
    
    setMarkers(prev => [...prev, {
      id: newId,
      timeMs: originalMarker.timeMs,
      label: newLabel
    }]);
    
    setPhasesConfig(prev => ({
      ...prev,
      [newId]: JSON.parse(JSON.stringify(prev[markerId]))
    }));
    
    setSelectedMarkerId(newId);
  };

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
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex justify-between items-center">
          <h3 className="kicker">Movement Phases</h3>
          <button 
            onClick={handleGenerateAIBlueprint} 
            disabled={isGenerating}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-bold rounded-lg shadow-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="text-lg leading-none">🪄</span>
            )}
            {isGenerating ? "Generating..." : "Generate AI Blueprint"}
          </button>
        </div>
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
            <div className="flex items-center overflow-x-auto flex-nowrap whitespace-nowrap min-w-0 flex-1 thin-scrollbar gap-1.5">
              {markers.map((marker, idx) => {
                const isDragging = draggedIdx === idx;
                const isDragOver = dragOverIdx === idx && draggedIdx !== idx;

                return (
                  <div 
                    key={marker.id} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', idx.toString());
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== idx) {
                        handleReorderMarkers(draggedIdx, idx);
                      }
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`relative group flex shrink-0 cursor-grab active:cursor-grabbing rounded-xl transition-all select-none ${
                      isDragging ? 'opacity-30 scale-95 border-2 border-dashed border-flame' : ''
                    } ${
                      isDragOver ? 'ring-2 ring-flame ring-offset-2 ring-offset-surface-elev scale-[1.03]' : ''
                    }`}
                    title="Drag and drop to reorder phase"
                  >
                    <button
                      onClick={() => setSelectedMarkerId(marker.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all pr-[72px] flex items-center gap-1.5 ${
                        selectedMarkerId === marker.id 
                          ? 'bg-flame text-on-dark shadow-flame' 
                          : 'text-fg-mute hover:text-fg hover:bg-surface-raised'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[15px] opacity-40 group-hover:opacity-100 transition-opacity ${selectedMarkerId === marker.id ? 'text-on-dark' : 'text-fg-mute'}`}>
                        drag_indicator
                      </span>
                      <span>{marker.label}</span>
                    </button>

                    {/* Actions Container */}
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePhase(marker.id);
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                          selectedMarkerId === marker.id
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
                          handleRemoveMarker(marker.id);
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                          selectedMarkerId === marker.id
                            ? 'hover:bg-white/20 text-on-dark'
                            : 'hover:bg-surface-elev text-fg-mute hover:text-err'
                        }`}
                        title="Delete Phase"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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
              key={selectedMarkerId || 'none'}
              phaseName={selectedMarkerId ? (markers.find(m => m.id === selectedMarkerId)?.label || '') : ''}
              isSetupPhase={selectedMarkerId && phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].isSetupPhase : false}
              entryConditions={selectedMarkerId && phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].entryConditions : []}
              formChecks={selectedMarkerId && phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].formChecks : []}
              entryCue={selectedMarkerId && phasesConfig[selectedMarkerId] ? (phasesConfig[selectedMarkerId].entryCue || '') : ''}
              entryCueEnabled={selectedMarkerId && phasesConfig[selectedMarkerId] ? (phasesConfig[selectedMarkerId].entryCueEnabled || false) : false}
              onUpdateSetupPhase={(isSetup) => {
                if (!selectedMarkerId) return;
                setPhasesConfig(prev => ({
                  ...prev,
                  [selectedMarkerId]: { ...prev[selectedMarkerId], isSetupPhase: isSetup }
                }));
              }}
              onUpdateEntryConditions={(rules) => {
                if (!selectedMarkerId) return;
                setPhasesConfig(prev => ({
                  ...prev,
                  [selectedMarkerId]: { ...prev[selectedMarkerId], entryConditions: rules }
                }));
              }}
              onUpdateFormChecks={(rules) => {
                if (!selectedMarkerId) return;
                setPhasesConfig(prev => ({
                  ...prev,
                  [selectedMarkerId]: { ...prev[selectedMarkerId], formChecks: rules }
                }));
              }}
              onUpdateEntryCue={(cue) => {
                if (!selectedMarkerId) return;
                setPhasesConfig(prev => ({
                  ...prev,
                  [selectedMarkerId]: { ...prev[selectedMarkerId], entryCue: cue }
                }));
              }}
              onUpdateEntryCueEnabled={(enabled) => {
                if (!selectedMarkerId) return;
                setPhasesConfig(prev => ({
                  ...prev,
                  [selectedMarkerId]: { ...prev[selectedMarkerId], entryCueEnabled: enabled }
                }));
              }}
              onUpdatePhaseName={(newName) => {
                if (!selectedMarkerId) return;
                setMarkers(prev => prev.map(m => m.id === selectedMarkerId ? { ...m, label: newName } : m));
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
            {selectedMarkerId && (
              <div className="bg-surface-card border border-flame/30 rounded-xl p-5 flex justify-between items-center shadow-sm">
                <p className="text-sm text-fg-mute font-medium">Ready to create this exercise?</p>
                <button 
                  onClick={handleSave}
                  className="bg-flame text-on-dark font-bold px-6 py-2 rounded-full shadow-flame hover:scale-[1.03] transition-all"
                >
                  Save Exercise
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
          targetPhaseName={markers.find(m => m.id === selectedMarkerId)?.label || 'Current Phase'}
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
