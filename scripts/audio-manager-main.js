/**
 * Audio Manager Main
 * Centralized audio and haptic feedback management system
 * 
 * Features:
 * - Haptic feedback for iOS and other devices
 * - Global audio control (sound effects)
 * - Global music control (independent from sound effects)
 * - User preference management (haptics, audio, music)
 * 
 * Haptic Patterns: 'single', 'double', 'triple', 'long', 'pattern'
 * 
 * Usage:
 *   triggerHaptic('single');   // Single tap haptic
 *   triggerHaptic('double');   // Double tap haptic
 *   triggerHaptic('triple');   // Triple tap haptic
 *   triggerHaptic('long');     // Long vibration
 *   triggerHaptic('pattern');  // Custom pattern
 * 
 * Audio Control:
 *   window.registerAudio(audioElement);  // Register sound effect
 *   window.registerMusic(musicElement);   // Register music
 */

(function() {
    'use strict';

    class HapticFeedback {
        constructor() {
            this.supportInfo = this.detectSupport();
            
            // Gesture credits system for iOS programmatic haptics
            // Focus on maintaining gesture context through call chain rather than arbitrary timeouts
            this.gestureCredits = 0;
            this.lastUserInteraction = 0;
            this.userInteractionTimeout = 30000; // 30 seconds - more realistic window for iOS haptics
            this.switchPool = [];
            
            // User preferences - load from localStorage
            this.hapticsEnabled = this.loadPreference('hapticsEnabled', true);
            this.audioEnabled = this.loadPreference('audioEnabled', true);
            this.musicEnabled = this.loadPreference('musicEnabled', true);
            
            // Audio feedback
            this.clickSound = null;
            this.initializeAudio();
            
            // Global audio control - for muting/unmuting ALL sounds
            this.setupGlobalAudioControl();
            
            // Global music control - for muting/unmuting music independently
            this.setupGlobalMusicControl();
            
            // Apply loaded preferences to global audio manager after setup
            // Sync the muted state with audioEnabled
            if (window.globalAudioManager) {
                window.globalAudioManager.muted = !this.audioEnabled;
                // Update all audio elements to reflect the current state
                window.globalAudioManager.audioElements.forEach(audio => {
                    window.globalAudioManager.updateAudioElement(audio);
                });
            }
            
            // Create hidden switches container if it doesn't exist
            this.ensureHiddenSwitchesContainer();
            
            // Pre-create switch pool for better performance
            this.createSwitchPool();
            
            // Set up event listeners to track user interactions
            this.setupInteractionTracking();
            
            // Create debug UI
            this.createDebugUI();
            
            // Update debug UI periodically to show time changes
            setInterval(() => {
                this.updateDebugUI();
            }, 1000); // Update every second
        }

        loadPreference(key, defaultValue) {
            try {
                const stored = localStorage.getItem(`haptic_${key}`);
                return stored !== null ? stored === 'true' : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }

        savePreference(key, value) {
            try {
                const stringValue = value.toString();
                localStorage.setItem(`haptic_${key}`, stringValue);
                // Force sync to ensure it's saved
                localStorage.getItem(`haptic_${key}`); // Read back to verify
            } catch (e) {
                console.warn('Failed to save preference:', e);
            }
        }

        setupGlobalAudioControl() {
            // Create a global audio context manager for controlling ALL sounds
            // This allows muting/unmuting all audio in the app
            if (!window.globalAudioManager) {
                window.globalAudioManager = {
                    masterVolume: 1.0,
                    muted: false,
                    audioElements: new Set(),
                    
                    registerAudio(audioElement) {
                        this.audioElements.add(audioElement);
                        this.updateAudioElement(audioElement);
                    },
                    
                    unregisterAudio(audioElement) {
                        this.audioElements.delete(audioElement);
                    },
                    
                    updateAudioElement(audioElement) {
                        // Check both muted state and audioEnabled (from haptic system)
                        const audioEnabled = this.audioEnabled;
                        if (this.muted || !audioEnabled) {
                            audioElement.volume = 0;
                        } else {
                            audioElement.volume = audioElement._originalVolume || 1.0;
                        }
                    },
                    
                    muteAll() {
                        this.muted = true;
                        this.audioElements.forEach(audio => {
                            this.updateAudioElement(audio);
                        });
                    },
                    
                    unmuteAll() {
                        this.muted = false;
                        // Update all audio elements, respecting audioEnabled state
                        this.audioElements.forEach(audio => {
                            this.updateAudioElement(audio);
                        });
                    },
                    
                    setMasterVolume(volume) {
                        this.masterVolume = Math.max(0, Math.min(1, volume));
                        this.audioElements.forEach(audio => {
                            const baseVolume = audio._originalVolume || 1.0;
                            audio.volume = this.muted ? 0 : baseVolume * this.masterVolume;
                        });
                    }
                };
            }
            
            // Store reference to haptic system for audioEnabled access
            const hapticSystemRef = this;
            window.globalAudioManager._hapticSystem = hapticSystemRef;
            
            // Link to haptic feedback audio enabled state
            Object.defineProperty(window.globalAudioManager, 'audioEnabled', {
                get: function() {
                    // Always get the current value from the haptic system
                    return hapticSystemRef.audioEnabled;
                },
                set: function(value) {
                    hapticSystemRef.audioEnabled = value;
                    hapticSystemRef.savePreference('audioEnabled', value);
                    // Update all audio elements when the state changes
                    this.audioElements.forEach(audio => {
                        this.updateAudioElement(audio);
                    });
                }
            });
        }

        setupGlobalMusicControl() {
            // Create a global music manager for controlling music independently from sound effects
            if (!window.globalMusicManager) {
                window.globalMusicManager = {
                    masterVolume: 1.0,
                    muted: false,
                    musicElements: new Set(),
                    
                    registerMusic(musicElement) {
                        this.musicElements.add(musicElement);
                        this.updateMusicElement(musicElement);
                    },
                    
                    unregisterMusic(musicElement) {
                        this.musicElements.delete(musicElement);
                    },
                    
                    updateMusicElement(musicElement) {
                        // Check both muted state and musicEnabled (from haptic system)
                        const musicEnabled = this.musicEnabled;
                        if (this.muted || !musicEnabled) {
                            musicElement.volume = 0;
                            if (musicElement.pause && !musicElement.paused) {
                                musicElement.pause();
                            }
                        } else {
                            musicElement.volume = musicElement._originalVolume || 1.0;
                            if (musicElement.play && musicElement.paused) {
                                musicElement.play().catch(() => {
                                    // Ignore play errors (autoplay policy)
                                });
                            }
                        }
                    },
                    
                    muteAll() {
                        this.muted = true;
                        this.musicElements.forEach(music => {
                            music.volume = 0;
                            if (music.pause && !music.paused) {
                                music.pause();
                            }
                        });
                    },
                    
                    unmuteAll() {
                        this.muted = false;
                        this.musicElements.forEach(music => {
                            const baseVolume = music._originalVolume || 1.0;
                            music.volume = baseVolume;
                            if (music.play && music.paused) {
                                music.play().catch(() => {
                                    // Ignore play errors (autoplay policy)
                                });
                            }
                        });
                    },
                    
                    setMasterVolume(volume) {
                        this.masterVolume = Math.max(0, Math.min(1, volume));
                        this.musicElements.forEach(music => {
                            const baseVolume = music._originalVolume || 1.0;
                            music.volume = this.muted ? 0 : baseVolume * this.masterVolume;
                        });
                    }
                };
            }
            
            // Store reference to haptic system for musicEnabled access
            const hapticSystemRef = this;
            window.globalMusicManager._hapticSystem = hapticSystemRef;
            
            // Link to haptic feedback music enabled state
            Object.defineProperty(window.globalMusicManager, 'musicEnabled', {
                get: function() {
                    // Always get the current value from the haptic system
                    return hapticSystemRef.musicEnabled;
                },
                set: function(value) {
                    hapticSystemRef.musicEnabled = value;
                    hapticSystemRef.savePreference('musicEnabled', value);
                    // Update all music elements when the state changes
                    this.musicElements.forEach(music => {
                        this.updateMusicElement(music);
                    });
                }
            });
            
            // Apply loaded preferences to global music manager after setup
            // Sync the muted state with musicEnabled
            if (window.globalMusicManager) {
                window.globalMusicManager.muted = !this.musicEnabled;
                // Update all music elements to reflect the current state
                window.globalMusicManager.musicElements.forEach(music => {
                    window.globalMusicManager.updateMusicElement(music);
                });
            }
        }

        initializeAudio() {
            try {
                // Determine the correct path to audio file based on current page location
                const pathname = window.location.pathname;
                let audioPath = './assets/audio/click.mp3';
                
                // If we're in a subdirectory, adjust the path
                // Count how many levels deep we are
                const depth = (pathname.match(/\//g) || []).length - 1;
                // If depth >= 1, we're in a subdirectory (e.g., /pages/badges.html)
                // and need to go up one level to reach root assets/
                if (depth >= 1) {
                    // We're in a subdirectory, need to go up
                    audioPath = '../assets/audio/click.mp3';
                }
                
                // Create audio element for click sound
                this.clickSound = new Audio(audioPath);
                this.clickSound._originalVolume = 0.5; // Store original volume
                // Set volume based on preference - if audio is disabled, volume should be 0
                this.clickSound.volume = this.audioEnabled ? 0.5 : 0;
                this.clickSound.preload = 'auto';
                
                // Register with global audio manager
                if (window.globalAudioManager) {
                    window.globalAudioManager.registerAudio(this.clickSound);
                    // Ensure it respects the current audioEnabled state
                    window.globalAudioManager.updateAudioElement(this.clickSound);
                }
                
                // Track if we've successfully loaded audio
                let audioLoaded = false;
                
                // Handle successful load
                this.clickSound.addEventListener('canplaythrough', () => {
                    audioLoaded = true;
                    this.audioEnabled = true;
                });
                
                // Handle audio loading errors gracefully
                this.clickSound.addEventListener('error', (e) => {
                    console.warn('Click sound failed to load from', audioPath, e);
                    // Try alternative paths
                    const altPaths = [
                        '../assets/audio/click.mp3',
                        '../../assets/audio/click.mp3',
                        './assets/audio/click.mp3',
                        'assets/audio/click.mp3'
                    ];
                    
                    let triedAlt = false;
                    for (const altPath of altPaths) {
                        if (altPath !== audioPath && !triedAlt && !audioLoaded) {
                            try {
                                const testAudio = new Audio(altPath);
                                testAudio.volume = 0.5;
                                testAudio.preload = 'auto';
                                
                                testAudio.addEventListener('canplaythrough', () => {
                                    this.clickSound = testAudio;
                                    this.audioEnabled = true;
                                    audioLoaded = true;
                                });
                                
                                testAudio.addEventListener('error', () => {
                                    // Try next path
                                });
                                
                                testAudio.load();
                                triedAlt = true;
                                break;
                            } catch (err) {
                                // Try next path
                            }
                        }
                    }
                    
                    if (!triedAlt && !audioLoaded) {
                        // Don't disable - might work after user interaction
                        console.warn('Could not load click sound, will retry on user interaction');
                    }
                });
                
                // Try to load the audio (some browsers require user interaction first)
                this.clickSound.load().catch(() => {
                    // Load failed, but that's okay - will work after user interaction
                });
            } catch (error) {
                console.warn('Failed to initialize click sound:', error);
                // Don't disable - might work after user interaction
            }
        }

        playClickSound() {
            // Check if audio is enabled
            if (!this.audioEnabled || !this.clickSound) {
                return;
            }
            
            try {
                // Reset the original audio to start and play
                // This is simpler and more reliable than cloning
                this.clickSound.currentTime = 0;
                
                // Update volume based on current settings
                if (window.globalAudioManager && !window.globalAudioManager.muted) {
                    this.clickSound.volume = this.clickSound._originalVolume || 0.5;
                } else {
                    this.clickSound.volume = 0;
                }
                
                // Try to play
                const playPromise = this.clickSound.play();
                
                // Handle play promise (required for some browsers)
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            // Audio started playing successfully
                        })
                        .catch(error => {
                            // Audio play failed (likely due to autoplay policy)
                            // This is expected on first interaction, will work after user interaction
                        });
                }
            } catch (error) {
                // Silently fail - audio might not be ready yet
            }
        }

        detectSupport() {
            const userAgent = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(userAgent);
            const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/.test(userAgent);
            const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
            
            // Detect iOS version
            const iosVersionMatch = userAgent.match(/OS (\d+)_(\d+)/);
            const iosVersion = iosVersionMatch ? 
                parseFloat(`${iosVersionMatch[1]}.${iosVersionMatch[2]}`) : null;

            // Check for switch support
            const testInput = document.createElement('input');
            testInput.type = 'checkbox';
            const hasSwitchSupport = 'switch' in testInput;

            // Check Vibration API
            const hasVibrationAPI = 'vibrate' in navigator;

            return {
                isIOS,
                isIOSWebView,
                isSafari,
                iosVersion,
                hasSwitchSupport,
                hasVibrationAPI,
                canUseHaptics: (isIOS && isSafari && hasSwitchSupport) || hasVibrationAPI
            };
        }

        ensureHiddenSwitchesContainer() {
            // Create container if it doesn't exist
            let container = document.getElementById('haptic-hidden-switches');
            if (!container) {
                container = document.createElement('div');
                container.id = 'haptic-hidden-switches';
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.opacity = '0';
                // Don't use pointer-events: none - we need labels to be clickable for iOS haptics
                // Instead, position off-screen but allow pointer events
                container.style.width = '1px';
                container.style.height = '1px';
                container.style.overflow = 'hidden';
                document.body.appendChild(container);
            }
            this.switchContainer = container;
        }

        createSwitchPool() {
            if (!this.switchContainer) {
                this.ensureHiddenSwitchesContainer();
            }
            
            const container = this.switchContainer;
            const poolSize = 20; // Create a pool of switches for reuse
            
            for (let i = 0; i < poolSize; i++) {
                const switchElement = document.createElement('input');
                switchElement.type = 'checkbox';
                switchElement.setAttribute('switch', '');
                switchElement.id = `haptic-pool-${i}`;
                
                const label = document.createElement('label');
                label.setAttribute('for', switchElement.id);
                // Don't use display: none - iOS needs the label to be accessible for haptics
                // Instead, position it off-screen but keep it in the flow
                label.style.position = 'absolute';
                label.style.left = '-9999px';
                label.style.width = '1px';
                label.style.height = '1px';
                label.style.overflow = 'hidden';
                
                container.appendChild(switchElement);
                container.appendChild(label);
                
                this.switchPool.push({
                    switch: switchElement,
                    label: label,
                    inUse: false
                });
            }
        }

        setupInteractionTracking() {
            // Track all user interactions to build gesture credits
            // This enables programmatic haptics on iOS by maintaining gesture context
            // iOS requires maintaining connection to user gestures through the call chain
            const events = ['touchstart', 'touchend', 'touchmove', 'click', 'mousedown', 'mouseup', 'mousemove', 'keydown', 'pointerdown', 'pointerup'];
            
            // Use capture phase to catch events early in the event chain
            events.forEach(eventType => {
                document.addEventListener(eventType, (e) => {
                    this.recordUserInteraction(eventType, e);
                }, { passive: true, capture: true });
            });
            
            // Also track on window level to catch all interactions
            window.addEventListener('touchstart', (e) => {
                this.recordUserInteraction('touchstart', e);
            }, { passive: true });
            
            window.addEventListener('click', (e) => {
                this.recordUserInteraction('click', e);
            }, { passive: true });
        }

        recordUserInteraction(eventType, event) {
            const now = Date.now();
            this.lastUserInteraction = now;
            
            // Increment credits for each interaction
            // Touch events are most important for mobile devices
            if (eventType === 'touchstart' || eventType === 'touchend') {
                this.gestureCredits += 2; // Bonus for touch events (primary on mobile)
            } else {
                this.gestureCredits += 1;
            }
            
            // Cap credits at a reasonable maximum to prevent unbounded growth
            // But allow enough credits for multiple haptic calls
            if (this.gestureCredits > 100) {
                this.gestureCredits = 100;
            }
            
            // Update debug UI
            this.updateDebugUI();
        }

        isUserInteractionRecent() {
            return (Date.now() - this.lastUserInteraction) < this.userInteractionTimeout;
        }

        async triggerIOSSwitchHaptic(pattern) {
            // Check if we have recent user interaction (iOS prefers recent gestures)
            // Maintaining gesture context through the call chain is key
            if (!this.isUserInteractionRecent()) {
                return false; // No recent interaction - iOS may block this
            }

            // Check gesture credits (must have credits to spend)
            if (this.gestureCredits <= 0) {
                return false; // No credits available - user needs to interact first
            }

            // Find available switch from pool
            const availableSwitch = this.switchPool.find(item => !item.inUse);
            if (!availableSwitch) {
                return false; // No switches available
            }

            try {
                availableSwitch.inUse = true;
                this.gestureCredits--; // Spend one credit
                this.updateDebugUI(); // Update debug display

                const switchCount = this.getPatternSwitchCount(pattern);
                const delay = this.getPatternDelay(pattern);

                // Debug: Log switch and label elements
                console.log('Triggering iOS haptic:', {
                    switch: availableSwitch.switch,
                    label: availableSwitch.label,
                    switchChecked: availableSwitch.switch.checked,
                    labelFor: availableSwitch.label.getAttribute('for'),
                    switchId: availableSwitch.switch.id
                });

                for (let i = 0; i < switchCount; i++) {
                    // First ensure the switch is not checked
                    if (availableSwitch.switch.checked) {
                        availableSwitch.switch.checked = false;
                    }
                    
                    // Try multiple methods to trigger the haptic
                    let hapticTriggered = false;
                    
                    // Method 1: Direct label click (most reliable)
                    try {
                        availableSwitch.label.click();
                        hapticTriggered = true;
                        console.log('Haptic trigger attempt:', i + 1, 'via label.click()');
                    } catch (e) {
                        console.warn('Label click failed:', e);
                    }
                    
                    // Method 2: MouseEvent dispatch
                    if (!hapticTriggered) {
                        try {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                buttons: 1
                            });
                            availableSwitch.label.dispatchEvent(clickEvent);
                            hapticTriggered = true;
                            console.log('Haptic trigger attempt:', i + 1, 'via MouseEvent');
                        } catch (e) {
                            console.warn('MouseEvent dispatch failed:', e);
                        }
                    }
                    
                    // Method 3: Direct switch click as last resort
                    if (!hapticTriggered) {
                        try {
                            availableSwitch.switch.click();
                            console.log('Haptic trigger attempt:', i + 1, 'via switch.click()');
                        } catch (e) {
                            console.warn('Switch click failed:', e);
                        }
                    }
                    
                    // Reset switch state after brief moment
                    setTimeout(() => {
                        if (availableSwitch.switch.checked) {
                            availableSwitch.switch.checked = false;
                            // Click again to reset
                            try {
                                availableSwitch.label.click();
                            } catch (e) {
                                // Ignore reset errors
                            }
                        }
                    }, 50);

                    if (i < switchCount - 1) {
                        await this.sleep(delay);
                    }
                }

                // Release switch back to pool after a delay
                setTimeout(() => {
                    availableSwitch.inUse = false;
                }, 500);

                console.log('iOS switch haptic sequence completed');
                return true;
            } catch (error) {
                availableSwitch.inUse = false;
                console.error('iOS switch haptic failed:', error);
                return false;
            }
        }

        getPatternSwitchCount(pattern) {
            switch (pattern) {
                case 'single': return 1;
                case 'double': return 2;
                case 'triple': return 3;
                case 'long': return 1; // Long is handled differently
                case 'pattern': return 5;
                default: return 1;
            }
        }

        getPatternDelay(pattern) {
            switch (pattern) {
                case 'double': return 100;
                case 'triple': return 150;
                case 'pattern': return 200;
                default: return 100;
            }
        }

        async triggerVibrationAPI(pattern) {
            if (!navigator.vibrate) {
                return false;
            }

            try {
                let vibrationPattern;
                
                switch (pattern) {
                    case 'single':
                        vibrationPattern = [50];
                        break;
                    case 'double':
                        vibrationPattern = [100, 100, 100];
                        break;
                    case 'triple':
                        vibrationPattern = [100, 100, 100, 100, 100];
                        break;
                    case 'long':
                        vibrationPattern = [800];
                        break;
                    case 'pattern':
                        vibrationPattern = [200, 100, 100, 100, 200, 100, 300];
                        break;
                    default:
                        vibrationPattern = [200];
                }

                navigator.vibrate(vibrationPattern);
                return true;
            } catch (error) {
                console.warn('Vibration API failed:', error);
                return false;
            }
        }

        playAudioFeedback(pattern) {
            try {
                // Create different audio frequencies for different patterns
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                const frequencies = {
                    single: [800],
                    double: [800, 600],
                    triple: [800, 600, 400],
                    long: [400],
                    pattern: [800, 600, 400, 600, 800]
                };

                const freqs = frequencies[pattern] || [800];
                const duration = pattern === 'long' ? 800 : 100;

                freqs.forEach((freq, index) => {
                    setTimeout(() => {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                        oscillator.type = 'sine';
                        
                        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
                        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration / 1000);
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + duration / 1000);
                    }, index * 150);
                });
                
                return true;
            } catch (error) {
                console.warn('Audio feedback failed:', error);
                return false;
            }
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async trigger(pattern) {
            // Update debug UI before triggering
            this.updateDebugUI();
            
            // Play click sound along with haptic (if audio enabled)
            if (this.audioEnabled) {
                this.playClickSound();
            }
            
            // Check if haptics are enabled
            if (!this.hapticsEnabled) {
                return; // Don't trigger haptics if disabled
            }
            
            // Validate pattern
            const validPatterns = ['single', 'double', 'triple', 'long', 'pattern'];
            if (!validPatterns.includes(pattern)) {
                console.warn(`Invalid haptic pattern: ${pattern}. Valid patterns are: ${validPatterns.join(', ')}`);
                return;
            }
            
            // For iOS: Try switch method first if we have recent interaction and credits
            // This provides the best haptic experience on iOS
            if (this.supportInfo.isIOS && this.supportInfo.isSafari && this.supportInfo.hasSwitchSupport) {
                const success = await this.triggerIOSSwitchHaptic(pattern);
                if (success) {
                    this.updateDebugUI('iOS Switch Haptic');
                    return;
                }
            }
            
            // Fallback to Vibration API (works programmatically on iOS and Android)
            // This is used when:
            // - No recent user interaction (programmatic call)
            // - No gesture credits available
            // - Switch method not available
            if (this.supportInfo.hasVibrationAPI) {
                const success = await this.triggerVibrationAPI(pattern);
                if (success) {
                    this.updateDebugUI('Vibration API');
                    return;
                }
            }
            
            // Final fallback to audio (only if haptics enabled but vibration failed)
            if (this.hapticsEnabled) {
                this.playAudioFeedback(pattern);
                this.updateDebugUI('Audio Fallback');
            }
        }
        
        // Public methods for enabling/disabling haptics and audio
        enableHaptics() {
            this.hapticsEnabled = true;
            this.savePreference('hapticsEnabled', true);
        }
        
        disableHaptics() {
            this.hapticsEnabled = false;
            this.savePreference('hapticsEnabled', false);
        }
        
        toggleHaptics() {
            this.hapticsEnabled = !this.hapticsEnabled;
            this.savePreference('hapticsEnabled', this.hapticsEnabled);
            return this.hapticsEnabled;
        }
        
        enableAudio() {
            this.audioEnabled = true;
            this.savePreference('audioEnabled', true);
            if (window.globalAudioManager) {
                // Update the property descriptor to sync state
                window.globalAudioManager.audioEnabled = true;
                window.globalAudioManager.muted = false;
                // Update all audio elements
                window.globalAudioManager.audioElements.forEach(audio => {
                    window.globalAudioManager.updateAudioElement(audio);
                });
            }
        }
        
        disableAudio() {
            this.audioEnabled = false;
            this.savePreference('audioEnabled', false);
            if (window.globalAudioManager) {
                // Update the property descriptor to sync state
                window.globalAudioManager.audioEnabled = false;
                window.globalAudioManager.muted = true;
                // Update all audio elements
                window.globalAudioManager.audioElements.forEach(audio => {
                    window.globalAudioManager.updateAudioElement(audio);
                });
            }
        }
        
        toggleAudio() {
            const newValue = !this.audioEnabled;
            this.audioEnabled = newValue;
            this.savePreference('audioEnabled', newValue);
            if (window.globalAudioManager) {
                // Update the property descriptor to sync state
                window.globalAudioManager.audioEnabled = newValue;
                window.globalAudioManager.muted = !newValue;
                // Update all audio elements
                window.globalAudioManager.audioElements.forEach(audio => {
                    window.globalAudioManager.updateAudioElement(audio);
                });
            }
            return this.audioEnabled;
        }
        
        isHapticsEnabled() {
            return this.hapticsEnabled;
        }
        
        isAudioEnabled() {
            return this.audioEnabled;
        }
        
        enableMusic() {
            this.musicEnabled = true;
            this.savePreference('musicEnabled', true);
            if (window.globalMusicManager) {
                // Update the property descriptor to sync state
                window.globalMusicManager.musicEnabled = true;
                window.globalMusicManager.muted = false;
                // Update all music elements
                window.globalMusicManager.musicElements.forEach(music => {
                    window.globalMusicManager.updateMusicElement(music);
                });
            }
        }
        
        disableMusic() {
            this.musicEnabled = false;
            this.savePreference('musicEnabled', false);
            if (window.globalMusicManager) {
                // Update the property descriptor to sync state
                window.globalMusicManager.musicEnabled = false;
                window.globalMusicManager.muted = true;
                // Update all music elements
                window.globalMusicManager.musicElements.forEach(music => {
                    window.globalMusicManager.updateMusicElement(music);
                });
            }
        }
        
        toggleMusic() {
            const newValue = !this.musicEnabled;
            this.musicEnabled = newValue;
            this.savePreference('musicEnabled', newValue);
            if (window.globalMusicManager) {
                // Update the property descriptor to sync state
                window.globalMusicManager.musicEnabled = newValue;
                window.globalMusicManager.muted = !newValue;
                // Update all music elements
                window.globalMusicManager.musicElements.forEach(music => {
                    window.globalMusicManager.updateMusicElement(music);
                });
            }
            return this.musicEnabled;
        }
        
        isMusicEnabled() {
            return this.musicEnabled;
        }

        createDebugUI() {
            // Wait for body to be available
            if (!document.body) {
                // If body doesn't exist yet, wait for it
                setTimeout(() => this.createDebugUI(), 100);
                return;
            }
            
            // Check if debug UI already exists
            if (document.getElementById('haptic-debug-ui')) {
                this.debugContainer = document.getElementById('haptic-debug-ui');
                return;
            }
            
            // Create toggle button
            const toggleButton = document.createElement('div');
            toggleButton.id = 'haptic-debug-toggle';
            toggleButton.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                width: 30px;
                height: 30px;
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid #FFD700;
                border-radius: 50%;
                cursor: pointer;
                z-index: 99998;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFD700;
                font-size: 12px;
                font-weight: bold;
                transition: all 0.2s ease;
            `;
            toggleButton.textContent = 'H';
            toggleButton.title = 'Toggle Haptic Debug UI';
            toggleButton.style.display = 'none'; // Hidden by default
            toggleButton.addEventListener('click', () => {
                this.toggleDebugUI();
            });
            document.body.appendChild(toggleButton);
            this.debugToggleButton = toggleButton;
            
            // Create debug container
            const debugContainer = document.createElement('div');
            debugContainer.id = 'haptic-debug-ui';
            debugContainer.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 12px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 11px;
                line-height: 1.6;
                z-index: 99999;
                max-width: 280px;
                border: 2px solid #333;
            `;
            
            debugContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: bold; color: #FFD700;">Haptic Debug</div>
                    <div id="haptic-debug-close" style="cursor: pointer; color: #fff; font-size: 14px; padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.2);" title="Close">✕</div>
                </div>
                <div id="haptic-debug-enabled">Enabled: Checking...</div>
                <div id="haptic-debug-ios">iOS Support: Checking...</div>
                <div id="haptic-debug-credits">Credits: 0</div>
                <div id="haptic-debug-recent">Recent Interaction: No</div>
                <div id="haptic-debug-can-trigger">Can Trigger: No</div>
                <div id="haptic-debug-method" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">Last Method: -</div>
            `;
            
            // Add close button handler
            const closeButton = debugContainer.querySelector('#haptic-debug-close');
            closeButton.addEventListener('click', () => {
                this.toggleDebugUI();
            });
            
            debugContainer.style.display = 'none'; // Hidden by default
            document.body.appendChild(debugContainer);
            this.debugContainer = debugContainer;
            
            // Initial update
            this.updateDebugUI();
        }

        showDebugToggle() {
            if (this.debugToggleButton) {
                this.debugToggleButton.style.display = 'flex';
            }
        }

        hideDebugToggle() {
            if (this.debugToggleButton) {
                this.debugToggleButton.style.display = 'none';
                // Also hide debug UI if it's open
                if (this.debugContainer) {
                    this.debugContainer.style.display = 'none';
                }
            }
        }

        toggleDebugUI() {
            if (!this.debugContainer || !this.debugToggleButton) return;
            
            const isVisible = this.debugContainer.style.display !== 'none';
            
            if (isVisible) {
                // Hide debug UI, show toggle button
                this.debugContainer.style.display = 'none';
                this.debugToggleButton.style.display = 'flex';
            } else {
                // Show debug UI, hide toggle button
                this.debugContainer.style.display = 'block';
                this.debugToggleButton.style.display = 'none';
                // Update UI when showing
                this.updateDebugUI();
            }
        }

        updateDebugUI(lastMethod = null) {
            if (!this.debugContainer) return;
            
            const isEnabled = this.supportInfo.canUseHaptics;
            const isIOS = this.supportInfo.isIOS;
            const isSafari = this.supportInfo.isSafari;
            const hasSwitchSupport = this.supportInfo.hasSwitchSupport;
            const hasVibrationAPI = this.supportInfo.hasVibrationAPI;
            const recentInteraction = this.isUserInteractionRecent();
            const timeSinceInteraction = this.lastUserInteraction ? 
                Math.floor((Date.now() - this.lastUserInteraction) / 1000) : 'Never';
            const canTrigger = recentInteraction && this.gestureCredits > 0;
            
            // Update enabled status
            const enabledEl = document.getElementById('haptic-debug-enabled');
            if (enabledEl) {
                enabledEl.textContent = `Enabled: ${isEnabled ? '✅ Yes' : '❌ No'}`;
                enabledEl.style.color = isEnabled ? '#4CAF50' : '#F44336';
            }
            
            // Update iOS support
            const iosEl = document.getElementById('haptic-debug-ios');
            if (iosEl) {
                let iosStatus = '';
                if (isIOS && isSafari) {
                    iosStatus = `✅ iOS Safari (Switch: ${hasSwitchSupport ? 'Yes' : 'No'}, Vibration: ${hasVibrationAPI ? 'Yes' : 'No'})`;
                } else if (isIOS) {
                    iosStatus = `⚠️ iOS (Not Safari)`;
                } else {
                    iosStatus = `ℹ️ Not iOS (Vibration: ${hasVibrationAPI ? 'Yes' : 'No'})`;
                }
                iosEl.textContent = `Platform: ${iosStatus}`;
                iosEl.style.color = isIOS && isSafari && hasSwitchSupport ? '#4CAF50' : '#FF9800';
            }
            
            // Update credits
            const creditsEl = document.getElementById('haptic-debug-credits');
            if (creditsEl) {
                creditsEl.textContent = `Credits: ${this.gestureCredits}`;
                creditsEl.style.color = this.gestureCredits > 0 ? '#4CAF50' : '#F44336';
            }
            
            // Update recent interaction
            const recentEl = document.getElementById('haptic-debug-recent');
            if (recentEl) {
                if (recentInteraction) {
                    recentEl.textContent = `Recent Interaction: ✅ Yes (${timeSinceInteraction}s ago)`;
                    recentEl.style.color = '#4CAF50';
                } else {
                    recentEl.textContent = `Recent Interaction: ❌ No (${timeSinceInteraction !== 'Never' ? timeSinceInteraction + 's ago' : 'Never'})`;
                    recentEl.style.color = '#F44336';
                }
            }
            
            // Update can trigger
            const canTriggerEl = document.getElementById('haptic-debug-can-trigger');
            if (canTriggerEl) {
                if (canTrigger) {
                    canTriggerEl.textContent = `Can Trigger: ✅ Yes (iOS Switch)`;
                    canTriggerEl.style.color = '#4CAF50';
                } else if (hasVibrationAPI) {
                    canTriggerEl.textContent = `Can Trigger: ⚠️ Yes (Vibration API)`;
                    canTriggerEl.style.color = '#FF9800';
                } else {
                    canTriggerEl.textContent = `Can Trigger: ❌ No`;
                    canTriggerEl.style.color = '#F44336';
                }
            }
            
            // Update last method
            if (lastMethod) {
                const methodEl = document.getElementById('haptic-debug-method');
                if (methodEl) {
                    methodEl.textContent = `Last Method: ${lastMethod}`;
                    methodEl.style.color = '#2196F3';
                }
            }
        }
    }

    // Initialize the haptic feedback system
    let hapticSystem = null;

    // Initialize function
    function initializeHapticSystem() {
        if (!hapticSystem) {
            try {
                hapticSystem = new HapticFeedback();
            } catch (error) {
                console.error('Failed to initialize haptic feedback system:', error);
            }
        }
    }

    // Global function for triggering haptics
    function triggerHaptic(pattern) {
        // Ensure system is initialized
        if (!hapticSystem) {
            initializeHapticSystem();
        }
        
        if (hapticSystem) {
            hapticSystem.trigger(pattern);
        } else {
            console.warn('Haptic feedback system not available');
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeHapticSystem);
    } else {
        // DOM is already ready
        initializeHapticSystem();
    }

    // Attach to window object for maximum reliability
    window.triggerHaptic = triggerHaptic;

    // Also expose the class for advanced usage if needed
    window.HapticFeedback = HapticFeedback;
    
    // Expose hapticSystem for direct access
    Object.defineProperty(window, 'hapticSystem', {
        get: function() {
            if (!hapticSystem) {
                initializeHapticSystem();
            }
            return hapticSystem;
        }
    });

    // Expose debug toggle functions
    window.showHapticDebug = function() {
        if (hapticSystem) {
            hapticSystem.showDebugToggle();
        }
    };

    window.hideHapticDebug = function() {
        if (hapticSystem) {
            hapticSystem.hideDebugToggle();
        }
    };

    // Expose haptics and audio control functions for settings
    window.enableHaptics = function() {
        if (hapticSystem) {
            hapticSystem.enableHaptics();
        }
    };

    window.disableHaptics = function() {
        if (hapticSystem) {
            hapticSystem.disableHaptics();
        }
    };

    window.toggleHaptics = function() {
        if (hapticSystem) {
            return hapticSystem.toggleHaptics();
        }
        return false;
    };

    window.isHapticsEnabled = function() {
        if (hapticSystem) {
            return hapticSystem.isHapticsEnabled();
        }
        return true;
    };

    window.enableAudio = function() {
        if (hapticSystem) {
            hapticSystem.enableAudio();
        }
    };

    window.disableAudio = function() {
        if (hapticSystem) {
            hapticSystem.disableAudio();
        }
    };

    window.toggleAudio = function() {
        if (hapticSystem) {
            return hapticSystem.toggleAudio();
        }
        return false;
    };

    window.isAudioEnabled = function() {
        if (hapticSystem) {
            return hapticSystem.isAudioEnabled();
        }
        return true;
    };

    window.enableMusic = function() {
        if (hapticSystem) {
            hapticSystem.enableMusic();
        }
    };

    window.disableMusic = function() {
        if (hapticSystem) {
            hapticSystem.disableMusic();
        }
    };

    window.toggleMusic = function() {
        if (hapticSystem) {
            return hapticSystem.toggleMusic();
        }
        return false;
    };

    window.isMusicEnabled = function() {
        if (hapticSystem) {
            return hapticSystem.isMusicEnabled();
        }
        return true;
    };

    // Function to register any audio element for global mute/unmute control
    window.registerAudio = function(audioElement) {
        if (window.globalAudioManager && audioElement) {
            // Store original volume if not already stored
            if (!audioElement._originalVolume) {
                audioElement._originalVolume = audioElement.volume || 1.0;
            }
            window.globalAudioManager.registerAudio(audioElement);
        }
    };

    // Function to unregister audio element
    window.unregisterAudio = function(audioElement) {
        if (window.globalAudioManager && audioElement) {
            window.globalAudioManager.unregisterAudio(audioElement);
        }
    };

    // Function to register any music element for global mute/unmute control
    window.registerMusic = function(musicElement) {
        if (window.globalMusicManager && musicElement) {
            // Store original volume if not already stored
            if (!musicElement._originalVolume) {
                musicElement._originalVolume = musicElement.volume || 1.0;
            }
            window.globalMusicManager.registerMusic(musicElement);
        }
    };

    // Function to unregister music element
    window.unregisterMusic = function(musicElement) {
        if (window.globalMusicManager && musicElement) {
            window.globalMusicManager.unregisterMusic(musicElement);
        }
    };

})();

