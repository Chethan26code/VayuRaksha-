# 🛡️ VayuRaksha (वायुरक्षा)
### AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
**Ministry of Defence (MoD) — Defence Services Staff College (DSSC)**  
*Smart India Hackathon (SIH 2026) · Problem Statement #247 · Software Track · Robotics & Drones*

---

## 📌 Executive Summary
**VayuRaksha** is an indigenous, offline-first, software-based counter-drone (C-UAS) simulation and training platform. Built specifically for unit-level operational readiness, it allows defence personnel to recognize, classify, and neutralize asymmetric rogue drone and swarm threats across varied environments (day/night, atmospheric fog/dust, sensor degradation) without requiring expensive live-fire exercises or specialized GPU hardware.

Unlike simple video games, VayuRaksha operates on an **OODA Loop Decision Engine** (Observe → Orient → Decide → Act), uses **multi-modal sensor fusion** (Radar, RF intercept, EO/IR thermal, and Acoustic), scores decisions through **auditable military decision trees**, and features an **AI Adversary** that algorithmically discovers each trainee's weaknesses and generates procedural drills to eliminate blind spots.

---

## 🚀 Key Innovations & Differentiators

1. **🧠 AI Adversary (Thompson Sampling Multi-Armed Bandit):**
   - Tracks operator competency across 6 skill domains using an Elo/Bayesian Knowledge Tracing learner model.
   - Synthesizes non-repeating procedural attack scenarios specifically tailored to challenge the operator's lowest-rated skill at an optimal 65% success frontier.
2. **⚖️ Auditable Doctrinal Scoring & Replay:**
   - Every point awarded or deducted includes a clear line-by-line justification (e.g., *"-25 pts: ROE Violation — Fired kinetic CIWS at biological avian decoy"*).
   - Rules of Engagement (ROE) are instructor-configurable in JSON without altering system code.
3. **🎯 Deterministic Seeded Simulation (mulberry32 PRNG + 60Hz Tick):**
   - Decoupled physics/AI update loop guarantees that the exact same seed yields identical flight paths on any computer.
   - Instructors can assign a single seed across an entire unit for completely fair, standardized baseline benchmarking.
4. **📶 100% Offline Operational Capability:**
   - Operates on standard military issue laptops without requiring GPU clusters or an internet connection.

---

## 📋 Problem Statement Requirement Coverage (FR-1 to FR-18)

| ID | Requirement | VayuRaksha Implementation | Status |
|:---|:---|:---|:---:|
| **FR-1** | Desktop or VR-capable 3D simulator | Three.js WebGL tactical environment running in any standard browser | ✅ **Implemented** |
| **FR-2** | Scripted threat scenarios | 3 predefined DSSC doctrinal missions in `scenarios/` | ✅ **Implemented** |
| **FR-3** | Procedurally generated threat scenarios | Constrained random procedural scenario generator (`generator.js`) | ✅ **Implemented** |
| **FR-4** | Day / Night simulation | Dynamic solar angles, lunar illumination, and night vision contrast | ✅ **Implemented** |
| **FR-5** | Degraded sensor simulation | Radar clutter/jamming, RF noise, and thermal fog degradation sliders | ✅ **Implemented** |
| **FR-6** | Urban & Rural terrain scenarios | Procedural metropolitan high-rise grid & rolling desert hill outposts | ✅ **Implemented** |
| **FR-7** | Single-drone threat scenarios | Reconnaissance quadcopters and high-speed kamikaze FPVs | ✅ **Implemented** |
| **FR-8** | Swarm attack scenarios | Modified Reynolds Boids flocking with tactical decoy/striker splits | ✅ **Implemented** |
| **FR-9** | Decision-tree based scoring | Explainable pure function scoring engine (`score.js`) | ✅ **Implemented** |
| **FR-10** | Detection time measurement | Tracks exact latency between target spawn and sensor designation | ✅ **Implemented** |
| **FR-11** | Threat classification accuracy | Scores exact, category, and critical false-alarm classifications | ✅ **Implemented** |
| **FR-12** | Engagement decision evaluation | Evaluates weapons doctrine adherence (Soft Jam vs Hard Kinetic vs Capture) | ✅ **Implemented** |
| **FR-13** | After-Action Review (AAR) dashboard | Full debriefing screen with radar skill charts and audit timeline | ✅ **Implemented** |
| **FR-14** | Individual performance tracking | Elo skill vectors tracked across repeated training sessions | ✅ **Implemented** |
| **FR-15** | Unit-level performance tracking | Instructor Portal displaying cadre averages and weakest domains | ✅ **Implemented** |
| **FR-16** | Session history over repeated drills | Persistent offline JSON database logging complete drill records | ✅ **Implemented** |
| **FR-17** | Adaptive difficulty adjustment | Scalable challenge calibrated to operator Elo ratings | ✅ **Implemented** |
| **FR-18** | Scenario randomization to prevent rote learning | Seeded procedural synthesis prevents memorization of attack vectors | ✅ **Implemented** |

---

## ⚡ Quick Start (Run Locally)

### 1. Prerequisites
- **Node.js (v18+)** installed.

### 2. Install & Launch (Single Command)
```bash
# Clone the repository
git clone https://github.com/Chethan26code/VayuRaksha-.git
cd VayuRaksha-

# Install dependencies
npm install

# Start local offline server and simulator
npm start
```
Navigate to: **`http://localhost:3000`** in your browser.

*(For developers wanting Vite hot-reload: run `npm run dev` in one terminal and `npm run server` in another).*

---

## 🎮 Tactical Keyboard Controls

| Key | Tactical Action | Description |
|:---:|:---|:---|
| **`Click Track`** | Designate Target | Selects contact on Radar PPI or Track Board |
| **`D`** | **Detect / Lock Track** | Acknowledges target contact on active sensors |
| **`1`** | Classify: **Biological Bird** | Marks target as harmless biological decoy |
| **`2`** | Classify: **Civilian Drone** | Marks target as commercial off-the-shelf UAV |
| **`3`** | Classify: **Recon ISR Quad** | Marks target as tactical military surveillance quad |
| **`4`** | Classify: **Kamikaze FPV** | Marks target as high-speed explosive munition |
| **`5`** | Classify: **Fixed-Wing Drone** | Marks target as long-range autonomous drone |
| **`J`** | Engage: **RF Jammer** | Soft kill: breaks C2 frequencies, forces failsafe landing |
| **`K`** | Engage: **CIWS Cannon** | Hard kill: high-explosive projectile mid-air destruction |
| **`C`** | Engage: **Net Interceptor** | Tactical capture: deploys net drone for forensic retrieval |
| **`E`** | Engage: **Escalate Battery** | Scrambles theater air-defence missile battery |
| **`I`** | Engage: **Ignore / Clear** | Doctrinal clearance of harmless avian decoys |
| **`C` / `V`** | Camera Modes | Toggle between Command Observation Deck & Tactical Overhead |
| **`Esc`** | Conclude Mission | Immediately concludes drill and opens AAR debriefing |

---

## 📁 Repository Structure
```text
VayuRaksha/
├── index.html                  # Main WebGL simulator entry point
├── package.json                # Project dependencies & scripts
├── vite.config.js              # Vite bundler & backend API proxy
├── README.md                   # Full military documentation & guide
│
├── scenarios/                  # Scripted Doctrinal Missions
│   ├── tutorial_basic.json     # Phase 1: Daylight basic intrusion
│   ├── urban_night_mixed.json  # Phase 2: Urban night multi-vector
│   └── rural_swarm.json        # Phase 3: Border outpost swarm assault
│
├── shared/                     # Shared Contracts (Client & Server)
│   ├── rng.js                  # Mulberry32 deterministic seeded PRNG
│   ├── threatTypes.js          # Tactical drone specs & weapons doctrine
│   ├── roe/
│   │   └── default.json        # Instructor-editable Rules of Engagement
│   └── scoring/
│       └── score.js            # Explainable decision-tree scoring engine
│
├── server/                     # Offline Express REST API & Learner Backend
│   ├── index.js                # Express server & API endpoints
│   ├── ai/
│   │   ├── skills.js           # Elo trainee competency rating model
│   │   └── adversary.js        # Thompson sampling adaptive scenario generator
│   └── db/
│       └── database.js         # Offline JSON persistent database & unit rosters
│
└── src/                        # Client Simulation Core
    ├── main.js                 # App coordinator & event logger
    ├── style.css               # Tactical dark military theme styles
    ├── sim/
    │   ├── loop.js             # Fixed 60Hz deterministic game loop
    │   ├── SceneManager.js     # Three.js 3D terrain, sky, fog, & lighting
    │   └── DroneRenderer.js    # Procedural 3D drone models, rotors, & FX
    ├── threats/
    │   ├── DroneAI.js          # FSM behaviour AI & Boids swarm algorithm
    │   └── generator.js        # Procedural scenario synthesis engine
    ├── sensors/
    │   └── SensorSystem.js     # Radar, RF, EO/IR thermal & track fusion
    ├── ui/
    │   ├── HUD.js              # Heads-Up Display & OODA action terminal
    │   ├── RadarDisplay.js     # 2D Canvas Radar PPI scope sweep display
    │   └── InstructorPortal.js # Unit readiness roster & ROE policy editor
    └── aar/
        └── Dashboard.js        # Post-mission debriefing & Chart.js radar charts
```

---

## 🎖️ Acknowledgements & References
- **Reynolds, C. W. (1987).** *Flocks, herds and schools: A distributed behavioral model.* ACM SIGGRAPH.
- **Corbett, A. T., & Anderson, J. R. (1994).** *Knowledge tracing: Modeling the acquisition of procedural knowledge.* User Modeling.
- **Thompson, W. R. (1933).** *On the likelihood that one unknown probability exceeds another in view of the evidence of two samples.* Biometrika.
- **Boyd, J. R. (1995).** *The Essence of Winning and Losing (OODA Loop Doctrine).*
- **DRDO Counter-Drone System (D4):** Conceptual alignment with indigenous detection, track fusion, and soft/hard kill operational protocols.
