"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type FailureGuidance = {
  id: string;
  failure_keyword: string;
  spoken_advice: string;
  is_active: boolean;
};

export default function ConfigurationsPage() {
  const [activeTab, setActiveTab] = useState<'voice' | 'tracking' | 'failure'>('voice');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tracking Configs
  const [modelType, setModelType] = useState('full');
  const [uiSmoothing, setUiSmoothing] = useState(0.3);
  const [engineSmoothing, setEngineSmoothing] = useState(0.0);

  // Voice Configs
  const [minIntervalMs, setMinIntervalMs] = useState(2200);
  const [phraseCooldownMs, setPhraseCooldownMs] = useState(4000);
  const [reinforcementProbability, setReinforcementProbability] = useState(0.70);
  const [speechRate, setSpeechRate] = useState(1.05);
  const [speechPitch, setSpeechPitch] = useState(1.00);
  const [positiveReinforcements, setPositiveReinforcements] = useState<string[]>([]);
  const [newReinforcement, setNewReinforcement] = useState('');
  const [failureGuidance, setFailureGuidance] = useState<FailureGuidance[]>([]);

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
        message,
        confirmText: 'OK',
        confirmStyle: isError ? 'err' : 'flame',
        hideCancel: true,
        onConfirm: () => {
          setConfirmModal(null);
          resolve();
        }
      });
    });
  };

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [trackRes, voiceRes, failRes] = await Promise.all([
          fetch('/api/tracking-config'),
          fetch('/api/voice-config'),
          fetch('/api/admin/failure-guidance')
        ]);
        
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          if (trackData.model_type) setModelType(trackData.model_type);
          if (trackData.ui_smoothing !== undefined) setUiSmoothing(trackData.ui_smoothing);
          if (trackData.engine_smoothing !== undefined) setEngineSmoothing(trackData.engine_smoothing);
        }
        
        if (voiceRes.ok) {
          const voiceData = await voiceRes.json();
          if (voiceData.config) {
            const vc = voiceData.config;
            if (vc.min_interval_ms !== undefined) setMinIntervalMs(vc.min_interval_ms);
            if (vc.phrase_cooldown_ms !== undefined) setPhraseCooldownMs(vc.phrase_cooldown_ms);
            if (vc.reinforcement_probability !== undefined) setReinforcementProbability(vc.reinforcement_probability);
            if (vc.speech_rate !== undefined) setSpeechRate(vc.speech_rate);
            if (vc.speech_pitch !== undefined) setSpeechPitch(vc.speech_pitch);
            if (Array.isArray(vc.positive_reinforcements)) setPositiveReinforcements(vc.positive_reinforcements);
          }
        }

        if (failRes.ok) {
          const failData = await failRes.json();
          setFailureGuidance(failData);
        }
      } catch (err) {
        console.error("Failed to load configs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfigs();
  }, []);

  const handleSaveTracking = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tracking-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_type: modelType,
          ui_smoothing: uiSmoothing,
          engine_smoothing: engineSmoothing
        })
      });
      if (!res.ok) throw new Error("Failed to save tracking config");
      await showAlert("Tracking Configuration updated successfully!");
    } catch (err: any) {
      await showAlert(err.message || "Error saving tracking config", true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVoice = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/voice-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_interval_ms: minIntervalMs,
          phrase_cooldown_ms: phraseCooldownMs,
          reinforcement_probability: reinforcementProbability,
          speech_rate: speechRate,
          speech_pitch: speechPitch,
          positive_reinforcements: positiveReinforcements
        })
      });
      if (!res.ok) throw new Error("Failed to save voice config");
      await showAlert("Voice Configuration updated successfully!");
    } catch (err: any) {
      await showAlert(err.message || "Error saving voice config", true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGuidance = async (guidance: FailureGuidance | { failure_keyword: string, spoken_advice: string, is_active: boolean }, isNew = false) => {
    setSaving(true);
    try {
      let res;
      if (isNew) {
        res = await fetch('/api/admin/failure-guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guidance)
        });
      } else {
        res = await fetch(`/api/admin/failure-guidance/${(guidance as FailureGuidance).id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guidance)
        });
      }
      
      if (!res.ok) throw new Error("Failed to save guidance");
      
      const failRes = await fetch('/api/admin/failure-guidance');
      if (failRes.ok) {
        const failData = await failRes.json();
        setFailureGuidance(failData);
      }
      await showAlert("Failure guidance saved successfully!");
    } catch (err: any) {
      await showAlert(err.message || "Error saving guidance", true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGuidance = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Guidance',
      message: 'Are you sure you want to delete this failure keyword mapping? This cannot be undone.',
      confirmText: 'Delete',
      confirmStyle: 'err',
      hideCancel: false,
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
          const res = await fetch(`/api/admin/failure-guidance/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete guidance");
          
          setFailureGuidance(prev => prev.filter(g => g.id !== id));
          await showAlert("Deleted successfully");
        } catch (err: any) {
          await showAlert(err.message || "Error deleting guidance", true);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  if (loading) {
    return <div className="p-10 text-fg-mute">Loading configurations...</div>;
  }

  return (
    <div className="p-6 w-full space-y-6">
      {/* Tabs */}
      <div className="bg-surface-elev border border-border p-1 inline-flex rounded-full mb-6">
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all ${
            activeTab === 'voice' 
              ? 'bg-flame text-on-dark shadow-sm' 
              : 'text-fg-mute hover:text-fg'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
          Voice Configs
        </button>
        <button
          onClick={() => setActiveTab('tracking')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all ${
            activeTab === 'tracking' 
              ? 'bg-flame text-on-dark shadow-sm' 
              : 'text-fg-mute hover:text-fg'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">video_camera_front</span>
          Tracking Configs
        </button>
        <button
          onClick={() => setActiveTab('failure')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all ${
            activeTab === 'failure' 
              ? 'bg-flame text-on-dark shadow-sm' 
              : 'text-fg-mute hover:text-fg'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_late</span>
          Failure Guidance
        </button>
      </div>

      <div className="bg-surface-card border border-border rounded-2xl p-6">
        {activeTab === 'voice' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="h4 text-fg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-flame">record_voice_over</span>
              Voice Assistant Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Min Interval (ms)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={minIntervalMs}
                  onChange={(e) => setMinIntervalMs(Number(e.target.value))}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Phrase Cooldown (ms)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={phraseCooldownMs}
                  onChange={(e) => setPhraseCooldownMs(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Reinforcement Prob (0-1)</label>
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={reinforcementProbability}
                  onChange={(e) => setReinforcementProbability(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Speech Rate</label>
                <input 
                  type="number" 
                  step="0.05"
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Speech Pitch</label>
                <input 
                  type="number" 
                  step="0.05"
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={speechPitch}
                  onChange={(e) => setSpeechPitch(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border mt-6">
              <label className="block text-xs font-bold text-fg-mute mb-4 uppercase tracking-wider">Positive Reinforcement Phrases</label>
              
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="E.g., Incredible depth!"
                  className="flex-1 bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={newReinforcement}
                  onChange={(e) => setNewReinforcement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newReinforcement.trim()) {
                      setPositiveReinforcements([...positiveReinforcements, newReinforcement.trim()]);
                      setNewReinforcement('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (newReinforcement.trim()) {
                      setPositiveReinforcements([...positiveReinforcements, newReinforcement.trim()]);
                      setNewReinforcement('');
                    }
                  }}
                  className="bg-surface-elev hover:bg-surface-elev-hover border border-border text-fg text-sm font-bold px-4 py-2 rounded-xl transition-all"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {positiveReinforcements.map((phrase, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-elev border border-border px-4 py-2 rounded-full text-sm">
                    <span className="text-fg">{phrase}</span>
                    <button 
                      onClick={() => {
                        const next = [...positiveReinforcements];
                        next.splice(idx, 1);
                        setPositiveReinforcements(next);
                      }}
                      className="text-fg-mute hover:text-err transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
                {positiveReinforcements.length === 0 && (
                  <div className="text-sm text-fg-mute py-2 italic">No phrases added. Defaults will be used.</div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-border mt-6 flex justify-end">
              <button 
                onClick={handleSaveVoice}
                disabled={saving}
                className="bg-flame text-on-dark text-sm font-bold px-6 py-2 rounded-full shadow-flame hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Voice Config'}
                <span className="material-symbols-outlined text-[20px]">save</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="h4 text-fg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-flame">video_camera_front</span>
              Tracking Settings
            </h3>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Model Type</label>
                <select 
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                >
                  <option value="lite">Lite (Faster, less accurate)</option>
                  <option value="full">Full (Balanced)</option>
                  <option value="heavy">Heavy (Slowest, most accurate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">UI Smoothing (0-1)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={uiSmoothing}
                  onChange={(e) => setUiSmoothing(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Engine Smoothing (0-1)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full bg-surface-elev border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame focus:ring-1 focus:ring-flame outline-none transition-all"
                  value={engineSmoothing}
                  onChange={(e) => setEngineSmoothing(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border mt-6 flex justify-end">
              <button 
                onClick={handleSaveTracking}
                disabled={saving}
                className="bg-flame text-on-dark text-sm font-bold px-6 py-2 rounded-full shadow-flame hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Tracking Config'}
                <span className="material-symbols-outlined text-[20px]">save</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'failure' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="h4 text-fg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-flame">assignment_late</span>
              Failure Guidance Keywords
            </h3>
            
            {/* Create New Card */}
            <div className="bg-surface-elev border border-border p-6 rounded-xl flex flex-col gap-4">
              <h4 className="text-sm font-bold text-fg-mute uppercase tracking-wider mb-2">Add New Mapping</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Failure Keyword</label>
                  <input id="new_keyword" type="text" placeholder="E.g., lean" className="w-full bg-surface-card border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-mute mb-2 uppercase tracking-wider">Spoken Advice</label>
                  <input id="new_advice" type="text" placeholder="E.g., Keep your chest up" className="w-full bg-surface-card border border-border rounded-xl px-3 py-2 text-sm text-fg focus:border-flame outline-none" />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  disabled={saving}
                  onClick={() => {
                    const keyword = (document.getElementById('new_keyword') as HTMLInputElement).value;
                    const advice = (document.getElementById('new_advice') as HTMLInputElement).value;
                    if (keyword && advice) {
                      handleSaveGuidance({ failure_keyword: keyword, spoken_advice: advice, is_active: true }, true);
                      (document.getElementById('new_keyword') as HTMLInputElement).value = '';
                      (document.getElementById('new_advice') as HTMLInputElement).value = '';
                    }
                  }}
                  className="bg-flame text-on-dark text-sm font-bold px-4 py-2 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  Add Mapping
                </button>
              </div>
            </div>

            <hr className="border-border my-6" />

            {/* List Existing */}
            <div className="bg-surface-elev border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-card border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-fg-mute uppercase tracking-wider w-1/4">Failure Keyword</th>
                    <th className="px-4 py-3 text-xs font-bold text-fg-mute uppercase tracking-wider w-1/2">Spoken Advice</th>
                    <th className="px-4 py-3 text-xs font-bold text-fg-mute uppercase tracking-wider text-center w-24">Active</th>
                    <th className="px-4 py-3 text-xs font-bold text-fg-mute uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {failureGuidance.map(rule => (
                    <tr key={rule.id} className="hover:bg-surface-card/50 transition-colors">
                      <td className="px-4 py-3">
                        <input id={`kw_${rule.id}`} defaultValue={rule.failure_keyword} className="w-full bg-transparent border border-transparent hover:border-border focus:border-flame focus:bg-surface-card rounded-lg px-3 py-2 text-sm text-fg outline-none transition-all" />
                      </td>
                      <td className="px-4 py-3">
                        <input id={`ad_${rule.id}`} defaultValue={rule.spoken_advice} className="w-full bg-transparent border border-transparent hover:border-border focus:border-flame focus:bg-surface-card rounded-lg px-3 py-2 text-sm text-fg outline-none transition-all" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" id={`act_${rule.id}`} defaultChecked={rule.is_active} className="w-5 h-5 accent-flame rounded bg-surface-card border-border cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            disabled={saving}
                            onClick={() => {
                              const keyword = (document.getElementById(`kw_${rule.id}`) as HTMLInputElement).value;
                              const advice = (document.getElementById(`ad_${rule.id}`) as HTMLInputElement).value;
                              const active = (document.getElementById(`act_${rule.id}`) as HTMLInputElement).checked;
                              handleSaveGuidance({ id: rule.id, failure_keyword: keyword, spoken_advice: advice, is_active: active });
                            }}
                            className="bg-surface-card hover:bg-surface-card/80 border border-border text-fg-mute hover:text-fg flex items-center justify-center p-2 rounded-lg transition-colors"
                            title="Save Changes"
                          >
                            <span className="material-symbols-outlined text-[18px]">save</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteGuidance(rule.id)}
                            className="text-fg-mute hover:text-err hover:bg-err/10 flex items-center justify-center p-2 rounded-lg transition-colors"
                            title="Delete Mapping"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {failureGuidance.length === 0 && (
                <div className="p-8 text-center text-fg-mute italic">No guidance mappings found.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Modal */}
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
