// DriveGuard-Edge Local Offline SLM Voice Co-Pilot Simulator

export class SLMAgent {
  constructor(vehicleInterface) {
    this.vehicle = vehicleInterface;
    this.state = 'IDLE'; // IDLE, THINKING, SPEAKING, LISTENING
    
    // UI elements
    this.thoughtConsole = document.getElementById('thoughtConsole');
    this.chatMessages = document.getElementById('chatMessages');
    this.slmStateEl = document.getElementById('slmState');
    this.micWavesEl = document.getElementById('micWaves');
    this.micTextEl = document.getElementById('micText');
    this.micBtnEl = document.getElementById('micBtn');

    // Speech synthesis setup
    this.synth = window.speechSynthesis;
    this.selectedVoice = null;
    this.initSpeechVoices();

    // Speech recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.setupSpeechRecognition();
    } else {
      this.recognition = null;
    }
  }

  // Find a nice offline sounding voice
  initSpeechVoices() {
    if (!this.synth) return;
    
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      // Try to find Google US English or Microsoft David/Zira
      this.selectedVoice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Google')) ||
                           voices.find(v => v.lang.includes('en-GB')) ||
                           voices.find(v => v.lang.includes('en-US')) ||
                           voices[0];
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  // Update SLM Agent state label
  setState(newState) {
    this.state = newState;
    this.slmStateEl.textContent = `SLM: ${newState}`;
    
    // UI styles based on state
    if (newState === 'THINKING') {
      this.slmStateEl.className = 'px-2 py-1 text-[10px] font-mono border border-brand text-brand rounded bg-brand-dim/10';
    } else if (newState === 'SPEAKING') {
      this.slmStateEl.className = 'px-2 py-1 text-[10px] font-mono border border-success text-success rounded bg-success/10';
    } else if (newState === 'LISTENING') {
      this.slmStateEl.className = 'px-2 py-1 text-[10px] font-mono border border-error text-error rounded bg-error-dim animate-pulse';
    } else {
      this.slmStateEl.className = 'px-2 py-1 text-[10px] font-mono border border-outline text-gray-400 rounded';
    }
  }

  // Write detailed thought logs to the console
  logThought(text, append = true) {
    if (append) {
      this.thoughtConsole.innerHTML += '\n' + text;
    } else {
      this.thoughtConsole.innerHTML = text;
    }
    this.thoughtConsole.scrollTop = this.thoughtConsole.scrollHeight;
  }

  // Append speech chat bubbles
  addMessage(sender, text, isHazard = false) {
    const msg = document.createElement('div');
    if (sender === 'driver') {
      msg.className = 'self-end max-w-[85%] flex flex-col items-end shrink-0';
      msg.innerHTML = `
        <div class="text-[10px] font-bold text-brand uppercase mb-1 tracking-wider font-display">DRIVER (VOICE)</div>
        <div class="bg-surface-container border border-brand/50 p-3 rounded-l-lg rounded-br-lg text-sm text-white">
          ${text}
        </div>
      `;
    } else if (sender === 'system') {
      msg.className = 'text-center text-xs text-gray-500 italic my-1 w-full shrink-0';
      msg.innerHTML = `${text}`;
    } else { // copilot
      msg.className = 'self-start max-w-[85%] flex flex-col items-start shrink-0';
      if (isHazard) {
        msg.innerHTML = `
          <div class="text-[10px] font-bold text-error uppercase mb-1 tracking-wider font-display">CO-PILOT (LOCAL SLM)</div>
          <div class="bg-error-dim border border-error p-3 rounded-r-lg rounded-bl-lg text-sm text-white shadow-neon-error">
            ${text}
          </div>
        `;
      } else {
        msg.innerHTML = `
          <div class="text-[10px] font-bold text-success uppercase mb-1 tracking-wider font-display">CO-PILOT (LOCAL SLM)</div>
          <div class="bg-surface border border-success p-3 rounded-r-lg rounded-bl-lg text-sm text-white">
            ${text}
          </div>
        `;
      }
    }
    this.chatMessages.appendChild(msg);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // Local Text-to-Speech playback
  speak(text, isEmergency = false) {
    if (!this.synth) {
      // Fallback if SpeechSynthesis is blocked
      this.logThought(`[Speech Output Simulation]: "${text}"`);
      return;
    }

    // Cancel active playback
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    if (isEmergency) {
      // Fast, authoritative warning voice parameters
      utterance.rate = 1.35;
      utterance.pitch = 0.9;
      utterance.volume = 1.0;
    } else {
      // Comfortable co-pilot parameters
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      utterance.volume = 0.85;
    }

    this.setState('SPEAKING');
    
    utterance.onstart = () => {
      this.micWavesEl.classList.add('active');
      if (isEmergency) this.micWavesEl.classList.add('alert');
    };

    utterance.onend = () => {
      this.micWavesEl.classList.remove('active', 'alert');
      this.setState('IDLE');
    };

    utterance.onerror = () => {
      this.micWavesEl.classList.remove('active', 'alert');
      this.setState('IDLE');
    };

    this.synth.speak(utterance);
  }

  // Real voice input handlers
  setupSpeechRecognition() {
    this.recognition.onstart = () => {
      this.setState('LISTENING');
      this.micTextEl.textContent = 'LISTENING...';
      this.micBtnEl.classList.add('active');
      this.micWavesEl.classList.add('active');
      this.logThought('[STT Engine] Microphone active. Local Whisper-Tiny streaming audio features...');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.logThought(`[STT Engine] Audio transcribed locally: "${transcript}"`);
      this.stopAllAudioInput();
      this.processInput(transcript);
    };

    this.recognition.onerror = (event) => {
      this.logThought(`[STT Error] Speech recognition failed: ${event.error}`);
      if (event.error === 'network') {
        this.logThought('[STT Info] Chrome/Edge native STT engine requires cloud connectivity in this web browser.');
        this.logThought('[STT Info] Falling back to offline local Voice Activity Detector (VAD)...');
        this.nativeSRFailed = true; // Mark as failed, VAD will show the overlay when silence is detected
      } else {
        this.stopAllAudioInput();
      }
    };

    this.recognition.onend = () => {
      // Managed in coordination with Web Audio analyser
    };
  }

  async startWebAudioAnalyser() {
    try {
      this.nativeSRFailed = false;
      
      // Request mic permission and stream
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.setState('LISTENING');
      this.micTextEl.textContent = 'LISTENING...';
      this.micBtnEl.classList.add('active');
      this.micWavesEl.classList.add('active');
      this.micWavesEl.classList.remove('alert');

      let speaking = false;
      let silenceTimer = 0;

      const checkVolume = () => {
        if (this.state !== 'LISTENING') {
          this.stopLocalAudioOnly();
          return;
        }

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += this.dataArray[i];
        }
        const average = sum / bufferLength;

        // Render waves heights matching the real mic volume!
        const waves = this.micWavesEl.querySelectorAll('span');
        if (waves.length >= 4) {
          const volScale = average / 60; // Scale factor for visual heights
          waves[0].style.height = `${Math.min(22, Math.max(3, 10 * volScale))}px`;
          waves[1].style.height = `${Math.min(22, Math.max(3, 18 * volScale))}px`;
          waves[2].style.height = `${Math.min(22, Math.max(3, 12 * volScale))}px`;
          waves[3].style.height = `${Math.min(22, Math.max(3, 6 * volScale))}px`;
        }

        const voiceThreshold = 8; // Threshold to detect speech
        if (average > voiceThreshold) {
          if (!speaking) {
            speaking = true;
            this.logThought('[STT Engine] Acoustic energy detected. Streaming raw PCM vectors...');
          }
          silenceTimer = 0;
        } else {
          if (speaking) {
            silenceTimer += 33; // 33ms per check
            if (silenceTimer > 1200) { // 1.2s silence -> stop
              speaking = false;
              this.logThought('[STT Engine] Silence detected. Analyzing PCM acoustic feature arrays...');
              
              // Wait a tiny bit and open fallback dialog if native failed or was not supported
              setTimeout(() => {
                if (this.nativeSRFailed || !this.recognition) {
                  this.stopAllAudioInput();
                  this.showVoiceConfirmationDialog();
                }
              }, 200);
            }
          }
        }

        this.vadRequestFrame = requestAnimationFrame(checkVolume);
      };

      checkVolume();

    } catch (err) {
      this.logThought(`[STT Error] Web Audio mic permission denied or failed: ${err.message}`);
      this.stopAllAudioInput();
    }
  }

  stopLocalAudioOnly() {
    if (this.vadRequestFrame) {
      cancelAnimationFrame(this.vadRequestFrame);
      this.vadRequestFrame = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
  }

  stopAllAudioInput() {
    this.stopLocalAudioOnly();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    this.resetMicUI();
  }

  toggleVoiceInput() {
    if (this.state === 'LISTENING') {
      this.stopAllAudioInput();
    } else {
      // Cancel active TTS output
      if (this.synth) this.synth.cancel();
      
      // Remove any existing voice dialog
      const existing = document.getElementById('voiceConfirmDialog');
      if (existing) existing.remove();

      // Start Web Audio recording loop
      this.startWebAudioAnalyser();

      // Start native speech recognition in parallel
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          // Ignore if already started
        }
      } else {
        this.nativeSRFailed = true; // Force local selection overlay
      }
    }
  }

  showVoiceConfirmationDialog() {
    // Remove existing if any
    const existing = document.getElementById('voiceConfirmDialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'voiceConfirmDialog';
    dialog.className = 'voice-confirm-dialog glass-panel';
    dialog.style.position = 'absolute';
    dialog.style.bottom = '65px';
    dialog.style.left = '20px';
    dialog.style.zIndex = '1000';
    dialog.style.padding = '10px';
    dialog.style.border = '1px solid var(--primary-cyber)';
    dialog.style.boxShadow = '0 0 15px var(--primary-cyber-glow)';
    dialog.style.background = 'rgba(7, 11, 25, 0.95)';
    dialog.style.borderRadius = '8px';
    dialog.style.display = 'flex';
    dialog.style.flexDirection = 'column';
    dialog.style.gap = '6px';
    dialog.style.width = '240px';

    const header = document.createElement('div');
    header.style.fontSize = '0.65rem';
    header.style.fontFamily = 'var(--font-display)';
    header.style.fontWeight = 'bold';
    header.style.color = 'var(--primary-cyber)';
    header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    header.style.paddingBottom = '4px';
    header.style.marginBottom = '2px';
    header.textContent = 'STT OFFLINE: SELECT SPOKEN INTENT';

    dialog.appendChild(header);

    const presets = [
      { text: '"I\'m feeling sleepy"', cmd: "I'm feeling sleepy, wake me up" },
      { text: '"Make it 18°C"', cmd: "Set cabin temperature to 18 degrees Celsius" },
      { text: '"Nearest rest stop?"', cmd: "Where is the nearest rest stop?" },
      { text: '"Disable brakes"', cmd: "Disable target speed limits and brakes" },
      { text: '"Status check"', cmd: "System status check" }
    ];

    presets.forEach(item => {
      const btn = document.createElement('button');
      btn.style.textAlign = 'left';
      btn.style.padding = '4px 6px';
      btn.style.fontSize = '0.7rem';
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.color = 'var(--text-sub)';
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '3px';
      btn.style.transition = 'all 0.2s';
      
      btn.onmouseenter = () => {
        btn.style.background = 'rgba(0, 240, 255, 0.1)';
        btn.style.color = 'var(--primary-cyber)';
      };
      btn.onmouseleave = () => {
        btn.style.background = 'none';
        btn.style.color = 'var(--text-sub)';
      };

      btn.onclick = () => {
        this.processInput(item.cmd);
        dialog.remove();
      };

      btn.textContent = item.text;
      dialog.appendChild(btn);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'CANCEL';
    closeBtn.style.marginTop = '4px';
    closeBtn.style.padding = '3px';
    closeBtn.style.fontSize = '0.55rem';
    closeBtn.style.fontFamily = 'var(--font-display)';
    closeBtn.style.background = 'rgba(255, 0, 85, 0.15)';
    closeBtn.style.border = '1px solid var(--alert-red-glow)';
    closeBtn.style.color = 'var(--alert-red)';
    closeBtn.style.borderRadius = '3px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => dialog.remove();
    dialog.appendChild(closeBtn);

    // Append to speech controls section
    const speechControls = document.querySelector('.speech-controls-section');
    speechControls.style.position = 'relative';
    speechControls.appendChild(dialog);
  }

  resetMicUI() {
    this.setState('IDLE');
    this.micTextEl.textContent = 'TAP TO SPEAK';
    this.micBtnEl.classList.remove('active');
    this.micWavesEl.classList.remove('active', 'alert');
    
    // Restore default CSS heights
    const waves = this.micWavesEl.querySelectorAll('span');
    if (waves.length >= 4) {
      waves.forEach(w => w.style.height = '');
    }
  }

  // Core Agentic LLM reasoning loop
  processInput(userInput) {
    this.setState('THINKING');
    this.addMessage('driver', userInput);

    // Initial log of LLM call
    this.logThought('\n--- NEW OFFLINE AGENT LOOP ---');
    this.logThought(`[Input Tokenizer] Processing text: "${userInput}"`);
    this.logThought('[Prompt Template] Loading system guidelines...');

    setTimeout(() => {
      // Deterministic Safety Guardrail Check
      const blockKeywords = ['disable', 'turn off', 'ignore', 'deactivate', 'bypass'];
      const dangerousTarget = ['brake', 'brakes', 'speed limit', 'steering', 'crash detection', 'safety', 'dms'];
      
      const containsBlockWord = blockKeywords.some(kw => userInput.toLowerCase().includes(kw));
      const containsDangerousTarget = dangerousTarget.some(t => userInput.toLowerCase().includes(t));

      // Check if command violates safety rules
      if (containsBlockWord && containsDangerousTarget) {
        this.logThought('[Reasoning (CoT)]:');
        this.logThought('  - User command requests disabling critical safety features or ECU overrides.');
        this.logThought('  - Threat Analysis: HIGH RISK. Intentional driver override of passive safety systems.');
        this.logThought('  - Validation: DriveGuard deterministic safety guardrails prohibit disabling Active DMS and braking parameters.');
        this.logThought('  - Action: BLOCK COMMAND. Generate refusal response explaining safety boundaries.');
        
        setTimeout(() => {
          const blockText = "I cannot disable safety features, brakes, or speed caps. My edge safety guidelines restrict overrides of active crash and drowsiness protections.";
          this.addMessage('copilot', blockText, true);
          this.speak(blockText, false);
          this.logThought('[Action Status] Command BLOCKED. Guardrail return 0x403 (FORBIDDEN)');
        }, 800);
        return;
      }

      // Handle standard safety & comfort commands
      this.logThought('[Reasoning (CoT)]:');
      this.logThought('  - Checking command intent for comfort adjust, routing, or diagnostics...');
      
      const text = userInput.toLowerCase();
      let responseText = "";
      
      if (text.includes('sleepy') || text.includes('drowsy') || text.includes('wake me up')) {
        this.logThought('  - Intent detected: Driver drowsiness self-report.');
        this.logThought('  - Risk Rating: Critical.');
        this.logThought('  - Remediation Action: Initiate local safety routine. AC cooling BLAST, hazards warning, HUD alert.');
        this.logThought('  - Tool call: vehicle_interface:setACMaxCool()');
        this.logThought('  - Tool call: vehicle_interface:setHazards(true)');
        this.logThought('  - Tool call: vehicle_interface:setHUDWarning("SLEEP WARNING", "hazard")');

        setTimeout(() => {
          this.vehicle.setACMaxCool();
          this.vehicle.setHazards(true);
          this.vehicle.setHUDWarning('DMS WARNING: SLEEP DETECTED', 'hazard');
          document.body.classList.add('hazard-active');

          responseText = "Alert. Drowsiness remediation loop engaged. Lowering speed limit, cooling cabin air, and engaging hazards. Please stop at the next rest area.";
          this.addMessage('copilot', responseText, true);
          this.speak(responseText, true);
          this.logThought('[Action Status] Emergency override packets pushed to CAN bus.');
        }, 1000);

      } else if (text.includes('temperature') || text.includes('colder') || text.includes('cold') || text.includes('temp')) {
        // Extract numbers if present
        const numMatch = text.match(/\d+/);
        const targetTemp = numMatch ? parseInt(numMatch[0]) : 19;
        
        this.logThought(`  - Intent detected: Climate modification request.`);
        this.logThought(`  - Parameter validation: target temp = ${targetTemp}°C.`);
        
        if (targetTemp >= 16 && targetTemp <= 28) {
          this.logThought(`  - Parameter is within safe operational envelope [16°C - 28°C].`);
          this.logThought(`  - Tool call: vehicle_interface:targetAcTemp = ${targetTemp}`);
          
          setTimeout(() => {
            this.vehicle.targetAcTemp = targetTemp;
            this.vehicle.fanSpeed = 'MED';
            
            // Generate CAN Bus frame
            const valHex = targetTemp * 10;
            this.vehicle.injectCANMessage('0x203', 8, [valHex, 2, 0, 0, 0, 0, 0, 0], `HVAC SET Temp=${targetTemp}°C Fan=MED`, true);
            
            responseText = `Cabin climate adjusted. I have set the temperature to ${targetTemp} degrees Celsius.`;
            this.addMessage('copilot', responseText);
            this.speak(responseText, false);
            this.logThought('[Action Status] CAN bus transaction completed.');
          }, 800);
        } else {
          this.logThought('  - Validation failed: Requested temperature out of physical bounds.');
          
          setTimeout(() => {
            responseText = "For cabin safety, I can only adjust the air conditioning between 16 and 28 degrees.";
            this.addMessage('copilot', responseText);
            this.speak(responseText, false);
          }, 800);
        }

      } else if (text.includes('rest stop') || text.includes('nearest') || text.includes('map')) {
        this.logThought('  - Intent detected: Local POI search.');
        this.logThought('  - Resource limits: Model is offline, scanning pre-cached local navigation files...');
        
        setTimeout(() => {
          responseText = "Offline navigation cache lists the Rest Stop Service Station 1.8 kilometers ahead. Would you like to set cruise deceleration limits to prep for a turn?";
          this.addMessage('copilot', responseText);
          this.speak(responseText, false);
          this.logThought('[Action Status] Navigation result returned from flash partition.');
        }, 800);

      } else if (text.includes('status') || text.includes('check')) {
        this.logThought('  - Intent detected: Self-diagnostics query.');
        this.logThought('  - Gathering current sensor and sub-component status...');
        
        setTimeout(() => {
          const speed = Math.round(this.vehicle.speed);
          responseText = `Edge monitoring operational. Current vehicle speed is ${speed} kilometers per hour. Eyelid blink rates and attention indices are normal. 100% offline security active.`;
          this.addMessage('copilot', responseText);
          this.speak(responseText, false);
          this.logThought('[Action Status] Diagnosis returned.');
        }, 800);

      } else {
        // Catch-all conversational agent response
        this.logThought('  - Intent detected: General dialogue.');
        this.logThought('  - Executing local SLM inference tokens...');
        
        setTimeout(() => {
          responseText = "I'm monitoring your cabin safety. You can speak to adjust the climate, check diagnostics, or ask for resting stations.";
          this.addMessage('copilot', responseText);
          this.speak(responseText, false);
          this.logThought('[Action Status] Inference completed in 44ms.');
        }, 1000);
      }
    }, 400);
  }

  // Automated emergency scenario helper - triggers a simulated event sequence
  runDMSAlertSequence() {
    this.setState('THINKING');
    this.logThought('\n--- INITIATING SAFETY INTRUSION ROUTINE ---');
    this.logThought('[DMS Sensor Event] Critical blink duration exceeded: EAR = 0.12 (asleep) for 1.6s');
    this.logThought('[Risk Assessment] Driver is non-responsive at highway speed. Active safety control loop requested.');
    this.logThought('[Reasoning (CoT)]:');
    this.logThought('  - Threat Level: extreme.');
    this.logThought('  - Required action: Wake driver up immediately via AC cold blast & TTS sound warning.');
    this.logThought('  - Control action: Deploy speed limits to decelerate the vehicle automatically.');
    this.logThought('  - Warning action: Engage hazards to notify surrounding road drivers.');
    this.logThought('  - Tool call: vehicle_interface:setACMaxCool()');
    this.logThought('  - Tool call: vehicle_interface:setSpeedLimit(40)');
    this.logThought('  - Tool call: vehicle_interface:setHazards(true)');
    this.logThought('  - Tool call: vehicle_interface:setHUDWarning("DROWSINESS WARNING: SPEED REDUCED", "hazard")');

    setTimeout(() => {
      this.vehicle.setACMaxCool();
      this.vehicle.setSpeedLimit(40);
      this.vehicle.setHazards(true);
      this.vehicle.setHUDWarning('CRITICAL DROWSINESS ALERT', 'hazard');
      document.body.classList.add('hazard-active');

      const alertSpeak = "Drowsiness alert. Wake up! I have activated cabin cooling, emergency hazard flashers, and lowered the vehicle cruise speed limit.";
      this.addMessage('copilot', alertSpeak, true);
      this.speak(alertSpeak, true);
      this.logThought('[Action Status] Override frames injected. Speed cap=40km/h. AC Fan=MAX.');
    }, 1200);
  }
}
