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

  if (loadingEx) return <div className="p-8 text-on-surface-variant font-body animate-pulse">Loading exercises...</div>;

  return (
    <div className="w-full h-full flex flex-col p-10 bg-surface-container-low/50">
      <div className="flex gap-8 h-[calc(100vh-16rem)] min-h-[600px]">
      {/* Left Sidebar: Exercises List */}
      <div className="w-1/5 min-w-[200px] bg-surface-container-lowest rounded-3xl shadow-sm border border-outline/5 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-outline/10 shrink-0">
          <h2 className="text-xl font-bold font-headline text-on-surface">Exercises</h2>
          <p className="text-sm text-on-surface-variant mt-1 font-body">Select an exercise to configure pose rules.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {exercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => handleExerciseChange(ex)}
              className={`w-full text-left px-5 py-4 rounded-2xl transition-all font-headline font-bold text-sm ${
                selectedExercise?.id === ex.id 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                  : 'bg-transparent text-on-surface hover:bg-surface-container-high border border-transparent hover:border-outline/5'
              }`}
            >
              {ex.name}
              <div className="text-xs font-body font-normal text-on-surface-variant mt-1">
                {ex.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Content: Rule Editor */}
      <div className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline/5 overflow-hidden flex flex-col">
        {selectedExercise ? (
          <>
            <div className="p-6 border-b border-outline/10 shrink-0 flex justify-between items-center bg-surface-container-low/30">
              <div>
                <h2 className="text-xl font-bold font-headline text-on-surface">{selectedExercise.name} Rules</h2>
                <p className="text-sm text-on-surface-variant mt-1 font-body">
                  Configure form-checking parameters specifically for this athlete.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rules.length > 0 && (
                  <>
                    <button
                      onClick={handleLoadDefaults}
                      disabled={saving}
                      className="px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-full font-headline font-bold text-sm hover:bg-surface-variant transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                    >
                      <span className="material-symbols-outlined text-[18px]">restore</span>
                      Default
                    </button>
                    <button
                      onClick={handleSaveAllRules}
                      disabled={saving}
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-headline font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-70 disabled:hover:scale-100 flex items-center gap-2 shadow-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-surface-container-lowest">
              {loadingRules ? (
                <div className="animate-pulse text-on-surface-variant">Loading rules...</div>
              ) : rules.length === 0 ? (
                <div className="text-on-surface-variant text-center mt-12 bg-surface-variant/30 py-8 rounded-2xl border border-outline/5 border-dashed">
                  No pose rules defined for this exercise.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Tab Navigation */}
                  <div className="inline-flex items-center bg-surface-container-high/50 rounded-full p-1 mb-6 overflow-x-auto max-w-full">
                    {rules.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveRuleIdx(i)}
                        className={`px-6 py-2.5 font-headline font-bold text-sm whitespace-nowrap rounded-full transition-all flex items-center gap-2 ${
                          activeRuleIdx === i 
                            ? 'bg-surface-container-lowest text-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
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
                    <div className="bg-surface-container-low rounded-2xl p-6 border border-outline/10 shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-6 border-b border-outline/5 pb-4">
                        <div>
                          <p className="text-sm font-body text-on-surface-variant leading-relaxed">
                            {RULE_SECTION_DESCRIPTIONS[rules[activeRuleIdx].rule_name] || "Configure specific parameter thresholds for this rule."}
                          </p>
                          <div className="flex gap-2 mt-3">
                             <span className="text-[10px] font-label font-bold uppercase tracking-wider bg-surface-container-highest px-2 py-1 rounded text-on-surface-variant">
                               {rules[activeRuleIdx].rule_type}
                             </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        {/* Threshold Settings */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rules[activeRuleIdx].threshold_value && Object.keys(rules[activeRuleIdx].threshold_value)
                              .filter(key => key !== 'penalty')
                              .map(key => {
                              const config = getParamConfig(key);
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
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body p-8 text-center bg-surface-container-lowest">
            Select an exercise from the left to configure rules for this athlete.
          </div>
        )}
      </div>

      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl border border-outline/10">
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Unsaved Changes</h3>
            <p className="font-body text-on-surface-variant mb-8 leading-relaxed">
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
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-transform shadow-md"
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
                className="w-full py-3 bg-error/10 text-error rounded-xl font-bold hover:bg-error/20 transition-colors"
              >
                No, Switch Without Saving
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3 bg-surface-variant/50 text-on-surface-variant rounded-xl font-bold hover:bg-surface-variant transition-colors mt-2"
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
