// Shared Settings: haptics, sound FX, music (persisted in localStorage), How to play callback, Permissions overlay (camera, location, motion). Customise per-page via initSettings({ onHowToPlay, nicknameElementId }).

(function() {
    'use strict';

    // Settings configuration
    let settingsConfig = {
        onHowToPlay: null,
        nicknameElementId: 'userNickname'
    };

    /**
     * Initialize settings on a page
     * @param {Object} config - Configuration object
     * @param {Function} config.onHowToPlay - Callback function for "How to play" button
     * @param {string} [config.nicknameElementId='userNickname'] - ID of element to display nickname
     */
    function initSettings(config) {
        if (config) {
            settingsConfig = Object.assign({}, settingsConfig, config);
        }

        // Setup close button
        const closeButton = document.querySelector('#settingsOverlay .close-button');
        if (closeButton) {
            closeButton.addEventListener('click', hideSettings);
        }

        // Setup home button
        const homeButton = document.querySelector('#settingsOverlay .home-button');
        if (homeButton) {
            homeButton.addEventListener('click', function() {
                // Trigger haptic feedback
                if (typeof triggerHaptic === 'function') {
                    triggerHaptic('single');
                }
                // Navigate to menu page
                navigateToMenu();
            });
        }

        // Setup how to play button
        const howToPlayButton = document.querySelector('#settingsOverlay .how-to-play-button');
        if (howToPlayButton) {
            howToPlayButton.addEventListener('click', function() {
                hideSettings();
                if (settingsConfig.onHowToPlay && typeof settingsConfig.onHowToPlay === 'function') {
                    settingsConfig.onHowToPlay();
                }
            });
        }

        // Setup sensor permissions button (opens second overlay)
        const sensorPermissionsButton = document.getElementById('sensorPermissionsButton');
        const sensorPermissionsOverlay = document.getElementById('sensorPermissionsOverlay');
        if (sensorPermissionsButton && sensorPermissionsOverlay) {
            sensorPermissionsButton.addEventListener('click', function() {
                if (typeof triggerHaptic === 'function') {
                    triggerHaptic('single');
                }
                showSensorPermissionsOverlay();
            });
            const sensorCloseButton = sensorPermissionsOverlay.querySelector('.close-button');
            if (sensorCloseButton) {
                sensorCloseButton.addEventListener('click', hideSensorPermissionsOverlay);
            }
        }

        // Setup toggle buttons
        const hapticsToggle = document.getElementById('hapticsToggle');
        if (hapticsToggle) {
            hapticsToggle.addEventListener('click', toggleHapticsSetting);
        }

        const audioToggle = document.getElementById('audioToggle');
        if (audioToggle) {
            audioToggle.addEventListener('click', toggleAudioSetting);
        }

        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) {
            musicToggle.addEventListener('click', toggleMusicSetting);
        }
    }

    /**
     * Show settings overlay
     */
    function showSettings() {
        // Trigger haptic feedback
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('single');
        }
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            // Remove any existing animation classes
            overlay.classList.remove('hiding');
            // Show overlay and add showing class to trigger animation
            overlay.style.display = 'flex';
            // Force reflow to ensure display change is applied
            overlay.offsetHeight;
            overlay.classList.add('showing');
            updateNickname();
            updateSettingsToggles();
        }
    }

    /**
     * Hide settings overlay
     */
    function hideSettings() {
        // Trigger haptic feedback
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('single');
        }
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            // Remove showing class and add hiding class to trigger exit animation
            overlay.classList.remove('showing');
            overlay.classList.add('hiding');
            // Wait for animation to complete before hiding
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.classList.remove('hiding');
            }, 300); // Match animation duration
        }
    }

    /**
     * Update nickname display in settings
     */
    function updateNickname() {
        const userData = JSON.parse(localStorage.getItem('userData') || 'null');
        const nicknameElement = document.getElementById(settingsConfig.nicknameElementId);
        
        if (nicknameElement) {
            if (userData && userData.nickname) {
                nicknameElement.textContent = userData.nickname;
            } else {
                nicknameElement.textContent = 'Guest';
            }
        }
    }

    /**
     * Update settings toggle states based on localStorage
     */
    function updateSettingsToggles() {
        // Wait a moment for haptic system to initialize
        setTimeout(() => {
            // Update haptics toggle
            const hapticsToggle = document.getElementById('hapticsToggle');
            if (hapticsToggle) {
                let enabled = true; // default
                // First try to get from haptic system directly
                if (window.hapticSystem && window.hapticSystem.hapticsEnabled !== undefined) {
                    enabled = window.hapticSystem.hapticsEnabled;
                } else if (typeof isHapticsEnabled === 'function') {
                    enabled = isHapticsEnabled();
                } else {
                    // Fallback: check localStorage directly
                    try {
                        const stored = localStorage.getItem('haptic_hapticsEnabled');
                        enabled = stored === null ? true : stored === 'true';
                    } catch (e) {
                        enabled = true;
                    }
                }
                // Remove disabled class first, then add it if needed
                hapticsToggle.classList.remove('disabled');
                if (!enabled) {
                    hapticsToggle.classList.add('disabled');
                }
            }

            // Update audio toggle
            const audioToggle = document.getElementById('audioToggle');
            if (audioToggle) {
                let enabled = true; // default
                // Priority 1: Check localStorage directly (most reliable source of truth)
                try {
                    const stored = localStorage.getItem('haptic_audioEnabled');
                    if (stored !== null) {
                        enabled = stored === 'true';
                    } else {
                        // If not in localStorage, check haptic system
                        if (window.hapticSystem && window.hapticSystem.audioEnabled !== undefined) {
                            enabled = window.hapticSystem.audioEnabled;
                        } else if (typeof isAudioEnabled === 'function') {
                            enabled = isAudioEnabled();
                        }
                    }
                } catch (e) {
                    // Fallback: check haptic system
                    if (window.hapticSystem && window.hapticSystem.audioEnabled !== undefined) {
                        enabled = window.hapticSystem.audioEnabled;
                    } else if (typeof isAudioEnabled === 'function') {
                        enabled = isAudioEnabled();
                    }
                }
                // Remove disabled class first, then add it if needed
                audioToggle.classList.remove('disabled');
                if (!enabled) {
                    audioToggle.classList.add('disabled');
                }
            }

            // Update music toggle
            const musicToggle = document.getElementById('musicToggle');
            if (musicToggle) {
                let enabled = true; // default
                try {
                    const stored = localStorage.getItem('haptic_musicEnabled');
                    if (stored !== null) {
                        enabled = stored === 'true';
                    } else {
                        if (window.hapticSystem && window.hapticSystem.musicEnabled !== undefined) {
                            enabled = window.hapticSystem.musicEnabled;
                        } else if (typeof isMusicEnabled === 'function') {
                            enabled = isMusicEnabled();
                        }
                    }
                } catch (e) {
                    if (window.hapticSystem && window.hapticSystem.musicEnabled !== undefined) {
                        enabled = window.hapticSystem.musicEnabled;
                    } else if (typeof isMusicEnabled === 'function') {
                        enabled = isMusicEnabled();
                    }
                }
                musicToggle.classList.remove('disabled');
                if (!enabled) {
                    musicToggle.classList.add('disabled');
                }
            }
        }, 150); // Slightly longer delay to ensure haptic system is ready
    }

    /**
     * Toggle haptics setting
     */
    function toggleHapticsSetting() {
        if (typeof toggleHaptics === 'function') {
            const enabled = toggleHaptics();
            const hapticsToggle = document.getElementById('hapticsToggle');
            if (hapticsToggle) {
                hapticsToggle.classList.toggle('disabled', !enabled);
            }
            // Trigger haptic feedback to show it's working (if enabled)
            if (enabled && typeof triggerHaptic === 'function') {
                triggerHaptic('single');
            }
        } else {
            // Fallback: toggle localStorage directly
            try {
                const stored = localStorage.getItem('haptic_hapticsEnabled');
                const current = stored === null ? true : stored === 'true';
                const newValue = !current;
                localStorage.setItem('haptic_hapticsEnabled', newValue.toString());
                const hapticsToggle = document.getElementById('hapticsToggle');
                if (hapticsToggle) {
                    hapticsToggle.classList.toggle('disabled', !newValue);
                }
                // Try to update haptic system if available
                if (window.hapticSystem) {
                    window.hapticSystem.hapticsEnabled = newValue;
                }
            } catch (e) {
                console.warn('Failed to toggle haptics:', e);
            }
        }
    }

    /**
     * Toggle audio setting
     */
    function toggleAudioSetting() {
        // Always read current state from localStorage first (source of truth)
        let currentValue = true;
        try {
            const stored = localStorage.getItem('haptic_audioEnabled');
            currentValue = stored === null ? true : stored === 'true';
        } catch (e) {
            // Fallback to haptic system
            if (window.hapticSystem && window.hapticSystem.audioEnabled !== undefined) {
                currentValue = window.hapticSystem.audioEnabled;
            } else if (typeof isAudioEnabled === 'function') {
                currentValue = isAudioEnabled();
            }
        }
        
        const newValue = !currentValue;
        
        // Update localStorage first (source of truth)
        try {
            localStorage.setItem('haptic_audioEnabled', newValue.toString());
        } catch (e) {
            console.warn('Failed to save audio preference:', e);
        }
        
        // Update haptic system if available
        if (window.hapticSystem) {
            window.hapticSystem.audioEnabled = newValue;
            if (typeof window.hapticSystem.savePreference === 'function') {
                window.hapticSystem.savePreference('audioEnabled', newValue);
            }
        }
        
        // Update global audio manager
        if (window.globalAudioManager) {
            window.globalAudioManager.audioEnabled = newValue;
            window.globalAudioManager.muted = !newValue;
            window.globalAudioManager.audioElements.forEach(audio => {
                window.globalAudioManager.updateAudioElement(audio);
            });
        }
        
        // Update UI
        const audioToggle = document.getElementById('audioToggle');
        if (audioToggle) {
            audioToggle.classList.remove('disabled');
            if (!newValue) {
                audioToggle.classList.add('disabled');
            }
        }
        
        // Play a test sound if audio was enabled
        if (newValue && typeof triggerHaptic === 'function') {
            triggerHaptic('single');
        }
    }

    /**
     * Toggle music setting
     */
    function toggleMusicSetting() {
        // Always read current state from localStorage first (source of truth)
        let currentValue = true;
        try {
            const stored = localStorage.getItem('haptic_musicEnabled');
            currentValue = stored === null ? true : stored === 'true';
        } catch (e) {
            // Fallback to haptic system
            if (window.hapticSystem && window.hapticSystem.musicEnabled !== undefined) {
                currentValue = window.hapticSystem.musicEnabled;
            } else if (typeof isMusicEnabled === 'function') {
                currentValue = isMusicEnabled();
            }
        }
        
        const newValue = !currentValue;
        
        // Update localStorage first (source of truth)
        try {
            localStorage.setItem('haptic_musicEnabled', newValue.toString());
        } catch (e) {
            console.warn('Failed to save music preference:', e);
        }
        
        // Update haptic system if available
        if (window.hapticSystem) {
            window.hapticSystem.musicEnabled = newValue;
            if (typeof window.hapticSystem.savePreference === 'function') {
                window.hapticSystem.savePreference('musicEnabled', newValue);
            }
        }
        
        // Update global music manager
        if (window.globalMusicManager) {
            window.globalMusicManager.musicEnabled = newValue;
            window.globalMusicManager.muted = !newValue;
            window.globalMusicManager.musicElements.forEach(music => {
                window.globalMusicManager.updateMusicElement(music);
            });
        }
        
        // Update UI
        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) {
            musicToggle.classList.remove('disabled');
            if (!newValue) {
                musicToggle.classList.add('disabled');
            }
        }
    }

    /**
     * Get permission state for UI display (granted / denied / prompt / unknown)
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @returns {Promise<string>} 'granted' | 'denied' | 'prompt' | 'unknown'
     */
    async function getPermissionState(permissionType) {
        try {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (permissionType === 'location' && isIOS) {
                const key = getPermissionStorageKey(permissionType);
                const stored = localStorage.getItem(key);
                const legacy = localStorage.getItem('geopin-location-permission');
                return (stored === 'granted' || legacy === 'granted') ? 'granted' : 'unknown';
            }
            if (permissionType === 'motion') {
                const key = getPermissionStorageKey(permissionType);
                const stored = localStorage.getItem(key);
                if (stored === 'granted') return 'granted';
                if (typeof DeviceOrientationEvent !== 'undefined' &&
                    typeof DeviceOrientationEvent.requestPermission === 'function') {
                    return 'prompt';
                }
                return 'granted';
            }
            if (navigator.permissions && navigator.permissions.query) {
                let name = permissionType === 'location' ? 'geolocation' : permissionType;
                const result = await navigator.permissions.query({ name: name });
                if (result.state === 'granted') return 'granted';
                if (result.state === 'denied') return 'denied';
                return 'prompt';
            }
            const granted = await checkPermission(permissionType);
            return granted ? 'granted' : 'unknown';
        } catch (e) {
            const granted = await checkPermission(permissionType);
            return granted ? 'granted' : 'unknown';
        }
    }

    /**
     * Re-trigger OS permission prompt (always calls OS API, does not return early if already granted)
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @returns {Promise<boolean>} True if permission is granted after request
     */
    async function requestPermissionRetrigger(permissionType) {
        try {
            if (permissionType === 'camera') {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    return false;
                }
                const constraints = { video: { facingMode: 'environment' } };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                storePermissionGrant('camera');
                stream.getTracks().forEach(track => track.stop());
                return true;
            }
            if (permissionType === 'location') {
                if (!('geolocation' in navigator)) return false;
                return new Promise(function (resolve) {
                    navigator.geolocation.getCurrentPosition(
                        function () {
                            storePermissionGrant('location');
                            resolve(true);
                        },
                        function () { resolve(false); },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                });
            }
            if (permissionType === 'motion') {
                if (typeof DeviceOrientationEvent !== 'undefined' &&
                    typeof DeviceOrientationEvent.requestPermission === 'function') {
                    const response = await DeviceOrientationEvent.requestPermission();
                    if (response === 'granted') {
                        storePermissionGrant('motion');
                        return true;
                    }
                    return false;
                }
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if (!isIOS) {
                    storePermissionGrant('motion');
                    return true;
                }
                return false;
            }
            return false;
        } catch (e) {
            console.warn('Permission retrigger failed:', permissionType, e);
            return false;
        }
    }

    /**
     * Show sensor permissions overlay and refresh button states
     */
    function showSensorPermissionsOverlay() {
        const overlay = document.getElementById('sensorPermissionsOverlay');
        if (overlay) {
            overlay.classList.remove('hiding');
            overlay.style.display = 'flex';
            overlay.offsetHeight;
            overlay.classList.add('showing');
            updateSensorPermissionButtons();
        }
    }

    /**
     * Hide sensor permissions overlay
     */
    function hideSensorPermissionsOverlay() {
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('single');
        }
        const overlay = document.getElementById('sensorPermissionsOverlay');
        if (overlay) {
            overlay.classList.remove('showing');
            overlay.classList.add('hiding');
            setTimeout(function () {
                overlay.style.display = 'none';
                overlay.classList.remove('hiding');
            }, 300);
        }
    }

    /**
     * Update sensor permission row labels and attach retrigger handlers
     */
    function updateSensorPermissionButtons() {
        const types = [
            { type: 'camera', label: 'Camera', buttonId: 'sensorPermissionCamera', stateId: 'sensorStateCamera' },
            { type: 'location', label: 'Location (GPS)', buttonId: 'sensorPermissionLocation', stateId: 'sensorStateLocation' },
            { type: 'motion', label: 'Device orientation', buttonId: 'sensorPermissionMotion', stateId: 'sensorStateMotion' }
        ];
        types.forEach(function (item) {
            const stateEl = document.getElementById(item.stateId);
            const buttonEl = document.getElementById(item.buttonId);
            if (stateEl) {
                getPermissionState(item.type).then(function (state) {
                    stateEl.setAttribute('data-state', state);
                    const stateImg = stateEl.querySelector('img');
                    if (stateImg && buttonEl) {
                        const requestImg = buttonEl.querySelector('img');
                        const basePath = requestImg && requestImg.src ? requestImg.src.replace(/PlayAgain\.png$/, '') : '';
                        stateImg.src = basePath + (state === 'granted' ? 'granted.svg' : 'Ngranted.svg');
                        stateImg.alt = state === 'granted' ? 'Granted' : 'Not granted';
                    }
                });
            }
            if (buttonEl) {
                buttonEl.onclick = function () {
                    if (typeof triggerHaptic === 'function') triggerHaptic('single');
                    buttonEl.disabled = true;
                    requestPermissionRetrigger(item.type).then(function () {
                        updateSensorPermissionButtons();
                    }).finally(function () {
                        buttonEl.disabled = false;
                    });
                };
            }
        });
    }

    /**
     * Navigate to menu page
     * Determines the correct path based on current location
     */
    function navigateToMenu() {
        const pathname = window.location.pathname;
        const pathParts = pathname.split('/').filter(part => part);
        
        // Determine relative path to menu.html
        let menuPath = 'menu.html';
        
        // If we're in a game directory (games/*/index.html)
        if (pathParts.includes('games')) {
            menuPath = '../../pages/menu.html';
        }
        // If we're in pages subdirectory (pages/wayfinding/wayfinding.html)
        else if (pathParts.includes('pages') && pathParts.length > 1) {
            menuPath = '../menu.html';
        }
        // If we're already in pages root (pages/menu.html)
        else if (pathParts.includes('pages') && pathParts.length === 1) {
            menuPath = 'menu.html';
        }
        // If we're in root or index
        else if (pathParts.length === 0 || pathParts[pathParts.length - 1] === 'index.html') {
            menuPath = 'pages/menu.html';
        }
        
        // Navigate to menu
        if (window.top && window.top !== window) {
            // If in iframe, navigate parent
            window.top.location.href = menuPath;
        } else {
            window.location.href = menuPath;
        }
    }

    /**
     * Permission Management System
     * Stores and checks permission grants to prevent repeated prompts on iOS/Safari
     */

    /**
     * Get the storage key for a permission type
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @returns {string} Storage key
     */
    function getPermissionStorageKey(permissionType) {
        const keys = {
            'camera': 'permission-camera-granted',
            'location': 'permission-location-granted',
            'motion': 'permission-motion-granted'
        };
        return keys[permissionType] || `permission-${permissionType}-granted`;
    }

    /**
     * Store permission grant in localStorage
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     */
    function storePermissionGrant(permissionType) {
        try {
            const key = getPermissionStorageKey(permissionType);
            localStorage.setItem(key, 'granted');
            sessionStorage.setItem(key, 'granted');
            // Also maintain backward compatibility for location permission
            if (permissionType === 'location') {
                localStorage.setItem('geopin-location-permission', 'granted');
                sessionStorage.setItem('geopin-location-permission', 'granted');
            }
        } catch (e) {
            console.warn('Failed to store permission grant:', e);
        }
    }

    /**
     * Check if a permission was previously granted
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @returns {Promise<boolean>} True if permission is granted
     */
    async function checkPermission(permissionType) {
        try {
            const key = getPermissionStorageKey(permissionType);
            // Sync check first (localStorage + sessionStorage) so we never miss a stored grant
            if (hasStoredPermissionSync(permissionType)) {
                return true;
            }
            // Legacy: first check localStorage
            const stored = localStorage.getItem(key);
            if (stored === 'granted') {
                return true;
            }
            // For location, also check legacy key
            if (permissionType === 'location') {
                const legacyStored = localStorage.getItem('geopin-location-permission');
                if (legacyStored === 'granted') {
                    storePermissionGrant('location');
                    return true;
                }
            }
            
            // For location on iOS, avoid using Permissions API as it can trigger prompts
            // Rely on localStorage only for iOS to prevent OS-level prompts
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (permissionType === 'location' && isIOS) {
                // On iOS, don't use Permissions API for location - it can trigger prompts
                // Rely solely on localStorage which we set when permission is granted
                return false;
            }
            
            // If Permissions API is available, query current state (for non-iOS or non-location)
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    let permissionName = permissionType;
                    
                    // Map permission types to Permissions API names
                    if (permissionType === 'camera') {
                        permissionName = 'camera';
                    } else if (permissionType === 'location') {
                        permissionName = 'geolocation';
                    } else if (permissionType === 'motion') {
                        // Motion sensors don't have a standard Permissions API name
                        // We'll rely on localStorage only for this
                        return false;
                    }
                    
                    const result = await navigator.permissions.query({ name: permissionName });
                    if (result.state === 'granted') {
                        // Update localStorage to reflect current state
                        storePermissionGrant(permissionType);
                        return true;
                    }
                } catch (e) {
                    // Permissions API might not support this permission type
                    // Fall through to return false
                }
            }
            
            return false;
        } catch (e) {
            console.warn('Failed to check permission:', e);
            return false;
        }
    }

    /**
     * Synchronous check for stored permission (avoids any async/race issues on load)
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @returns {boolean} True if we have a stored grant
     */
    function hasStoredPermissionSync(permissionType) {
        try {
            const key = getPermissionStorageKey(permissionType);
            if (localStorage.getItem(key) === 'granted') return true;
            if (sessionStorage.getItem(key) === 'granted') return true;
            if (permissionType === 'location' && localStorage.getItem('geopin-location-permission') === 'granted') return true;
            if (permissionType === 'location' && sessionStorage.getItem('geopin-location-permission') === 'granted') return true;
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Request permission only if not already granted
     * @param {string} permissionType - 'camera', 'location', or 'motion'
     * @param {Object} options - Options for permission request (e.g., constraints for camera)
     * @returns {Promise<boolean>} True if permission is granted
     */
    async function requestPermission(permissionType, options = {}) {
        try {
            // Synchronous check first: if we already have a stored grant, never trigger OS prompt
            if (hasStoredPermissionSync(permissionType)) {
                return true;
            }
            // Async check as well (covers Permissions API state, etc.)
            const alreadyGranted = await checkPermission(permissionType);
            if (alreadyGranted) {
                return true;
            }
            
            // Request permission based on type
            if (permissionType === 'camera') {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.warn('Camera API not available');
                    return false;
                }
                
                const constraints = options.constraints || { video: { facingMode: 'environment' } };
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    // Permission granted - store it
                    storePermissionGrant('camera');
                    // Stop the stream immediately (we just needed permission)
                    stream.getTracks().forEach(track => track.stop());
                    return true;
                } catch (e) {
                    console.warn('Camera permission denied:', e);
                    return false;
                }
            } else if (permissionType === 'location') {
                if (!('geolocation' in navigator)) {
                    console.warn('Geolocation API not available');
                    return false;
                }
                
                // IMPORTANT: On iOS, calling getCurrentPosition even when permission is granted
                // can still trigger OS prompts. We should only call it if we're actually requesting
                // permission for the first time. If already granted, just return true.
                // The checkPermission call at the start should have caught this, but double-check here
                const alreadyGranted = await checkPermission('location');
                if (alreadyGranted) {
                    // Permission already granted - don't call geolocation API to avoid OS prompts
                    return true;
                }
                
                // Permission not yet granted - request it
                const geoOptions = options.geoOptions || { 
                    enableHighAccuracy: true, 
                    timeout: 10000, 
                    maximumAge: 30000 
                };
                
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        () => {
                            // Permission granted - store it
                            storePermissionGrant('location');
                            resolve(true);
                        },
                        () => {
                            // Permission denied
                            resolve(false);
                        },
                        geoOptions
                    );
                });
            } else if (permissionType === 'motion') {
                // Motion sensors (DeviceOrientationEvent) - iOS 13+ requires permission
                if (typeof DeviceOrientationEvent !== 'undefined' && 
                    typeof DeviceOrientationEvent.requestPermission === 'function') {
                    try {
                        const response = await DeviceOrientationEvent.requestPermission();
                        if (response === 'granted') {
                            storePermissionGrant('motion');
                            return true;
                        }
                        return false;
                    } catch (e) {
                        console.warn('Motion permission request failed:', e);
                        return false;
                    }
                } else {
                    // Android/other browsers - permission is implicit, but we can't detect it
                    // Assume granted for non-iOS devices
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                    if (!isIOS) {
                        storePermissionGrant('motion');
                        return true;
                    }
                    return false;
                }
            } else {
                console.warn('Unknown permission type:', permissionType);
                return false;
            }
        } catch (e) {
            console.warn('Failed to request permission:', e);
            return false;
        }
    }

    // Export functions to global scope
    window.initSettings = initSettings;
    window.showSettings = showSettings;
    window.hideSettings = hideSettings;
    window.updateSettingsToggles = updateSettingsToggles;
    window.toggleHapticsSetting = toggleHapticsSetting;
    window.toggleAudioSetting = toggleAudioSetting;
    window.toggleMusicSetting = toggleMusicSetting;
    window.navigateToMenu = navigateToMenu;
    
    // Export permission management functions
    window.checkPermission = checkPermission;
    window.requestPermission = requestPermission;
    window.storePermissionGrant = storePermissionGrant;
    window.hasStoredPermissionSync = hasStoredPermissionSync;
    window.getPermissionState = getPermissionState;
    window.requestPermissionRetrigger = requestPermissionRetrigger;
    window.showSensorPermissionsOverlay = showSensorPermissionsOverlay;
    window.hideSensorPermissionsOverlay = hideSensorPermissionsOverlay;

})();

