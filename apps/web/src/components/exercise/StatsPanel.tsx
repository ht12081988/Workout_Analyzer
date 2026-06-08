'use client';

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Clock } from 'lucide-react';

interface StatsPanelProps {
  repCount: number;
  attemptCount: number;
  accuracy: number;
  isStarted: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ repCount, attemptCount, accuracy, isStarted }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStarted) {
      setTimeout(() => setSeconds(0), 0);
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStarted]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      <StatCard 
        icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
        label="Attempts"
        value={attemptCount.toString()}
        subValue="total movements"
      />
      <StatCard 
        icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
        label="Reps"
        value={repCount.toString()}
        subValue="completed"
      />
      <StatCard 
        icon={<Target className="w-5 h-5 text-purple-400" />}
        label="Success Rate"
        value={`${Math.round(accuracy)}%`}
        subValue="completed reps"
      />
      <StatCard 
        icon={<Clock className="w-5 h-5 text-yellow-400" />}
        label="Timer"
        value={formatTime(isStarted ? seconds : 0)}
        subValue="session"
      />
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue }) => (
  <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex min-h-32 flex-col items-center justify-center text-center group hover:bg-white/5 transition-colors">
    <div className="mb-2 p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
      {icon}
    </div>
    <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{label}</span>
    <span className="text-2xl font-black text-white mt-1 xl:text-3xl">{value}</span>
    <span className="text-white/20 text-[10px] font-medium mt-0.5">{subValue}</span>
  </div>
);
