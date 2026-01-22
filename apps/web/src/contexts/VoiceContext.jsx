/**
 * Voice Context - Provides voice state and controls throughout the app
 * Manages speech recognition, synthesis, transcript history, and voice settings
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  checkBrowserSupport,
  SpeechRecognitionManager,
  SpeechSynthesisManager,
  ConversationRecorder,
  VoiceActivityDetector,
  VOICE_COMMANDS
} from "../services/voiceService.js";

// Default voice settings
export const DEFAULT_VOICE_SETTINGS = {
  voiceEnabled: true,
  selectedVoice: null, // Will be set to first available voice
  speechRate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoSpeak: true, // Auto-speak AI responses
  language: 'en-US'
};

const VoiceContext = createContext(null);

export function VoiceProvider({ children }) {
  // Browser support state
  const [browserSupport, setBrowserSupport] = useState(null);
  
  // Voice settings (persisted to localStorage)
  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('voiceSettings');
    return saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
  });
  
  // Recognition state
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  
  // Synthesis state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [currentSpokenText, setCurrentSpokenText] = useState('');
  
  // Transcript history
  const [transcript, setTranscript] = useState([]);
  
  // Recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Volume level for visualization
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Manager refs
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const recorderRef = useRef(null);
  const vadRef = useRef(null);
  const recordingTimerRef = useRef(null);
  
  // Callback refs for command handling
  const commandCallbackRef = useRef(null);
  const messageCallbackRef = useRef(null);
  
  // Initialize browser support check
  useEffect(() => {
    const support = checkBrowserSupport();
    setBrowserSupport(support);
    
    if (!support.full) {
      setError(support.message);
    }
  }, []);
  
  // Initialize synthesis manager and load voices
  useEffect(() => {
    if (!browserSupport?.synthesis) {
      return;
    }
    
    const synthManager = new SpeechSynthesisManager({
      rate: voiceSettings.speechRate,
      pitch: voiceSettings.pitch,
      volume: voiceSettings.volume,
      onStart: (text) => {
        setIsSpeaking(true);
        setCurrentSpokenText(text);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setCurrentSpokenText('');
      },
      onError: (err) => {
        setIsSpeaking(false);
        console.error('TTS Error:', err);
      }
    });
    
    synthManager.init();
    synthesisRef.current = synthManager;
    
    // Load voices after a short delay (Chrome async loading)
    const loadVoices = () => {
      const voices = synthManager.getVoices();
      setAvailableVoices(voices);
      
      // Set default voice if not set
      if (!voiceSettings.selectedVoice && voices.length > 0) {
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        const defaultVoice = englishVoice || voices[0];
        setVoiceSettings(prev => ({
          ...prev,
          selectedVoice: defaultVoice.voiceURI
        }));
      }
    };
    
    // Try immediately and after delay
    loadVoices();
    setTimeout(loadVoices, 100);
    
    return () => {
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, [browserSupport?.synthesis]);
  
  // Update synthesis settings when voice settings change
  useEffect(() => {
    if (synthesisRef.current) {
      synthesisRef.current.setRate(voiceSettings.speechRate);
      synthesisRef.current.setPitch(voiceSettings.pitch);
      synthesisRef.current.setVolume(voiceSettings.volume);
      
      if (voiceSettings.selectedVoice) {
        synthesisRef.current.setVoice(voiceSettings.selectedVoice);
      }
    }
  }, [voiceSettings.speechRate, voiceSettings.pitch, voiceSettings.volume, voiceSettings.selectedVoice]);
  
  // Persist voice settings
  useEffect(() => {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);
  
  // Initialize recognition manager
  const initRecognition = useCallback(() => {
    if (!browserSupport?.recognition || recognitionRef.current) {
      return recognitionRef.current !== null;
    }
    
    const manager = new SpeechRecognitionManager({
      lang: voiceSettings.language,
      silenceThreshold: 2000,
      onStart: () => {
        setIsListening(true);
        setError(null);
      },
      onEnd: () => {
        setIsListening(false);
      },
      onError: (err) => {
        setError(`Speech recognition error: ${err}`);
        setIsListening(false);
      },
      onSpeechStart: () => {
        setIsSpeechActive(true);
        // Pause AI speech when user starts talking
        if (synthesisRef.current?.isSpeaking) {
          synthesisRef.current.pause();
        }
      },
      onSpeechEnd: () => {
        setIsSpeechActive(false);
        // Resume AI speech if it was paused
        if (synthesisRef.current?.isPaused) {
          synthesisRef.current.resume();
        }
      },
      onInterimResult: (text) => {
        setInterimTranscript(text);
      },
      onResult: (text) => {
        setInterimTranscript('');
        
        // Add to transcript
        const entry = {
          id: Date.now(),
          speaker: 'user',
          text: text,
          timestamp: new Date().toISOString()
        };
        setTranscript(prev => [...prev, entry]);
        
        // Call message callback if set
        if (messageCallbackRef.current) {
          messageCallbackRef.current(text);
        }
      },
      onCommand: (command, text) => {
        setInterimTranscript('');
        
        // Add command to transcript
        const entry = {
          id: Date.now(),
          speaker: 'user',
          text: text,
          isCommand: true,
          command: command.id,
          timestamp: new Date().toISOString()
        };
        setTranscript(prev => [...prev, entry]);
        
        // Call command callback if set
        if (commandCallbackRef.current) {
          commandCallbackRef.current(command, text);
        }
      }
    });
    
    if (manager.init()) {
      recognitionRef.current = manager;
      return true;
    }
    
    return false;
  }, [browserSupport?.recognition, voiceSettings.language]);
  
  // Start listening
  const startListening = useCallback(() => {
    if (!voiceSettings.voiceEnabled) {
      return false;
    }
    
    if (!recognitionRef.current) {
      if (!initRecognition()) {
        return false;
      }
    }
    
    return recognitionRef.current.start();
  }, [voiceSettings.voiceEnabled, initRecognition]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setInterimTranscript('');
  }, []);
  
  // Speak text using TTS
  const speak = useCallback((text, options = {}) => {
    if (!voiceSettings.voiceEnabled || !synthesisRef.current) {
      return false;
    }
    
    // Add AI response to transcript
    if (!options.skipTranscript) {
      const entry = {
        id: Date.now(),
        speaker: 'ai',
        text: text,
        timestamp: new Date().toISOString()
      };
      setTranscript(prev => [...prev, entry]);
    }
    
    return synthesisRef.current.speak(text, options);
  }, [voiceSettings.voiceEnabled]);
  
  // Cancel current speech
  const cancelSpeech = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
  }, []);
  
  // Pause speech
  const pauseSpeech = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.pause();
    }
  }, []);
  
  // Resume speech
  const resumeSpeech = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.resume();
    }
  }, []);
  
  // Repeat last spoken text
  const repeatLastResponse = useCallback(() => {
    if (synthesisRef.current) {
      return synthesisRef.current.repeat();
    }
    return false;
  }, []);
  
  // Get last spoken text
  const getLastSpokenText = useCallback(() => {
    if (synthesisRef.current) {
      return synthesisRef.current.getLastSpokenText();
    }
    return '';
  }, []);
  
  // Start audio recording
  const startRecording = useCallback(async () => {
    if (recorderRef.current?.isRecording) {
      return true;
    }
    
    const recorder = new ConversationRecorder({
      onStart: () => {
        setIsRecordingAudio(true);
        setRecordingDuration(0);
        
        // Start recording timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      },
      onStop: () => {
        setIsRecordingAudio(false);
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      },
      onError: (err) => {
        setError(`Recording error: ${err.message || err}`);
        setIsRecordingAudio(false);
      }
    });
    
    const success = await recorder.init();
    if (success) {
      recorderRef.current = recorder;
      recorder.start();
      return true;
    }
    
    return false;
  }, []);
  
  // Stop audio recording
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
  }, []);
  
  // Pause audio recording
  const pauseRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.pause();
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, []);
  
  // Resume audio recording
  const resumeRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.resume();
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  }, []);
  
  // Download recording
  const downloadRecording = useCallback((filename) => {
    if (recorderRef.current) {
      return recorderRef.current.downloadRecording(filename);
    }
    return false;
  }, []);
  
  // Get recording blob
  const getRecordingBlob = useCallback(() => {
    if (recorderRef.current) {
      return recorderRef.current.getBlob();
    }
    return null;
  }, []);
  
  // Set command callback
  const setCommandCallback = useCallback((callback) => {
    commandCallbackRef.current = callback;
  }, []);
  
  // Set message callback
  const setMessageCallback = useCallback((callback) => {
    messageCallbackRef.current = callback;
  }, []);
  
  // Update voice settings
  const updateVoiceSettings = useCallback((key, value) => {
    setVoiceSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Reset voice settings
  const resetVoiceSettings = useCallback(() => {
    setVoiceSettings(DEFAULT_VOICE_SETTINGS);
    localStorage.removeItem('voiceSettings');
  }, []);
  
  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);
  
  // Add custom entry to transcript
  const addTranscriptEntry = useCallback((speaker, text, options = {}) => {
    const entry = {
      id: Date.now(),
      speaker,
      text,
      timestamp: new Date().toISOString(),
      ...options
    };
    setTranscript(prev => [...prev, entry]);
  }, []);
  
  // Export transcript
  const exportTranscript = useCallback(() => {
    const content = transcript.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const speaker = entry.speaker === 'ai' ? 'Interviewer' : 'You';
      const prefix = entry.isCommand ? '[Command] ' : '';
      return `[${time}] ${speaker}: ${prefix}${entry.text}`;
    }).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcript]);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Test voice (speaks a sample)
  const testVoice = useCallback(() => {
    speak("Hello! This is a test of the voice settings. How does it sound?", { skipTranscript: true });
  }, [speak]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.destroy();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (vadRef.current) {
        vadRef.current.destroy();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);
  
  const value = {
    // Browser support
    browserSupport,
    isSupported: browserSupport?.full ?? false,
    
    // Voice settings
    voiceSettings,
    updateVoiceSettings,
    resetVoiceSettings,
    availableVoices,
    
    // Recognition state and controls
    isListening,
    interimTranscript,
    isSpeechActive,
    startListening,
    stopListening,
    
    // Synthesis state and controls
    isSpeaking,
    currentSpokenText,
    speak,
    cancelSpeech,
    pauseSpeech,
    resumeSpeech,
    repeatLastResponse,
    getLastSpokenText,
    testVoice,
    
    // Transcript
    transcript,
    clearTranscript,
    addTranscriptEntry,
    exportTranscript,
    
    // Recording
    isRecordingAudio,
    recordingDuration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    getRecordingBlob,
    
    // Volume level (for visualization)
    volumeLevel,
    
    // Callbacks
    setCommandCallback,
    setMessageCallback,
    
    // Error handling
    error,
    clearError,
    
    // Voice commands reference
    VOICE_COMMANDS
  };
  
  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
}

export default VoiceContext;
