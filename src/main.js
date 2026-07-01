import './style.css';
import { DMSSimulator } from './dmsSim.js';
import { VehicleInterface } from './vehicleInterface.js';
import { SLMAgent } from './slmAgent.js';

function initializeDashboard() {
  // 1. Initialize core system modules
  const vehicle = new VehicleInterface();
  const dms = new DMSSimulator('dmsCanvas');
  const agent = new SLMAgent(vehicle);

  // Keep track of alert timings
  let eyeClosedDuration = 0;
  let distractionDuration = 0;
  let phoneDuration = 0;
  let isOverrideActive = false;
  let testSequenceTimer = null;

  // 2. Wire up Accordion Toggle
  const accordionToggle = document.querySelector('.accordion-toggle');
  const accordionSection = document.querySelector('.accordion-section');
  accordionToggle.addEventListener('click', () => {
    accordionSection.classList.toggle('active');
  });

  // 3. UI Element updates
  const earVal = document.getElementById('earVal');
  const earBar = document.getElementById('earBar');
  const blinkVal = document.getElementById('blinkVal');
  const poseVal = document.getElementById('poseVal');
  const gazeVal = document.getElementById('gazeVal');
  const dmsStatus = document.getElementById('dmsStatus');
  const ramUsageEl = document.getElementById('ramUsage');
  const dmsFpsEl = document.getElementById('dmsFps');

  // Sliders
  const sliderEar = document.getElementById('sliderEar');
  const sliderYaw = document.getElementById('sliderYaw');
  const sliderPitch = document.getElementById('sliderPitch');
  const sliderEarVal = document.getElementById('sliderEarVal');
  const sliderYawVal = document.getElementById('sliderYawVal');
  const sliderPitchVal = document.getElementById('sliderPitchVal');

  // 4. Slider event bindings (manual override adjustments)
  sliderEar.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    dms.targetEar = val;
    sliderEarVal.textContent = val.toFixed(2);
    resetStateButtonsHighlight();
  });

  sliderYaw.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    dms.targetYaw = val;
    sliderYawVal.textContent = `${val}°`;
    resetStateButtonsHighlight();
  });

  sliderPitch.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    dms.targetPitch = val;
    sliderPitchVal.textContent = `${val}°`;
    resetStateButtonsHighlight();
  });

  function resetStateButtonsHighlight() {
    stateButtons.forEach(btn => btn.classList.remove('active'));
  }

  // 5. Driver state preset buttons
  const stateButtons = document.querySelectorAll('.state-btn');
  stateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Clear active class from all
      stateButtons.forEach(b => b.classList.remove('active'));
      // Add to clicked
      btn.classList.add('active');
      
      const state = btn.getAttribute('data-state');
      dms.setPresetState(state);
      
      // Update sliders position to match presets
      sliderEar.value = dms.targetEar;
      sliderEarVal.textContent = dms.targetEar.toFixed(2);
      sliderYaw.value = dms.targetYaw;
      sliderYawVal.textContent = `${dms.targetYaw}°`;
      sliderPitch.value = dms.targetPitch;
      sliderPitchVal.textContent = `${dms.targetPitch}°`;

      // Cancel any running test sequences if user manually selects states
      if (testSequenceTimer) {
        clearTimeout(testSequenceTimer);
        testSequenceTimer = null;
        agent.logThought('[Sequence Monitor] Automated test interrupted by manual driver state selection.');
      }
    });
  });

  // 6. Voice / Speech preset clicks
  const speechPresetButtons = document.querySelectorAll('.speech-preset-btn');
  speechPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.getAttribute('data-command');
      agent.processInput(command);
    });
  });

  // Microphone trigger button
  const micBtn = document.getElementById('micBtn');
  micBtn.addEventListener('click', () => {
    agent.toggleVoiceInput();
  });

  // Custom Voice Injector Fallback Binding
  const customVoiceInput = document.getElementById('customVoiceInput');
  const sendCustomVoiceBtn = document.getElementById('sendCustomVoiceBtn');

  function submitCustomVoice() {
    const command = customVoiceInput.value.trim();
    if (command) {
      agent.processInput(command);
      customVoiceInput.value = '';
    }
  }

  sendCustomVoiceBtn.addEventListener('click', submitCustomVoice);
  customVoiceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitCustomVoice();
    }
  });

  // Webcam Toggle Button Binding
  const toggleCameraBtn = document.getElementById('toggleCameraBtn');
  toggleCameraBtn.addEventListener('click', () => {
    dms.toggleWebcam((isActive) => {
      if (isActive) {
        toggleCameraBtn.textContent = 'STOP WEBCAM DMS';
        toggleCameraBtn.style.background = 'linear-gradient(135deg, #ff0055 0%, #bb003b 100%)';
        toggleCameraBtn.style.boxShadow = '0 4px 10px rgba(255, 0, 85, 0.25)';
        agent.logThought('\n[DMS Sensor Interface] Engaging live camera frame grabber...');
        agent.logThought('[DMS Core Thread] Streaming frames to local FaceMesh model...');
        
        // Disable sliders during active webcam tracking
        sliderEar.disabled = true;
        sliderYaw.disabled = true;
        sliderPitch.disabled = true;
      } else {
        toggleCameraBtn.textContent = 'START WEBCAM DMS';
        toggleCameraBtn.style.background = 'linear-gradient(135deg, #00f0ff 0%, #0077ff 100%)';
        toggleCameraBtn.style.boxShadow = '0 4px 10px rgba(0, 240, 255, 0.15)';
        agent.logThought('\n[DMS Sensor Interface] Camera feed terminated.');
        agent.logThought('[DMS Core Thread] Reverted to synthetic driver avatar.');

        // Re-enable sliders
        sliderEar.disabled = false;
        sliderYaw.disabled = false;
        sliderPitch.disabled = false;
        
        triggerPreset('normal');
      }
    });
  });

  // 7. Automated emergency sequence test runner
  const startTestBtn = document.getElementById('startTestBtn');
  startTestBtn.addEventListener('click', () => {
    runAutoTestScenario();
  });

  function runAutoTestScenario() {
    if (testSequenceTimer) clearTimeout(testSequenceTimer);

    // Step 1: Initialize normal road cruise
    agent.logThought('\n[SCENARIO ENGINE] INITIALIZING AUTOMATED EMERGENCY OVERRIDE SCENARIO');
    triggerPreset('normal');
    vehicle.clearSpeedLimit();
    vehicle.resetAC();
    vehicle.setHazards(false);
    vehicle.setHUDWarning('DRIVING ASSIST ACTIVE');
    document.body.classList.remove('hazard-active');
    isOverrideActive = false;
    
    agent.addMessage('copilot', "Simulation initiated. Vehicles cruising normally on highway at 90 km/h under Adaptive Cruise Control.");

    // Step 2: Driver becomes drowsy after 3 seconds
    testSequenceTimer = setTimeout(() => {
      agent.logThought('\n[SCENARIO ENGINE] STEP 2: DRIVER FATIGUE INDUCTION');
      triggerPreset('drowsy');
      agent.addMessage('system', "Driver begins to experience micro-sleep. Eyes closing, head nodding downward...");
      
      // Step 3: Local agent triggers auto remediation after another 2 seconds
      testSequenceTimer = setTimeout(() => {
        agent.logThought('\n[SCENARIO ENGINE] STEP 3: AUTOMATED OVERRIDE TRIGGERED');
        agent.runDMSAlertSequence();
        isOverrideActive = true;

        // Step 4: Driver recovers after 6 seconds of AC blast and alerts
        testSequenceTimer = setTimeout(() => {
          agent.logThought('\n[SCENARIO ENGINE] STEP 4: PHYSIOLOGICAL RECOVERY');
          triggerPreset('normal');
          agent.addMessage('system', "Driver recovers attention. Eyelid movement and gaze direction return to standard calibration.");
          
          // Agent logs recovery and restores controls
          setTimeout(() => {
            agent.logThought('\n[Reasoning (CoT)]:');
            agent.logThought('  - DMS reports driver EAR recovered to 0.32.');
            agent.logThought('  - Active warning threshold cleared.');
            agent.logThought('  - Action: Restore normal HVAC comfort. Retain hazards for safe visual stabilization, then clear.');
            agent.logThought('  - Tool call: vehicle_interface:clearSpeedLimit()');
            agent.logThought('  - Tool call: vehicle_interface:setHazards(false)');
            agent.logThought('  - Tool call: vehicle_interface:setHUDWarning("DRIVING ASSIST ACTIVE")');

            vehicle.clearSpeedLimit();
            vehicle.resetAC();
            vehicle.setHazards(false);
            vehicle.setHUDWarning('DRIVING ASSIST ACTIVE');
            document.body.classList.remove('hazard-active');
            isOverrideActive = false;
            
            agent.addMessage('copilot', "Drowsiness cleared. Cabin climate and speed limits returned to normal control. Safe travel.");
            agent.logThought('[SCENARIO ENGINE] SCENARIO CONCLUDED SUCCESSFULLY.');
          }, 1200);

        }, 7000); // 7s in safety override mode

      }, 2500); // 2.5s of drowsiness triggers safety overrides

    }, 3500); // 3.5s of normal driving
  }

  function triggerPreset(stateName) {
    stateButtons.forEach(btn => {
      if (btn.getAttribute('data-state') === stateName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    dms.setPresetState(stateName);
    sliderEar.value = dms.targetEar;
    sliderEarVal.textContent = dms.targetEar.toFixed(2);
    sliderYaw.value = dms.targetYaw;
    sliderYawVal.textContent = `${dms.targetYaw}°`;
    sliderPitch.value = dms.targetPitch;
    sliderPitchVal.textContent = `${dms.targetPitch}°`;
  }

  // 8. Core Animation / Simulation Frame loop (30 FPS target)
  let lastFrameTime = Date.now();
  let backgroundTrafficCounter = 0;

  function renderLoop() {
    const now = Date.now();
    const delta = now - lastFrameTime;

    // Run updates at roughly 30 frames per second
    if (delta >= 33) {
      lastFrameTime = now;

      // Update simulation models
      dms.update();
      dms.draw();
      
      vehicle.update();

      // Retrieve real-time data from the DMS simulator
      const metrics = dms.getMetrics();

      // If camera is active, dynamically update manual sliders to reflect real values
      if (dms.isWebcamActive) {
        sliderEar.value = metrics.ear;
        sliderEarVal.textContent = metrics.ear.toFixed(2);
        
        sliderYaw.value = Math.max(-45, Math.min(45, Math.round(metrics.yaw)));
        sliderYawVal.textContent = `${Math.round(metrics.yaw)}°`;
        
        sliderPitch.value = Math.max(-30, Math.min(30, Math.round(metrics.pitch)));
        sliderPitchVal.textContent = `${Math.round(metrics.pitch)}°`;
      }

      // Update Telemetry Panel UI labels
      earVal.textContent = metrics.ear.toFixed(2);
      
      // Update EAR progress bar coloring
      earBar.style.width = `${Math.min(100, (metrics.ear / 0.40) * 100)}%`;
      if (metrics.ear < 0.22) {
        earVal.className = 'text-error text-glow animate-pulse';
        earBar.className = 'h-full bg-error transition-all duration-300';
        dmsStatus.textContent = 'CRITICAL ALERT';
        dmsStatus.className = 'px-2 py-1 text-[10px] font-mono border border-error text-error rounded bg-error-dim animate-pulse';
      } else if (metrics.ear < 0.26) {
        earVal.className = 'text-warning text-glow';
        earBar.className = 'h-full bg-warning transition-all duration-300';
        dmsStatus.textContent = 'ATTENTION SLOW';
        dmsStatus.className = 'px-2 py-1 text-[10px] font-mono border border-warning text-warning rounded bg-warning/10';
      } else {
        earVal.className = 'text-white';
        earBar.className = 'h-full bg-success transition-all duration-300';
        dmsStatus.textContent = 'MONITORING';
        dmsStatus.className = 'px-2 py-1 text-[10px] font-mono border border-success text-success rounded';
      }

      blinkVal.textContent = metrics.blinkRate;
      poseVal.textContent = `${metrics.pitch.toFixed(1)}°, ${metrics.yaw.toFixed(1)}°, ${metrics.roll.toFixed(1)}°`;
      
      gazeVal.textContent = metrics.gazeDirection;
      if (metrics.gazeDirection === 'CENTER') {
        gazeVal.className = 'text-success text-glow';
      } else {
        gazeVal.className = 'text-brand text-glow';
      }

      // 9. Passive DMS Threshold Monitoring (Auto Alert triggers)
      if (!isOverrideActive && !testSequenceTimer) {
        
        // A. Sleep / Eyes Closed check
        if (metrics.ear < 0.22) {
          eyeClosedDuration += 33; // Add millisecond frame step
          
          if (eyeClosedDuration > 600) { // Closed eyes for > 0.6 seconds
            agent.logThought('\n[DMS Core Thread] Safety trigger: Eye Aspect Ratio (EAR) < 0.22 for 0.6s.');
            agent.runDMSAlertSequence();
            isOverrideActive = true;
            eyeClosedDuration = 0;
          }
        } else {
          eyeClosedDuration = 0;
        }

        // B. Distraction check (looking away)
        if (Math.abs(metrics.yaw) > 20) {
          distractionDuration += 33;
          if (distractionDuration > 1000) { // Distracted for > 1.0 second
            agent.logThought('\n[DMS Core Thread] Attention trigger: Head pose Yaw exceeded 20° for 1.0s.');
            agent.logThought('[Reasoning (CoT)] Driver looking away from front windshield road vectors. Invoking HUD notifications.');
            
            vehicle.setHUDWarning('DMS ALERT: KEEP EYES ON ROAD', 'hazard');
            agent.speak("Please look straight and focus on the road.", false);
            
            distractionDuration = 0;
          }
        } else {
          distractionDuration = 0;
        }

        // C. Phone distraction check (gaze down and head pitch down)
        if (metrics.gazeDirection === 'DOWN (PHONE)' && metrics.pitch > 15) {
          phoneDuration += 33;
          if (phoneDuration > 800) { // Look at phone for > 0.8 seconds
            agent.logThought('\n[DMS Core Thread] Gesture trigger: Gaze matching cell phone orientation posture.');
            agent.logThought('[Reasoning (CoT)] Handheld device distraction signature matches. Deploying HUD override warning.');
            
            vehicle.setHUDWarning('DMS ALERT: CELL PHONE DISTRACTION', 'hazard');
            agent.speak("Put away the phone and pay attention to driving.", false);
            
            phoneDuration = 0;
          }
        } else {
          phoneDuration = 0;
        }
      }

      // If override is active and user is now looking normally, clear warning after a delay
      if (isOverrideActive && !testSequenceTimer && !metrics.isHazard) {
        // Driver recovered manually
        agent.logThought('\n[DMS Core Thread] Passive safety clearing: Driver is alert.');
        vehicle.clearSpeedLimit();
        vehicle.resetAC();
        vehicle.setHazards(false);
        vehicle.setHUDWarning('DRIVING ASSIST ACTIVE');
        document.body.classList.remove('hazard-active');
        isOverrideActive = false;
        agent.addMessage('copilot', "Safety override deactivated. Driver attention restored.");
      }

      // 10. Inject background traffic packets to make CAN feed look real
      backgroundTrafficCounter++;
      if (backgroundTrafficCounter >= 3) { // Tick every 3 frames (~100ms)
        vehicle.tickBackgroundTraffic();
        backgroundTrafficCounter = 0;
      }

      // 11. Subtle RAM and FPS UI indicators updating
      // Small RAM fluctuation to mimic active memory pooling
      const baseRam = 1.44;
      const flux = (Math.random() * 0.04) - 0.02;
      ramUsageEl.textContent = `${(baseRam + flux).toFixed(2)} GB / 2.0 GB`;
      
      dmsFpsEl.textContent = `${dms.fps.toFixed(1)} FPS`;
    }

    requestAnimationFrame(renderLoop);
  }

  // Start the render loop
  requestAnimationFrame(renderLoop);
}

// Robust execution wrapper to prevent DOMContentLoaded race conditions in Vite
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  initializeDashboard();
}
