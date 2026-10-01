'use client';

import React, { useState, useMemo } from 'react';

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

interface MetricSelectionPanelProps {
  availableMetrics: MetricItem[];
  selectedMetricKeys: string[];
  onToggleMetric: (key: string) => void;
  onSelectAll?: (keys: string[]) => void;
  onClearAll?: () => void;
  onBackToVideo?: () => void;
  onExtractMetrics?: () => void;
  isManualMode?: boolean;
}

export const MetricSelectionPanel: React.FC<MetricSelectionPanelProps> = ({
  availableMetrics,
  selectedMetricKeys,
  onToggleMetric,
  onClearAll,
  onBackToVideo,
  onExtractMetrics,
  isManualMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    availableMetrics.forEach(m => {
      if (m.category) cats.add(m.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [availableMetrics]);

  // Filter metrics
  const filteredMetrics = useMemo(() => {
    return availableMetrics.filter(m => {
      const name = (m.metric_name || m.name || m.metric_key || '').toLowerCase();
      const key = (m.metric_key || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || key.includes(q) || cat.includes(q);
      const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [availableMetrics, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-200">
      {/* Search & Category Filter Bar */}
      <div className="flex flex-col gap-2.5">
        {/* Search Input & Extract/Add Button Row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-fg-subtle text-[15px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search metric name or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-raised border border-border/80 rounded-xl pl-8 pr-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:border-flame transition-all"
            />
          </div>

          {onExtractMetrics && (
            <button
              type="button"
              onClick={onExtractMetrics}
              className="bg-flame text-on-dark hover:bg-flame/90 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-flame hover:scale-[1.01] active:scale-95 shrink-0 whitespace-nowrap"
              title={isManualMode ? "Add all selected metrics directly into active phase" : "Extract all selected metrics with auto-operators directly into active phase"}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isManualMode ? 'playlist_add' : 'auto_fix_high'}
              </span>
              {isManualMode ? 'Add Metrics to Current Phase' : 'Extract Metrics to Current Phase'} ({selectedMetricKeys.length})
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 thin-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-surface-elev text-flame border border-border shadow-sm font-black'
                  : 'bg-surface-raised/60 text-fg-mute hover:text-fg hover:bg-surface-raised border border-transparent'
              }`}
            >
              {cat === 'ALL' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1 thin-scrollbar">
        {filteredMetrics.length === 0 ? (
          <div className="col-span-full py-8 text-center text-fg-mute text-xs bg-surface-raised/30 rounded-xl border border-dashed border-border">
            No metrics match your search criteria.
          </div>
        ) : (
          filteredMetrics.map(metric => {
            const isSelected = selectedMetricKeys.includes(metric.metric_key);
            const displayName = metric.metric_name || metric.name || metric.metric_key;

            return (
              <div
                key={metric.metric_key}
                onClick={() => onToggleMetric(metric.metric_key)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group select-none ${
                  isSelected
                    ? 'bg-flame/5 border-flame/40 shadow-sm'
                    : 'bg-surface-raised/40 hover:bg-surface-raised border-border/70 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      isSelected
                        ? 'bg-flame border-flame text-on-dark shadow-sm'
                        : 'border-border bg-surface-card group-hover:border-fg-mute'
                    }`}>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[14px] font-black">check</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className={`font-bold text-xs truncate transition-colors ${
                        isSelected ? 'text-flame' : 'text-fg'
                      }`}>
                        {displayName}
                      </h5>
                      <span className="text-[10px] font-mono text-fg-subtle truncate block mt-0.5">
                        {metric.metric_key}
                      </span>
                    </div>
                  </div>

                  {metric.category && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-elev text-fg-mute border border-border/50 shrink-0">
                      {metric.category}
                    </span>
                  )}
                </div>

                {metric.description && (
                  <p className="text-[11px] text-fg-mute line-clamp-2 leading-relaxed">
                    {metric.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-fg-subtle font-medium">
                  <span>Range: {metric.min_val ?? 0}° – {metric.max_val ?? 180}°</span>
                  <span className={`font-bold ${isSelected ? 'text-flame' : 'text-fg-mute'}`}>
                    {isSelected ? 'Active' : 'Click to add'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Summary Footer */}
      <div className="bg-surface-raised border border-border p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-fg">Active:</span>
          {selectedMetricKeys.length === 0 ? (
            <span className="text-xs text-err font-bold">None</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {selectedMetricKeys.map(key => {
                const metric = availableMetrics.find(m => m.metric_key === key);
                const name = metric?.metric_name || metric?.name || key;
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-elev border border-border text-[10px] font-bold text-fg shadow-sm"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMetric(key);
                      }}
                      className="text-fg-subtle hover:text-err transition-colors"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {onClearAll && selectedMetricKeys.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-bold text-fg-mute hover:text-err transition-colors px-2 py-1 rounded-lg hover:bg-surface-elev"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
};
