// DriveGuard-Edge Vehicle ECU & CAN Bus Interface

// Normal background CAN message IDs to simulate active traffic
const NOISE_CAN_IDS = [
  { id: '0x0A2', dlc: 6, desc: 'WHEEL_SPEED_SENSORS' },
  { id: '0x1B4', dlc: 4, desc: 'STEERING_ANGLE_ECU' },
  { id: '0x2D1', dlc: 8, desc: 'TRANSMISSION_TELEMETRY' },
  { id: '0x3F6', dlc: 5, desc: 'BRAKE_PRESSURE_UNIT' },
  { id: '0x4E8', dlc: 8, desc: 'INFOTAINMENT_VOLUME_SYNC' }
];

export class VehicleInterface {
  constructor() {
    // Initial Vehicle State
    this.speed = 90;              // km/h
    this.targetSpeed = 90;        // target speed to interpolate
    this.speedLimit = null;       // Limit in km/h (null = none)
    
    this.acTemp = 22.0;           // Celsius
    this.targetAcTemp = 22.0;
    this.fanSpeed = 'AUTO';       // AUTO, LOW, MED, MAX
    
    this.hazardsActive = false;
    this.cabinIllum = false;
    this.adasActive = true;       // Adaptive Cruise Control active by default

    // CAN Bus logs history
    this.logsContainer = document.getElementById('canbusLogs');
    this.canHistory = [];
    
    // UI elements references
    this.speedValEl = document.getElementById('speedVal');
    this.speedTrackFillEl = document.getElementById('speedTrackFill');
    this.acTempEl = document.getElementById('acTemp');
    this.acFanEl = document.getElementById('acFan');
    this.fanIconEl = document.getElementById('fanIcon');
    this.hazardLampEl = document.getElementById('hazardLamp');
    this.cabinLampEl = document.getElementById('cabinLamp');
    this.adasLampEl = document.getElementById('adasLamp');
    this.speedLimitIndicatorEl = document.getElementById('speedLimitIndicator');
    this.hudWarningEl = document.getElementById('hudWarning');
  }

  // Update vehicle speed interpolation & dashboard visualizers
  update() {
    // Apply speed limits if set
    if (this.speedLimit !== null && this.targetSpeed > this.speedLimit) {
      this.targetSpeed = this.speedLimit;
    }

    // Interpolate speed smoothly
    this.speed += (this.targetSpeed - this.speed) * 0.05;
    if (Math.abs(this.speed - this.targetSpeed) < 0.2) {
      this.speed = this.targetSpeed;
    }

    // Interpolate AC Temperature smoothly
    this.acTemp += (this.targetAcTemp - this.acTemp) * 0.05;

    // Update UI elements
    this.renderDashboard();
  }

  // Render variables to dashboard controls
  renderDashboard() {
    // 1. Update Speedometer
    const speedInt = Math.round(this.speed);
    this.speedValEl.textContent = speedInt;
    
    // Update SVG stroke-dashoffset (fills gauge ring progressively from 198 to 0)
    const activeLength = 198;
    const offset = activeLength - (speedInt / 180) * activeLength;
    this.speedTrackFillEl.style.strokeDashoffset = Math.max(0, Math.min(activeLength, offset));
    
    // Toggle color of SVG stroke if speed limit override is active
    if (this.speedLimit !== null) {
      this.speedTrackFillEl.style.stroke = 'var(--alert-red)';
    } else {
      this.speedTrackFillEl.style.stroke = 'var(--primary-cyber)';
    };
    
    if (this.speedLimit !== null) {
      this.speedValEl.classList.add('hazard');
    } else {
      this.speedValEl.classList.remove('hazard');
    }

    // 2. Speed limit badge
    if (this.speedLimit !== null) {
      this.speedLimitIndicatorEl.textContent = `LIMIT: ${this.speedLimit} km/h`;
      this.speedLimitIndicatorEl.classList.add('active');
    } else {
      this.speedLimitIndicatorEl.textContent = 'LIMIT: NONE';
      this.speedLimitIndicatorEl.classList.remove('active');
    }

    // 3. Climate dashboard card
    this.acTempEl.textContent = `${this.acTemp.toFixed(1)}°C`;
    this.acFanEl.textContent = this.fanSpeed;
    
    // Spin fan icon depending on speed
    if (this.fanSpeed !== 'OFF') {
      this.fanIconEl.classList.add('spinning');
      if (this.fanSpeed === 'MAX') {
        this.fanIconEl.classList.add('fast');
      } else {
        this.fanIconEl.classList.remove('fast');
      }
    } else {
      this.fanIconEl.classList.remove('spinning', 'fast');
    }

    // 4. Indicator lamps status
    this.toggleLamp(this.hazardLampEl, this.hazardsActive);
    this.toggleLamp(this.cabinLampEl, this.cabinIllum);
    this.toggleLamp(this.adasLampEl, this.adasActive);
  }

  toggleLamp(element, isActive) {
    if (isActive) {
      element.classList.add('active');
    } else {
      element.classList.remove('active');
    }
  }

  // Inject a simulated CAN frame into the log panel
  injectCANMessage(canId, dlc, payloadBytes, translationText, isOverride = false) {
    const formattedBytes = payloadBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    
    const packet = {
      id: canId,
      dlc: dlc,
      payload: formattedBytes,
      translation: translationText,
      isOverride: isOverride,
      time: Date.now()
    };

    this.canHistory.push(packet);
    
    // Cap buffer
    if (this.canHistory.length > 50) {
      this.canHistory.shift();
    }

    this.renderCANLogs();
  }

  // Draw the current scroll of CAN frames to DOM
  renderCANLogs() {
    this.logsContainer.innerHTML = '';
    
    // Draw logs in reverse order so newest is at bottom (or auto scroll to bottom)
    this.canHistory.forEach(pkt => {
      const packetRow = document.createElement('div');
      packetRow.className = `can-packet ${pkt.isOverride ? 'override-pulse' : 'new-pulse'}`;
      
      packetRow.innerHTML = `
        <span class="can-id">${pkt.id}</span>
        <span class="can-dlc">${pkt.dlc}</span>
        <span class="can-data">${pkt.payload}</span>
        <span class="can-desc">${pkt.translation}</span>
      `;
      this.logsContainer.appendChild(packetRow);
    });

    // Auto-scroll to bottom of CAN logger container
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
  }

  // Generates random normal traffic to make the CAN stream look active
  tickBackgroundTraffic() {
    if (Math.random() < 0.7) { // 70% chance of random traffic tick
      const noiseTemplate = NOISE_CAN_IDS[Math.floor(Math.random() * NOISE_CAN_IDS.length)];
      
      // Generate random payload hex values
      const payload = [];
      for (let i = 0; i < noiseTemplate.dlc; i++) {
        payload.push(Math.floor(Math.random() * 256));
      }

      // Contextual translation mocks
      let translation = `${noiseTemplate.desc} STATE OK`;
      if (noiseTemplate.id === '0x0A2') {
        translation = `WHEEL_SPEED: ${Math.round(this.speed)} km/h`;
      } else if (noiseTemplate.id === '0x1B4') {
        translation = `STEERING_ANGLE: ${((Math.random() * 10) - 5).toFixed(1)}°`;
      } else if (noiseTemplate.id === '0x3F6') {
        translation = `BRAKE_PSI: ${Math.round(Math.random() * 10)}`;
      }

      this.injectCANMessage(noiseTemplate.id, noiseTemplate.dlc, payload, translation, false);
    }
  }

  // Command handlers - triggered by local safety agent overrides
  setACMaxCool() {
    this.targetAcTemp = 17.0;
    this.fanSpeed = 'MAX';
    
    const payload = [170, 3, 0, 0, 0, 0, 0, 0]; // 170 => 17.0 C, 3 => Max Fan Speed
    this.injectCANMessage('0x203', 8, payload, 'HVAC OVERRIDE: TEMP=17C FAN=MAX', true);
  }

  resetAC() {
    this.targetAcTemp = 22.0;
    this.fanSpeed = 'AUTO';
    
    const payload = [220, 0, 0, 0, 0, 0, 0, 0]; // 220 => 22.0 C, 0 => Auto Fan
    this.injectCANMessage('0x203', 8, payload, 'HVAC CONTROL: RESTORE COMFORT MODE', true);
  }

  setSpeedLimit(kmh) {
    this.speedLimit = kmh;
    if (this.targetSpeed > kmh) {
      this.targetSpeed = kmh;
    }
    
    const payload = [kmh, 1, 0, 0, 0, 0, 0, 0]; // Byte 0 = limit, Byte 1 = speed control override flag
    this.injectCANMessage('0x101', 8, payload, `ECU OVERRIDE: ACTIVE SPEED LIMIT=${kmh}km/h`, true);
  }

  clearSpeedLimit() {
    this.speedLimit = null;
    this.targetSpeed = 90; // Recover back to highway cruise speed
    
    const payload = [0, 0, 0, 0, 0, 0, 0, 0];
    this.injectCANMessage('0x101', 8, payload, 'ECU CONTROL: SPEED LIMIT DEACTIVATED', true);
  }

  setHazards(isActive) {
    this.hazardsActive = isActive;
    
    // Toggle lamp indicators and fire CAN frame
    const lampStateMask = (this.hazardsActive ? 0x01 : 0x00) | (this.cabinIllum ? 0x02 : 0x00) | (this.adasActive ? 0x04 : 0x00);
    this.injectCANMessage('0x30A', 8, [lampStateMask, 0, 0, 0, 0, 0, 0, 0], `BCM OVERRIDE: HAZARD_LIGHTS=${isActive ? 'ON' : 'OFF'}`, true);
  }

  setCabinIllum(isActive) {
    this.cabinIllum = isActive;
    
    const lampStateMask = (this.hazardsActive ? 0x01 : 0x00) | (this.cabinIllum ? 0x02 : 0x00) | (this.adasActive ? 0x04 : 0x00);
    this.injectCANMessage('0x30A', 8, [lampStateMask, 0, 0, 0, 0, 0, 0, 0], `BCM OVERRIDE: CABIN_LIGHTS=${isActive ? 'ON' : 'OFF'}`, true);
  }

  setHUDWarning(text, level = 'normal') {
    this.hudWarningEl.textContent = text.toUpperCase();
    if (level === 'hazard') {
      this.hudWarningEl.className = 'hud-warning-display hazard';
      
      const payload = [100, 1, 0, 0, 0, 0, 0, 0]; // 100 => Alert Intensity level, 1 => Flash HUD
      this.injectCANMessage('0x0F2', 8, payload, `DMS WARNING INJECT: Level=CRITICAL Text=${text}`, true);
    } else {
      this.hudWarningEl.className = 'hud-warning-display';
      
      const payload = [0, 0, 0, 0, 0, 0, 0, 0];
      this.injectCANMessage('0x0F2', 8, payload, 'DMS STATE: COGNITIVE OVERWATCH STANDBY', false);
    }
  }
}
