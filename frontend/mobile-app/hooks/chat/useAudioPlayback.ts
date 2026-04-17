import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Message } from '@/types/chat';

export function useAudioPlayback(messages: Message[]) {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { position: number; duration: number }>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  const playAudio = useCallback(async (msgId: string, url: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingAudioId === msgId) {
        setPlayingAudioId(null);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      setPlayingAudioId(msgId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setAudioProgress(prev => ({
            ...prev,
            [msgId]: {
              position: status.positionMillis || 0,
              duration: status.durationMillis || 1,
            },
          }));
          if (status.didJustFinish) {
            setPlayingAudioId(null);
            soundRef.current = null;
          }
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.log('Play audio error:', err);
      setPlayingAudioId(null);
    }
  }, [playingAudioId]);

  useEffect(() => {
    const loadDurations = async () => {
      const audioMsgs = messages.filter(
        m => m.messageType === 'audio' && m.fileUrl && !audioProgress[m._id]
      );
      for (const msg of audioMsgs) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: msg.fileUrl! },
            { shouldPlay: false }
          );
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setAudioProgress(prev => ({
              ...prev,
              [msg._id]: { position: 0, duration: status.durationMillis || 0 },
            }));
          }
          await sound.unloadAsync();
        } catch {}
      }
    };
    loadDurations();
  }, [messages, audioProgress]);

  return { playingAudioId, audioProgress, playAudio };
}
