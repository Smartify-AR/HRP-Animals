/**
 * Smartify Model Viewer: GLB viewer with AR (ARCore / ARKit Quick Look).
 * Matches temp base (Google model-viewer): minimal attributes so placement/lighting use component defaults.
 * Options: modelSrc, iosSrc, arModes, environmentImage, exposure, shadowIntensity, shadowSoftness.
 */

class SmartifyModelViewer {
  constructor(options = {}) {
    this.options = {
      container: options.container || 'body',
      modelSrc: options.modelSrc || '',
      iosSrc: options.iosSrc || '',
      backgroundColor: options.backgroundColor || '#FCF6EF',
      environmentImage: options.environmentImage ?? '',
      exposure: options.exposure ?? 1.25,
      shadowIntensity: options.shadowIntensity ?? 0.6,
      shadowSoftness: options.shadowSoftness ?? 1,
      autoRotate: options.autoRotate || false,
      cameraControls: options.cameraControls !== false,
      enablePan: options.enablePan !== false,
      fieldOfView: options.fieldOfView || '45deg',
      maxFieldOfView: options.maxFieldOfView || '45deg',
      interactionPrompt: options.interactionPrompt || 'none',
      arModes: options.arModes || 'webxr scene-viewer quick-look',
      /** AR floor placement: if the model floats above the detected plane (e.g. ~1m on Android), set to a positive number (meters) to shift the model down. Applied when object-placed. */
      arPlacementOffsetY: options.arPlacementOffsetY ?? 0,
      xrEnvironment: options.xrEnvironment !== false,
      showControls: options.showControls || false,
      showInstructions: options.showInstructions || false,
      customControls: options.customControls || [],
      onModelLoad: options.onModelLoad || null,
      onError: options.onError || null,
      onARStart: options.onARStart || null,
      onAREnd: options.onAREnd || null,
      ...options
    };

    this.viewer = null;
    this.container = null;
    this.controlsContainer = null;
    this.instructionsContainer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the model viewer
   */
  async init() {
    try {
      // Wait for model-viewer to be loaded
      await this.waitForModelViewer();

      // Get container element
      this.container = typeof this.options.container === 'string'
        ? document.querySelector(this.options.container)
        : this.options.container;

      if (!this.container) {
        throw new Error('Container element not found');
      }

      // On Android over HTTP, WebXR (floor placement + hold-to-move) won't run; show tip
      if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && !window.isSecureContext) {
        console.warn('[model-viewer] On Android, floor placement and reposition in AR require HTTPS. Open this page over HTTPS in Chrome for the full AR experience.');
        this.showAndroidHttpsTip();
      }

      // Create the viewer HTML structure
      this.createViewerHTML();
      
      // Initialize the model-viewer element
      this.initializeViewer();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Apply initial settings
      this.applySettings();
      
      this.isInitialized = true;
      
      if (this.options.onModelLoad) {
        this.options.onModelLoad(this.viewer);
      }
      
    } catch (error) {
      console.error('Failed to initialize Smartify Model Viewer:', error);
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }

  /**
   * Show a one-time tip for Android users on HTTP (WebXR needs HTTPS for floor placement + reposition)
   */
  showAndroidHttpsTip() {
    try {
      const key = 'model-viewer-android-https-tip-dismissed';
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
      const tip = document.createElement('div');
      tip.setAttribute('role', 'status');
      tip.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;max-width:400px;margin:0 auto;padding:12px 16px;background:#3A2E27;color:#FCEFE1;font-family:sans-serif;font-size:14px;line-height:1.4;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      tip.innerHTML = 'For <strong>place & move</strong> in AR on Android, open this page over <strong>HTTPS</strong> in Chrome. <button type="button" style="margin-left:8px;padding:4px 8px;background:#D64D1B;border:none;color:white;border-radius:4px;cursor:pointer;font-size:12px;">OK</button>';
      const btn = tip.querySelector('button');
      const dismiss = () => {
        tip.remove();
        try { sessionStorage.setItem(key, '1'); } catch (_) {}
      };
      if (btn) btn.addEventListener('click', dismiss);
      setTimeout(dismiss, 12000);
      document.body.appendChild(tip);
    } catch (_) {}
  }

  /**
   * Wait for model-viewer custom element to be defined
   */
  async waitForModelViewer() {
    return new Promise((resolve) => {
      if (customElements.get('model-viewer')) {
        resolve();
      } else {
        customElements.whenDefined('model-viewer').then(resolve);
      }
    });
  }

  /**
   * Escape string for safe use in an HTML attribute (avoids breaking on &, ", etc.)
   */
  escapeHtmlAttr(str) {
    if (str == null || str === '') return '';
    const s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Create the HTML structure for the viewer.
   */
  createViewerHTML() {
    const srcAttr = this.escapeHtmlAttr(this.options.modelSrc);
    const iosAttr = this.options.iosSrc ? this.escapeHtmlAttr(this.options.iosSrc) : '';
    this.container.innerHTML = `
      <div class="smartify-viewer-container">
        <model-viewer 
          id="smartify-viewer" 
          class="smartify-model-viewer"
          data-js-focus-visible
          src="${srcAttr}"
          ${iosAttr ? `ios-src="${iosAttr}"` : ''}
          autoplay 
          camera-controls="${this.options.cameraControls}"
          enable-pan="${this.options.enablePan}" 
          field-of-view="${this.options.fieldOfView}" 
          max-field-of-view="${this.options.maxFieldOfView}" 
          interaction-prompt="${this.options.interactionPrompt}" 
          exposure="${this.options.exposure}"
          shadow-intensity="${this.options.shadowIntensity}"
          shadow-softness="${this.options.shadowSoftness}"
          ar 
          ar-modes="${this.options.arModes}"
          ${this.options.xrEnvironment ? 'xr-environment' : ''}>
          <div slot="ar-button"></div>
          <div class="ar-placement-prompt" aria-live="polite">Move your phone slowly to find a flat surface to place the model.</div>
        </model-viewer>
      </div>
    `;

    this.viewer = this.container.querySelector('#smartify-viewer');
  }

  /**
   * Initialize the model-viewer element.
   */
  initializeViewer() {
    if (!this.viewer) return;

    this.viewer.src = this.options.modelSrc;
    if (this.options.iosSrc) {
      this.viewer.setAttribute('ios-src', this.options.iosSrc);
    }
    if (this.options.environmentImage) {
      this.viewer.environmentImage = this.options.environmentImage;
    }
    this.viewer.exposure = this.options.exposure;
    this.viewer.shadowIntensity = this.options.shadowIntensity;
    this.viewer.shadowSoftness = this.options.shadowSoftness;
    this.viewer.autoRotate = this.options.autoRotate;
    this.viewer.setAttribute('autoplay', '');
    if (this.options.xrEnvironment) {
      this.viewer.setAttribute('xr-environment', '');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (!this.viewer) return;

    // Error handling
    this.viewer.addEventListener('error', (event) => {
      console.error('Model viewer error:', event.detail);
      if (this.options.onError) {
        this.options.onError(event.detail);
      }
    });

    // Start animation when model has loaded (helps in-page and AR)
    this.viewer.addEventListener('load', () => {
      try {
        if (typeof this.viewer.play === 'function') {
          this.viewer.play();
        }
      } catch (e) {
        // ignore
      }
    });

    // AR event listeners – start animation when AR session starts so it plays in AR
    this.viewer.addEventListener('ar-status', (event) => {
      if (event.detail.status === 'session-started') {
        try {
          if (typeof this.viewer.play === 'function') {
            this.viewer.play();
          }
        } catch (e) {
          // ignore
        }
        if (this.options.onARStart) {
          this.options.onARStart();
        }
      } else if (event.detail.status === 'object-placed') {
        // Apply vertical placement offset after the component has placed the object (fixes model floating ~1m above floor on Android)
        const offsetM = Number(this.options.arPlacementOffsetY);
        if (!isNaN(offsetM) && offsetM > 0) {
          const apply = () => {
            try {
              this.viewer.setAttribute('camera-target', `0m ${offsetM}m 0m`);
            } catch (e) { /* ignore */ }
          };
          requestAnimationFrame(() => requestAnimationFrame(apply));
        }
      } else if (event.detail.status === 'session-ended') {
        if (this.options.onAREnd) {
          this.options.onAREnd();
        }
      }
    });
  }

  /**
   * Apply current settings to the viewer
   */
  applySettings() {
    if (!this.viewer) return;

    // Set background color
    if (this.container && this.container.parentElement) {
      this.container.parentElement.style.backgroundColor = this.options.backgroundColor;
    }
  }

  /**
   * Update viewer options
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    if (this.isInitialized) {
      this.applySettings();
    }
  }

  /**
   * Load a new model
   */
  loadModel(src) {
    if (this.viewer) {
      this.viewer.src = src;
      this.options.modelSrc = src;
    }
  }

  /**
   * Set environment image
   */
  setEnvironment(imageSrc) {
    if (this.viewer) {
      this.viewer.environmentImage = imageSrc;
      this.options.environmentImage = imageSrc;
    }
  }

  /**
   * Get the model-viewer element
   */
  getViewer() {
    return this.viewer;
  }

  /**
   * Destroy the viewer instance
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.isInitialized = false;
  }
}

// Static method to initialize a new instance
SmartifyModelViewer.init = function(options) {
  const instance = new SmartifyModelViewer(options);
  return instance.init().then(() => instance);
};

// Make it available globally
window.SmartifyModelViewer = SmartifyModelViewer;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartifyModelViewer;
}

