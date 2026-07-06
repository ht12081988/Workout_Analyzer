"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { DifficultySlider } from "@/components/DifficultySlider";
import { getParamConfig, RULE_SECTION_DESCRIPTIONS } from "@/lib/ruleConfig";

export default function ExercisesPage() {
  const params = useParams();
  const athleteId = params?.id as string;
  const router = useRouter();
  const [trainerId, setTrainerId] = useState<string | null>(null);

  useEffect(() => {
    const trainerAuth = localStorage.getItem("visionfit.auth.trainer");
    if (!trainerAuth) {
      router.push("/trainer/login");
      return;
    }
    const trainer = JSON.parse(trainerAuth);
    setTrainerId(trainer.id);
  }, [router]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [activeRuleIdx, setActiveRuleIdx] = useState(0);

  const [metricsLibrary, setMetricsLibrary] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => setMetricsLibrary(data))
      .catch(err => console.error(err));
  }, []);

  const getDynamicConfig = (key: string) => {
    const dbMetric = metricsLibrary.find(m => m.metric_key === key);
    if (dbMetric) {
      return { min: parseFloat(dbMetric.min_val), max: parseFloat(dbMetric.max_val), step: parseFloat(dbMetric.step_val), direction: dbMetric.direction, description: dbMetric.description };
    }
    return getParamConfig(key);
  };
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingExercise, setPendingExercise] = useState<any | null>(null);

  // 1. Fetch Exercises
  useEffect(() => {
    fetch('/api/exercises')
      .then(res => res.json())
      .then(data => {
        const exercisesData = Array.isArray(data) ? data : (data?.data || []);
        setExercises(exercisesData);
        if (exercisesData && exercisesData.length > 0) {
          setSelectedExercise(exercisesData[0]);
        }
        setLoadingEx(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises", err);
        setLoadingEx(false);
      });
  }, []);

  // 2. Fetch Rules when selectedExercise changes
  useEffect(() => {
    if (!selectedExercise || !trainerId) return;
    setLoadingRules(true);
    fetch(`/api/exercises/${selectedExercise.id}/rules?mode=trainer&trainer_id=${trainerId}&customer_id=${athleteId}`)
      .then(res => res.json())
      .then(data => {
        let rulesArr = Array.isArray(data) ? data : (data?.data || []);
        rulesArr = rulesArr.sort((a: any, b: any) => {
          if (a.rule_name === 'HEEL_TILT') return -1;
          if (b.rule_name === 'HEEL_TILT') return 1;
          if (a.rule_name === 'SQUAT_DEPTH') return -1;
          if (b.rule_name === 'SQUAT_DEPTH') return 1;
          return 0;
        });
        setRules(rulesArr);
        setLoadingRules(false);
      })
      .catch(err => {
        console.error("Failed to fetch rules", err);
        setLoadingRules(false);
      });
  }, [selectedExercise, trainerId, athleteId]);

  // 3. Handle saving all rules
  const handleSaveAllRules = async () => {
    setSaving(true);
    try {
      const promises = rules.map(rule => {
        const payload = {
          exercise_id: rule.exercise_id,
          rule_name: rule.rule_name,
          rule_type: rule.rule_type,
          threshold_value: rule.threshold_value,
          exercise_name: rule.exercise_name,
          trainer_id: trainerId,
          customer_id: athleteId
        };
        
        return fetch('/api/trainer/rules', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      });
      
      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);
      
      if (allOk) {
        toast.success(`Successfully saved overrides for ${selectedExercise.name}`);
        setIsDirty(false);
      } else {
        toast.error(`Failed to save some overrides.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error saving overrides.`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefaults = async () => {
    try {
      const res = await fetch(`/api/exercises/${selectedExercise.id}/rules`);
      const data = await res.json();
      let rulesArr = Array.isArray(data) ? data : (data?.data || []);
      rulesArr = rulesArr.sort((a: any, b: any) => {
        if (a.rule_name === 'HEEL_TILT') return -1;
        if (b.rule_name === 'HEEL_TILT') return 1;
        if (a.rule_name === 'SQUAT_DEPTH') return -1;
        if (b.rule_name === 'SQUAT_DEPTH') return 1;
        return 0;
      });
      setRules(rulesArr);
      setIsDirty(true);
      toast.success("Loaded system defaults. Don't forget to save!");
    } catch (err) {
      console.error("Failed to load defaults", err);
      toast.error("Error loading defaults.");
    }
  };

  const getIconForRule = (ruleName: string) => {
    const lower = ruleName.toLowerCase();
    if (lower.includes('tempo') || lower.includes('speed') || lower.includes('time') || lower.includes('duration')) return 'speed';
    if (lower.includes('posture') || lower.includes('angle') || lower.includes('stability') || lower.includes('alignment')) return 'accessibility_new';
    if (lower.includes('depth') || lower.includes('range')) return 'straighten';
    if (lower.includes('movement') || lower.includes('stillness')) return 'vibration';
    return 'tune';
  };

  const handleRuleChange = (index: number, field: string, value: any) => {
    const updatedRules = [...rules];
    if (field.startsWith('threshold_')) {
       // Parse nested threshold
       const key = field.replace('threshold_', '');
       updatedRules[index].threshold_value = {
         ...updatedRules[index].threshold_value,
         [key]: Number(value)
       };
    } else {
       updatedRules[index][field] = value;
    }
    setRules(updatedRules);
    setIsDirty(true);
  };

  const handleExerciseChange = (ex: any) => {
    if (isDirty && selectedExercise?.id !== ex.id) {
      setPendingExercise(ex);
      setShowExitModal(true);
    } else {
      setSelectedExercise(ex);
      setActiveRuleIdx(0);
      setIsDirty(false);
    }
  };

  if (loadingEx) return <div className="p-8 text-fg-mute font-body animate-pulse">Loading exercises...</div>;

  return (
    <div className="w-full h-full flex flex-col p-6 bg-bg">
      <div className="flex gap-6 h-[calc(100vh-16rem)] min-h-[600px]">
      {/* Left Sidebar: Exercises List */}
      <div className="w-1/5 min-w-[200px] bg-surface rounded-2xl shadow-card border border-border overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border shrink-0">
          <h2 className="h3 text-fg">Exercises</h2>
          <p className="text-sm text-fg-mute mt-1 font-body">Select an exercise to configure pose rules.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {exercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => handleExerciseChange(ex)}
              className={`w-full text-left px-5 py-4 transition-all font-bold text-sm border border-l-[3px] rounded-xl ${
                selectedExercise?.id === ex.id 
                  ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' 
                  : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'
              }`}
            >
              {ex.name}
              <div className="text-xs font-body font-normal text-fg-mute mt-1">
                {ex.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Content: Rule Editor */}
      <div className="flex-1 bg-surface-card rounded-2xl shadow-card border border-border overflow-hidden flex flex-col">
        {selectedExercise ? (
          <>
            <div className="p-6 border-b border-border shrink-0 flex justify-between items-center bg-surface/30">
              <div>
                <h2 className="h3 text-fg">{selectedExercise.name} Rules</h2>
                <p className="text-sm text-fg-mute mt-1 font-body">
                  Configure form-checking parameters specifically for this athlete.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rules.length > 0 && (
                  <>
                    <button
                      onClick={handleLoadDefaults}
                      disabled={saving}
                      className="px-4 py-2.5 bg-surface-elev text-fg rounded-lg font-bold text-sm hover:bg-surface transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 border border-border"
                    >
                      <span className="material-symbols-outlined text-[18px]">restore</span>
                      Default
                    </button>
                    <button
                      onClick={handleSaveAllRules}
                      disabled={saving}
                      className="px-6 py-2.5 bg-flame text-on-dark rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-70 disabled:hover:scale-100 flex items-center gap-2 shadow-flame"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-surface-card">
              {loadingRules ? (
                <div className="animate-pulse text-fg-mute">Loading rules...</div>
              ) : rules.length === 0 ? (
                <div className="text-fg-mute text-center mt-12 bg-surface/30 py-8 rounded-2xl border border-border border-dashed">
                  No pose rules defined for this exercise.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Tab Navigation */}
                  <div className="inline-flex items-center bg-surface-elev rounded-lg p-1 mb-6 overflow-x-auto max-w-full border border-border">
                    {rules.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveRuleIdx(i)}
                        className={`px-6 py-2.5 kicker whitespace-nowrap rounded-md transition-all flex items-center gap-2 ${
                          activeRuleIdx === i 
                            ? 'bg-surface-card text-flame shadow-sm'
                            : 'text-fg-mute hover:text-fg hover:bg-surface/30'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {getIconForRule(r.rule_name)}
                        </span>
                        {r.rule_name.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Active Rule Editor */}
                  {rules[activeRuleIdx] && (
                    <div className="bg-bg rounded-2xl p-6 border border-border shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
                        <div>
                          <p className="text-sm font-body text-fg-mute leading-relaxed">
                            {RULE_SECTION_DESCRIPTIONS[rules[activeRuleIdx].rule_name] || "Configure specific parameter thresholds for this rule."}
                          </p>
                          <div className="flex gap-2 mt-3">
                             <span className="kicker bg-surface-elev px-2 py-1 rounded text-fg-mute border border-border">
                               {rules[activeRuleIdx].rule_type}
                             </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        {/* Threshold Settings */}
                        <div className="space-y-4">
                          {rules[activeRuleIdx].rule_name === 'DYNAMIC_PROFILE' ? (
                            <div className="flex flex-col gap-6">
                              {rules[activeRuleIdx].threshold_value?.phases?.map((phase: any, phaseIdx: number) => (
                                <div key={phaseIdx} className="bg-surface border border-border rounded-2xl p-6">
                                  <h3 className="h3 text-fg mb-4">{phase.name}</h3>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {phase.entryConditions?.map((cond: any, condIdx: number) => {
                                      const config = getDynamicConfig(cond.metric);
                                      return (
                                        <DifficultySlider
                                          key={`entry-${condIdx}`}
                                          label={`Entry: ${cond.metric.replace(/_/g, ' ')}`}
                                          value={Number(cond.value)}
                                          min={config.min}
                                          max={config.max}
                                          step={config.step}
                                          direction={config.direction}
                                          description={`${cond.operator} ${cond.value}`}
                                          onChange={(newVal) => {
                                            const updatedRules = [...rules];
                                            const newProfile = JSON.parse(JSON.stringify(updatedRules[activeRuleIdx].threshold_value));
                                            newProfile.phases[phaseIdx].entryConditions[condIdx].value = newVal;
                                            updatedRules[activeRuleIdx].threshold_value = newProfile;
                                            setRules(updatedRules);
                                            setIsDirty(true);
                                          }}
                                        />
                                      );
                                    })}
                                    {phase.formChecks?.map((check: any, checkIdx: number) => {
                                      const config = getDynamicConfig(check.metric);
                                      return (
                                        <DifficultySlider
                                          key={`check-${checkIdx}`}
                                          label={`Form: ${check.metric.replace(/_/g, ' ')}`}
                                          value={Number(check.value)}
                                          min={config.min}
                                          max={config.max}
                                          step={config.step}
                                          direction={config.direction}
                                          description={`${check.operator} ${check.value}`}
                                          onChange={(newVal) => {
                                            const updatedRules = [...rules];
                                            const newProfile = JSON.parse(JSON.stringify(updatedRules[activeRuleIdx].threshold_value));
                                            newProfile.phases[phaseIdx].formChecks[checkIdx].value = newVal;
                                            updatedRules[activeRuleIdx].threshold_value = newProfile;
                                            setRules(updatedRules);
                                            setIsDirty(true);
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {rules[activeRuleIdx].threshold_value && Object.keys(rules[activeRuleIdx].threshold_value)
                                .filter(key => key !== 'penalty')
                                .map(key => {
                                const config = getDynamicConfig(key);
                                return (
                                  <DifficultySlider
                                    key={key}
                                    label={key}
                                    value={parseFloat(rules[activeRuleIdx].threshold_value[key])}
                                    min={config.min}
                                    max={config.max}
                                    step={config.step}
                                    direction={config.direction}
                                    description={config.description}
                                    imageUrl={config.imageUrl}
                                    onChange={(newVal) => handleRuleChange(activeRuleIdx, `threshold_${key}`, newVal)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-fg-mute font-body p-8 text-center bg-surface-card">
            Select an exercise from the left to configure rules for this athlete.
          </div>
        )}
      </div>

      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-card p-6 sm:p-8 rounded-2xl max-w-sm w-full shadow-2xl border border-border">
            <h3 className="h3 text-fg mb-2">Unsaved Changes</h3>
            <p className="font-body text-fg-mute mb-8 leading-relaxed">
              You have unsaved changes. Would you like to save them before switching exercises?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  await handleSaveAllRules();
                  setSelectedExercise(pendingExercise);
                  setActiveRuleIdx(0);
                  setIsDirty(false);
                  setShowExitModal(false);
                }}
                className="w-full py-3 bg-flame text-on-dark rounded-lg font-bold hover:scale-[1.02] active:scale-95 transition-transform shadow-flame"
              >
                Yes, Save & Switch
              </button>
              <button
                onClick={() => {
                  setSelectedExercise(pendingExercise);
                  setActiveRuleIdx(0);
                  setIsDirty(false);
                  setShowExitModal(false);
                }}
                className="w-full py-3 bg-err/10 text-err rounded-lg font-bold hover:bg-err/20 transition-colors"
              >
                No, Switch Without Saving
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3 bg-surface-elev text-fg-mute rounded-lg font-bold hover:bg-surface transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
