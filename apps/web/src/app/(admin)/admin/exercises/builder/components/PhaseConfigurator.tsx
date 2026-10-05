'use client';

import React, { useState, useEffect } from 'react';
import { DifficultySlider } from '@/components/DifficultySlider';
import { MetricSelectionPanel, MetricItem } from './MetricSelectionPanel';

export interface RuleConfig {
  id: string;
  metric: string;
  operator: '<' | '>' | '==' | '<=' | '>=';
  value: number;
  message?: string; // Voice cue / Error message
  isBlocking?: boolean; // For Entry conditions
}

export type ConfigTab = 'metrics' | 'transitions' | 'formChecks' | 'entryCue';

interface PhaseConfiguratorProps {
  phaseName: string;
  entryConditions: RuleConfig[];
  formChecks: RuleConfig[];
  entryCue?: string;
  entryCueEnabled?: boolean;
  isSetupPhase?: boolean;
  onUpdateSetupPhase?: (val: boolean) => void;
  onUpdatePhaseName?: (newName: string) => void;
  onUpdateEntryConditions: (rules: RuleConfig[]) => void;
  onUpdateFormChecks: (rules: RuleConfig[]) => void;
  onUpdateEntryCue?: (cue: string) => void;
  onUpdateEntryCueEnabled?: (enabled: boolean) => void;
  // Metric Selection Props
  availableMetrics?: MetricItem[];
  selectedMetricKeys?: string[];
  onToggleMetric?: (key: string) => void;
  onClearAllMetrics?: () => void;
  activeTab?: ConfigTab;
  onTabChange?: (tab: ConfigTab) => void;
  onExtractMetrics?: () => void;
  isManualMode?: boolean;
}

export const PhaseConfigurator: React.FC<PhaseConfiguratorProps> = ({ 
  phaseName,
  entryConditions,
  formChecks,
  entryCue = '',
  entryCueEnabled = false,
  isSetupPhase,
  onUpdateSetupPhase,
  onUpdatePhaseName,
  onUpdateEntryConditions,
  onUpdateFormChecks,
  onUpdateEntryCue,
  onUpdateEntryCueEnabled,
  availableMetrics,
  selectedMetricKeys = [],
  onToggleMetric,
  onClearAllMetrics,
  activeTab,
  onTabChange,
  onExtractMetrics,
  isManualMode
}) => {
  const [metricsLibrary, setMetricsLibrary] = useState<any[]>([]);
  const [internalTab, setInternalTab] = useState<ConfigTab>('transitions');
  const currentTab = activeTab !== undefined ? activeTab : internalTab;
  const setTab = (t: ConfigTab) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };

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

  const renderRuleRow = (rule: RuleConfig, listType: 'entry' | 'form', index: number = 0) => {
    const key = rule.id || `${listType}-${rule.metric || 'rule'}-${index}`;
    return (
      <div key={key} className="flex flex-col gap-2 bg-bg border border-border p-3 rounded-lg mb-2 relative">
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
        <div className="flex items-end justify-between w-full">
          <div className="flex gap-6">
            {/* Tab 1: Metric Selection (Moved before Phase Transitions) */}
            <button
              type="button"
              onClick={() => setTab('metrics')}
              className={`text-sm font-bold pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                currentTab === 'metrics'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-fg-mute hover:text-fg'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Metric Selection
              <span className={`px-1.5 py-0.2 rounded-full font-black text-[10px] ${
                currentTab === 'metrics'
                  ? 'bg-flame text-on-dark'
                  : 'bg-surface-elev text-fg-mute border border-border'
              }`}>
                {selectedMetricKeys.length}
              </span>
            </button>

            {/* Tab 2: Phase Transitions */}
            <button
              type="button"
              onClick={() => setTab('transitions')}
              className={`text-sm font-bold pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                currentTab === 'transitions'
                  ? 'border-[#22c55e] text-[#22c55e]'
                  : 'border-transparent text-fg-mute hover:text-fg'
              }`}
            >
              Phase Transitions
              {entryConditions.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full font-black text-[10px] ${
                  currentTab === 'transitions'
                    ? 'bg-[#22c55e]/20 text-[#22c55e]'
                    : 'bg-surface-elev text-fg-mute border border-border'
                }`}>
                  {entryConditions.length}
                </span>
              )}
            </button>

            {/* Tab 3: Live Form Checks */}
            <button
              type="button"
              onClick={() => setTab('formChecks')}
              className={`text-sm font-bold pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                currentTab === 'formChecks'
                  ? 'border-[#fbbf24] text-[#fbbf24]'
                  : 'border-transparent text-fg-mute hover:text-fg'
              }`}
            >
              Live Form Checks
              {formChecks.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full font-black text-[10px] ${
                  currentTab === 'formChecks'
                    ? 'bg-[#fbbf24]/20 text-[#fbbf24]'
                    : 'bg-surface-elev text-fg-mute border border-border'
                }`}>
                  {formChecks.length}
                </span>
              )}
            </button>

            {/* Tab 4: Entry Cue */}
            <button
              type="button"
              onClick={() => setTab('entryCue')}
              className={`text-sm font-bold pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                currentTab === 'entryCue'
                  ? 'border-[#a78bfa] text-[#a78bfa]'
                  : 'border-transparent text-fg-mute hover:text-fg'
              }`}
            >
              Entry Cue
              {entryCue && entryCueEnabled && (
                <span className="w-2 h-2 rounded-full bg-[#a78bfa]" title="Entry cue active" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Metric Selection Tab Content */}
      {currentTab === 'metrics' && (
        <div className="flex-1 mt-2">
          <MetricSelectionPanel
            availableMetrics={availableMetrics && availableMetrics.length > 0 ? availableMetrics : metricsLibrary}
            selectedMetricKeys={selectedMetricKeys}
            onToggleMetric={onToggleMetric || (() => {})}
            onClearAll={onClearAllMetrics}
            onExtractMetrics={onExtractMetrics}
            isManualMode={isManualMode}
          />
        </div>
      )}

      {/* Phase Transitions Tab Content */}
      {currentTab === 'transitions' && (
        !phaseName ? (
          <div className="flex-1 flex flex-col items-center justify-center text-fg-mute min-h-[300px]">
            <span className="material-symbols-outlined text-4xl mb-2 text-fg-subtle">flag</span>
            <p className="font-bold text-sm text-fg mb-1">No Phase Selected</p>
            <p className="text-xs">Select a phase on the timeline above to configure its transition rules.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pr-2 mt-4">
            <div className="flex-1 overflow-auto space-y-6">
                {onUpdateSetupPhase && (
                  <div className="flex items-center gap-4 bg-surface-elev p-3 rounded-lg border border-border">
                    <label className="flex items-center gap-2 text-xs font-bold text-fg cursor-pointer bg-bg px-3 py-1.5 rounded-full border border-border hover:border-flame transition">
                      <input 
                        type="checkbox" 
                        checked={!!isSetupPhase}
                        onChange={(e) => onUpdateSetupPhase(e.target.checked)}
                        className="accent-flame w-3.5 h-3.5"
                      />
                      Setup Phase (No Failures)
                    </label>
                  </div>
                )}

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
                    entryConditions.map((rule, idx) => renderRuleRow(rule, 'entry', idx))
                  )}
                </div>
              </div>
            </div>
        )
      )}

      {/* Form Checks Tab Content */}
      {currentTab === 'formChecks' && (
        !phaseName ? (
          <div className="flex-1 flex flex-col items-center justify-center text-fg-mute min-h-[300px]">
            <span className="material-symbols-outlined text-4xl mb-2 text-fg-subtle">verified</span>
            <p className="font-bold text-sm text-fg mb-1">No Phase Selected</p>
            <p className="text-xs">Select a phase on the timeline above to configure its form checks.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pr-2 mt-4">
            <div className="flex-1 overflow-auto space-y-6">
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
                  formChecks.map((rule, idx) => renderRuleRow(rule, 'form', idx))
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Entry Cue Tab Content */}
      {currentTab === 'entryCue' && (
        !phaseName ? (
          <div className="flex-1 flex flex-col items-center justify-center text-fg-mute min-h-[300px]">
            <span className="material-symbols-outlined text-4xl mb-2 text-fg-subtle">record_voice_over</span>
            <p className="font-bold text-sm text-fg mb-1">No Phase Selected</p>
            <p className="text-xs">Select a phase on the timeline above to set an entry cue.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pr-2 mt-4">
            <div className="bg-surface-elev rounded-lg p-5 border border-[#a78bfa]/30">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-[#a78bfa] font-bold text-sm tracking-wide">Phase Entry Voice Cue</h4>
                  <p className="text-xs text-fg-dim mt-0.5">Spoken once when the athlete enters this phase.</p>
                </div>
                {/* Enable / Disable Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-fg-mute">{entryCueEnabled ? 'Enabled' : 'Disabled'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!entryCueEnabled}
                    onClick={() => onUpdateEntryCueEnabled && onUpdateEntryCueEnabled(!entryCueEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#a78bfa]/50 ${
                      entryCueEnabled ? 'bg-[#a78bfa]' : 'bg-border'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                      entryCueEnabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <textarea
                rows={4}
                placeholder={`e.g. "Good! Now kick your knee out to the side."`}
                value={entryCue}
                onChange={(e) => onUpdateEntryCue && onUpdateEntryCue(e.target.value)}
                disabled={!entryCueEnabled}
                className={`w-full bg-bg text-sm text-fg border rounded-lg p-3 resize-none outline-none transition-all ${
                  entryCueEnabled
                    ? 'border-[#a78bfa]/50 focus:border-[#a78bfa]'
                    : 'border-border opacity-40 cursor-not-allowed'
                }`}
              />

              {entryCueEnabled && entryCue && (
                <div className="mt-3 flex items-start gap-2 bg-[#a78bfa]/10 border border-[#a78bfa]/20 rounded-lg p-3">
                  <span className="material-symbols-outlined text-[16px] text-[#a78bfa] mt-0.5">volume_up</span>
                  <p className="text-xs text-[#a78bfa]">Will speak: <em>"{entryCue}"</em></p>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
};
