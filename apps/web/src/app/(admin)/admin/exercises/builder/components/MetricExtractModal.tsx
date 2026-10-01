'use client';

import React, { useState, useMemo } from 'react';
import { PoseData, DynamicRule, predictMetricOperatorAndBuffer } from '@workout/shared';
import { RuleConfig } from './PhaseConfigurator';

export interface MetricItem {
  metric_key: string;
  metric_name?: string;
  name?: string;
  category?: string;
  description?: string;
  unit?: string;
  min_val?: number;
  max_val?: number;
}

interface MetricExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPhaseName: string;
  currentTimeMs: number;
  availableMetrics: MetricItem[];
  currentPose: PoseData;
  previousPose?: PoseData | null;
  previousPhaseName?: string;
  onApply: (rules: RuleConfig[], targetType: 'entry' | 'formCheck') => void;
}

export const MetricExtractModal: React.FC<MetricExtractModalProps> = ({
  isOpen,
  onClose,
  targetPhaseName,
  currentTimeMs,
  availableMetrics,
  currentPose,
  previousPose,
  previousPhaseName,
  onApply
}) => {
  const [targetType, setTargetType] = useState<'entry' | 'formCheck'>('entry');
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [operatorOverrides, setOperatorOverrides] = useState<Record<string, '<' | '>' | '<=' | '>='>>({});
  const [valueOverrides, setValueOverrides] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Format timestamp mm:ss.ms
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${millis}`;
  };

  const mockState = { timeMs: currentTimeMs, baseTorsoHeight: 0.5 };

  // Calculate telemetry and prediction for all available metrics
  const analyzedMetrics = useMemo(() => {
    if (!currentPose) return [];

    return availableMetrics.map(m => {
      let prevVal = 0;
      if (previousPose) {
        prevVal = DynamicRule.calculateMetric(m.metric_key, previousPose, mockState);
      }
      const currVal = DynamicRule.calculateMetric(m.metric_key, currentPose, mockState);

      // If no previous pose available, default prevVal to currVal
      const effectivePrev = previousPose ? prevVal : currVal;
      const pred = predictMetricOperatorAndBuffer(m.metric_key, effectivePrev, currVal);

      return {
        ...m,
        prevVal: Number(effectivePrev.toFixed(1)),
        currVal: Number(currVal.toFixed(1)),
        delta: pred.delta,
        pred
      };
    }).sort((a, b) => {
      // Prioritize significant changes first
      if (a.pred.isSignificantChange && !b.pred.isSignificantChange) return -1;
      if (!a.pred.isSignificantChange && b.pred.isSignificantChange) return 1;
      return Math.abs(b.delta) - Math.abs(a.delta);
    });
  }, [availableMetrics, currentPose, previousPose, currentTimeMs]);

  // Filter based on search query
  const filteredMetrics = useMemo(() => {
    if (!searchQuery.trim()) return analyzedMetrics;
    const q = searchQuery.toLowerCase();
    return analyzedMetrics.filter(m => {
      const nameStr = (m.name || (m as any).metric_name || '').toLowerCase();
      const keyStr = (m.metric_key || '').toLowerCase();
      return nameStr.includes(q) || keyStr.includes(q);
    });
  }, [analyzedMetrics, searchQuery]);

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleApply = () => {
    const selected = analyzedMetrics.filter(m => selectedKeys[m.metric_key]);
    if (selected.length === 0) return;

    const generatedRules: RuleConfig[] = selected.map(item => {
      const op = operatorOverrides[item.metric_key] || item.pred.operator;
      const val = valueOverrides[item.metric_key] !== undefined ? valueOverrides[item.metric_key] : item.pred.targetValue;
      const displayName = item.name || (item as any).metric_name || item.metric_key;
      return {
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        metric: item.metric_key,
        operator: op,
        value: val,
        isBlocking: targetType === 'entry',
        message: targetType === 'formCheck' ? `Maintain proper ${displayName.toLowerCase()}` : undefined
      };
    });

    onApply(generatedRules, targetType);
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = Object.values(selectedKeys).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#00142b] border border-white/10 rounded-[28px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <span className="material-symbols-outlined text-xl">auto_fix_high</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white leading-tight">
                Extract Metrics to Phase
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-white/50">
                <span className="text-cyan-400 font-bold">{targetPhaseName || 'Target Phase'}</span>
                <span>•</span>
                <span className="tabular-nums">Time: {formatTime(currentTimeMs)}</span>
                {previousPhaseName && (
                  <>
                    <span>•</span>
                    <span className="text-white/40">From: {previousPhaseName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Target Type Selector */}
        <div className="px-6 py-3.5 bg-white/[0.01] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-white/60">Apply extracted metrics as:</span>
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setTargetType('entry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                targetType === 'entry'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              Phase Transition Gate (Entry Condition)
            </button>
            <button
              onClick={() => setTargetType('formCheck')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                targetType === 'formCheck'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              Form Quality Check (Warning)
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-white/5 bg-black/20">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-white/30 text-base">search</span>
            <input
              type="text"
              placeholder="Search joint angles, ratios, metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Metric Cards List */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3 custom-scrollbar">
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-10 text-white/40 text-xs">
              No matching metrics found.
            </div>
          ) : (
            filteredMetrics.map((item) => {
              const isSelected = !!selectedKeys[item.metric_key];
              const isSignificant = item.pred.isSignificantChange;
              const op = operatorOverrides[item.metric_key] || item.pred.operator;
              const val = valueOverrides[item.metric_key] !== undefined ? valueOverrides[item.metric_key] : item.pred.targetValue;

              return (
                <div
                  key={item.metric_key}
                  onClick={() => toggleSelect(item.metric_key)}
                  className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by container
                        className="w-4 h-4 rounded text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-white/10 border-white/20"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {item.name || (item as any).metric_name || item.metric_key}
                          </span>
                          {isSignificant && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-black text-orange-400 uppercase tracking-wider flex items-center gap-1">
                              🔥 Active Joint
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-white/40">{item.metric_key}</span>
                      </div>
                    </div>

                    {/* Movement direction tag */}
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-xs font-black tabular-nums ${
                        item.delta < -5 ? 'text-emerald-400' : item.delta > 5 ? 'text-amber-400' : 'text-white/40'
                      }`}>
                        {item.delta > 0 ? `+${item.delta}°` : `${item.delta}°`}
                      </span>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                        {item.pred.movementType}
                      </span>
                    </div>
                  </div>

                  {/* Auto-detected Rule Proposal */}
                  <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/40 font-medium">Trajectory:</span>
                      <span className="font-bold text-white/70 tabular-nums">{item.prevVal}°</span>
                      <span className="text-white/30">➔</span>
                      <span className="font-black text-white tabular-nums">{item.currVal}°</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-cyan-400/80 uppercase tracking-wider">
                        Auto Rule:
                      </span>

                      {/* Operator override selector */}
                      <select
                        value={op}
                        onChange={(e) => {
                          setOperatorOverrides(prev => ({
                            ...prev,
                            [item.metric_key]: e.target.value as any
                          }));
                        }}
                        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="<" className="bg-[#00142b]">&lt;</option>
                        <option value=">" className="bg-[#00142b]">&gt;</option>
                        <option value="<=" className="bg-[#00142b]">&le;</option>
                        <option value=">=" className="bg-[#00142b]">&ge;</option>
                      </select>

                      {/* Target value input with buffer applied */}
                      <input
                        type="number"
                        step={item.metric_key.includes('RATIO') ? 0.01 : 0.5}
                        value={val}
                        onChange={(e) => {
                          setValueOverrides(prev => ({
                            ...prev,
                            [item.metric_key]: Number(e.target.value)
                          }));
                        }}
                        className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs font-black text-white text-right tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-xs text-white/40 font-bold">
                        {item.metric_key.includes('RATIO') ? '' : '°'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
          <span className="text-xs text-white/50 font-medium">
            {selectedCount} metric{selectedCount === 1 ? '' : 's'} selected
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedCount === 0}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg flex items-center gap-2 ${
                selectedCount > 0
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:scale-105 shadow-cyan-500/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              Apply Selected to Phase ({selectedCount})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
