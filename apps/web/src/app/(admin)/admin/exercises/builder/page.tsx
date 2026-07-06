'use client';

import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { VideoExtractor, TelemetryFrame } from './components/VideoExtractor';
import { PhaseConfigurator, RuleConfig } from './components/PhaseConfigurator';
import { DynamicRule } from '@workout/shared';
import { useRouter } from 'next/navigation';

export default function NoCodeBuilderPage() {
  const router = useRouter();
  const [telemetry, setTelemetry] = useState<TelemetryFrame[]>([]);
  const [markers, setMarkers] = useState<{id: string, timeMs: number, label: string}[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [showVideoAssistant, setShowVideoAssistant] = useState(false);

  // Master Configuration State
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [category, setCategory] = useState('AI Generated');
  const [subcategory, setSubcategory] = useState('');
  const [cameraAngle, setCameraAngle] = useState('FRONT');
  const [imagePath, setImagePath] = useState('');
  const [videoPath, setVideoPath] = useState('');
  const [phasesConfig, setPhasesConfig] = useState<Record<string, { entryConditions: RuleConfig[], formChecks: RuleConfig[], isSetupPhase?: boolean }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

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
    
    // Initialize config for this phase
    setPhasesConfig(prev => ({ ...prev, [newMarker.id]: { entryConditions: [], formChecks: [] } }));
  };

  const handleAddPhaseManually = () => {
    handleAddMarker(-1);
  };

  const handleAutoMagicExtract = () => {
    if (telemetry.length === 0) {
      showAlert("Please run 'Full Frame Extraction' on the video first so we have the 3D data!", true);
      return;
    }

    // 1. Find closest frame
    let closestFrame = telemetry[0];
    let minDiff = Infinity;
    for (const frame of telemetry) {
      const diff = Math.abs(frame.timeMs - currentTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    // 2. Add Phase marker
    const newMarkerId = Date.now().toString();
    const newMarker = {
      id: newMarkerId,
      timeMs: currentTimeMs,
      label: `Phase ${markers.length + 1}`
    };
    setMarkers([...markers, newMarker]);
    setSelectedMarkerId(newMarker.id);

    // 3. Auto-calculate metrics
    const pose = closestFrame.pose;
    const ALL_METRICS = ['KNEE_ANGLE', 'LEFT_KNEE_ANGLE', 'RIGHT_KNEE_ANGLE', 'TORSO_ANGLE_VERT', 'STANCE_WIDTH_RATIO', 'KNEE_VALGUS_RATIO', 'FOOT_TURNOUT_ANGLE', 'BODY_ORIENTATION_ANGLE', 'HIP_HINGE_ANGLE', 'ELBOW_ANGLE', 'LEFT_ELBOW_ANGLE', 'RIGHT_ELBOW_ANGLE', 'SHOULDER_FLEXION', 'LEFT_SHOULDER_FLEXION', 'RIGHT_SHOULDER_FLEXION', 'WRIST_ALIGNMENT', 'LEFT_WRIST_ALIGNMENT', 'RIGHT_WRIST_ALIGNMENT', 'GAZE_ALIGNMENT', 'GRIP_WIDTH_RATIO', 'BILATERAL_SYMMETRY', 'KNEE_OVER_TOE', 'HEAD_FORWARD_LEAN', 'VERTICAL_BAR_PATH', 'HEEL_RAISE_TILT', 'LEFT_HEEL_RAISE_TILT', 'RIGHT_HEEL_RAISE_TILT', 'DYN_TORSO_COMPRESSION', 'BODY_SWAY', 'SHOULDER_ROTATION', 'STILLNESS_JITTER', 'CONCENTRIC_VELOCITY', 'ECCENTRIC_VELOCITY'];

    const newRules: RuleConfig[] = [];
    ALL_METRICS.forEach((metricId, index) => {
       // Mock state to stabilize ratio calculations
       const mockState = { timeMs: currentTimeMs, baseTorsoHeight: 0.5 }; 
       const val = DynamicRule.calculateMetric(metricId, pose, mockState);
       
       // Only populate if it actually yielded a valid value
       if (val !== 0 && !isNaN(val)) {
         newRules.push({
           id: Date.now().toString() + index,
           metric: metricId,
           operator: '>', // Default to > 
           value: Number(val.toFixed(2)),
           isBlocking: true
         });
       }
    });

    setPhasesConfig(prev => ({
      ...prev,
      [newMarkerId]: {
        entryConditions: newRules,
        formChecks: []
      }
    }));
  };

  const handleUpdateSelectedPhaseWithTelemetry = () => {
    if (telemetry.length === 0) {
      showAlert("Please run 'Full Frame Extraction' on the video first so we have the 3D data!", true);
      return;
    }
    if (!selectedMarkerId || !phasesConfig[selectedMarkerId]) {
      showAlert("Please select a phase from the tabs above first!", true);
      return;
    }

    // 1. Find closest frame
    let closestFrame = telemetry[0];
    let minDiff = Infinity;
    for (const frame of telemetry) {
      const diff = Math.abs(frame.timeMs - currentTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    const pose = closestFrame.pose;
    const mockState = { timeMs: currentTimeMs, baseTorsoHeight: 0.5 }; 

    // Update entry conditions
    const updatedEntryConditions = phasesConfig[selectedMarkerId].entryConditions.map(rule => {
      const val = DynamicRule.calculateMetric(rule.metric, pose, mockState);
      if (val !== 0 && !isNaN(val)) {
        return { ...rule, value: Number(val.toFixed(2)) };
      }
      return rule;
    });

    // Update form checks
    const updatedFormChecks = phasesConfig[selectedMarkerId].formChecks.map(rule => {
      const val = DynamicRule.calculateMetric(rule.metric, pose, mockState);
      if (val !== 0 && !isNaN(val)) {
        return { ...rule, value: Number(val.toFixed(2)) };
      }
      return rule;
    });

    setPhasesConfig(prev => ({
      ...prev,
      [selectedMarkerId]: {
        ...prev[selectedMarkerId],
        entryConditions: updatedEntryConditions,
        formChecks: updatedFormChecks
      }
    }));
    
    showAlert("Metrics updated successfully for this phase!", false);
  };

  const handleRemoveMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  const handleSave = async () => {
    if (!exerciseName) return showAlert("Please enter an exercise name", true);
    if (markers.length === 0) return showAlert("Please create at least one phase", true);

    const sortedMarkers = [...markers].sort((a,b) => a.timeMs - b.timeMs);
    const phases = sortedMarkers.map(m => ({
      name: m.label,
      isSetupPhase: phasesConfig[m.id]?.isSetupPhase || false,
      entryConditions: phasesConfig[m.id]?.entryConditions || [],
      formChecks: phasesConfig[m.id]?.formChecks || []
    }));

    const dynamicProfile = { phases };

    try {
      const res = await fetch('/api/admin/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: exerciseName,
          description: exerciseDescription,
          category,
          subcategory,
          camera_angle: cameraAngle,
          image_path: imagePath,
          video_path: videoPath,
          dynamicProfile
        })
      });

      if (!res.ok) {
        if (res.status === 500) {
           throw new Error(`Failed to save. An exercise named "${exerciseName}" might already exist.`);
        }
        throw new Error("Failed to save");
      }
      
      const data = await res.json();
      await showAlert("Exercise saved successfully!", false);
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
    
    setMarkers([...markers, { id: newId, timeMs: originalMarker.timeMs, label: newLabel }]);
    
    if (phasesConfig[markerId]) {
      setPhasesConfig(prev => ({
        ...prev,
        [newId]: JSON.parse(JSON.stringify(prev[markerId]))
      }));
    }
    
    setSelectedMarkerId(newId);
  };

  const activePhaseLabel = markers.find(m => m.id === selectedMarkerId)?.label || '';

  return (
    <div className="px-10 py-10 w-full space-y-6 pb-32">
      <div className="flex flex-col gap-6">
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
            <label className="kicker text-fg-mute">Golden Rep Video URL</label>
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
            {/* Scrollable Tabs */}
            <div className="flex items-center overflow-x-auto flex-nowrap whitespace-nowrap min-w-0 flex-1 thin-scrollbar">
              {markers.map(m => (
                <div key={m.id} className="relative group flex shrink-0">
                  <button
                    onClick={() => setSelectedMarkerId(m.id)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all pr-[72px] flex items-center ${
                      selectedMarkerId === m.id 
                        ? 'bg-flame text-on-dark shadow-flame' 
                        : 'text-fg-mute hover:text-fg hover:bg-surface-raised'
                    }`}
                  >
                    {m.label}
                  </button>
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicatePhase(m.id);
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        selectedMarkerId === m.id
                          ? 'text-on-dark/70 hover:text-white hover:bg-black/20'
                          : 'text-fg-mute/70 hover:text-flame hover:bg-flame/10'
                      }`}
                      title="Duplicate Phase"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({
                          isOpen: true,
                          title: 'Delete Phase',
                          message: `Are you sure you want to delete ${m.label}?`,
                          confirmText: 'Yes, Delete',
                          confirmStyle: 'err',
                          onConfirm: () => {
                            setConfirmModal(null);
                            handleRemoveMarker(m.id);
                          }
                        });
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        selectedMarkerId === m.id
                          ? 'text-on-dark/70 hover:text-white hover:bg-black/20'
                          : 'text-fg-mute/70 hover:text-err hover:bg-err/10'
                      }`}
                      title="Delete Phase"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pinned Add Button */}
            {markers.length > 0 && <div className="w-px h-6 bg-border mx-2 shrink-0" />}
            
            <button 
              onClick={handleAddPhaseManually}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-fg-mute hover:text-flame hover:bg-flame/5 transition-all shrink-0"
              title="Add Phase"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>

        {/* 2-Column or 1-Column Layout */}
        <div className={`grid gap-6 ${showVideoAssistant ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Left Column (Video) */}
          {showVideoAssistant && (
            <div className="flex flex-col gap-4">
              <VideoExtractor 
                onExtractionComplete={handleExtractionComplete}
                onTimeUpdate={setCurrentTimeMs}
                scrubTimeMs={currentTimeMs}
              />
              
              <div className="bg-surface-elev border border-border p-5 rounded-xl shadow-sm">
                <h4 className="text-fg font-bold text-sm mb-2 flex items-center gap-2">
                  <span className="text-xl">🪄</span> Auto-Magic Phase Population
                </h4>
                <p className="text-fg-mute text-xs mb-4">
                  Pause the video where you want to create a new phase. Click the button below to extract the 3D telemetry and auto-populate all entry conditions based on the athlete's exact angles at this frame.
                </p>
                <button 
                  onClick={handleAutoMagicExtract}
                  className="w-full bg-flame hover:bg-flame/90 text-on-dark font-bold text-sm py-3 px-4 rounded-lg transition shadow-flame flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Extract Rules & Add New Phase Here
                </button>
                {selectedMarkerId && (
                  <button 
                    onClick={handleUpdateSelectedPhaseWithTelemetry}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 px-4 rounded-lg transition shadow-md flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    Update metrics to the phase
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right Column (Phase Configurator) */}
          <div className="flex flex-col min-w-0 h-full">
            {selectedMarkerId ? (
              <>
                <PhaseConfigurator 
                  phaseName={activePhaseLabel}
                  entryConditions={phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].entryConditions : []}
                  formChecks={phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].formChecks : []}
                  isSetupPhase={phasesConfig[selectedMarkerId] ? phasesConfig[selectedMarkerId].isSetupPhase : false}
                  onUpdateSetupPhase={(val) => {
                    setPhasesConfig(prev => ({
                      ...prev,
                      [selectedMarkerId]: { ...prev[selectedMarkerId], isSetupPhase: val }
                    }));
                  }}
                  onUpdateEntryConditions={(rules) => {
                    setPhasesConfig(prev => ({
                      ...prev,
                      [selectedMarkerId]: { ...prev[selectedMarkerId], entryConditions: rules }
                    }));
                  }}
                  onUpdateFormChecks={(rules) => {
                    setPhasesConfig(prev => ({
                      ...prev,
                      [selectedMarkerId]: { ...prev[selectedMarkerId], formChecks: rules }
                    }));
                  }}
                  onUpdatePhaseName={(newName) => {
                    setMarkers(markers.map(m => m.id === selectedMarkerId ? { ...m, label: newName } : m));
                  }}
                />
                
                <div className="bg-surface-card border border-flame/30 rounded-xl p-5 flex justify-between items-center mt-6 shadow-sm">
                  <p className="text-sm text-fg-mute font-medium">Ready to deploy this exercise?</p>
                  <button 
                    onClick={handleSave}
                    className="bg-flame text-on-dark font-bold px-6 py-2 rounded-full shadow-flame hover:scale-[1.03] transition-all"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface-card border border-border p-12 text-center rounded-xl text-fg-mute flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-4xl mb-4 opacity-50">build</span>
                <p>Select a phase from the tabs above or click "Add Phase" to begin building.</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}
