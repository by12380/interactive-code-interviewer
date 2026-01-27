import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// Ambient sound configurations
export const AMBIENT_SOUNDS = {
  rain: {
    id: "rain",
    name: "Rain",
    icon: "🌧️",
    description: "Gentle rainfall for focus",
    // Using a free ambient rain sound from a CDN (placeholder URL - will use Web Audio API oscillators as fallback)
    url: "https://cdn.freesound.org/previews/531/531947_4921277-lq.mp3",
  },
  coffeeShop: {
    id: "coffeeShop",
    name: "Coffee Shop",
    icon: "☕",
    description: "Busy cafe atmosphere",
    url: "https://cdn.freesound.org/previews/462/462311_6891911-lq.mp3",
  },
  whiteNoise: {
    id: "whiteNoise",
    name: "White Noise",
    icon: "📻",
    description: "Consistent white noise",
    useOscillator: true,
  },
  nature: {
    id: "nature",
    name: "Forest",
    icon: "🌲",
    description: "Birds and nature sounds",
    url: "https://cdn.freesound.org/previews/531/531977_4921277-lq.mp3",
  },
  ocean: {
    id: "ocean",
    name: "Ocean Waves",
    icon: "🌊",
    description: "Calm ocean waves",
    url: "https://cdn.freesound.org/previews/467/467962_8386274-lq.mp3",
  },
  silence: {
    id: "silence",
    name: "Silence",
    icon: "🔇",
    description: "No ambient sound",
    url: null,
  },
};

// Breathing exercise patterns
export const BREATHING_PATTERNS = {
  relaxed: {
    id: "relaxed",
    name: "Relaxed Breathing",
    description: "4-4-4-4 pattern for calm focus",
    inhale: 4,
    hold1: 4,
    exhale: 4,
    hold2: 4,
    icon: "😌",
  },
  energizing: {
    id: "energizing",
    name: "Energizing",
    description: "4-2-4-0 pattern for alertness",
    inhale: 4,
    hold1: 2,
    exhale: 4,
    hold2: 0,
    icon: "⚡",
  },
  calming: {
    id: "calming",
    name: "Deep Calm",
    description: "4-7-8 pattern for stress relief",
    inhale: 4,
    hold1: 7,
    exhale: 8,
    hold2: 0,
    icon: "🧘",
  },
  focus: {
    id: "focus",
    name: "Focus",
    description: "5-5-5 pattern for concentration",
    inhale: 5,
    hold1: 5,
    exhale: 5,
    hold2: 0,
    icon: "🎯",
  },
};

// Default focus mode settings
export const DEFAULT_FOCUS_SETTINGS = {
  isEnabled: false,
  backgroundBlur: 0, // 0-20px
  backgroundOpacity: 100, // 0-100%
  hideChat: true,
  hideMetrics: true,
  hideSidebar: true,
  hideHeader: false,
  hideProblem: true, // Hide the problem panel on the left
  ambientSound: "silence",
  ambientVolume: 30, // 0-100
  showBreathingTimer: false,
  breathingPattern: "relaxed",
  zenMode: false, // Extreme minimal mode - only editor visible
};

const FocusModeContext = createContext(null);

export function FocusModeProvider({ children }) {
  // Load saved preferences from localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("focusModeSettings");
    return saved ? { ...DEFAULT_FOCUS_SETTINGS, ...JSON.parse(saved) } : DEFAULT_FOCUS_SETTINGS;
  });

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState("idle"); // idle, inhale, hold1, exhale, hold2
  const [breathingProgress, setBreathingProgress] = useState(0);
  const [breathingCycles, setBreathingCycles] = useState(0);

  // Audio refs
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const oscillatorRef = useRef(null);
  const audioElementRef = useRef(null);

  // Breathing timer ref
  const breathingIntervalRef = useRef(null);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("focusModeSettings", JSON.stringify(settings));
  }, [settings]);

  // Apply focus mode CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    if (settings.isEnabled) {
      root.classList.add("focus-mode-active");
      root.style.setProperty("--focus-blur", `${settings.backgroundBlur}px`);
      root.style.setProperty("--focus-opacity", `${settings.backgroundOpacity / 100}`);
      
      if (settings.zenMode) {
        root.classList.add("zen-mode-active");
      } else {
        root.classList.remove("zen-mode-active");
      }
    } else {
      root.classList.remove("focus-mode-active", "zen-mode-active");
      root.style.removeProperty("--focus-blur");
      root.style.removeProperty("--focus-opacity");
    }
  }, [settings.isEnabled, settings.backgroundBlur, settings.backgroundOpacity, settings.zenMode]);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }, []);

  // Create white noise generator
  const createWhiteNoise = useCallback(() => {
    if (!audioContextRef.current) return;
    
    const bufferSize = 2 * audioContextRef.current.sampleRate;
    const noiseBuffer = audioContextRef.current.createBuffer(1, bufferSize, audioContextRef.current.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = audioContextRef.current.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    
    // Add a lowpass filter for softer noise
    const filter = audioContextRef.current.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1000;
    
    whiteNoise.connect(filter);
    filter.connect(gainNodeRef.current);
    
    return whiteNoise;
  }, []);

  // Play ambient sound
  const playAmbientSound = useCallback(async (soundId) => {
    const sound = AMBIENT_SOUNDS[soundId];
    if (!sound || soundId === "silence") {
      stopAmbientSound();
      return;
    }

    initAudioContext();

    // Stop any existing sound
    stopAmbientSound();

    try {
      if (sound.useOscillator) {
        // Use white noise generator
        oscillatorRef.current = createWhiteNoise();
        if (oscillatorRef.current) {
          gainNodeRef.current.gain.value = settings.ambientVolume / 100 * 0.3; // Lower volume for white noise
          oscillatorRef.current.start();
        }
      } else if (sound.url) {
        // Use audio element for sound files
        audioElementRef.current = new Audio();
        audioElementRef.current.crossOrigin = "anonymous";
        audioElementRef.current.loop = true;
        audioElementRef.current.volume = settings.ambientVolume / 100;
        audioElementRef.current.src = sound.url;
        
        await audioElementRef.current.play().catch(err => {
          console.warn("Could not play ambient sound:", err);
          // Fallback to white noise if URL fails
          oscillatorRef.current = createWhiteNoise();
          if (oscillatorRef.current) {
            gainNodeRef.current.gain.value = settings.ambientVolume / 100 * 0.3;
            oscillatorRef.current.start();
          }
        });
      }
    } catch (err) {
      console.warn("Error playing ambient sound:", err);
    }
  }, [initAudioContext, createWhiteNoise, settings.ambientVolume]);

  // Stop ambient sound
  const stopAmbientSound = useCallback(() => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      oscillatorRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
      audioElementRef.current = null;
    }
  }, []);

  // Update ambient volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = settings.ambientVolume / 100 * 0.3;
    }
    if (audioElementRef.current) {
      audioElementRef.current.volume = settings.ambientVolume / 100;
    }
  }, [settings.ambientVolume]);

  // Handle ambient sound changes
  useEffect(() => {
    if (settings.isEnabled && settings.ambientSound !== "silence") {
      playAmbientSound(settings.ambientSound);
    } else {
      stopAmbientSound();
    }

    return () => {
      stopAmbientSound();
    };
  }, [settings.isEnabled, settings.ambientSound, playAmbientSound, stopAmbientSound]);

  // Breathing exercise logic
  const startBreathing = useCallback(() => {
    setIsBreathingActive(true);
    setBreathingCycles(0);
    setBreathingPhase("inhale");
    setBreathingProgress(0);
  }, []);

  const stopBreathing = useCallback(() => {
    setIsBreathingActive(false);
    setBreathingPhase("idle");
    setBreathingProgress(0);
    if (breathingIntervalRef.current) {
      clearInterval(breathingIntervalRef.current);
      breathingIntervalRef.current = null;
    }
  }, []);

  // Breathing timer effect
  useEffect(() => {
    if (!isBreathingActive) return;

    const pattern = BREATHING_PATTERNS[settings.breathingPattern];
    const phases = ["inhale", "hold1", "exhale", "hold2"];
    const durations = [pattern.inhale, pattern.hold1, pattern.exhale, pattern.hold2];
    
    let currentPhaseIndex = phases.indexOf(breathingPhase);
    if (currentPhaseIndex === -1) currentPhaseIndex = 0;
    
    const currentDuration = durations[currentPhaseIndex];
    const updateInterval = 50; // Update every 50ms for smooth animation
    let elapsed = 0;

    breathingIntervalRef.current = setInterval(() => {
      elapsed += updateInterval;
      const progress = (elapsed / (currentDuration * 1000)) * 100;
      
      if (progress >= 100) {
        // Move to next phase
        let nextPhaseIndex = (currentPhaseIndex + 1) % 4;
        
        // Skip phases with 0 duration
        while (durations[nextPhaseIndex] === 0) {
          nextPhaseIndex = (nextPhaseIndex + 1) % 4;
        }
        
        // If we completed a full cycle
        if (nextPhaseIndex <= currentPhaseIndex) {
          setBreathingCycles(prev => prev + 1);
        }
        
        setBreathingPhase(phases[nextPhaseIndex]);
        setBreathingProgress(0);
      } else {
        setBreathingProgress(progress);
      }
    }, updateInterval);

    return () => {
      if (breathingIntervalRef.current) {
        clearInterval(breathingIntervalRef.current);
      }
    };
  }, [isBreathingActive, breathingPhase, settings.breathingPattern]);

  // Update individual setting
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Toggle focus mode
  const toggleFocusMode = useCallback(() => {
    setSettings(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

  // Enable focus mode with preset
  const enableFocusMode = useCallback((preset = null) => {
    if (preset === "zen") {
      setSettings(prev => ({
        ...prev,
        isEnabled: true,
        zenMode: true,
        hideChat: true,
        hideMetrics: true,
        hideSidebar: true,
        hideHeader: true,
        hideProblem: true,
        backgroundBlur: 0,
        backgroundOpacity: 100,
      }));
    } else if (preset === "minimal") {
      setSettings(prev => ({
        ...prev,
        isEnabled: true,
        zenMode: false,
        hideChat: true,
        hideMetrics: true,
        hideSidebar: true,
        hideProblem: true,
        hideHeader: false,
        backgroundBlur: 5,
        backgroundOpacity: 90,
      }));
    } else {
      setSettings(prev => ({ ...prev, isEnabled: true }));
    }
  }, []);

  // Disable focus mode
  const disableFocusMode = useCallback(() => {
    setSettings(prev => ({ ...prev, isEnabled: false, zenMode: false }));
    stopBreathing();
  }, [stopBreathing]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_FOCUS_SETTINGS);
    stopBreathing();
    stopAmbientSound();
  }, [stopBreathing, stopAmbientSound]);

  // Open/close panel
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const value = {
    settings,
    updateSetting,
    toggleFocusMode,
    enableFocusMode,
    disableFocusMode,
    resetSettings,
    isPanelOpen,
    openPanel,
    closePanel,
    // Breathing
    isBreathingActive,
    breathingPhase,
    breathingProgress,
    breathingCycles,
    startBreathing,
    stopBreathing,
    // Audio
    playAmbientSound,
    stopAmbientSound,
    // Constants
    AMBIENT_SOUNDS,
    BREATHING_PATTERNS,
  };

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return context;
}

export default FocusModeContext;
