/**
 * Voice Service - Web Speech API wrapper for speech recognition and synthesis
 * Handles STT, TTS, Voice Activity Detection, and voice command parsing
 * 
 * BROWSER COMPATIBILITY:
 * - Speech Recognition: Chrome (full), Edge (full), Safari (partial - no continuous mode)
 * - Speech Synthesis: Chrome, Edge, Safari, Firefox (all good support)
 * - Audio Recording: Chrome, Edge, Firefox, Safari 14.1+
 * 
 * LIMITATIONS:
 * - Firefox: Speech Recognition NOT supported (will show fallback UI)
 * - Safari: Continuous recognition may stop unexpectedly
 * - Mobile: Works on Chrome Android and Safari iOS with some variations
 * - Requires HTTPS in production (localhost works for development)
 * 
 * RECOMMENDED: Chrome or Edge for best experience
 */

// Voice command definitions
export const VOICE_COMMANDS = {
  RUN_CODE: {
    id: 'run_code',
    phrases: ['run code', 'execute', 'run it', 'execute code', 'run my code'],
    description: 'Run current solution'
  },
  NEXT_PROBLEM: {
    id: 'next_problem',
    phrases: ['next problem', 'skip', 'next question', 'skip problem', 'move on'],
    description: 'Move to next challenge'
  },
  HINT: {
    id: 'hint',
    phrases: ['give me a hint', 'help', 'hint please', 'i need a hint', 'help me'],
    description: 'Request AI assistance'
  },
  EXPLAIN: {
    id: 'explain',
    phrases: ['explain approach', 'walk through', 'explain my approach', 'let me explain'],
    description: 'Describe solution strategy'
  },
  PAUSE: {
    id: 'pause',
    phrases: ['pause interview', 'pause', 'stop', 'take a break', 'hold on'],
    description: 'Pause the interview'
  },
  RESUME: {
    id: 'resume',
    phrases: ['resume', 'continue', 'start again', 'unpause', "let's continue"],
    description: 'Resume the interview'
  },
  REPEAT: {
    id: 'repeat',
    phrases: ['repeat that', 'say again', 'repeat', 'what did you say', 'come again'],
    description: 'AI repeats last response'
  }
};

// Check browser support for Web Speech API
export function checkBrowserSupport() {
  const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const hasSynthesis = 'speechSynthesis' in window;
  
  return {
    recognition: hasRecognition,
    synthesis: hasSynthesis,
    full: hasRecognition && hasSynthesis,
    message: !hasRecognition && !hasSynthesis
      ? 'Voice features are not supported in this browser. Please use Chrome, Edge, or Safari.'
      : !hasRecognition
        ? 'Speech recognition is not supported. Voice commands will not work.'
        : !hasSynthesis
          ? 'Speech synthesis is not supported. AI voice responses will not work.'
          : null
  };
}

// Create speech recognition instance
export function createSpeechRecognition(options = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    return null;
  }
  
  const recognition = new SpeechRecognition();
  
  // Configure recognition
  recognition.continuous = options.continuous ?? true;
  recognition.interimResults = options.interimResults ?? true;
  recognition.lang = options.lang || 'en-US';
  recognition.maxAlternatives = options.maxAlternatives || 1;
  
  return recognition;
}

// Speech Recognition Manager class
export class SpeechRecognitionManager {
  constructor(options = {}) {
    this.recognition = null;
    this.isListening = false;
    this.isPaused = false;
    this.callbacks = {
      onResult: options.onResult || (() => {}),
      onInterimResult: options.onInterimResult || (() => {}),
      onStart: options.onStart || (() => {}),
      onEnd: options.onEnd || (() => {}),
      onError: options.onError || (() => {}),
      onSpeechStart: options.onSpeechStart || (() => {}),
      onSpeechEnd: options.onSpeechEnd || (() => {}),
      onCommand: options.onCommand || (() => {})
    };
    this.lang = options.lang || 'en-US';
    this.silenceTimeout = null;
    this.silenceThreshold = options.silenceThreshold || 2000; // 2 seconds
    this.lastInterimTranscript = '';
    this.finalTranscript = '';
  }
  
  init() {
    if (this.recognition) {
      return true;
    }
    
    this.recognition = createSpeechRecognition({
      continuous: true,
      interimResults: true,
      lang: this.lang
    });
    
    if (!this.recognition) {
      return false;
    }
    
    this._setupEventListeners();
    return true;
  }
  
  _setupEventListeners() {
    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onStart();
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      
      // Auto-restart if not manually stopped
      if (!this.isPaused && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          // Already started
        }
      }
      
      this.callbacks.onEnd();
    };
    
    this.recognition.onerror = (event) => {
      // Ignore no-speech errors (common when waiting)
      if (event.error === 'no-speech') {
        return;
      }
      
      // Ignore aborted errors (happens on manual stop)
      if (event.error === 'aborted') {
        return;
      }
      
      this.callbacks.onError(event.error);
    };
    
    this.recognition.onspeechstart = () => {
      this.callbacks.onSpeechStart();
      this._clearSilenceTimeout();
    };
    
    this.recognition.onspeechend = () => {
      this.callbacks.onSpeechEnd();
      this._startSilenceTimeout();
    };
    
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Handle interim results
      if (interimTranscript) {
        this.lastInterimTranscript = interimTranscript;
        this.callbacks.onInterimResult(interimTranscript);
      }
      
      // Handle final results
      if (finalTranscript) {
        this.finalTranscript = finalTranscript;
        
        // Check for voice commands
        const command = this._parseCommand(finalTranscript);
        if (command) {
          this.callbacks.onCommand(command, finalTranscript);
        } else {
          this.callbacks.onResult(finalTranscript);
        }
        
        this.lastInterimTranscript = '';
      }
    };
  }
  
  _parseCommand(transcript) {
    const normalized = transcript.toLowerCase().trim();
    
    for (const [key, command] of Object.entries(VOICE_COMMANDS)) {
      for (const phrase of command.phrases) {
        if (normalized.includes(phrase)) {
          return command;
        }
      }
    }
    
    return null;
  }
  
  _startSilenceTimeout() {
    this._clearSilenceTimeout();
    
    this.silenceTimeout = setTimeout(() => {
      // If we have interim transcript but no final, treat it as final
      if (this.lastInterimTranscript) {
        const transcript = this.lastInterimTranscript;
        this.lastInterimTranscript = '';
        
        const command = this._parseCommand(transcript);
        if (command) {
          this.callbacks.onCommand(command, transcript);
        } else {
          this.callbacks.onResult(transcript);
        }
      }
    }, this.silenceThreshold);
  }
  
  _clearSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }
  
  start() {
    if (!this.recognition) {
      if (!this.init()) {
        return false;
      }
    }
    
    this.isPaused = false;
    
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      // Already started
      return this.isListening;
    }
  }
  
  stop() {
    this.isPaused = true;
    this._clearSilenceTimeout();
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
    
    this.isListening = false;
  }
  
  abort() {
    this.isPaused = true;
    this._clearSilenceTimeout();
    
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Already aborted
      }
    }
    
    this.isListening = false;
    this.lastInterimTranscript = '';
    this.finalTranscript = '';
  }
  
  setLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
  
  destroy() {
    this.abort();
    this.recognition = null;
  }
}

// Speech Synthesis Manager class
export class SpeechSynthesisManager {
  constructor(options = {}) {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.currentUtterance = null;
    this.queue = [];
    this.isSpeaking = false;
    this.isPaused = false;
    this.callbacks = {
      onStart: options.onStart || (() => {}),
      onEnd: options.onEnd || (() => {}),
      onPause: options.onPause || (() => {}),
      onResume: options.onResume || (() => {}),
      onError: options.onError || (() => {}),
      onBoundary: options.onBoundary || (() => {})
    };
    
    // Default voice settings
    this.settings = {
      voice: null,
      rate: options.rate ?? 1.0,
      pitch: options.pitch ?? 1.0,
      volume: options.volume ?? 1.0
    };
    
    this.lastSpokenText = '';
  }
  
  init() {
    if (!this.synth) {
      return false;
    }
    
    // Load voices
    this._loadVoices();
    
    // Chrome loads voices asynchronously
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this._loadVoices();
    }
    
    return true;
  }
  
  _loadVoices() {
    this.voices = this.synth.getVoices();
    
    // Set default voice to first English voice if not set
    if (!this.settings.voice && this.voices.length > 0) {
      const englishVoice = this.voices.find(v => v.lang.startsWith('en'));
      this.settings.voice = englishVoice || this.voices[0];
    }
  }
  
  getVoices(lang = null) {
    if (lang) {
      return this.voices.filter(v => v.lang.startsWith(lang));
    }
    return this.voices;
  }
  
  setVoice(voiceURI) {
    const voice = this.voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      this.settings.voice = voice;
    }
  }
  
  setRate(rate) {
    this.settings.rate = Math.max(0.1, Math.min(2.0, rate));
  }
  
  setPitch(pitch) {
    this.settings.pitch = Math.max(0.1, Math.min(2.0, pitch));
  }
  
  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
  }
  
  speak(text, options = {}) {
    if (!this.synth || !text) {
      return false;
    }
    
    // Cancel any pending speech if immediate is requested
    if (options.immediate) {
      this.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    utterance.voice = options.voice || this.settings.voice;
    utterance.rate = options.rate ?? this.settings.rate;
    utterance.pitch = options.pitch ?? this.settings.pitch;
    utterance.volume = options.volume ?? this.settings.volume;
    utterance.lang = options.lang || (utterance.voice?.lang) || 'en-US';
    
    // Set up event handlers
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.currentUtterance = utterance;
      this.lastSpokenText = text;
      this.callbacks.onStart(text);
    };
    
    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.callbacks.onEnd(text);
      
      // Process queue
      this._processQueue();
    };
    
    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.callbacks.onError(event.error);
      
      // Process queue even on error
      this._processQueue();
    };
    
    utterance.onpause = () => {
      this.isPaused = true;
      this.callbacks.onPause();
    };
    
    utterance.onresume = () => {
      this.isPaused = false;
      this.callbacks.onResume();
    };
    
    utterance.onboundary = (event) => {
      this.callbacks.onBoundary(event);
    };
    
    // Add to queue or speak immediately
    if (options.immediate || !this.isSpeaking) {
      this.synth.speak(utterance);
    } else {
      this.queue.push({ text, options, utterance });
    }
    
    return true;
  }
  
  _processQueue() {
    if (this.queue.length > 0 && !this.isSpeaking) {
      const next = this.queue.shift();
      this.synth.speak(next.utterance);
    }
  }
  
  pause() {
    if (this.synth && this.isSpeaking) {
      this.synth.pause();
    }
  }
  
  resume() {
    if (this.synth && this.isPaused) {
      this.synth.resume();
    }
  }
  
  cancel() {
    if (this.synth) {
      this.synth.cancel();
      this.queue = [];
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
    }
  }
  
  repeat() {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, { immediate: true });
      return true;
    }
    return false;
  }
  
  getLastSpokenText() {
    return this.lastSpokenText;
  }
}

// Audio Recorder for conversation (separate from video)
export class ConversationRecorder {
  constructor(options = {}) {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.chunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.callbacks = {
      onStart: options.onStart || (() => {}),
      onStop: options.onStop || (() => {}),
      onPause: options.onPause || (() => {}),
      onResume: options.onResume || (() => {}),
      onDataAvailable: options.onDataAvailable || (() => {}),
      onError: options.onError || (() => {})
    };
  }
  
  async init() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      return true;
    } catch (error) {
      this.callbacks.onError(error);
      return false;
    }
  }
  
  start() {
    if (!this.audioStream) {
      return false;
    }
    
    try {
      this.chunks = [];
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          this.callbacks.onDataAvailable(event.data);
        }
      };
      
      this.mediaRecorder.onstart = () => {
        this.isRecording = true;
        this.isPaused = false;
        this.callbacks.onStart();
      };
      
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.isPaused = false;
        this.callbacks.onStop(this.chunks);
      };
      
      this.mediaRecorder.onpause = () => {
        this.isPaused = true;
        this.callbacks.onPause();
      };
      
      this.mediaRecorder.onresume = () => {
        this.isPaused = false;
        this.callbacks.onResume();
      };
      
      this.mediaRecorder.onerror = (event) => {
        this.callbacks.onError(event.error);
      };
      
      // Record in 1 second chunks
      this.mediaRecorder.start(1000);
      
      return true;
    } catch (error) {
      this.callbacks.onError(error);
      return false;
    }
  }
  
  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }
  
  pause() {
    if (this.mediaRecorder && this.isRecording && !this.isPaused) {
      this.mediaRecorder.pause();
    }
  }
  
  resume() {
    if (this.mediaRecorder && this.isPaused) {
      this.mediaRecorder.resume();
    }
  }
  
  getBlob() {
    if (this.chunks.length === 0) {
      return null;
    }
    
    return new Blob(this.chunks, { type: 'audio/webm' });
  }
  
  getAudioURL() {
    const blob = this.getBlob();
    if (!blob) {
      return null;
    }
    
    return URL.createObjectURL(blob);
  }
  
  downloadRecording(filename = 'interview-audio') {
    const blob = this.getBlob();
    if (!blob) {
      return false;
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  }
  
  destroy() {
    this.stop();
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

// Voice Activity Detection helper
export class VoiceActivityDetector {
  constructor(options = {}) {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isActive = false;
    this.isSpeaking = false;
    this.silenceStart = null;
    
    this.threshold = options.threshold || 30; // dB threshold
    this.silenceDuration = options.silenceDuration || 1500; // ms of silence before "stopped speaking"
    
    this.callbacks = {
      onSpeechStart: options.onSpeechStart || (() => {}),
      onSpeechEnd: options.onSpeechEnd || (() => {}),
      onVolumeChange: options.onVolumeChange || (() => {})
    };
    
    this.animationFrame = null;
  }
  
  async init(stream = null) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
      
      this.microphone.connect(this.analyser);
      
      return true;
    } catch (error) {
      console.error('VAD init error:', error);
      return false;
    }
  }
  
  start() {
    if (!this.analyser) {
      return false;
    }
    
    this.isActive = true;
    this._analyze();
    return true;
  }
  
  stop() {
    this.isActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
  
  _analyze() {
    if (!this.isActive) {
      return;
    }
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    
    this.callbacks.onVolumeChange(average);
    
    const wasSpeaking = this.isSpeaking;
    
    if (average > this.threshold) {
      this.silenceStart = null;
      
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.callbacks.onSpeechStart();
      }
    } else {
      if (this.isSpeaking) {
        if (!this.silenceStart) {
          this.silenceStart = Date.now();
        } else if (Date.now() - this.silenceStart > this.silenceDuration) {
          this.isSpeaking = false;
          this.silenceStart = null;
          this.callbacks.onSpeechEnd();
        }
      }
    }
    
    this.animationFrame = requestAnimationFrame(() => this._analyze());
  }
  
  destroy() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.microphone = null;
  }
}

// Default export with all utilities
export default {
  checkBrowserSupport,
  createSpeechRecognition,
  SpeechRecognitionManager,
  SpeechSynthesisManager,
  ConversationRecorder,
  VoiceActivityDetector,
  VOICE_COMMANDS
};
