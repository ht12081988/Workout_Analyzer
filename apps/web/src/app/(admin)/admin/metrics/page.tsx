'use client';

import { useState, useEffect, useMemo } from 'react';

const PREFERRED_CATEGORY_ORDER = [
  'All',
  'Hips & Pelvis',
  'Spine & Trunk',
  'Shoulders & Scapula',
  'Knees & Legs',
  'Ankles & Feet',
  'Arms & Hands',
  'Balance & Velocity'
];

export default function MasterMetricsPage() {
  const [masterMetrics, setMasterMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inspectMetric, setInspectMetric] = useState<any | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/metrics');
        const data = await res.json();
        setMasterMetrics(data);
      } catch (err) {
        console.error('Failed to load master metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const categories = useMemo(() => {
    const existingCategories = new Set<string>();
    masterMetrics.forEach((m) => {
      if (m.category) existingCategories.add(m.category);
    });

    // Sort by preferred anatomical order, then any remaining alphabetically
    const ordered: string[] = [];
    for (const cat of PREFERRED_CATEGORY_ORDER) {
      if (cat === 'All' || existingCategories.has(cat)) {
        ordered.push(cat);
      }
    }
    existingCategories.forEach((cat) => {
      if (!ordered.includes(cat)) {
        ordered.push(cat);
      }
    });
    return ordered;
  }, [masterMetrics]);

  const filteredMetrics = useMemo(() => {
    return masterMetrics.filter((config) => {
      const matchesCat = selectedCategory === 'All' || config.category === selectedCategory;
      if (!matchesCat) return false;
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        (config.metric_name || '').toLowerCase().includes(term) ||
        (config.metric_key || '').toLowerCase().includes(term) ||
        (config.category || '').toLowerCase().includes(term) ||
        (config.description || '').toLowerCase().includes(term)
      );
    });
  }, [masterMetrics, selectedCategory, search]);

  // Helper to parse description into main purpose and difficulty tiers
  const parseDescription = (desc: string) => {
    if (!desc) return { main: '', tiers: [] };
    const parts = desc.split('\n\n');
    const main = parts[0] || '';
    const tiersText = parts.slice(1).join('\n\n');
    const lines = tiersText.split('\n').filter((l) => l.trim().startsWith('•'));
    const tiers = lines.map((l) => {
      const clean = l.replace(/^•\s*/, '');
      const [title, ...rest] = clean.split(':');
      return {
        title: title?.trim(),
        detail: rest.join(':')?.trim()
      };
    });
    return { main, tiers };
  };

  if (loading) {
    return (
      <div className="p-12 text-fg-mute text-sm flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-flame border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs uppercase tracking-wider text-fg-dim">Loading Master Metrics Library...</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 w-full flex flex-col gap-6 max-w-7xl mx-auto">
      {/* 1. Header Row: Title & Subtitle on Left, Search Bar on Right */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-fg">Master Metrics Library</h1>
            <span className="bg-flame/15 text-flame border border-flame/30 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold">
              {masterMetrics.length} Active
            </span>
          </div>
          <p className="text-sm text-fg-mute mt-1 max-w-2xl">
            Biomechanical movement benchmarks, anatomical axes, and clinical difficulty thresholds for MR-CAS audits &amp; custom exercise builder.
          </p>
        </div>

        {/* Prominent Search Bar & Tiers Legend (Top Right) */}
        <div className="flex flex-col items-start lg:items-end gap-2 w-full lg:w-96 flex-shrink-0">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-dim text-[19px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search metric name, key, joint, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface text-fg text-sm rounded-xl py-2 pl-10 pr-10 border border-border focus:outline-none focus:ring-2 focus:ring-flame/30 transition-all shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-dim hover:text-fg w-5 h-5 rounded-full flex items-center justify-center text-xs bg-surface-raised transition-colors"
                title="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          {/* Difficulty Tiers Legend (Neatly aligned under search bar) */}
          <div className="flex items-center gap-2 text-[11px] text-fg-dim font-medium">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Tiers:</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Screening
            </span>
            <span className="text-fg-dim/40">&bull;</span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span> Functional
            </span>
            <span className="text-fg-dim/40">&bull;</span>
            <span className="flex items-center gap-1 text-flame font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-flame inline-block"></span> Athletic
            </span>
          </div>
        </div>
      </div>

      {/* 2. Category Tabs Row (Full Width, Perfectly Aligned) */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = cat === 'All' ? masterMetrics.length : masterMetrics.filter((m) => m.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-flame text-white shadow-md shadow-flame/20 scale-[1.02]'
                  : 'bg-surface border border-border text-fg-mute hover:text-fg hover:bg-surface-elev'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/25 text-white font-bold' : 'bg-surface-raised text-fg-dim'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Sub-bar: Active filters count and reset button */}
      {(selectedCategory !== 'All' || search) && (
        <div className="flex items-center justify-between text-xs text-fg-mute px-1">
          <div>
            Showing <strong className="text-fg">{filteredMetrics.length}</strong> of{' '}
            <strong className="text-fg">{masterMetrics.length}</strong> metrics
            {selectedCategory !== 'All' && (
              <span> in <strong className="text-flame">{selectedCategory}</strong></span>
            )}
            {search && (
              <span> matching &ldquo;<strong className="text-fg">{search}</strong>&rdquo;</span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSearch('');
            }}
            className="text-xs text-flame hover:underline font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            Reset filters
          </button>
        </div>
      )}

      {/* 4. Master Table */}
      <div className="bg-surface-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-surface-elev/60 text-[11px] font-mono uppercase tracking-wider text-fg-dim">
                <th className="py-3.5 px-6 text-left font-bold">Metric &amp; Joint Axis</th>
                <th className="py-3.5 px-6 text-left font-bold w-2/5">Clinical Purpose &amp; Difficulty Benchmarks</th>
                <th className="py-3.5 px-4 text-center font-bold">Range &amp; Dir</th>
                <th className="py-3.5 px-4 text-center font-bold">Default Target</th>
                <th className="py-3.5 px-6 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-fg-mute">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-fg-dim">search_off</span>
                      <p className="font-semibold">No metrics found matching &ldquo;{search}&rdquo;</p>
                      <button
                        onClick={() => {
                          setSearch('');
                          setSelectedCategory('All');
                        }}
                        className="text-xs text-flame hover:underline font-semibold mt-1"
                      >
                        Clear search and filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((config) => {
                  const { main, tiers } = parseDescription(config.description);
                  const isUnitDegrees =
                    (config.max_val > 10 && config.metric_key.includes('ANGLE')) ||
                    config.metric_key.includes('ROTATION') ||
                    config.metric_key.includes('FLEXION') ||
                    config.metric_key.includes('TILT') ||
                    config.metric_key.includes('LEAN') ||
                    config.metric_key.includes('TURNOUT');
                  const unitSymbol = isUnitDegrees
                    ? '°'
                    : config.metric_key.includes('RATIO')
                    ? 'x'
                    : config.metric_key.includes('PERCENT') ||
                      config.metric_key.includes('CROSSING') ||
                      config.metric_key.includes('SYMMETRY')
                    ? '%'
                    : '';

                  return (
                    <tr
                      key={config.metric_key}
                      className="hover:bg-surface-elev/50 transition-colors group cursor-pointer"
                      onClick={() => setInspectMetric(config)}
                    >
                      {/* Name & Key */}
                      <td className="py-4 px-6 align-top">
                        <div className="font-bold text-sm text-fg group-hover:text-flame transition-colors leading-snug">
                          {config.metric_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-flame bg-flame/10 px-2 py-0.5 rounded font-semibold">
                            {config.metric_key}
                          </span>
                          {config.category && (
                            <span className="text-[10px] font-semibold text-fg-mute bg-surface-raised px-2 py-0.5 rounded border border-border/60">
                              {config.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purpose & Difficulties */}
                      <td className="py-4 px-6 align-top">
                        <p className="text-xs text-fg-mute leading-relaxed font-normal">{main}</p>

                        {tiers.length > 0 && (
                          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/50 pt-2 text-[11px]">
                            {tiers.slice(0, 3).map((t, idx) => {
                              const isBeginner =
                                t.title?.toLowerCase().includes('beginner') ||
                                t.title?.toLowerCase().includes('screening');
                              const isIntermediate =
                                t.title?.toLowerCase().includes('intermediate') ||
                                t.title?.toLowerCase().includes('functional');
                              const isAdvanced =
                                t.title?.toLowerCase().includes('advanced') ||
                                t.title?.toLowerCase().includes('athletic');
                              const isFault =
                                t.title?.toLowerCase().includes('form check') ||
                                t.title?.toLowerCase().includes('alert');

                              const badgeColor = isBeginner
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                                : isIntermediate
                                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25'
                                : isAdvanced
                                ? 'text-flame bg-flame/10 border-flame/25'
                                : isFault
                                ? 'text-rose-500 bg-rose-500/10 border-rose-500/25'
                                : 'text-fg-mute bg-surface-raised border-border';

                              return (
                                <div key={idx} className="flex items-start gap-1.5 leading-snug">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border flex-shrink-0 ${badgeColor}`}
                                  >
                                    {t.title?.split('/')[0]?.trim()}
                                  </span>
                                  <span className="text-fg text-xs font-mono font-medium">{t.detail}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Range & Direction */}
                      <td className="py-4 px-4 align-top text-center">
                        <div className="font-mono text-xs font-bold text-fg">
                          {config.min_val}{unitSymbol} &rarr; {config.max_val}{unitSymbol}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                              config.direction === 'asc'
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25'
                                : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25'
                            }`}
                          >
                            {config.direction === 'asc' ? 'Ascending (>=)' : 'Descending (<=)'}
                          </span>
                        </div>
                        <div className="text-[10px] text-fg-dim font-mono mt-0.5">
                          Step: {config.step_val}
                        </div>
                      </td>

                      {/* Default Target */}
                      <td className="py-4 px-4 align-top text-center font-mono">
                        <div className="inline-block bg-surface-raised border border-border px-2.5 py-1 rounded-md text-xs font-bold text-fg">
                          {config.default_val !== null && config.default_val !== undefined
                            ? `${config.default_val}${unitSymbol}`
                            : '-'}
                        </div>
                        <div className="text-[10px] text-fg-dim mt-0.5">Recommended</div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 align-top text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectMetric(config);
                          }}
                          className="bg-surface-elev hover:bg-flame hover:text-white text-fg-mute text-xs px-3 py-1.5 rounded-lg border border-border hover:border-flame font-medium transition-all inline-flex items-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal / Detailed Inspector Drawer */}
      {inspectMetric && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-surface-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-border bg-surface-elev flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-flame bg-flame/10 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-flame/20">
                    {inspectMetric.category || 'General'}
                  </span>
                  <span className="font-mono text-xs text-fg-mute">
                    Key: <strong className="text-fg">{inspectMetric.metric_key}</strong>
                  </span>
                </div>
                <h2 className="text-xl font-black text-fg mt-1 tracking-tight">{inspectMetric.metric_name}</h2>
              </div>
              <button
                onClick={() => setInspectMetric(null)}
                className="text-fg-mute hover:text-fg w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm">
              {/* Core Parameters Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-fg-dim uppercase font-bold">Safe Metric Range</span>
                  <p className="text-base font-bold font-mono text-fg mt-0.5">
                    {inspectMetric.min_val} &rarr; {inspectMetric.max_val}
                  </p>
                </div>
                <div className="bg-surface p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-fg-dim uppercase font-bold">Standard Target</span>
                  <p className="text-base font-bold font-mono text-flame mt-0.5">
                    {inspectMetric.default_val ?? '-'}
                  </p>
                </div>
                <div className="bg-surface p-3.5 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-fg-dim uppercase font-bold">Evaluation Direction</span>
                  <p className="text-sm font-bold font-mono text-fg mt-0.5">
                    {inspectMetric.direction === 'asc' ? '>= Ascending' : '<= Descending'}
                  </p>
                </div>
              </div>

              {/* Biomechanical Purpose */}
              <div className="bg-surface-elev/60 p-4 rounded-xl border border-border">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-fg-dim mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-flame">biotech</span>
                  Biomechanical Purpose &amp; Anatomical Axis
                </h3>
                <p className="text-sm text-fg leading-relaxed">
                  {parseDescription(inspectMetric.description).main}
                </p>
              </div>

              {/* Difficulty & Screening Tiers */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-fg-dim mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-500">fitness_center</span>
                  Difficulty &amp; Risk Threshold Guidelines
                </h3>
                <div className="flex flex-col gap-2">
                  {parseDescription(inspectMetric.description).tiers.map((t, idx) => {
                    const isBeginner =
                      t.title?.toLowerCase().includes('beginner') || t.title?.toLowerCase().includes('screening');
                    const isIntermediate =
                      t.title?.toLowerCase().includes('intermediate') || t.title?.toLowerCase().includes('functional');
                    const isAdvanced =
                      t.title?.toLowerCase().includes('advanced') || t.title?.toLowerCase().includes('athletic');
                    const isFault =
                      t.title?.toLowerCase().includes('form check') || t.title?.toLowerCase().includes('alert');

                    const borderAccent = isBeginner
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : isIntermediate
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : isAdvanced
                      ? 'border-flame/30 bg-flame/5'
                      : isFault
                      ? 'border-rose-400/30 bg-rose-400/5'
                      : 'border-border bg-surface';

                    const icon = isBeginner
                      ? 'verified'
                      : isIntermediate
                      ? 'trending_up'
                      : isAdvanced
                      ? 'military_tech'
                      : 'warning';

                    return (
                      <div key={idx} className={`p-3.5 rounded-xl border flex items-start gap-3 ${borderAccent}`}>
                        <span className="material-symbols-outlined text-[18px] text-fg-mute flex-shrink-0 mt-0.5">
                          {icon}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-fg">{t.title}</div>
                          <p className="text-xs text-fg-mute mt-0.5 leading-normal">{t.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Configuration Advice */}
              <div className="p-3.5 rounded-xl border border-dashed border-border text-xs text-fg-dim bg-surface/50">
                <span className="font-bold text-fg">Exercise Builder Tip:</span> To track this metric in a custom exercise phase, select{' '}
                <code className="text-flame bg-flame/10 px-1 py-0.5 rounded font-mono font-bold">
                  {inspectMetric.metric_key}
                </code>{' '}
                with operator{' '}
                <code className="text-fg bg-surface-raised px-1 py-0.5 rounded font-mono font-bold">
                  {inspectMetric.direction === 'asc' ? '>=' : '<='}
                </code>{' '}
                and your target threshold value.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface-elev flex justify-end">
              <button
                onClick={() => setInspectMetric(null)}
                className="bg-surface hover:bg-surface-raised text-fg text-xs px-4 py-2 rounded-lg border border-border font-semibold transition-colors shadow-sm"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
