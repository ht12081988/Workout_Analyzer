import { useState, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { SpeechManager } from '@workout/shared';
import { API_BASE_URL } from '../config';

export function useVoiceGuide(exerciseId?: string | null) {
  const [speech] = useState(() => new SpeechManager({
    customSpeakFn: (text, rate, pitch) => {
      Speech.speak(text, {
        language: 'en-US',
        rate: rate,
        pitch: pitch,
      });
    },
    customStopFn: () => {
      Speech.stop();
    }
  }));

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(speech.getIsEnabled());

  useEffect(() => {
    setIsVoiceEnabled(speech.getIsEnabled());
  }, [speech]);

  useEffect(() => {
    return () => {
      speech.stop();
    };
  }, [speech]);

  const toggleVoice = (enabled: boolean) => {
    speech.setEnabled(enabled);
    setIsVoiceEnabled(enabled);
  };

  useEffect(() => {
    let active = true;
    async function fetchConfigs() {
      try {
        const [voiceRes, cuesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/voice-config`),
          fetch(`${API_BASE_URL}/exercises/cues`)
        ]);

        if (!active) return;
        
        let voiceData: any = {};
        if (voiceRes.ok) {
          const configObj = await voiceRes.json();
          voiceData = { ...configObj };
        }
        if (cuesRes.ok) {
          voiceData.cues = await cuesRes.json();
        }

        speech.initializeConfig(voiceData, exerciseId || undefined);
      } catch (err) {
        console.error('Failed to fetch voice configuration:', err);
      }
    }
    
    if (exerciseId) {
      fetchConfigs();
    }

    return () => { active = false; };
  }, [exerciseId, speech]);

  return { speech, isVoiceEnabled, toggleVoice };
}
