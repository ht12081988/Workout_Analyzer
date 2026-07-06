"use client";

import React, { useState, useEffect } from 'react';

interface DifficultySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  direction: 'asc' | 'desc';
  description?: string;
  imageUrl?: string;
  onChange: (val: number) => void;
}

export function DifficultySlider({ label, value, min, max, step = 1, direction, description, imageUrl, onChange }: DifficultySliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  // Keep local edit value in sync if props change from outside
  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      onChange(num); // No hard clamp here to allow power users to bypass slider max/min if they really need to
    } else {
      setEditValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full my-4 bg-surface-elev p-4 rounded-2xl border border-border shadow-sm transition-all hover:border-border">
      <div className="flex justify-between items-start text-sm kicker text-fg">
        <div className="flex flex-col relative">
          <div className="flex items-center gap-2 w-max">
            <span className="capitalize text-base">{label.replace(/_/g, ' ')}</span>
            {imageUrl && (
              <div className="relative flex items-center group cursor-help">
                <span className="material-symbols-outlined text-[16px] text-fg-mute opacity-70 group-hover:opacity-100 transition-opacity">info</span>
                
                {/* Tooltip */}
                <div className="absolute left-8 top-1/2 -translate-y-1/2 z-50 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 pointer-events-none w-80 bg-surface rounded-2xl shadow-2xl border border-border p-3 transform group-hover:translate-x-2">
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-bg mb-3 shadow-inner border border-border">
                    <img src={imageUrl} alt={label} className="w-full h-full object-cover mix-blend-multiply" />
                  </div>
                  <p className="text-sm font-body font-normal text-fg-mute leading-relaxed text-center px-2 pb-1">{description}</p>
                </div>
              </div>
            )}
          </div>
          {!imageUrl && description && (
            <span className="text-xs font-body font-normal text-fg-mute mt-1 max-w-[90%] leading-relaxed">
              {description}
            </span>
          )}
        </div>
        
        {isEditing ? (
          <input 
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-right bg-surface text-flame font-mono text-xs px-2 py-1 rounded w-20 outline-none border-b-2 border-flame mt-1"
          />
        ) : (
          <span 
            onDoubleClick={() => setIsEditing(true)}
            className="text-flame bg-flame/10 px-3 py-1 rounded-md font-mono text-xs cursor-pointer hover:bg-flame/20 transition-colors mt-1"
            title="Double-click to manually edit"
          >
            {value}
          </span>
        )}
      </div>
      
      <div className="relative pt-4 pb-6 w-full">
        <input 
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none slider-thumb-styled"
          style={{
             background: direction === 'asc'
              ? `linear-gradient(to right, #4ade80 0%, #f87171 100%)`
              : `linear-gradient(to right, #f87171 0%, #4ade80 100%)`
          }}
        />
        
        <style jsx>{`
          .slider-thumb-styled::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #111827;
            border: 4px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
            cursor: pointer;
            transition: transform 0.1s;
          }
          .slider-thumb-styled::-webkit-slider-thumb:hover {
            transform: scale(1.1);
          }
          .slider-thumb-styled::-webkit-slider-thumb:active {
            transform: scale(0.95);
          }
          
          .slider-thumb-styled::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #111827;
            border: 4px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
            cursor: pointer;
            transition: transform 0.1s;
          }
          .slider-thumb-styled::-moz-range-thumb:hover {
            transform: scale(1.1);
          }
          .slider-thumb-styled::-moz-range-thumb:active {
            transform: scale(0.95);
          }
        `}</style>
        
        <div className="absolute left-0 bottom-0 text-xs text-fg-mute font-mono font-medium">{min}</div>
        <div className="absolute right-0 bottom-0 text-xs text-fg-mute font-mono font-medium">{max}</div>
      </div>
    </div>
  );
}
