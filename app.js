// ==========================================================================
// AeroFlow 360 — Next-Gen Aviation Operations Logic & Database Engine
// Tailored for BBA Aviation Management | TechRaga '26 Hackathon
// ==========================================================================

// 💽 DATABASE STORAGE & RETRIEVAL LAYER (AeroDB)
const AeroDB = {
  STORAGE_KEY: 'AEROFLOW_360_STATE_V1',
  AUDIT_KEY: 'AEROFLOW_360_AUDIT_LOGS_V1',

  saveState(state) {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        flights: state.flights,
        gates: state.gates,
        gseFleet: state.gseFleet,
        kpis: state.kpis,
        roiInputs: state.roiInputs
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
      this.updateDbTelemetryUI('SAVED', payload.flights.length);
      return true;
    } catch (err) {
      console.warn('AeroDB: Storage quota or serialization issue', err);
      return false;
    }
  },

  loadState() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      console.log('📦 AeroDB: Retrieved persistent turnaround state from local database:', parsed.timestamp);
      return parsed;
    } catch (err) {
      console.warn('AeroDB: Failed to retrieve stored state', err);
      return null;
    }
  },

  logAuditEvent(flightNo, eventType, operator, details) {
    try {
      const logEntry = {
        id: 'LOG-' + Date.now().toString(36).toUpperCase(),
        timestamp: new Date().toISOString(),
        timeIST: new Date().toTimeString().split(' ')[0] + ' IST',
        flightNo,
        eventType,
        operator: operator || 'Ramp Operator (AOCC)',
        details
      };
      const existing = this.getAuditLogs();
      existing.unshift(logEntry);
      // Keep up to 100 historical logs
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(existing.slice(0, 100)));
      console.log(`📝 AeroDB Audit Log [${logEntry.id}]:`, logEntry);
      return logEntry;
    } catch (err) {
      console.warn('AeroDB: Audit log error', err);
      return null;
    }
  },

  getAuditLogs() {
    try {
      const raw = localStorage.getItem(this.AUDIT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  },

  clearDatabase() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.AUDIT_KEY);
    console.log('🧹 AeroDB: Database reset to factory state.');
  },

  updateDbTelemetryUI(status, recordCount) {
    const dbPill = document.getElementById('dbTelemetryPill');
    if (dbPill) {
      dbPill.innerHTML = `
        <span class="pulse-dot" style="background: #10b981;"></span>
        <span>DB: <strong style="color: #34d399;">Active (SQL/JSON)</strong> [${recordCount} Flights]</span>
      `;
    }
  }
};

const AeroApp = {
  state: {
    currentTab: 'turnaround',
    selectedFlightId: 'FL-001',
    flights: [],
    gates: [],
    gseFleet: [],
    kpis: {},
    activeAlert: null,
    currentSlideIdx: 0,
    roiInputs: {
      dailyFlights: 40,
      minSavedPerTurn: 4.5,
      costPerMin: 10500
    },
    timerInterval: null
  },

  // Initialize the platform
  init() {
    console.log("✈️ Initializing AeroFlow 360 Command System with Database Engine...");
    if (!window.AERO_DATA) {
      console.error("Critical: AERO_DATA not loaded!");
      return;
    }

    // Attempt retrieval from persistent storage first
    const savedState = AeroDB.loadState();

    if (savedState && Array.isArray(savedState.flights) && savedState.flights.length > 0) {
      this.state.flights = savedState.flights;
      this.state.gates = savedState.gates || JSON.parse(JSON.stringify(window.AERO_DATA.gates));
      this.state.gseFleet = savedState.gseFleet || JSON.parse(JSON.stringify(window.AERO_DATA.gseFleet));
      this.state.kpis = savedState.kpis || JSON.parse(JSON.stringify(window.AERO_DATA.kpis));
      if (savedState.roiInputs) this.state.roiInputs = savedState.roiInputs;
      AeroDB.updateDbTelemetryUI('RETRIEVED', this.state.flights.length);
    } else {
      // First boot: clone factory initial data and commit to database
      this.state.flights = JSON.parse(JSON.stringify(window.AERO_DATA.flights));
      this.state.gates = JSON.parse(JSON.stringify(window.AERO_DATA.gates));
      this.state.gseFleet = JSON.parse(JSON.stringify(window.AERO_DATA.gseFleet));
      this.state.kpis = JSON.parse(JSON.stringify(window.AERO_DATA.kpis));
      AeroDB.saveState(this.state);
      AeroDB.logAuditEvent('SYSTEM', 'AOCC_INITIAL_BOOT', 'System Initializer', 'Database schema mounted with 4 active aircraft turns');
    }

    this.renderHeader();
    this.renderKPIs();
    this.renderFlightList();
    this.renderGateMatrix();
    this.renderTurnaroundView();
    this.renderGSEGrid();
    this.renderIataCodesTable();
    this.renderAuditLedger();
    this.calculateROI();
    this.initAudio();

    // Start live clock & ticker
    this.startLiveTicker();

    // Setup keyboard shortcuts (e.g. arrow keys for presentation slides)
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('pitchModal')?.classList.contains('open')) {
        if (e.key === 'ArrowRight' || e.key === 'Space') this.nextSlide();
        if (e.key === 'ArrowLeft') this.prevSlide();
      }
    });

    console.log("✅ AeroFlow 360 Ready for Operations, Database Sync & Pitch Demo");
  },

  // Web Audio Alert Synthesizer for High-Tech AOCC Notifications
  initAudio() {
    this.audioCtx = null;
  },

  playAlertSound(type = 'chime') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'warning') {
        // Double warning beep
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // High-tech positive confirmation chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Audio Context silent fallback");
    }
  },

  // Live Clock Ticker
  startLiveTicker() {
    this.updateClock();
    setInterval(() => {
      this.updateClock();
    }, 1000);
  },

  updateClock() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + " IST";
    const clockEl = document.getElementById('liveAoccClock');
    if (clockEl) clockEl.innerText = timeStr;
  },

  // Render Header telemetry
  renderHeader() {
    const airport = window.AERO_DATA.airport;
    const airportMeta = document.getElementById('airportHeaderMeta');
    if (airportMeta) {
      airportMeta.innerHTML = `
        <span class="telemetry-pill">
          <span class="pulse-dot"></span>
          <span>AIRPORT: <strong>${airport.name} (${airport.code})</strong></span>
        </span>
        <span class="telemetry-pill">
          <span>RWY: <strong>${airport.activeRunway.split(' ')[1]}</strong></span>
        </span>
        <span class="telemetry-pill">
          <span>METAR: <strong>${airport.weather.temp}, ${airport.weather.wind}</strong></span>
        </span>
      `;
    }
  },

  // Render KPI Metrics
  renderKPIs() {
    const kpis = this.state.kpis;
    const kpiContainer = document.getElementById('kpiCardsContainer');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
      <div class="kpi-card green">
        <div class="kpi-header">
          <span class="kpi-title">On-Time Performance (OTP)</span>
          <span class="kpi-icon">🎯</span>
        </div>
        <div class="kpi-value-row">
          <div class="kpi-value">${kpis.otpRate}%</div>
          <span class="kpi-sub">▲ +3.2% vs DGCA Avg</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-title">Avg Turnaround Time</span>
          <span class="kpi-icon">⏱️</span>
        </div>
        <div class="kpi-value-row">
          <div class="kpi-value">${kpis.avgTatMins}m</div>
          <span class="kpi-sub">Target: 35.0m</span>
        </div>
      </div>

      <div class="kpi-card purple">
        <div class="kpi-header">
          <span class="kpi-title">Delay Cost Avoided (Today)</span>
          <span class="kpi-icon">💰</span>
        </div>
        <div class="kpi-value-row">
          <div class="kpi-value">₹${kpis.costAvoidedTodayLakhs}L</div>
          <span class="kpi-sub">48 Departures</span>
        </div>
      </div>

      <div class="kpi-card amber">
        <div class="kpi-header">
          <span class="kpi-title">GSE Fleet Utilization</span>
          <span class="kpi-icon">🚜</span>
        </div>
        <div class="kpi-value-row">
          <div class="kpi-value">${kpis.gseUtilizationRate}%</div>
          <span class="kpi-sub neutral">11 Active / 1 Standby</span>
        </div>
      </div>
    `;
  },

  // Render Active Flights list on the left panel
  renderFlightList() {
    const listContainer = document.getElementById('flightListContainer');
    if (!listContainer) return;

    listContainer.innerHTML = this.state.flights.map(fl => {
      const isSelected = fl.id === this.state.selectedFlightId;
      const completedCount = fl.milestones.filter(m => m.status === 'Completed').length;
      const progressPct = Math.round((completedCount / fl.milestones.length) * 100);
      
      let badgeClass = 'status-inprogress';
      if (fl.status === 'SLA Warning') badgeClass = 'status-delayed';
      if (fl.status === 'Pushback Ready') badgeClass = 'status-completed';

      return `
        <div class="flight-card ${isSelected ? 'active' : ''}" onclick="AeroApp.selectFlight('${fl.id}')">
          <div class="flight-card-top">
            <span class="flight-number" style="color: ${fl.accentColor || '#38bdf8'}">${fl.flightNo}</span>
            <span class="flight-gate-badge">${fl.gate}</span>
          </div>
          <div class="flight-route">
            <span>${fl.origin.split(' ')[0]}</span>
            <span>➔</span>
            <span>${fl.destination.split(' ')[0]}</span>
            <span style="margin-left: auto; font-size: 0.725rem; color: var(--text-dim);">${fl.aircraft}</span>
          </div>
          <div class="flight-tat-progress-bar">
            <div class="flight-tat-fill ${fl.status === 'SLA Warning' ? 'critical' : ''}" style="width: ${progressPct}%"></div>
          </div>
          <div class="flight-footer-meta">
            <span class="milestone-status-badge ${badgeClass}" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">${fl.status}</span>
            <span>Elapsed: <strong>${fl.elapsedMins} / ${fl.targetTatMins}m</strong></span>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Gates Overview Matrix
  renderGateMatrix() {
    const container = document.getElementById('gateMatrixMiniGrid');
    if (!container) return;

    container.innerHTML = this.state.gates.map(gate => {
      let statusClass = 'available';
      let displayStatus = 'FREE';

      if (gate.status === 'Available') {
        statusClass = 'available';
        displayStatus = 'FREE';
      } else if (gate.status === 'Occupied') {
        statusClass = 'occupied';
        displayStatus = 'OCCUPIED';
      } else if (gate.status === 'Turnaround In Progress') {
        statusClass = 'turnaround';
        displayStatus = 'TURNING';
      } else if (gate.status === 'SLA Warning') {
        statusClass = 'warning';
        displayStatus = 'SLA ALERT';
      } else if (gate.status === 'Reserved') {
        statusClass = 'reserved';
        displayStatus = 'RESERVED';
      } else if (gate.status === 'Maintenance') {
        statusClass = 'maintenance';
        displayStatus = 'MAINT';
      } else if (gate.status === 'Pushback Ready') {
        statusClass = 'pushback';
        displayStatus = 'PUSHBACK';
      }

      return `
        <div class="gate-cell" onclick="AeroApp.onGateClick('${gate.id}')" title="${gate.name}: ${gate.type} (${gate.status})">
          <div class="gate-cell-name">${gate.id}</div>
          <div class="gate-cell-status ${statusClass}">${displayStatus}</div>
        </div>
      `;
    }).join('');
  },

  onGateClick(gateId) {
    const gate = this.state.gates.find(g => g.id === gateId);
    if (gate && gate.flightId) {
      this.selectFlight(gate.flightId);
    }
  },

  // Select active flight to monitor
  selectFlight(flightId) {
    this.state.selectedFlightId = flightId;
    this.renderFlightList();
    this.renderTurnaroundView();
    this.playAlertSound('chime');
  },

  // Render Center Turnaround Spotlight & Critical Path Milestones
  renderTurnaroundView() {
    const flight = this.state.flights.find(f => f.id === this.state.selectedFlightId);
    if (!flight) return;

    // Render Spotlight Hero
    const heroContainer = document.getElementById('flightSpotlightHero');
    if (heroContainer) {
      const remainingMins = Math.max(0, flight.targetTatMins - flight.elapsedMins);

      heroContainer.innerHTML = `
        <div class="spotlight-header">
          <div class="spotlight-main-meta">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
              <span class="brand-badge" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff;">${flight.airline}</span>
              <span class="brand-badge" style="background: rgba(56, 189, 248, 0.2); color: var(--accent-cyan);">${flight.bayType}</span>
              <span class="milestone-status-badge ${flight.status === 'SLA Warning' ? 'status-delayed' : 'status-inprogress'}">${flight.status}</span>
            </div>
            <h2>
              <span style="color: ${flight.accentColor || '#38bdf8'}">${flight.flightNo}</span>
              <span style="font-size: 1.15rem; color: var(--text-muted); font-weight: 500;">(${flight.origin} ➔ ${flight.destination})</span>
            </h2>
            <p class="spotlight-sub">Aircraft: <strong>${flight.aircraft}</strong> | Reg: <strong>${flight.registration}</strong> | Total Pax: <strong>${flight.paxInbound} In / ${flight.paxOutbound} Out</strong></p>
          </div>

          <div class="spotlight-tat-clock">
            <div class="tat-clock-label">TAT Target Countdown</div>
            <div class="tat-clock-time" style="${flight.status === 'SLA Warning' ? 'color: var(--accent-red);' : ''}">
              ${remainingMins > 0 ? `T - ${remainingMins} MIN` : 'DEPARTURE READY'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.2rem;">STA: ${flight.sta} | STD: ${flight.std}</div>
          </div>
        </div>

        <div class="spotlight-spec-grid">
          <div class="spec-item">
            <span class="spec-label">ATF Fuel Qty</span>
            <span class="spec-val">${flight.fuelRequiredKg.toLocaleString()} kg</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Baggage In / Out</span>
            <span class="spec-val">${flight.cargoBagsIn} / ${flight.cargoBagsOut} Bags</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Catering Meals</span>
            <span class="spec-val">${flight.cateringMealTrays} Trays</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Turnaround Health</span>
            <span class="spec-val" style="color: ${flight.turnaroundHealth === 'Optimal' ? 'var(--accent-green)' : 'var(--accent-red)'}">
              ${flight.turnaroundHealth === 'Optimal' ? '● Optimal Flow' : '▲ SLA Escalation'}
            </span>
          </div>
        </div>
      `;
    }

    // Render Milestone Critical Path Rows
    const milestoneContainer = document.getElementById('milestonesContainer');
    if (milestoneContainer) {
      milestoneContainer.innerHTML = flight.milestones.map(m => {
        let statusBadgeClass = 'status-pending';
        let rowClass = '';
        if (m.status === 'Completed') {
          statusBadgeClass = 'status-completed';
          rowClass = 'completed';
        } else if (m.status === 'In-Progress') {
          statusBadgeClass = 'status-inprogress';
        } else if (m.status === 'Delayed') {
          statusBadgeClass = 'status-delayed';
          rowClass = 'delayed';
        }

        const isDelayed = m.status === 'Delayed';
        const isCompleted = m.status === 'Completed';
        const isInProgress = m.status === 'In-Progress';

        return `
          <div class="milestone-row ${rowClass}">
            <div class="milestone-icon-box">${m.icon || '⚡'}</div>
            
            <div class="milestone-info">
              <h4>${m.name}</h4>
              <p>Team: <strong>${m.team}</strong></p>
              ${m.operator ? `<p style="color: var(--text-muted); font-size: 0.7rem;">Lead: ${m.operator}</p>` : ''}
            </div>

            <div class="milestone-gantt-bar-wrap">
              <div class="gantt-time-labels">
                <span>Window: T+${m.startOffset || 0}m (${m.duration} min SLA)</span>
                <span>${isCompleted ? `Done (${m.actualDuration || m.duration}m)` : (isDelayed ? `+${m.delayMinutes || 4}m DELAY` : `${m.progressPct || 0}% Complete`)}</span>
              </div>
              <div class="gantt-bar-track">
                <div class="gantt-bar-fill ${isCompleted ? 'completed' : (isDelayed ? 'delayed' : '')}" 
                     style="width: ${isCompleted ? '100%' : (isDelayed ? '40%' : `${m.progressPct || (isInProgress ? 50 : 0)}%`)}">
                </div>
              </div>
              <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 0.35rem; font-style: italic;">
                "${m.digitalEvidence || 'Awaiting telemetry handshake'}"
              </div>
            </div>

            <div>
              <span class="milestone-status-badge ${statusBadgeClass}">${m.status}</span>
            </div>

            <div class="milestone-actions">
              ${!isCompleted ? `
                <button class="btn btn-sm btn-success" onclick="AeroApp.completeMilestone('${flight.id}', '${m.id}')" title="Sign off milestone as complete">✓ Done</button>
              ` : `
                <button class="btn btn-sm btn-secondary" onclick="AeroApp.resetMilestone('${flight.id}', '${m.id}')" title="Reset milestone">↺ Reset</button>
              `}
              
              ${!isDelayed && !isCompleted ? `
                <button class="btn btn-sm btn-warning" onclick="AeroApp.flagDelay('${flight.id}', '${m.id}')" title="Flag milestone delay">⚠️ Delay</button>
              ` : ''}

              ${isDelayed ? `
                <button class="btn btn-sm btn-primary" onclick="AeroApp.resolveMilestoneDelay('${flight.id}', '${m.id}')" title="Deploy auto-recovery action">⚡ Auto-Fix</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // Milestone Actions
  completeMilestone(flightId, milestoneId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return;
    const m = flight.milestones.find(item => item.id === milestoneId);
    if (!m) return;

    m.status = 'Completed';
    m.actualDuration = m.duration;
    m.progressPct = 100;
    m.completedAt = new Date().toTimeString().split(' ')[0].substring(0, 5);
    m.digitalEvidence = `Completed & digitally timestamped by ground operator @ ${m.completedAt}`;

    // Check if all milestones completed
    const allDone = flight.milestones.every(item => item.status === 'Completed');
    if (allDone) {
      flight.status = 'Pushback Ready';
      flight.turnaroundHealth = 'Optimal';
      this.playAlertSound('chime');
      AeroDB.logAuditEvent(flight.flightNo, 'FLIGHT_PUSHBACK_CLEARED', 'Ramp Duty Lead', `All 8 turnaround milestones verified and approved for pushback.`);
    } else {
      AeroDB.logAuditEvent(flight.flightNo, `MILESTONE_COMPLETED_${m.code}`, m.team, `Milestone '${m.name}' signed off in ${m.actualDuration}m.`);
    }

    AeroDB.saveState(this.state);
    this.renderFlightList();
    this.renderTurnaroundView();
    this.renderAuditLedger();
    this.playAlertSound('chime');
  },

  resetMilestone(flightId, milestoneId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return;
    const m = flight.milestones.find(item => item.id === milestoneId);
    if (!m) return;

    m.status = 'In-Progress';
    m.progressPct = 50;
    flight.status = 'In Progress';
    AeroDB.logAuditEvent(flight.flightNo, `MILESTONE_RESET_${m.code}`, 'Ramp Supervisor', `Reset milestone '${m.name}' to In-Progress status.`);
    AeroDB.saveState(this.state);
    this.renderFlightList();
    this.renderTurnaroundView();
    this.renderAuditLedger();
  },

  flagDelay(flightId, milestoneId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return;
    const m = flight.milestones.find(item => item.id === milestoneId);
    if (!m) return;

    m.status = 'Delayed';
    m.delayMinutes = 6;
    m.digitalEvidence = `ALERT: Milestone deviated by +6 mins from critical path. Escalated to Duty Manager.`;
    flight.status = 'SLA Warning';
    flight.turnaroundHealth = 'Critical';

    this.playAlertSound('warning');
    this.showSlaAlertBanner(`Critical SLA Delay Detected on Flight ${flight.flightNo} (${m.name}). Auto-escalated to Ramp Duty Officer.`);

    AeroDB.logAuditEvent(flight.flightNo, `SLA_BREACH_FLAGGED_${m.code}`, 'Automated Telemetry Sensor', `Milestone '${m.name}' delayed by +6m. Escalated to AOCC Duty Officer.`);
    AeroDB.saveState(this.state);
    this.renderFlightList();
    this.renderTurnaroundView();
    this.renderAuditLedger();
  },

  resolveMilestoneDelay(flightId, milestoneId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return;
    const m = flight.milestones.find(item => item.id === milestoneId);
    if (!m) return;

    m.status = 'Completed';
    m.actualDuration = m.duration + 2;
    m.progressPct = 100;
    m.digitalEvidence = `RECOVERED: Backup ground asset deployed. Delay contained to +2 mins.`;
    
    // Check if any other delay exists
    const hasOtherDelay = flight.milestones.some(item => item.status === 'Delayed');
    if (!hasOtherDelay) {
      flight.status = 'In Progress';
      flight.turnaroundHealth = 'Optimal';
      this.hideSlaAlertBanner();
    }

    AeroDB.logAuditEvent(flight.flightNo, `DELAY_AUTO_RECOVERED_${m.code}`, 'Standby Dispatch Engine', `Deployed standby unit to recover '${m.name}' with +2m containment.`);
    AeroDB.saveState(this.state);
    this.renderFlightList();
    this.renderTurnaroundView();
    this.renderAuditLedger();
    this.playAlertSound('chime');
  },

  showSlaAlertBanner(msg) {
    const banner = document.getElementById('slaAlertBanner');
    const textEl = document.getElementById('slaAlertText');
    if (banner && textEl) {
      textEl.innerHTML = `<h4>🚨 AUTOMATED SLA DEVIATION ESCALATION</h4><p>${msg}</p>`;
      banner.style.display = 'flex';
    }
  },

  hideSlaAlertBanner() {
    const banner = document.getElementById('slaAlertBanner');
    if (banner) banner.style.display = 'none';
  },

  // Run Hackathon Simulation Scenarios
  runScenario(type) {
    const flight = this.state.flights.find(f => f.id === 'FL-001');
    if (!flight) return;

    if (type === 'optimal') {
      flight.milestones.forEach((m, idx) => {
        m.status = 'Completed';
        m.actualDuration = Math.max(3, m.duration - 1);
        m.progressPct = 100;
      });
      flight.elapsedMins = 26;
      flight.status = 'Pushback Ready';
      flight.turnaroundHealth = 'Optimal';
      this.hideSlaAlertBanner();
      this.playAlertSound('chime');
      AeroDB.logAuditEvent(flight.flightNo, 'SCENARIO_OPTIMAL_26M', 'Simulation Engine', 'Simulated 26-minute benchmark fast turnaround.');
    } else if (type === 'catering_delay') {
      const cat = flight.milestones.find(m => m.code === 'CATERING');
      if (cat) {
        cat.status = 'Delayed';
        cat.delayMinutes = 5;
        cat.digitalEvidence = 'Simulated Catering Highloader Hydraulic Jam. Automatic Standby CAT-01 requested.';
        flight.status = 'SLA Warning';
        flight.turnaroundHealth = 'Critical';
        this.showSlaAlertBanner(`Simulation: Catering Highloader hydraulic jam at Gate G3. Standby highloader dispatched.`);
        this.playAlertSound('warning');
        AeroDB.logAuditEvent(flight.flightNo, 'SCENARIO_CATERING_DELAY', 'Simulation Engine', 'Injected hydraulic failure on Catering Highloader CAT-02.');
      }
    } else if (type === 'fuel_anomaly') {
      const fuel = flight.milestones.find(m => m.code === 'REFUELING');
      if (fuel) {
        fuel.status = 'In-Progress';
        fuel.progressPct = 85;
        fuel.digitalEvidence = 'Fuel density verification (0.795 g/cm³) digitally validated and locked to cockpit.';
        AeroDB.logAuditEvent(flight.flightNo, 'SCENARIO_DIGITAL_FUEL_CHIT', 'IOCL Aviation', '4,200kg ATF fuel loaded with density 0.795 g/cm³ locked to EFB.');
      }
    }

    AeroDB.saveState(this.state);
    this.renderFlightList();
    this.renderTurnaroundView();
    this.renderAuditLedger();
  },

  renderAuditLedger() {
    const tbody = document.getElementById('auditLedgerTbody');
    if (!tbody) return;

    const logs = AeroDB.getAuditLogs();
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No historical ledger events yet. Perform operations or simulations to generate ledger records.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><strong style="color: var(--accent-cyan); font-family: var(--font-mono); font-size: 0.75rem;">${l.id}</strong></td>
        <td><span style="font-family: var(--font-mono); font-size: 0.75rem;">${l.timeIST}</span></td>
        <td><strong>${l.flightNo}</strong></td>
        <td><span class="milestone-status-badge status-inprogress" style="font-size: 0.65rem;">${l.eventType}</span></td>
        <td>${l.operator}</td>
        <td style="font-size: 0.75rem; color: var(--text-muted);">${l.details}</td>
      </tr>
    `).join('');
  },

  // Render Ground Support Equipment (GSE) Matrix
  renderGSEGrid() {
    const container = document.getElementById('gseGridContainer');
    if (!container) return;

    container.innerHTML = this.state.gseFleet.map(gse => {
      const isAvailable = !gse.assignedFlight;
      return `
        <div class="gse-card">
          <div class="gse-top">
            <div>
              <div class="gse-id">${gse.id}</div>
              <div class="gse-type">${gse.type}</div>
            </div>
            <span class="milestone-status-badge ${isAvailable ? 'status-completed' : 'status-inprogress'}" style="font-size: 0.65rem;">
              ${isAvailable ? 'Available' : 'On-Duty'}
            </span>
          </div>
          <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.35rem;">
            Model: <strong>${gse.model}</strong>
          </div>
          <div class="gse-battery-bar">
            <div class="gse-battery-fill" style="width: 85%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.725rem; color: var(--text-dim);">
            <span>Power / Fuel: <strong>${gse.batteryFuel}</strong></span>
            <span>${gse.status}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render IATA Delay Codes Table
  renderIataCodesTable() {
    const tbody = document.getElementById('iataDelayCodesTbody');
    if (!tbody) return;

    tbody.innerHTML = window.AERO_DATA.iataDelayCodes.map(c => `
      <tr>
        <td><strong style="color: var(--accent-cyan); font-family: var(--font-mono);">CODE ${c.code}</strong></td>
        <td><strong>${c.category}</strong></td>
        <td>${c.description}</td>
        <td>${c.standardMinAllowance} mins</td>
      </tr>
    `).join('');
  },

  // Switch Main Navigation Tabs
  switchTab(tabKey) {
    this.state.currentTab = tabKey;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    document.querySelectorAll('.tab-content-pane').forEach(pane => {
      pane.style.display = pane.id === `tabPane_${tabKey}` ? 'block' : 'none';
    });
  },

  // Dynamic Aviation ROI Calculator
  calculateROI() {
    const dailyFlights = parseInt(document.getElementById('sliderDailyFlights')?.value || 40);
    const minSaved = parseFloat(document.getElementById('sliderMinSaved')?.value || 4.5);
    const costPerMin = parseInt(document.getElementById('sliderCostPerMin')?.value || 10500);

    // Update value displays
    if (document.getElementById('valDailyFlights')) document.getElementById('valDailyFlights').innerText = `${dailyFlights} Flights`;
    if (document.getElementById('valMinSaved')) document.getElementById('valMinSaved').innerText = `${minSaved} Mins`;
    if (document.getElementById('valCostPerMin')) document.getElementById('valCostPerMin').innerText = `₹${costPerMin.toLocaleString()}`;

    // Financial math
    const dailyMinutesSaved = dailyFlights * minSaved;
    const dailySavingsINR = dailyMinutesSaved * costPerMin;
    const annualSavingsCrores = ((dailySavingsINR * 365) / 10000000).toFixed(2);
    
    // Fuel & ESG math
    const dailyFuelSavedKg = dailyMinutesSaved * 1.8;
    const annualFuelSavedLiters = Math.round((dailyFuelSavedKg * 365) / 0.8);
    const annualCo2SavedTonnes = Math.round((dailyFuelSavedKg * 3.16 * 365) / 1000);

    // Update Result Cards
    if (document.getElementById('roiAnnualSavingsCrores')) {
      document.getElementById('roiAnnualSavingsCrores').innerText = `₹${annualSavingsCrores} Cr`;
    }
    if (document.getElementById('roiFuelSavedLiters')) {
      document.getElementById('roiFuelSavedLiters').innerText = `${annualFuelSavedLiters.toLocaleString()} L`;
    }
    if (document.getElementById('roiCo2AvoidedTonnes')) {
      document.getElementById('roiCo2AvoidedTonnes').innerText = `${annualCo2SavedTonnes} T`;
    }
    if (document.getElementById('roiOtpBoostPct')) {
      document.getElementById('roiOtpBoostPct').innerText = `+${((minSaved / 35) * 100).toFixed(1)}%`;
    }
  },

  // Open IATA Digital Turnaround Clearance Modal
  openClearanceCertificateModal() {
    const flight = this.state.flights.find(f => f.id === this.state.selectedFlightId);
    if (!flight) return;

    const modal = document.getElementById('clearanceModal');
    const content = document.getElementById('clearanceModalContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="certificate-view">
        <div class="cert-header">
          <h2 style="font-size: 1.5rem; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">
            ✈️ AEROFLOW 360 — OFFICIAL AIRCRAFT TURNAROUND CLEARANCE CERTIFICATE
          </h2>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
            Compliant with IATA Airport Handling Manual (AHM 730/780) & DGCA Civil Aviation Requirements
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
          <div>Flight Number: <strong>${flight.flightNo}</strong></div>
          <div>Airline: <strong>${flight.airline}</strong></div>
          <div>Aircraft: <strong>${flight.aircraft} (${flight.registration})</strong></div>
          <div>Stand / Gate: <strong>${flight.gate} (${flight.bayType})</strong></div>
          <div>Block-In: <strong>${flight.blockIn} IST</strong></div>
          <div>Pushback Target: <strong>${flight.std} IST</strong></div>
        </div>

        <table class="cert-table">
          <thead>
            <tr>
              <th>Milestone Workflow</th>
              <th>Responsible Agency</th>
              <th>Status</th>
              <th>Digital Sign-Off / Evidence</th>
            </tr>
          </thead>
          <tbody>
            ${flight.milestones.map(m => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.team}</td>
                <td><span style="color: ${m.status === 'Completed' ? '#059669' : '#dc2626'}; font-weight: 700;">${m.status}</span></td>
                <td>${m.digitalEvidence || 'Signed off'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; margin-top: 2rem; border-top: 1px dashed #94a3b8; padding-top: 1.25rem; font-size: 0.825rem;">
          <div>
            <div>Ramp Duty Officer: <strong>R. Karthik (EMP-8821)</strong></div>
            <div style="color: #64748b;">Digital Signature: <i>[AEROFLOW-VERIFIED-AUTH-HASH-99214]</i></div>
          </div>
          <div style="text-align: right;">
            <div>Aircraft Commander / Pilot-in-Command: <strong>Capt. V. Sharma</strong></div>
            <div style="color: #64748b;">Electronic Flight Bag Handshake: <i>[EFB-ACK-14:38:12]</i></div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  },

  // Open Ramp Crew Mobile View Simulation Modal
  openMobileCrewSimulator() {
    const flight = this.state.flights.find(f => f.id === this.state.selectedFlightId);
    if (!flight) return;

    const modal = document.getElementById('crewMobileModal');
    const content = document.getElementById('crewMobileContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="phone-frame">
        <div class="phone-notch"></div>
        <div class="phone-screen">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.75rem; font-weight: 800; color: var(--accent-cyan);">AEROFLOW CREW PWA</span>
            <span class="brand-badge" style="font-size: 0.6rem;">GATE ${flight.gate}</span>
          </div>

          <div style="background: rgba(255,255,255,0.06); border-radius: var(--radius-sm); padding: 0.6rem; margin-bottom: 0.85rem;">
            <div style="font-size: 0.95rem; font-weight: 800; color: #fff;">${flight.flightNo} (${flight.aircraft})</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${flight.origin} ➔ ${flight.destination}</div>
          </div>

          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-dim); margin-bottom: 0.5rem; text-transform: uppercase;">
            My Assigned Field Tasks
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: 320px;">
            ${flight.milestones.slice(0, 5).map(m => `
              <div style="background: rgba(16,27,48,0.8); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.6rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 0.775rem; font-weight: 700; color: #fff;">${m.name}</div>
                  <div style="font-size: 0.65rem; color: var(--text-dim);">${m.team}</div>
                </div>
                <button class="btn btn-sm ${m.status === 'Completed' ? 'btn-secondary' : 'btn-success'}" 
                        style="font-size: 0.65rem; padding: 0.2rem 0.5rem;"
                        onclick="AeroApp.completeMilestone('${flight.id}', '${m.id}'); AeroApp.openMobileCrewSimulator();">
                  ${m.status === 'Completed' ? '✓ Done' : 'Tap to Sign'}
                </button>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--border-color); text-align: center;">
            <button class="btn btn-sm btn-primary" style="width: 100%; font-size: 0.75rem;" onclick="AeroApp.playAlertSound('chime'); alert('📱 RFID Ground Scanner Synchronized');">
              📷 Scan GSE Asset Barcode
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  },

  // Built-in Pitch Presentation Deck Controller
  openPitchDeck() {
    this.state.currentSlideIdx = 0;
    this.renderPitchSlide();
    document.getElementById('pitchModal')?.classList.add('open');
  },

  renderPitchSlide() {
    const slides = window.AERO_DATA.pitchSlides;
    const slide = slides[this.state.currentSlideIdx];
    const container = document.getElementById('pitchSlideContainer');
    const counter = document.getElementById('pitchSlideCounter');
    const nextBtn = document.getElementById('pitchNextBtn');
    const prevBtn = document.getElementById('pitchPrevBtn');
    if (!container || !slide) return;

    const isFirst = this.state.currentSlideIdx === 0;
    const isLast = this.state.currentSlideIdx === slides.length - 1;

    if (counter) counter.innerText = `Slide ${this.state.currentSlideIdx + 1} of ${slides.length}`;

    if (prevBtn) {
      prevBtn.disabled = isFirst;
      prevBtn.style.opacity = isFirst ? '0.4' : '1';
      prevBtn.style.cursor = isFirst ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
      if (isLast) {
        nextBtn.innerHTML = `Finish & Return to AOCC ✕`;
        nextBtn.className = `btn btn-pitch btn-sm`;
      } else {
        nextBtn.innerHTML = `Next Slide ▶`;
        nextBtn.className = `btn btn-primary btn-sm`;
      }
    }

    container.innerHTML = `
      <div>
        <span class="pitch-slide-badge">${slide.badge}</span>
        <h2 class="pitch-slide-title">${slide.title}</h2>
        <h3 class="pitch-slide-subtitle">${slide.subtitle}</h3>

        <ul class="pitch-points-list">
          ${slide.points.map(pt => `
            <li>${pt.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--accent-cyan);">$1</strong>')}</li>
          `).join('')}
        </ul>
      </div>
    `;
  },

  nextSlide() {
    const slides = window.AERO_DATA.pitchSlides;
    if (this.state.currentSlideIdx < slides.length - 1) {
      this.state.currentSlideIdx++;
      this.renderPitchSlide();
      this.playAlertSound('chime');
    } else {
      // On last slide, close modal
      this.closeModal('pitchModal');
      this.playAlertSound('chime');
    }
  },

  prevSlide() {
    if (this.state.currentSlideIdx > 0) {
      this.state.currentSlideIdx--;
      this.renderPitchSlide();
      this.playAlertSound('chime');
    }
  },

  closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('open');
  }
};

// Auto-boot upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  AeroApp.init();
});
