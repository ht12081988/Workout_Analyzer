'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { createPortal } from 'react-dom';

export default function AdminAthletesPage() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedAthlete, setSelectedAthlete] = useState<any>(null);
  const [search, setSearch] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAthletes();
  }, []);

  const filteredAthletes = useMemo(() => {
    return athletes.filter(a => {
      if (search && !a.name?.toLowerCase().includes(search.toLowerCase()) && !a.email?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [athletes, search]);

  async function loadAthletes() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/athletes');
      const data = await res.json();
      setAthletes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load athletes');
    } finally {
      setLoading(false);
    }
  }

  const openAddModal = () => {
    setModalMode('add');
    setName('');
    setEmail('');
    setPassword('');
    setStatus(true);
    setSelectedAthlete(null);
    setIsModalOpen(true);
  };

  const openEditModal = (athlete: any) => {
    setModalMode('edit');
    setName(athlete.name || '');
    setEmail(athlete.email || '');
    setPassword(''); // don't load password
    setStatus(athlete.status);
    setSelectedAthlete(athlete);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!email) return toast.error("Email is required");
    
    setSaving(true);
    try {
      const url = modalMode === 'add' ? '/api/admin/athletes' : `/api/admin/athletes/${selectedAthlete.id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const payload: any = { name, email, status };
      if (modalMode === 'add' || password) payload.password = password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save athlete");
      
      toast.success(`Athlete ${modalMode === 'add' ? 'created' : 'updated'} successfully`);
      setIsModalOpen(false);
      loadAthletes();
    } catch (err) {
      console.error(err);
      toast.error("Error saving athlete");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (athlete: any) => {
    try {
      const newStatus = !athlete.status;
      const res = await fetch(`/api/admin/athletes/${athlete.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...athlete, status: newStatus })
      });
      if (res.ok) {
        toast.success(`Athlete marked as ${newStatus ? 'Active' : 'Inactive'}`);
        loadAthletes();
      } else {
        throw new Error("Failed");
      }
    } catch (err) {
      toast.error("Error updating status");
    }
  };

  if (loading && athletes.length === 0) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-flame border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="px-10 py-10 w-full space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-mute text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Search athletes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[280px] pl-10 pr-4 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:ring-2 focus:ring-flame/50 outline-none"
          />
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-flame text-on-dark rounded-lg font-bold text-sm shadow-flame hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Athlete
        </button>
      </div>

      <div className="bg-surface-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface-elev">
                <th className="py-4 px-6 text-left kicker text-fg-mute">Name</th>
                <th className="py-4 px-6 text-left kicker text-fg-mute">Email</th>

                <th className="py-4 px-6 text-center kicker text-fg-mute">Last Login</th>
                <th className="py-4 px-6 text-center kicker text-fg-mute">Date Joined</th>
                <th className="py-4 px-6 text-right kicker text-fg-mute">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAthletes.map((athlete) => (
                <tr key={athlete.id} className="hover:bg-surface-elev transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-bold text-sm text-fg group-hover:text-flame transition-colors">{athlete.name || 'N/A'}</div>
                  </td>
                  <td className="py-4 px-6 text-sm text-fg-mute">{athlete.email}</td>

                  <td className="py-4 px-6 text-center text-sm text-fg-mute">
                    {athlete.last_login ? new Date(athlete.last_login).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-fg-mute">
                    {new Date(athlete.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => toggleStatus(athlete)}
                        className={`w-11 h-6 rounded-full transition-colors relative inline-flex shrink-0 ${athlete.status ? 'bg-flame' : 'bg-surface-elev border border-border'}`}
                        title={athlete.status ? 'Active' : 'Inactive'}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${athlete.status ? 'left-6' : 'left-1'}`} />
                      </button>
                      <button 
                        onClick={() => openEditModal(athlete)}
                        className="text-fg-mute hover:text-flame transition-colors p-2 rounded-lg hover:bg-surface"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <Link 
                        href={`/admin/athletes/${athlete.id}?name=${encodeURIComponent(athlete.name || 'Unknown')}`}
                        className="text-fg-mute hover:text-flame transition-colors p-2 rounded-lg hover:bg-surface"
                        title="View Sessions"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAthletes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-fg-mute">No athletes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-card rounded-2xl w-full max-w-md shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface-elev">
              <h2 className="text-xl font-bold text-fg">{modalMode === 'add' ? 'Add Athlete' : 'Edit Athlete'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-fg-mute hover:text-flame transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-fg focus:ring-2 focus:ring-flame/50 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-fg focus:ring-2 focus:ring-flame/50 outline-none"
                  placeholder="athlete@example.com"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Password {modalMode === 'edit' && '(Leave blank to keep unchanged)'}</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-fg focus:ring-2 focus:ring-flame/50 outline-none"
                  placeholder="••••••••"
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <label className="text-sm font-bold text-fg">Active Status</label>
                <button 
                  onClick={() => setStatus(!status)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${status ? 'bg-flame' : 'bg-surface-elev border border-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${status ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
            
            <div className="p-6 border-t border-border bg-surface-elev flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-fg bg-surface hover:bg-surface-card border border-border transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-dark bg-flame hover:scale-[1.02] active:scale-95 transition-all shadow-flame disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Athlete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
