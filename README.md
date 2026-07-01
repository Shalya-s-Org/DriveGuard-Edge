# DriveGuard Edge - Active Safety Agent Proof of Concept (POC)

DriveGuard Edge is a hybrid, offline Driver Monitoring System (DMS) and Local SLM Voice Co-Pilot designed for modern automotive edge processors (e.g., i.MX8 Edge SoC). This POC demonstrates a real-time active safety system that monitors driver attention, interprets speech commands locally, and overrides vehicle ECU controls during emergency situations.

---

## 🚀 Key Features & Subsystems

### 1. Computer Vision Driver Monitoring System (DMS)
- **Real-Time Facial Landmark Tracking**: Uses MediaPipe Face Mesh to capture eye positions, eyelid closure, and head posture.
- **Eye Aspect Ratio (EAR)**: Computes eye blink rates and detects micro-sleep triggers (alerts fire if EAR falls below `0.22` for more than `0.6` seconds).
- **Head Posture Estimation**: Calculates Head Yaw and Pitch (triggers windshield gaze distraction alerts if yaw exceeds `20°` or pitch/gaze indicates cell phone posture).
- **Quantized Edge Inference**: Mocks local integer quantization (`INT8`) suitable for low-power edge SoCs.

### 2. Local SLM Voice Co-Pilot
- **Edge Speech Recognition**: Offline Whisper-Tiny Speech-to-Text (STT) simulation (with interactive dialogue logs and a custom text injection interface).
- **Deterministic Guardrails**: Prohibits user commands targeting critical braking or safety subsystems (e.g., blocked commands return `0x403 FORBIDDEN` alerts).
- **Local Agent Scratchpad**: Displays real-time chain-of-thought (`CoT`) reasoning and local tools invoked by the SLM.

### 3. Vehicle Control Interface & CAN Bus Gateway
- **Speedometer Gauge**: Responsive circular SVG speedometer that dynamically reflects target speed changes and caps limits.
- **HVAC Cabin Comfort**: Displays target temperatures and features a spinning AC fan indicator (rotates fast during safety cooling blasts).
- **Accessory Toggles**: Interactive lamp indicators for **Hazard Lights**, **Cabin Illum** (dome lights), and **ADAS ACC** that toggle vehicle state and BCM packets.
- **CAN Bus Telemetry Injector**: Real-time log table streaming frame packets (e.g., wheel speed, steering yaw, brake pressure) with overrides colored red.

---

## 🎨 Premium User Interface
The dashboard has been fully redesigned to feature a high-tech **glassmorphism styling system** using **Tailwind CSS v3**:
- Curated dark themes (`#0b0f14` surface) with neon cyan highlights (`#00f0ff`).
- Smooth animations for scan lines, microphone voice waves, and rotating AC fan icons.
- Fully responsive 3-column layout suited for vehicle telemetry dashboards.

---

## 🛠️ Development & Commands

This project is built as a modular modern Javascript application bundled using **Vite**.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup Dependencies
Install Vite and other local dev packages:
```bash
npm install
```

### Run Locally (Development Server)
Launch the local Vite server:
```bash
npm run dev
```
Open the provided URL (typically `http://localhost:5173`) in your web browser.

### Build for Production
Bundle the production files:
```bash
npm run build
```
Vite will output the static bundle to the `dist/` directory.

### Preview Production Build
Test the generated bundle locally:
```bash
npm run preview
```

---

## 🚨 Simulating Safety Sequences
You can test the active safety systems using the controls on the dashboard:
1. **Manual Telemetry Sliders**: Expand the accordion in Column 1 and adjust the sliders to manually lower the EAR value (to trigger drowsiness) or turn the head yaw/pitch angles (to trigger distractions).
2. **Voice Command Presets**: Click on comfort triggers like `"Make it 18°C"` or check safety restrictions by clicking `"Disable brakes"` (which will trigger a refusal warning).
3. **Automated Emergency Test Sequence**: Click the footer button to run a complete highway cruise scenario:
   - Cruising at 90 km/h under ADAS ACC.
   - Driver falls asleep (EAR drops below `0.22`).
   - Co-pilot triggers an intrusion routine (turns on cabin illumination dome lights, sounds a wake-up warning, initiates a MAX COOL climate blast, activates emergency hazards, and cap speed limit at 40 km/h).
   - Driver recovers attention (system clears speed limits, restores HVAC climate comfort, turns off dome lights, and transitions back to highway cruise).
