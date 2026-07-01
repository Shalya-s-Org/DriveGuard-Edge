// DriveGuard-Edge DMS Simulator (Webcam & Procedural Simulator)

// 3D Landmark Points of a simplified face mesh (Procedural Fallback)
const BASE_LANDMARKS = {
  forehead: { x: 0, y: -80, z: 0 },
  leftTemple: { x: -75, y: -40, z: -20 },
  rightTemple: { x: 75, y: -40, z: -20 },
  leftJaw: { x: -65, y: 35, z: -10 },
  rightJaw: { x: 65, y: 35, z: -10 },
  chin: { x: 0, y: 80, z: 10 },
  leftEyebrowOuter: { x: -60, y: -45, z: 10 },
  leftEyebrowInner: { x: -15, y: -42, z: 18 },
  rightEyebrowInner: { x: 15, y: -42, z: 18 },
  rightEyebrowOuter: { x: 60, y: -45, z: 10 },
  noseBridge: { x: 0, y: -25, z: 25 },
  noseTip: { x: 0, y: 10, z: 45 },
  noseLeft: { x: -15, y: 15, z: 30 },
  noseRight: { x: 15, y: 15, z: 30 },
  leftEye1: { x: -45, y: -25, z: 15 },
  leftEye2: { x: -35, y: -30, z: 17 },
  leftEye3: { x: -22, y: -28, z: 18 },
  leftEye4: { x: -15, y: -23, z: 15 },
  leftEye5: { x: -24, y: -20, z: 17 },
  leftEye6: { x: -37, y: -21, z: 17 },
  leftPupil: { x: -30, y: -25, z: 19 },
  rightEye1: { x: 15, y: -23, z: 15 },
  rightEye2: { x: 22, y: -28, z: 18 },
  rightEye3: { x: 35, y: -30, z: 17 },
  rightEye4: { x: 45, y: -25, z: 15 },
  rightEye5: { x: 37, y: -21, z: 17 },
  rightEye6: { x: 24, y: -20, z: 17 },
  rightPupil: { x: 30, y: -25, z: 19 },
  mouthCornerLeft: { x: -30, y: 40, z: 12 },
  mouthTopLip: { x: 0, y: 32, z: 22 },
  mouthCornerRight: { x: 30, y: 40, z: 12 },
  mouthBottomLip: { x: 0, y: 48, z: 22 },
};

const EDGES = [
  ['forehead', 'leftTemple'], ['leftTemple', 'leftJaw'], ['leftJaw', 'chin'],
  ['chin', 'rightJaw'], ['rightJaw', 'rightTemple'], ['rightTemple', 'forehead'],
  ['leftEyebrowOuter', 'leftEyebrowInner'], ['rightEyebrowOuter', 'rightEyebrowInner'],
  ['noseBridge', 'noseTip'], ['noseTip', 'noseLeft'], ['noseTip', 'noseRight'],
  ['noseLeft', 'noseBridge'], ['noseRight', 'noseBridge'],
  ['leftEye1', 'leftEye2'], ['leftEye2', 'leftEye3'], ['leftEye3', 'leftEye4'],
  ['leftEye4', 'leftEye5'], ['leftEye5', 'leftEye6'], ['leftEye6', 'leftEye1'],
  ['rightEye1', 'rightEye2'], ['rightEye2', 'rightEye3'], ['rightEye3', 'rightEye4'],
  ['rightEye4', 'rightEye5'], ['rightEye5', 'rightEye6'], ['rightEye6', 'rightEye1'],
  ['mouthCornerLeft', 'mouthTopLip'], ['mouthTopLip', 'mouthCornerRight'],
  ['mouthCornerRight', 'mouthBottomLip'], ['mouthBottomLip', 'mouthCornerLeft'],
];

// MediaPipe Landmark Connection Index Loops
const LEFT_EYE_MP = [33, 160, 159, 158, 133, 153, 145, 144];
const RIGHT_EYE_MP = [362, 385, 386, 387, 263, 373, 374, 380];
const LIPS_MP = [61, 185, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 61];
const FACE_OUTLINE_MP = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

export class DMSSimulator {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Core parameters (target states)
    this.targetYaw = 0;   
    this.targetPitch = 0; 
    this.targetRoll = 0;  
    this.targetEar = 0.32; 
    
    // Current interpolated states
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.ear = 0.32;
    
    this.gazeOffsetX = 0;
    this.gazeOffsetY = 0;

    // Simulation metrics
    this.blinkCount = 0;
    this.isBlinking = false;
    this.blinkTimer = 0;
    this.lastBlinkTime = 0;
    this.fps = 30;
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
    
    this.earHistory = Array(60).fill(0.32);
    this.showPhone = false;
    this.phoneAlpha = 0;

    // Webcam & MediaPipe Properties
    this.isWebcamActive = false;
    this.videoElement = document.getElementById('webcamVideo');
    this.cameraHelper = null;
    this.faceMesh = null;
    this.latestFaceResults = null;
  }

  // Toggle actual webcam computer vision tracking
  async toggleWebcam(onStateChangeCallback) {
    if (this.isWebcamActive) {
      this.stopWebcam();
      onStateChangeCallback(false);
    } else {
      const started = await this.startWebcam();
      onStateChangeCallback(started);
    }
  }

  async startWebcam() {
    try {
      // 1. Check if MediaPipe is loaded
      if (typeof window.FaceMesh === 'undefined' || typeof window.Camera === 'undefined') {
        console.warn('MediaPipe library scripts not loaded from CDN yet.');
        alert('MediaPipe FaceMesh scripts are still downloading from the CDN. Please wait 3 seconds and try again.');
        return false;
      }

      // 2. Request mic/camera stream permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      this.videoElement.srcObject = stream;
      this.videoElement.style.display = 'none';

      // 3. Initialize MediaPipe FaceMesh
      this.faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults((results) => {
        this.latestFaceResults = results;
        this.processWebcamLandmarks(results);
      });

      // 4. Start Camera Helper loop
      this.cameraHelper = new window.Camera(this.videoElement, {
        onFrame: async () => {
          if (this.isWebcamActive) {
            await this.faceMesh.send({ image: this.videoElement });
          }
        },
        width: 320,
        height: 240
      });

      this.isWebcamActive = true;
      await this.cameraHelper.start();
      return true;

    } catch (err) {
      console.error('Camera access or MediaPipe error:', err);
      alert(`Cannot start webcam DMS: ${err.message}. Ensure camera permissions are granted and secure localhost connection is active.`);
      this.isWebcamActive = false;
      return false;
    }
  }

  stopWebcam() {
    this.isWebcamActive = false;
    
    if (this.cameraHelper) {
      try {
        this.cameraHelper.stop();
      } catch (e) {}
      this.cameraHelper = null;
    }

    if (this.videoElement && this.videoElement.srcObject) {
      this.videoElement.srcObject.getTracks().forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }

    this.faceMesh = null;
    this.latestFaceResults = null;
    this.setPresetState('normal'); // Reset variables
  }

  // Extract EAR, Pose, and Gaze directions from MediaPipe 468 landmarks
  processWebcamLandmarks(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Distance helper
    const dist = (p1, p2) => Math.hypot((p1.x - p2.x) * width, (p1.y - p2.y) * height);

    // 1. Calculate Eye Aspect Ratio (EAR) for blink detection
    // Left eye vertical landmarks: 159-145, 160-144, 158-153. Horizontal: 33-133
    const d_v1_l = dist(landmarks[159], landmarks[145]);
    const d_v2_l = dist(landmarks[160], landmarks[144]);
    const d_v3_l = dist(landmarks[158], landmarks[153]);
    const d_h_l = dist(landmarks[33], landmarks[133]);
    const leftEAR = (d_v1_l + d_v2_l + d_v3_l) / (3.0 * d_h_l || 1);

    // Right eye vertical landmarks: 386-374, 387-373, 385-380. Horizontal: 362-263
    const d_v1_r = dist(landmarks[386], landmarks[374]);
    const d_v2_r = dist(landmarks[387], landmarks[373]);
    const d_v3_r = dist(landmarks[385], landmarks[380]);
    const d_h_r = dist(landmarks[362], landmarks[263]);
    const rightEAR = (d_v1_r + d_v2_r + d_v3_r) / (3.0 * d_h_r || 1);

    const currentEAR = (leftEAR + rightEAR) / 2.0;
    this.targetEar = currentEAR;

    // 2. Real-time blink counter
    if (currentEAR < 0.18) { // threshold for closed eye
      if (!this.isBlinking) {
        this.isBlinking = true;
      }
    } else if (currentEAR > 0.22) {
      if (this.isBlinking) {
        this.isBlinking = false;
        this.blinkCount++;
        this.lastBlinkTime = Date.now();
      }
    }

    // 3. Approximate Head Pose (Yaw, Pitch, Roll)
    // Yaw: Nose center (4) horizontal position relative to outer eye corners (33 and 263)
    const nose = landmarks[4];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    
    const leftDist = dist(nose, leftEye);
    const rightDist = dist(nose, rightEye);
    
    // Smooth and scale yaw to degrees
    this.targetYaw = (leftDist - rightDist) * 1.5;

    // Pitch: vertical ratio between nose tip, chin (152), and forehead (10)
    const forehead = landmarks[10];
    const chin = landmarks[152];
    
    const foreheadDist = nose.y - forehead.y;
    const chinDist = chin.y - nose.y;
    this.targetPitch = (foreheadDist - chinDist) * 110;

    // Roll: Angle between left and right eye corners
    const dy = rightEye.y - leftEye.y;
    const dx = rightEye.x - leftEye.x;
    this.targetRoll = -Math.atan2(dy, dx) * 180 / Math.PI;

    // 4. Approximate Gaze Direction
    // If refineLandmarks is true, landmarks 468 and 473 are pupil centers
    if (landmarks.length > 468) {
      const leftPupil = landmarks[468];
      const rightPupil = landmarks[473];
      
      // Compute pupil offsets from eye corners to identify look direction
      const l_outer = landmarks[33];
      const l_inner = landmarks[133];
      const r_inner = landmarks[362];
      const r_outer = landmarks[263];

      const l_ratio = dist(l_outer, leftPupil) / (dist(leftPupil, l_inner) || 1);
      const r_ratio = dist(r_inner, rightPupil) / (dist(rightPupil, r_outer) || 1);

      // Gaze offset scale
      this.gazeOffsetX = ((l_ratio + r_ratio) / 2.0 - 1.0) * 15;
      
      const pupilAvgY = (leftPupil.y + rightPupil.y) / 2.0;
      const eyeAvgY = (leftEye.y + rightEye.y) / 2.0;
      this.gazeOffsetY = (pupilAvgY - eyeAvgY) * 200;
    }
  }

  setPresetState(stateName) {
    if (this.isWebcamActive) return; // Ignore presets if user is physically driving camera

    switch (stateName) {
      case 'normal':
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.targetRoll = 0;
        this.targetEar = 0.32;
        this.showPhone = false;
        break;
      case 'drowsy':
        this.targetYaw = 2;
        this.targetPitch = 12; 
        this.targetRoll = -3;
        this.targetEar = 0.12; 
        this.showPhone = false;
        break;
      case 'distracted':
        this.targetYaw = 32;  
        this.targetPitch = -2;
        this.targetRoll = 0;
        this.targetEar = 0.32;
        this.showPhone = false;
        break;
      case 'phone':
        this.targetYaw = -10;
        this.targetPitch = 22; 
        this.targetRoll = -5;
        this.targetEar = 0.30;
        this.showPhone = true;
        break;
    }
  }

  update() {
    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = (this.frameCount * 1000) / (now - this.lastFpsUpdate);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Smooth interpolation (slerp)
    this.yaw += (this.targetYaw - this.yaw) * 0.15;
    this.pitch += (this.targetPitch - this.pitch) * 0.15;
    this.roll += (this.targetRoll - this.roll) * 0.15;
    this.ear += (this.targetEar - this.ear) * 0.25;

    // Update EAR history
    this.earHistory.push(this.ear);
    if (this.earHistory.length > 80) {
      this.earHistory.shift();
    }

    if (!this.isWebcamActive) {
      // Run auto blink loops for procedural simulation only
      const isDrowsyPreset = (this.targetEar < 0.15);
      if (!isDrowsyPreset) {
        this.handleAutoBlinking();
      }
      this.gazeOffsetX = Math.sin(this.yaw * Math.PI / 180) * 1.5;
      this.gazeOffsetY = Math.sin(this.pitch * Math.PI / 180) * 1.5;

      if (this.showPhone) {
        this.phoneAlpha += (1 - this.phoneAlpha) * 0.1;
      } else {
        this.phoneAlpha += (0 - this.phoneAlpha) * 0.1;
      }
    }
  }

  handleAutoBlinking() {
    const timeSinceLastBlink = Date.now() - this.lastBlinkTime;
    if (!this.isBlinking && timeSinceLastBlink > 3000 + Math.random() * 3000) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    if (this.isBlinking) {
      this.blinkTimer += 1;
      if (this.blinkTimer <= 2) {
        this.ear += (0.08 - this.ear) * 0.6;
      } else if (this.blinkTimer <= 4) {
        this.ear = 0.08;
      } else if (this.blinkTimer <= 7) {
        this.ear += (this.targetEar - this.ear) * 0.4;
      } else {
        this.isBlinking = false;
        this.ear = this.targetEar;
        this.blinkCount++;
        this.lastBlinkTime = Date.now();
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Draw background (either live camera frame or standard dark grid)
    if (this.isWebcamActive && this.latestFaceResults) {
      ctx.drawImage(this.latestFaceResults.image, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#030612';
      ctx.fillRect(0, 0, width, height);

      // Draw backdrop scan grids
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let i = 0; i < height; i += 15) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
    }

    const isHazard = (this.ear < 0.22 || Math.abs(this.yaw) > 20 || this.pitch > 15);

    // DRAW DYNAMIC CAMERA FEED WEBCAM OVERLAYS
    if (this.isWebcamActive && this.latestFaceResults && this.latestFaceResults.multiFaceLandmarks && this.latestFaceResults.multiFaceLandmarks.length > 0) {
      const landmarks = this.latestFaceResults.multiFaceLandmarks[0];

      ctx.strokeStyle = isHazard ? 'rgba(255, 0, 85, 0.65)' : 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 1.5;

      // Draw MediaPipe Face Mesh Connections
      const drawMPLoop = (indices) => {
        ctx.beginPath();
        for (let i = 0; i < indices.length; i++) {
          const pt = landmarks[indices[i]];
          if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
          else ctx.lineTo(pt.x * width, pt.y * height);
        }
        ctx.stroke();
      };

      drawMPLoop(LEFT_EYE_MP);
      drawMPLoop(RIGHT_EYE_MP);
      drawMPLoop(LIPS_MP);
      drawMPLoop(FACE_OUTLINE_MP);

      // Draw pupil gaze indicator vectors on top of webcam feed
      ctx.fillStyle = isHazard ? '#ff3b30' : '#39ff14';
      ctx.strokeStyle = isHazard ? '#ff3b30' : '#39ff14';
      ctx.lineWidth = 2.0;

      // Use pupil centers (468, 473)
      [468, 473].forEach(idx => {
        if (landmarks[idx]) {
          const pt = landmarks[idx];
          const px = pt.x * width;
          const py = pt.y * height;
          
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Project gaze vector
          const targetGazeX = px + this.gazeOffsetX * 1.5;
          const targetGazeY = py + this.gazeOffsetY * 1.5;

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(targetGazeX, targetGazeY);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(targetGazeX, targetGazeY, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

    } else {
      // WEBCAM OFF -> RENDER DEFAULT SIMULATED 3D WIREFRAME FACE
      const radYaw = -this.yaw * Math.PI / 180;
      const radPitch = this.pitch * Math.PI / 180;
      const radRoll = this.roll * Math.PI / 180;
      
      const cx = width / 2;
      const cy = height / 2 - 10;
      const D = 280; 

      const points = {};
      for (const [key, value] of Object.entries(BASE_LANDMARKS)) {
        let x = value.x;
        let y = value.y;
        let z = value.z;

        if (key.startsWith('leftEye') && key !== 'leftEye1' && key !== 'leftEye4') {
          const center = BASE_LANDMARKS.leftPupil.y;
          const scale = this.ear / 0.32;
          y = center + (y - center) * scale;
        }
        if (key.startsWith('rightEye') && key !== 'rightEye1' && key !== 'rightEye4') {
          const center = BASE_LANDMARKS.rightPupil.y;
          const scale = this.ear / 0.32;
          y = center + (y - center) * scale;
        }

        let y1 = y * Math.cos(radPitch) - z * Math.sin(radPitch);
        let z1 = y * Math.sin(radPitch) + z * Math.cos(radPitch);
        let x2 = x * Math.cos(radYaw) + z1 * Math.sin(radYaw);
        let z2 = -x * Math.sin(radYaw) + z1 * Math.cos(radYaw);
        let x3 = x2 * Math.cos(radRoll) - y1 * Math.sin(radRoll);
        let y3 = x2 * Math.sin(radRoll) + y1 * Math.cos(radRoll);

        const scale = D / (D - z2);
        points[key] = {
          x: cx + x3 * scale,
          y: cy + y3 * scale,
          z: z2
        };
      }

      // Draw phone wireframe overlay if preset active
      if (this.phoneAlpha > 0.05) {
        ctx.save();
        ctx.globalAlpha = this.phoneAlpha;
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 85, 0.05)';
        ctx.translate(width - 90, height - 90);
        ctx.rotate(-15 * Math.PI / 180);
        ctx.strokeRect(-20, -35, 40, 70);
        ctx.fillRect(-20, -35, 40, 70);
        ctx.beginPath();
        ctx.arc(0, 27, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = isHazard ? 'rgba(255, 0, 85, 0.45)' : 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 1.2;

      EDGES.forEach(([p1, p2]) => {
        if (points[p1] && points[p2]) {
          ctx.beginPath();
          ctx.moveTo(points[p1].x, points[p1].y);
          ctx.lineTo(points[p2].x, points[p2].y);
          ctx.stroke();
        }
      });

      // Vertices nodes
      ctx.fillStyle = isHazard ? '#ff0055' : '#00f0ff';
      for (const [key, pt] of Object.entries(points)) {
        if (key.includes('Pupil')) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pupils & Gaze Vectors
      ctx.fillStyle = isHazard ? '#ff3b30' : '#39ff14';
      ctx.strokeStyle = isHazard ? '#ff3b30' : '#39ff14';
      ['left', 'right'].forEach(side => {
        const pupil = points[`${side}Pupil`];
        if (pupil) {
          ctx.beginPath();
          ctx.arc(pupil.x, pupil.y, 3, 0, Math.PI * 2);
          ctx.fill();

          let gazeX = pupil.x;
          let gazeY = pupil.y;
          if (this.targetYaw > 20) gazeX += 15;
          else if (this.targetYaw < -20) gazeX -= 15;
          else if (this.showPhone) { gazeX -= 3; gazeY += 12; }

          ctx.beginPath();
          ctx.lineWidth = 1.8;
          ctx.moveTo(pupil.x, pupil.y);
          ctx.lineTo(gazeX + (gazeX - pupil.x) * 2.5, gazeY + (gazeY - pupil.y) * 2.5);
          ctx.stroke();
        }
      });
    }

    // RENDER COMMON HUD LAYOUTS
    this.drawHUDOverlays(ctx, width, height, isHazard);
  }

  drawHUDOverlays(ctx, width, height, isHazard) {
    ctx.strokeStyle = isHazard ? 'rgba(255, 0, 85, 0.25)' : 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 10, 110, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isHazard ? 'var(--alert-red)' : 'var(--primary-cyber)';
    ctx.lineWidth = 2;
    const len = 15; const pad = 10;
    
    ctx.beginPath(); ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad, pad + len); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad - len, pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, height - pad - len); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + len, height - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width - pad, height - pad - len); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad - len, height - pad); ctx.stroke();

    // Graph plotting
    const graphW = 100; const graphH = 35; const graphX = 20; const graphY = height - 55;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    const thresholdY = graphY + graphH * (1 - 0.22 / 0.4);
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(graphX, thresholdY); ctx.lineTo(graphX + graphW, thresholdY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = isHazard ? '#ff0055' : '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < this.earHistory.length; i++) {
      const val = this.earHistory[i];
      const px = graphX + (i / (this.earHistory.length - 1)) * graphW;
      const py = graphY + graphH * (1 - (val - 0.1) / 0.3);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = isHazard ? '#ff0055' : '#00f0ff';
    ctx.font = '6.5px "Share Tech Mono"';
    ctx.fillText('EAR HISTORY', graphX, graphY - 4);
    ctx.fillStyle = isHazard ? '#ff0055' : 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(`EAR: ${this.ear.toFixed(2)}`, graphX + graphW - 40, graphY - 4);

    ctx.font = '8px "Share Tech Mono"';
    ctx.fillStyle = isHazard ? '#ff0055' : '#8a9fc4';
    ctx.fillText(`SYS_DMS_CALIBRATED: ${this.isWebcamActive ? 'CAM_LINKED' : 'SIMULATED'}`, 25, 25);
    ctx.fillText(this.isWebcamActive ? 'INFERENCE: LIVE FACE MESH' : 'QUANT: INT8 ONNX-RUN', 25, 36);

    if (isHazard) {
      ctx.fillStyle = '#ff0055';
      ctx.font = 'bold 9px "Orbitron"';
      ctx.fillText('CRITICAL STATE WARNING', width - 155, 26);
    }
  }

  getMetrics() {
    let gaze = 'CENTER';
    if (this.yaw > 18) gaze = 'RIGHT (MIRROR)';
    else if (this.yaw < -18) gaze = 'LEFT (WINDOW)';
    else if (this.pitch > 15 && this.isWebcamActive) gaze = 'DOWN (CABIN)';
    else if (this.showPhone) gaze = 'DOWN (PHONE)';

    return {
      ear: this.ear,
      blinkRate: this.blinkCount,
      pitch: this.pitch,
      yaw: this.yaw,
      roll: this.roll,
      gazeDirection: gaze,
      isHazard: this.ear < 0.22 || Math.abs(this.yaw) > 18 || this.pitch > 15
    };
  }
}
