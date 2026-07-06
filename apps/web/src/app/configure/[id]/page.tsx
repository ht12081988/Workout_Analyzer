"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { DifficultySlider } from "@/components/DifficultySlider";
import { getParamConfig, RULE_SECTION_DESCRIPTIONS } from "@/lib/ruleConfig";

export default function AthleteConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const initialExerciseId = params?.id as string;
  const [athleteId, setAthleteId] = useState<string | null>(null);

  useEffect(() => {
    const athleteAuth = localStorage.getItem("visionfit.auth.user");
    if (!athleteAuth) {
      router.push("/");
      return;
    }
    const athlete = JSON.parse(athleteAuth);
    setAthleteId(athlete.id);
  }, [router]);

  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [activeRuleIdx, setActiveRuleIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

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

  // 1. Fetch Exercises to find the selected one
  useEffect(() => {
    fetch('http://localhost:5002/exercises')
      .then(res => res.json())
      .then(data => {
        const exercisesData = Array.isArray(data) ? data : (data?.data || []);
        if (exercisesData && exercisesData.length > 0) {
          const targetExercise = exercisesData.find((ex: any) => String(ex.id) === String(initialExerciseId));
          setSelectedExercise(targetExercise || exercisesData[0]);
        }
        setLoadingEx(false);
      })
      .catch(err => {
        console.error("Failed to fetch exercises", err);
        setLoadingEx(false);
      });
  }, [initialExerciseId]);

  // 2. Fetch Rules when selectedExercise changes
  useEffect(() => {
    if (!selectedExercise || !athleteId) return;
    setLoadingRules(true);
    fetch(`http://localhost:5002/exercises/${selectedExercise.id}/rules?mode=self&customer_id=${athleteId}`)
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
  }, [selectedExercise, athleteId]);

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
          customer_id: athleteId
        };
        
        return fetch('http://localhost:5002/athlete/rules', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      });
      
      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);
      
      if (allOk) {
        toast.success(`Successfully saved your preferences for ${selectedExercise.name}`);
        setIsDirty(false);
      } else {
        toast.error(`Failed to save some preferences.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error saving preferences.`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefaults = async () => {
    try {
      const res = await fetch(`http://localhost:5002/exercises/${selectedExercise.id}/rules`);
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

  const handleBackClick = () => {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      router.push('/');
    }
  };

  if (loadingEx) return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="animate-pulse text-flame font-headline text-xl">Loading exercises...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-bg pb-28 text-fg">
      <nav className="fixed left-0 top-0 z-50 flex h-16 sm:h-20 w-full items-center justify-between bg-surface-card/60 px-4 shadow-sm backdrop-blur-xl md:px-8 border-b border-border">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 max-w-[35%] xs:max-w-[45%] mr-2">
          <button
            onClick={handleBackClick}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-elev border border-border text-flame hover:bg-surface-elev-hover transition-all"
            title="Back to Dashboard"
            type="button"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="hidden h3 italic text-fg lg:block">VisionFiT</span>
          
          <div className="h-8 w-[1px] bg-border mx-2 hidden lg:block" />
          
          {selectedExercise && (
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-elev border border-border text-flame hidden xs:flex">
                <span className="material-symbols-outlined text-lg sm:text-xl">tune</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="h3 !text-xs sm:!text-sm text-fg leading-none truncate">
                    {selectedExercise.name} Rules
                  </h2>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden xl:flex items-center justify-center max-w-[50%] overflow-hidden">
          {rules.length > 0 && (
            <div className="flex items-center gap-1 bg-surface-elev rounded-full p-1 border border-border shadow-inner overflow-x-auto no-scrollbar">
              {rules.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setActiveRuleIdx(i)}
                  className={`px-4 py-2 font-headline font-bold text-[11px] rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                    activeRuleIdx === i 
                      ? 'bg-surface-card text-flame shadow-md border border-border'
                      : 'text-fg-mute hover:text-fg'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {getIconForRule(r.rule_name)}
                  </span>
                  {r.rule_name.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {rules.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleLoadDefaults}
                disabled={saving}
                className="px-4 md:px-6 py-2.5 bg-surface-elev border border-border text-fg rounded-full font-headline font-bold text-sm hover:bg-surface-elev-hover transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">restore</span>
                <span className="hidden md:inline">Default</span>
              </button>
              <button
                onClick={handleSaveAllRules}
                disabled={saving}
                className="px-4 md:px-6 py-2.5 bg-flame text-on-dark rounded-full font-headline font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-70 disabled:hover:scale-100 flex items-center gap-2 shadow-flame"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {saving ? "Saving..." : <span className="hidden md:inline">Save</span>}
              </button>
            </div>
          )}
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-4 pb-8 pt-20 md:px-8 md:pt-24">
        <div className="bg-surface-card rounded-[24px] shadow-card border border-border overflow-hidden flex flex-col">
          {selectedExercise ? (
            <div className="p-4 md:p-6">
              {loadingRules ? (
                <div className="animate-pulse text-fg-mute text-center py-12">Loading rules...</div>
              ) : rules.length === 0 ? (
                <div className="text-fg-mute text-center my-12 bg-surface-elev py-12 rounded-2xl border border-border border-dashed">
                  No pose rules defined for this exercise.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tab Navigation (Mobile & Tablet) */}
                  <div className="flex xl:hidden flex-wrap items-center gap-2 bg-surface-elev rounded-2xl p-2 mb-4 border border-border">
                    {rules.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveRuleIdx(i)}
                        className={`px-6 py-3 font-headline font-bold text-sm rounded-xl transition-all flex items-center gap-2 flex-grow sm:flex-grow-0 justify-center ${
                          activeRuleIdx === i 
                            ? 'bg-surface-card text-flame shadow-md border border-border'
                            : 'text-fg-mute hover:text-fg hover:bg-surface-elev border border-transparent'
                        }`}
                        type="button"
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
                    <div className="bg-surface-elev rounded-[2rem] p-6 md:p-8 border border-border shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
                        <div>
                          <p className="text-base text-fg-mute leading-relaxed">
                            {RULE_SECTION_DESCRIPTIONS[rules[activeRuleIdx].rule_name] || "Configure specific parameter thresholds for this rule."}
                          </p>
                          <div className="flex gap-2 mt-4">
                             <span className="text-[11px] font-label font-bold uppercase tracking-widest bg-bg border border-border px-3 py-1.5 rounded-md text-fg-mute shadow-inner">
                               {rules[activeRuleIdx].rule_type}
                             </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          ) : (
            <div className="flex-1 flex items-center justify-center text-fg-mute p-12 text-center">
              Failed to load the selected exercise.
            </div>
          )}
        </div>
      </section>

      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-card p-6 sm:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl border border-border">
            <h3 className="h3 text-fg mb-2">Unsaved Changes</h3>
            <p className="text-fg-mute mb-8 leading-relaxed">
              You have unsaved changes. Would you like to save them before leaving?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  await handleSaveAllRules();
                  router.push('/');
                }}
                className="w-full py-3 bg-flame text-on-dark rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-transform shadow-flame"
              >
                Yes, Save & Exit
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-err/10 text-err rounded-xl font-bold hover:bg-err/20 transition-colors"
              >
                No, Exit Without Saving
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3 bg-surface-elev text-fg-mute rounded-xl font-bold hover:bg-surface-elev-hover transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
