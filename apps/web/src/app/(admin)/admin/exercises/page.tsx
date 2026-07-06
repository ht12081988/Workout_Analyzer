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
        
        <Link 
          href="/admin/exercises/builder" 
          className="flex items-center gap-2 px-4 py-2 bg-flame text-on-dark rounded-lg font-bold text-sm shadow-flame hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create Exercise
        </Link>
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
                    <div className="flex items-center gap-4">
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
                  <div className="flex items-center gap-4">
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
