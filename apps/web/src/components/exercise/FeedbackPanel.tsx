'use client';

import React from 'react';
import { MovementPhase } from '../../lib/exercise-engine/types';

interface FeedbackPanelProps {
  phase: MovementPhase;
  feedback: string[];
  lastRepQuality: number;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ phase, feedback, lastRepQuality }) => {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 w-full min-h-72 flex flex-1 flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white/60 uppercase text-xs font-bold tracking-widest">Real-time Feedback</h3>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
          phase === MovementPhase.HEEL_RAISE || phase === MovementPhase.ASCENDING ? 'bg-green-500 text-black' : 
          phase === MovementPhase.TOP_POSITION || phase === MovementPhase.BOTTOM_POSITION ? 'bg-yellow-400 text-black' : 
          phase === MovementPhase.DESCENDING ? 'bg-cyan-500 text-black animate-pulse' :
          'bg-white/10 text-white/40'
        }`}>
          {(phase || '').replace('_', ' ')}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
        {feedback.length === 0 ? (
          <div className="text-white/30 text-sm italic flex items-center justify-center h-full">
            Position yourself in the frame...
          </div>
        ) : (
          feedback.map((msg, idx) => (
            <div 
              key={idx} 
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {msg}
            </div>
          ))
        )}
      </div>

      {lastRepQuality > 0 && (
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/40 text-xs">Last Rep Quality</span>
            <span className={`text-xl font-black ${
              lastRepQuality > 85 ? 'text-green-400' : 
              lastRepQuality > 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {Math.round(lastRepQuality)}%
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                lastRepQuality > 85 ? 'bg-green-400' : 
                lastRepQuality > 60 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${lastRepQuality}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
