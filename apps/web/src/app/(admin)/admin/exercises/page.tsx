'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterSubcategory, setFilterSubcategory] = useState('All');

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

  const uniqueCategories = useMemo(() => ['All', ...Array.from(new Set(exercises.map(e => e.category).filter(Boolean)))], [exercises]);
  const uniqueSubcategories = useMemo(() => ['All', ...Array.from(new Set(exercises.map(e => e.subcategory).filter(Boolean)))], [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType === 'System' && ex.category === 'AI Generated') return false;
      if (filterType === 'Custom' && ex.category !== 'AI Generated') return false; 
      if (filterCategory !== 'All' && ex.category !== filterCategory) return false;
      if (filterSubcategory !== 'All' && ex.subcategory !== filterSubcategory) return false;
      return true;
    });
  }, [exercises, search, filterType, filterCategory, filterSubcategory]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/exercises');
        const data = await res.json();
        setExercises(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const performReplicate = async (exerciseId: number, name: string, description: string) => {
    
    setLoading(true);
    try {
      // Fetch existing rules
      const rulesRes = await fetch(`/api/exercises/${exerciseId}/rules`);
      const rulesData = await rulesRes.json();
      
      const dynamicRule = rulesData.find((r: any) => r.rule_name === 'DYNAMIC_PROFILE' && r.creator_type === 'system');
      let dynamicProfile = { phases: [] };
      
      if (dynamicRule && dynamicRule.threshold_value) {
        dynamicProfile = typeof dynamicRule.threshold_value === 'string' ? JSON.parse(dynamicRule.threshold_value) : dynamicRule.threshold_value;
      }
      
      // Create new exercise with cloned rules
      const createRes = await fetch('/api/admin/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name} (Copy ${Math.floor(Math.random() * 1000)})`,
          description: description,
          dynamicProfile: dynamicProfile
        })
      });
      
      if (!createRes.ok) throw new Error("Failed to replicate exercise");
      
      // Reload list
      const res = await fetch('/api/admin/exercises');
      const data = await res.json();
      setExercises(data);
      
    } catch (err) {
      console.error(err);
      showAlert("Error replicating exercise.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleReplicate = (exerciseId: number, name: string, description: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Replicate Exercise',
      message: `Are you sure you want to replicate "${name}"?`,
      confirmText: 'Yes, Replicate',
      confirmStyle: 'flame',
      onConfirm: () => {
        setConfirmModal(null);
        performReplicate(exerciseId, name, description);
      }
    });
  };

  const performDelete = async (exerciseId: number, name: string) => {
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error("Failed to delete exercise");
      
      // Reload list
      const fetchRes = await fetch('/api/admin/exercises');
      const data = await fetchRes.json();
      setExercises(data);
      
    } catch (err) {
      console.error(err);
      showAlert("Error deleting exercise.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (exerciseId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      setExercises(prev => prev.map(ex => ex.id === exerciseId ? { ...ex, status: newStatus } : ex));
    } catch (err) {
      console.error(err);
      showAlert("Error updating exercise status.", true);
    }
  };

  const handleDelete = (exerciseId: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Exercise',
      message: `Are you sure you want to delete "${name}"? This will remove it from the library, but preserve past athlete data.`,
      confirmText: 'Yes, Delete',
      confirmStyle: 'err',
      onConfirm: () => {
        setConfirmModal(null);
        performDelete(exerciseId, name);
      }
    });
  };

  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    fileData: any | null;
    fileName: string;
    error: string | null;
    overwrite: boolean;
    importing: boolean;
  }>({
    isOpen: false,
    fileData: null,
    fileName: '',
    error: null,
    overwrite: false,
    importing: false
  });

  const handleExport = async (exerciseId: string | number, name: string) => {
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId}/export`);
      if (!res.ok) throw new Error("Failed to export exercise data");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (name || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      showAlert("Error exporting exercise: " + err.message, true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const exerciseData = json.exercise || json;
        
        if (!exerciseData.name) {
          setImportModal(prev => ({ ...prev, error: 'Invalid JSON: Missing "name" property.', fileData: null }));
          return;
        }

        if (!exerciseData.dynamicProfile && !exerciseData.trajectoryProfile && !exerciseData.phasesConfig) {
          setImportModal(prev => ({ ...prev, error: 'Invalid JSON: Missing dynamicProfile or trajectoryProfile rules.', fileData: null }));
          return;
        }

        setImportModal(prev => ({
          ...prev,
          fileName: file.name,
          fileData: exerciseData,
          error: null
        }));
      } catch (err: any) {
        setImportModal(prev => ({ ...prev, error: 'Could not parse file as JSON: ' + err.message, fileData: null }));
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importModal.fileData) return;

    setImportModal(prev => ({ ...prev, importing: true, error: null }));
    try {
      const res = await fetch('/api/admin/exercises/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: importModal.fileData,
          overwrite: importModal.overwrite
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to import exercise');

      // Refresh list
      const fetchRes = await fetch('/api/admin/exercises');
      const exData = await fetchRes.json();
      setExercises(exData);

      setImportModal({
        isOpen: false,
        fileData: null,
        fileName: '',
        error: null,
        overwrite: false,
        importing: false
      });

      showAlert(`Exercise "${data.name}" successfully imported and ready!`);
    } catch (err: any) {
      console.error(err);
      setImportModal(prev => ({ ...prev, importing: false, error: err.message }));
    }
  };

  return (
    <div className="px-10 py-10 w-full space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-mute text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Search exercises..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:ring-2 focus:ring-flame/20 outline-none w-64"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${showFilters ? 'bg-surface-elev border-border text-fg' : 'bg-bg border-border text-fg-mute hover:bg-surface-elev'}`}
            title="Filters"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setImportModal({ isOpen: true, fileData: null, fileName: '', error: null, overwrite: false, importing: false })}
            className="flex items-center gap-2 px-4 py-2 bg-surface-elev hover:bg-surface-elev-hover text-fg rounded-lg font-bold text-sm border border-border hover:border-flame/30 transition-all shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px] text-flame">file_upload</span>
            Import JSON
          </button>

          <Link 
            href="/admin/exercises/builder" 
            className="flex items-center gap-2 px-4 py-2 bg-flame text-on-dark rounded-lg font-bold text-sm shadow-flame hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Exercise
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 bg-surface-card rounded-xl border border-border shadow-sm flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Type</label>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg min-w-[120px] outline-none focus:ring-2 focus:ring-flame/20"
            >
              <option value="All">All Types</option>
              <option value="System">System</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Category</label>
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg min-w-[150px] outline-none focus:ring-2 focus:ring-flame/20"
            >
              {uniqueCategories.map((cat: any) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Subcategory</label>
            <select 
              value={filterSubcategory} 
              onChange={e => setFilterSubcategory(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-fg min-w-[150px] outline-none focus:ring-2 focus:ring-flame/20"
            >
              {uniqueSubcategories.map((cat: any) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
          {(filterType !== 'All' || filterCategory !== 'All' || filterSubcategory !== 'All' || search) && (
            <button 
              onClick={() => { setFilterType('All'); setFilterCategory('All'); setFilterSubcategory('All'); setSearch(''); }}
              className="px-4 py-2 text-sm font-bold text-flame hover:bg-flame/10 rounded-lg transition-colors ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-flame border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredExercises.map(ex => (
            <div key={ex.id} className="bg-surface-card rounded-2xl border border-border p-6 shadow-card flex flex-col gap-3 group transition-transform duration-350 hover:-translate-y-1 hover:border-flame/40">
              <div className="flex flex-col">
                <h3 className="font-bold text-lg text-fg">{ex.name}</h3>
                <div className="flex justify-between items-center mt-1">
                  <p className="kicker">{ex.category || 'AI Generated'}</p>
                  <label className="flex items-center gap-2 cursor-pointer relative z-10" title="Toggle active status">
                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${ex.status ? 'bg-ok' : 'bg-surface-elev border border-border'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${ex.status ? 'translate-x-4' : 'translate-x-0 bg-fg-mute'}`} />
                    </div>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={!!ex.status}
                      onChange={() => handleToggleStatus(ex.id, !!ex.status)}
                    />
                  </label>
                </div>
              </div>
              
              {ex.image_path ? (
                <div className="w-full h-72 rounded-lg overflow-hidden bg-surface relative group/image shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={ex.image_path.replace(/\\/g, '/').startsWith('/') ? ex.image_path.replace(/\\/g, '/') : '/' + ex.image_path.replace(/\\/g, '/')} 
                    alt={ex.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-105" 
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleExport(ex.id, ex.name)}
                        className="text-white/80 hover:text-flame flex items-center transition-colors p-1"
                        title="Export JSON"
                      >
                        <span className="material-symbols-outlined text-[20px]">file_download</span>
                      </button>

                      <button 
                        onClick={() => handleReplicate(ex.id, ex.name, ex.description)}
                        className="text-white/80 hover:text-white flex items-center transition-colors p-1"
                        title="Replicate"
                      >
                        <span className="material-symbols-outlined text-[20px]">content_copy</span>
                      </button>
                      
                      <button 
                        onClick={() => handleDelete(ex.id, ex.name)}
                        className="text-white/80 hover:text-err flex items-center transition-colors p-1"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                    <Link 
                      href={`/admin/exercises/${ex.id}`}
                      className="text-flame hover:text-flame-2 bg-black/40 hover:bg-black/60 p-1.5 rounded backdrop-blur-sm transition-all flex items-center justify-center"
                      title="Edit Rules"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleExport(ex.id, ex.name)}
                      className="text-fg-mute hover:text-flame flex items-center transition-colors p-1"
                      title="Export JSON"
                    >
                      <span className="material-symbols-outlined text-[20px]">file_download</span>
                    </button>

                    <button 
                      onClick={() => handleReplicate(ex.id, ex.name, ex.description)}
                      className="text-fg-mute hover:text-flame flex items-center transition-colors p-1"
                      title="Replicate"
                    >
                      <span className="material-symbols-outlined text-[20px]">content_copy</span>
                    </button>
                    
                    <button 
                      onClick={() => handleDelete(ex.id, ex.name)}
                      className="text-err hover:text-err/80 flex items-center transition-colors p-1"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                  <Link 
                    href={`/admin/exercises/${ex.id}`}
                    className="text-flame hover:text-flame-2 flex items-center p-1"
                    title="Edit Rules"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </Link>
                </div>
              )}

              <div className="border-t border-border pt-3 mt-1 flex-1">
                <p className="text-sm text-fg-mute leading-relaxed">{ex.description || 'No description provided.'}</p>
              </div>
            </div>
          ))}
          {filteredExercises.length === 0 && (
            <p className="text-fg-mute col-span-full">No exercises found.</p>
          )}
        </div>
      )}

      {/* Single Exercise Import Modal */}
      {importModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface-card p-6 sm:p-8 rounded-[2rem] max-w-lg w-full shadow-2xl border border-border relative">
            <button 
              onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-surface-elev text-fg-mute hover:text-fg hover:bg-surface-elev-hover transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-flame/10 flex items-center justify-center text-flame">
                <span className="material-symbols-outlined text-[24px]">file_upload</span>
              </div>
              <h3 className="h3 text-fg">Import Exercise (JSON)</h3>
            </div>
            
            <p className="text-sm text-fg-mute mb-6">
              Select an exported VisionFit exercise <code className="text-xs bg-surface-elev px-1.5 py-0.5 rounded border border-border">.json</code> file to import all its biomechanical rules, phases, and metadata.
            </p>

            {/* File Upload Area */}
            <div className="mb-6">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border hover:border-flame/50 rounded-2xl cursor-pointer bg-bg/50 hover:bg-surface-elev/30 transition-all p-4 text-center">
                <span className="material-symbols-outlined text-3xl text-fg-mute mb-2">upload_file</span>
                <span className="text-sm font-semibold text-fg">
                  {importModal.fileName ? importModal.fileName : "Click or drag & drop .json file here"}
                </span>
                <span className="text-xs text-fg-mute mt-1">Accepts standard VisionFit Exercise JSON</span>
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* Preview of Parsed Data */}
            {importModal.fileData && (
              <div className="p-4 bg-bg rounded-xl border border-border mb-6 space-y-3 animate-in fade-in duration-150">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-fg text-base">{importModal.fileData.name}</h4>
                    <p className="text-xs text-fg-mute mt-0.5">{importModal.fileData.description || 'No description'}</p>
                  </div>
                  <span className="kicker bg-flame/10 text-flame px-2 py-0.5 rounded-full text-[11px] font-bold">
                    {importModal.fileData.category || 'AI Generated'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-fg-mute block">Camera View:</span>
                    <span className="font-semibold text-fg uppercase">{importModal.fileData.camera_angle || 'FRONT'}</span>
                  </div>
                  <div>
                    <span className="text-fg-mute block">Phases:</span>
                    <span className="font-semibold text-fg">
                      {importModal.fileData.dynamicProfile?.phases?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-fg-mute block">Voice Cues:</span>
                    <span className="font-semibold text-fg">
                      {Array.isArray(importModal.fileData.voice_cues) ? importModal.fileData.voice_cues.length : 0}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-fg font-medium">
                    <input 
                      type="checkbox" 
                      checked={importModal.overwrite}
                      onChange={e => setImportModal(prev => ({ ...prev, overwrite: e.target.checked }))}
                      className="rounded border-border text-flame focus:ring-flame"
                    />
                    <span>Overwrite if an exercise with the same name exists</span>
                  </label>
                </div>
              </div>
            )}

            {/* Error Message */}
            {importModal.error && (
              <div className="p-3 bg-err/10 border border-err/30 rounded-xl text-xs text-err mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{importModal.error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 bg-surface-elev text-fg-mute rounded-xl font-bold hover:bg-surface-elev-hover transition-colors text-sm"
              >
                Cancel
              </button>
              
              <button
                onClick={handleConfirmImport}
                disabled={!importModal.fileData || importModal.importing}
                className="flex-1 py-3 bg-flame text-on-dark rounded-xl font-bold hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-flame text-sm flex items-center justify-center gap-2"
              >
                {importModal.importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Import Exercise
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Confirmation Modal */}
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
