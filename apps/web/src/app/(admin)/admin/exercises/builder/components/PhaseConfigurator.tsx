'use client';

import React, { useState, useEffect } from 'react';
import { DifficultySlider } from '@/components/DifficultySlider';

export interface RuleConfig {
  id: string;
  metric: string;
  operator: '<' | '>' | '==' | '<=' | '>=';
  value: number;
  message?: string; // Voice cue / Error message
  isBlocking?: boolean; // For Entry conditions
}

interface PhaseConfiguratorProps {
  phaseName: string;
  entryConditions: RuleConfig[];
  formChecks: RuleConfig[];
  onUpdateEntryConditions: (rules: RuleConfig[]) => void;
  onUpdateFormChecks: (rules: RuleConfig[]) => void;
}

export const PhaseConfigurator: React.FC<PhaseConfiguratorProps> = ({ 
  phaseName,
  entryConditions,
  formChecks,
  onUpdateEntryConditions,
  onUpdateFormChecks,
  isSetupPhase,
  onUpdateSetupPhase,
  onUpdatePhaseName
}: PhaseConfiguratorProps & { isSetupPhase?: boolean, onUpdateSetupPhase?: (val: boolean) => void, onUpdatePhaseName?: (name: string) => void }) => {

  const [metricsLibrary, setMetricsLibrary] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'transitions' | 'formChecks'>('transitions');

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => setMetricsLibrary(data))
      .catch(err => console.error("Failed to load metrics library", err));
  }, []);

  const getMetricConfig = (id: string) => {
    return metricsLibrary.find(m => m.metric_key === id) || { min_val: 0, max_val: 100, step_val: 1, direction: 'asc' };
  };

  const addEntryCondition = () => {
    onUpdateEntryConditions([...entryConditions, {
      id: Date.now().toString(),
      metric: 'KNEE_ANGLE',
      operator: '<',
      value: 160,
      isBlocking: true
    }]);
  };

  const addFormCheck = () => {
    onUpdateFormChecks([...formChecks, {
      id: Date.now().toString(),
      metric: 'KNEE_VALGUS_RATIO',
      operator: '<',
      value: 0.85,
      message: 'Push your knees out!'
    }]);
  };

  const updateRule = (listType: 'entry' | 'form', id: string, key: keyof RuleConfig, val: any) => {
    if (listType === 'entry') {
      onUpdateEntryConditions(entryConditions.map(r => r.id === id ? { ...r, [key]: val } : r));
    } else {
      onUpdateFormChecks(formChecks.map(r => r.id === id ? { ...r, [key]: val } : r));
    }
  };

  const removeRule = (listType: 'entry' | 'form', id: string) => {
    if (listType === 'entry') {
      onUpdateEntryConditions(entryConditions.filter(r => r.id !== id));
    } else {
      onUpdateFormChecks(formChecks.filter(r => r.id !== id));
    }
  };

  const renderRuleRow = (rule: RuleConfig, listType: 'entry' | 'form') => {
    return (
      <div key={rule.id} className="flex flex-col gap-2 bg-bg border border-border p-3 rounded-lg mb-2 relative">
        <button 
          onClick={() => removeRule(listType, rule.id)}
          className="absolute top-2 right-2 text-fg-mute hover:text-err font-bold"
        >
          ✕
        </button>
        
        <div className="flex gap-2 items-center w-full pr-6">
          <select 
            className="flex-1 bg-surface-elev text-sm text-fg border border-border rounded p-1.5 focus:border-flame outline-none"
            value={rule.metric}
            onChange={(e) => updateRule(listType, rule.id, 'metric', e.target.value)}
          >
            {metricsLibrary.map(m => (
              <option key={m.metric_key} value={m.metric_key}>{m.metric_name}</option>
            ))}
          </select>

          <select 
            className="w-16 bg-surface-elev text-sm text-fg border border-border rounded p-1.5 text-center focus:border-flame outline-none"
            value={rule.operator}
            onChange={(e) => updateRule(listType, rule.id, 'operator', e.target.value)}
          >
            <option value="<">{'<'}</option>
            <option value="<=">{'<='}</option>
            <option value=">">{'>'}</option>
            <option value=">=">{'>='}</option>
            <option value="==">{'=='}</option>
          </select>
        </div>

        <div className="-mt-2 pr-6">
          <DifficultySlider
            label=""
            value={rule.value}
            min={parseFloat(getMetricConfig(rule.metric).min_val)}
            max={parseFloat(getMetricConfig(rule.metric).max_val)}
            step={parseFloat(getMetricConfig(rule.metric).step_val)}
            direction={getMetricConfig(rule.metric).direction}
            onChange={(newVal) => updateRule(listType, rule.id, 'value', newVal)}
          />
        </div>

        {listType === 'form' && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[#fbbf24] font-bold w-16">VOICE CUE:</span>
            <input 
              type="text" 
              placeholder="e.g. Keep your chest up!"
              className="flex-1 bg-bg text-sm text-fg border border-border rounded p-1.5 focus:border-[#fbbf24] outline-none"
              value={rule.message || ''}
              onChange={(e) => updateRule(listType, rule.id, 'message', e.target.value)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-surface-card border border-border rounded-xl p-6 shadow-card flex flex-col gap-4 min-h-[400px]">
      <div className="flex items-end border-b border-border">
        {phaseName ? (
          <div className="flex items-end gap-8 w-full">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('transitions')}
                className={`text-sm font-bold pb-3 border-b-2 transition-colors ${
                  activeTab === 'transitions'
                    ? 'border-[#22c55e] text-[#22c55e]'
                    : 'border-transparent text-fg-mute hover:text-fg'
                }`}
              >
                Phase Transitions
              </button>
              <button
                onClick={() => setActiveTab('formChecks')}
                className={`text-sm font-bold pb-3 border-b-2 transition-colors ${
                  activeTab === 'formChecks'
                    ? 'border-[#fbbf24] text-[#fbbf24]'
                    : 'border-transparent text-fg-mute hover:text-fg'
                }`}
              >
                Live Form Checks
              </button>
            </div>
          </div>
        ) : (
          <h3 className="kicker text-fg flex items-center gap-2 pb-3">
            <span className="w-2.5 h-2.5 bg-flame rounded-full"></span>
            Step 3: Phase Configurator
          </h3>
        )}
      </div>

      {!phaseName ? (
        <div className="flex-1 flex flex-col items-center justify-center text-fg-mute">
          <p>Select a phase on the timeline to configure its rules.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col pr-2 mt-4">
          <div className="flex-1 overflow-auto space-y-6">
            {/* Entry Conditions Block */}
            {activeTab === 'transitions' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4 bg-surface-elev p-3 rounded-lg border border-border">
                  {onUpdateSetupPhase && (
                    <label className="flex items-center gap-2 text-xs font-bold text-fg cursor-pointer bg-bg px-3 py-1.5 rounded-full border border-border hover:border-flame transition">
                      <input 
                        type="checkbox" 
                        checked={!!isSetupPhase}
                        onChange={(e) => onUpdateSetupPhase(e.target.checked)}
                        className="accent-flame w-3.5 h-3.5"
                      />
                      Setup Phase (No Failures)
                    </label>
                  )}
                  <div className="flex items-center gap-2 bg-bg px-3 py-1.5 rounded-full border border-border">
                    <span className="text-fg-mute text-xs font-bold">Phase Type:</span>
                    <select
                      className="bg-transparent text-flame text-xs font-bold outline-none cursor-pointer max-w-[250px] truncate"
                      value={phaseName || ''}
                      onChange={(e) => onUpdatePhaseName && onUpdatePhaseName(e.target.value)}
                      disabled={!phaseName}
                    >
                      {!['Setup', 'First Movement', 'Hold / Pause', 'Top', 'Return Movement'].includes(phaseName) && (
                        <option value={phaseName}>{phaseName || 'None Selected'}</option>
                      )}
                      <option value="Setup">Setup (Preparing for the rep)</option>
                      <option value="First Movement">First Movement (e.g., Descending, Twisting Left)</option>
                      <option value="Hold / Pause">Hold / Pause (e.g., Pausing at bottom)</option>
                      <option value="Top">Top (e.g., Pausing at the top)</option>
                      <option value="Return Movement">Return Movement (e.g., Ascending, Twisting Right)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-surface-elev rounded-lg p-5 border border-border">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-[#22c55e] font-bold text-sm tracking-wide">Phase Transitions (Exit Conditions)</h4>
                    <p className="text-xs text-fg-dim mt-0.5">Rules that must be met to MOVE to the NEXT phase.</p>
                  </div>
                  <button 
                    onClick={addEntryCondition}
                    className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 hover:bg-[#22c55e]/20 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    + Add Rule
                  </button>
                </div>
                
                {entryConditions.length === 0 ? (
                  <p className="text-xs text-fg-mute italic">No transition rules set. Phase will transition immediately.</p>
                ) : (
                  entryConditions.map(rule => renderRuleRow(rule, 'entry'))
                )}
              </div>
            </div>
            )}

            {/* Form Checks Block */}
            {activeTab === 'formChecks' && (
              <div className="bg-surface-elev rounded-lg p-5 border border-border">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-[#fbbf24] font-bold text-sm tracking-wide">Live Form Checks</h4>
                    <p className="text-xs text-fg-dim mt-0.5">Errors checked continuously during this phase.</p>
                  </div>
                  <button 
                    onClick={addFormCheck}
                    className="bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30 hover:bg-[#fbbf24]/20 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    + Add Check
                  </button>
                </div>

                {formChecks.length === 0 ? (
                  <p className="text-xs text-fg-mute italic">No form checks set. Rep will not fail during this phase.</p>
                ) : (
                  formChecks.map(rule => renderRuleRow(rule, 'form'))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
