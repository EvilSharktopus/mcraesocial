// Daily Nutrition & Training Log — Client Logic & Firebase Integration

// Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyBfQNvbEDERrDoM816JFmtkOKBsCXFYXCI",
  authDomain: "project-7910201586224417193.firebaseapp.com",
  projectId: "project-7910201586224417193",
  storageBucket: "project-7910201586224417193.firebasestorage.app",
  messagingSenderId: "885278922704",
  appId: "1:885278922704:web:feea02463fa11035094bd5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
let messaging = null;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.log('FCM not supported on this browser/environment.');
}

// App State
let selectedDate = getTodayStr();
let currentDocData = {
  foodEntries: [],
  activities: [],
  garminBurnOverride: null,
  weighIn: {},
  rehabTicks: []
};
let rehabExercises = ["Hip bridges", "Slider hamstring curls", "Prone hamstring curls", "Single-leg work"];
let savedFoodsList = [];
let historicalLogs = {}; // date -> docData mapping for trends/streaks
let aiResultCache = null;
let selectedAiTag = "Whole food";

// Date Helper Functions
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRehabExercises();
  loadSavedFoods();
  loadHistoricalLogs();
  setSelectedDate(getTodayStr());
  initPushNotifications();
});

// Register FCM Push Notifications
async function initPushNotifications() {
  const btn = document.getElementById('fcm-status-btn');
  if (!btn || !messaging) {
    if (btn) btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await messaging.getToken({
          vapidKey: 'BD18_YOUR_VAPID_KEY_HERE_IF_NEEDED' // optional standard FCM vapid key
        }).catch(() => null);

        if (token) {
          await db.collection('fcm_tokens').doc(token.substring(0, 30)).set({
            token,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          btn.textContent = '🔔 Push Notifications Enabled';
          btn.style.color = 'var(--green-text)';
        } else {
          btn.textContent = '🔔 Notifications Allowed';
        }
      } else {
        btn.textContent = '🔕 Push Notifications Blocked';
      }
    } catch (e) {
      console.error('Error requesting notification permission:', e);
    }
  });

  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Push Notifications Enabled';
    btn.style.color = 'var(--green-text)';
  }
}

// Date Navigation
function setSelectedDate(dateStr) {
  selectedDate = dateStr;
  document.getElementById('date-picker').value = selectedDate;
  
  // Show / hide Today quick button
  const isToday = selectedDate === getTodayStr();
  document.getElementById('today-badge-btn').style.display = isToday ? 'none' : 'inline-block';

  listenToDayLog(selectedDate);
}

// Real-time listener for current selected date
let unsubscribeDayLog = null;
function listenToDayLog(dateStr) {
  if (unsubscribeDayLog) unsubscribeDayLog();

  unsubscribeDayLog = db.collection('food_logs').doc(dateStr).onSnapshot((doc) => {
    if (doc.exists) {
      currentDocData = Object.assign({
        foodEntries: [],
        activities: [],
        garminBurnOverride: null,
        weighIn: {},
        rehabTicks: []
      }, doc.data());
    } else {
      currentDocData = {
        foodEntries: [],
        activities: [],
        garminBurnOverride: null,
        weighIn: {},
        rehabTicks: []
      };
    }
    renderAll();
  }, (err) => {
    console.error('Error loading day log:', err);
  });
}

// Load global rehab exercises from Firestore
function loadRehabExercises() {
  db.collection('food_settings').doc('rehab').onSnapshot((doc) => {
    if (doc.exists && doc.data().exercises) {
      rehabExercises = doc.data().exercises;
    } else {
      // Initialize default exercises in Firestore if missing
      db.collection('food_settings').doc('rehab').set({ exercises: rehabExercises });
    }
    renderRehabSection();
  });
}

// Load saved foods from Firestore
function loadSavedFoods() {
  db.collection('saved_foods').onSnapshot((snapshot) => {
    savedFoodsList = [];
    snapshot.forEach(doc => {
      savedFoodsList.push({ id: doc.id, ...doc.data() });
    });
    renderSavedFoodsDropdown();
  });
}

// Load all historical logs for trend & streak calculations
function loadHistoricalLogs() {
  db.collection('food_logs').onSnapshot((snapshot) => {
    historicalLogs = {};
    snapshot.forEach(doc => {
      historicalLogs[doc.id] = doc.data();
    });
    renderYesterdayAndStreaks();
    renderTrendsSection();
    renderBadgesSection();
  });
}

// Save current date document to Firestore
async function saveCurrentDoc() {
  try {
    await db.collection('food_logs').doc(selectedDate).set({
      ...currentDocData,
      date: selectedDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Error saving to Firestore:', e);
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Date picker
  const dateInput = document.getElementById('date-picker');
  dateInput.addEventListener('change', (e) => setSelectedDate(e.target.value));

  document.getElementById('prev-day-btn').addEventListener('click', () => {
    setSelectedDate(getYesterdayStr(selectedDate));
  });

  document.getElementById('next-day-btn').addEventListener('click', () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  });

  document.getElementById('today-badge-btn').addEventListener('click', () => {
    setSelectedDate(getTodayStr());
  });

  // Activity Quick Add Buttons
  document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const defaultKcal = Number(btn.dataset.kcal);
      showInlineActivityEdit(name, defaultKcal);
    });
  });

  document.getElementById('confirm-activity-btn').addEventListener('click', () => {
    const name = document.getElementById('inline-act-name').textContent;
    const kcal = Number(document.getElementById('inline-act-kcal').value) || 0;
    currentDocData.activities.push({ id: Date.now().toString(), name, kcal });
    hideInlineActivityEdit();
    saveCurrentDoc();
  });

  document.getElementById('cancel-activity-btn').addEventListener('click', () => {
    hideInlineActivityEdit();
  });

  // Garmin Override
  document.getElementById('save-garmin-btn').addEventListener('click', () => {
    const val = document.getElementById('garmin-override-input').value;
    currentDocData.garminBurnOverride = val !== "" ? Number(val) : null;
    saveCurrentDoc();
  });

  // Rehab Add Exercise
  document.getElementById('add-exercise-btn').addEventListener('click', () => {
    const input = document.getElementById('new-exercise-input');
    const name = input.value.trim();
    if (name && !rehabExercises.includes(name)) {
      rehabExercises.push(name);
      input.value = '';
      db.collection('food_settings').doc('rehab').set({ exercises: rehabExercises });
    }
  });

  // Food Quick Add Buttons
  document.querySelectorAll('.food-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const kcal = Number(btn.dataset.kcal);
      const protein = Number(btn.dataset.protein);
      currentDocData.foodEntries.push({ id: Date.now().toString(), name, kcal, protein, tag: 'Whole food' });
      saveCurrentDoc();
    });
  });

  // Saved Foods Dropdown Add
  document.getElementById('saved-foods-select').addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const food = savedFoodsList.find(f => f.id === selectedId);
    if (food) {
      currentDocData.foodEntries.push({
        id: Date.now().toString(),
        name: food.name,
        kcal: food.kcal,
        protein: food.protein,
        tag: food.tag || 'Whole food'
      });
      saveCurrentDoc();
    }
    e.target.value = '';
  });

  // AI Food Lookup
  document.getElementById('ai-lookup-btn').addEventListener('click', handleAiLookup);
  document.getElementById('ai-lookup-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAiLookup();
  });

  document.querySelectorAll('.tag-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tag-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAiTag = btn.dataset.tag;
    });
  });

  document.getElementById('ai-add-today-btn').addEventListener('click', () => {
    if (!aiResultCache) return;
    currentDocData.foodEntries.push({
      id: Date.now().toString(),
      name: aiResultCache.name,
      kcal: aiResultCache.kcal,
      protein: aiResultCache.protein,
      tag: selectedAiTag
    });
    saveCurrentDoc();
    hideAiResultBox();
  });

  document.getElementById('ai-add-save-btn').addEventListener('click', async () => {
    if (!aiResultCache) return;
    // Add to today
    currentDocData.foodEntries.push({
      id: Date.now().toString(),
      name: aiResultCache.name,
      kcal: aiResultCache.kcal,
      protein: aiResultCache.protein,
      tag: selectedAiTag
    });
    saveCurrentDoc();

    // Save globally
    await db.collection('saved_foods').add({
      name: aiResultCache.name,
      kcal: aiResultCache.kcal,
      protein: aiResultCache.protein,
      tag: selectedAiTag,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    hideAiResultBox();
  });

  // Weigh-in Inputs
  ['weighin-weight', 'weighin-bf', 'weighin-muscle', 'weighin-bmr'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveWeighInFromUI);
  });
}

// Activity inline edit toggle
function showInlineActivityEdit(name, defaultKcal) {
  document.getElementById('inline-act-name').textContent = name;
  document.getElementById('inline-act-kcal').value = defaultKcal;
  document.getElementById('activity-inline-edit').style.display = 'flex';
}

function hideInlineActivityEdit() {
  document.getElementById('activity-inline-edit').style.display = 'none';
}

// AI Food Lookup Handler
async function handleAiLookup() {
  const input = document.getElementById('ai-lookup-input');
  const query = input.value.trim();
  const errBox = document.getElementById('ai-error-box');
  if (!query) return;

  errBox.style.display = 'none';
  document.getElementById('ai-lookup-btn').textContent = 'Searching...';

  try {
    const res = await fetch('/api/food-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Food lookup failed.');
    }

    const data = await res.json();
    if (!data.name || typeof data.kcal !== 'number') {
      throw new Error('Invalid response format from lookup.');
    }

    aiResultCache = data;
    document.getElementById('ai-result-title').textContent = `${data.name} — ${data.kcal} kcal, ${data.protein}g protein`;
    document.getElementById('ai-result-box').style.display = 'block';
    input.value = '';
  } catch (err) {
    errBox.textContent = err.message || 'Lookup failed. Enter food manually.';
    errBox.style.display = 'block';
  } finally {
    document.getElementById('ai-lookup-btn').textContent = 'Estimate';
  }
}

function hideAiResultBox() {
  document.getElementById('ai-result-box').style.display = 'none';
  aiResultCache = null;
}

// Save weigh-in entries to current document
function saveWeighInFromUI() {
  const w = parseFloat(document.getElementById('weighin-weight').value);
  const bf = parseFloat(document.getElementById('weighin-bf').value);
  const m = parseFloat(document.getElementById('weighin-muscle').value);
  const bmr = parseFloat(document.getElementById('weighin-bmr').value);

  currentDocData.weighIn = {
    weight: isNaN(w) ? null : w,
    bodyFat: isNaN(bf) ? null : bf,
    muscleMass: isNaN(m) ? null : m,
    bmr: isNaN(bmr) ? null : bmr
  };
  saveCurrentDoc();
}

// ----------------------------------------------------
// RENDERING FUNCTIONS
// ----------------------------------------------------

function renderAll() {
  renderTotalsPanel();
  renderEveningBanner();
  renderActivitySection();
  renderRehabSection();
  renderFoodSection();
  renderWeighInSection();
  renderYesterdayAndStreaks();
  renderTrendsSection();
  renderBadgesSection();
}

// Calculate BMR with Fallback Logic
function getEffectiveBMR() {
  if (currentDocData.weighIn && currentDocData.weighIn.bmr) {
    return currentDocData.weighIn.bmr;
  }
  // Fallback to most recent weigh-in entry in historical logs
  const dates = Object.keys(historicalLogs).sort().reverse();
  for (let d of dates) {
    if (historicalLogs[d]?.weighIn?.bmr) {
      return historicalLogs[d].weighIn.bmr;
    }
  }
  return 2230; // Default BMR
}

// Render Totals Panel (Section 3)
function renderTotalsPanel() {
  const foodEntries = currentDocData.foodEntries || [];
  const activities = currentDocData.activities || [];
  
  const kcalIn = foodEntries.reduce((sum, f) => sum + (Number(f.kcal) || 0), 0);
  const proteinIn = foodEntries.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);

  const estimatedBurn = activities.reduce((sum, a) => sum + (Number(a.kcal) || 0), 0);
  const actualBurn = currentDocData.garminBurnOverride !== null && currentDocData.garminBurnOverride !== undefined
    ? Number(currentDocData.garminBurnOverride)
    : estimatedBurn;

  const isTrainingDay = activities.length > 0;
  const calorieTarget = isTrainingDay ? 2600 : 2300;
  const leftToday = calorieTarget - kcalIn;

  const bmr = getEffectiveBMR();
  const totalExpenditure = bmr + actualBurn;
  const actualDeficit = totalExpenditure - kcalIn;

  // DOM Updates
  document.getElementById('total-kcal-in').textContent = kcalIn;
  document.getElementById('total-protein-in').textContent = `${proteinIn}g`;
  document.getElementById('total-burn').textContent = actualBurn;

  // Protein Progress Bar
  const proteinPct = Math.min(100, Math.round((proteinIn / 180) * 100));
  const proteinBar = document.getElementById('protein-progress-fill');
  proteinBar.style.width = `${proteinPct}%`;
  
  const proteinCaption = document.getElementById('protein-target-caption');
  if (proteinIn >= 180) {
    proteinCaption.textContent = 'Target reached! (180g+)';
    proteinBar.style.background = 'var(--green-main)';
  } else {
    proteinCaption.textContent = `${180 - proteinIn}g to target`;
    proteinBar.style.background = 'var(--amber-main)';
  }

  // Left Today Card
  const leftCard = document.getElementById('left-today-card');
  const leftVal = document.getElementById('left-today-val');
  if (leftToday >= 0) {
    leftCard.className = 'left-today-card positive';
    leftVal.textContent = `${leftToday} kcal`;
  } else {
    leftCard.className = 'left-today-card over';
    leftVal.textContent = `${Math.abs(leftToday)} kcal over`;
  }

  // Explainer Line
  document.getElementById('totals-explainer').textContent = 
    `Target: ${calorieTarget} kcal (${isTrainingDay ? 'Training' : 'Rest'} Day) | Expenditure: ${totalExpenditure} kcal (${bmr} BMR + ${actualBurn} burn) | Actual Deficit: ${actualDeficit} kcal`;
}

// Render Evening Check Banner (Section 4)
function renderEveningBanner() {
  const banner = document.getElementById('evening-check-banner');
  const isToday = selectedDate === getTodayStr();

  // Get local hour & minute
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const isAfter1945 = (hours > 19) || (hours === 19 && minutes >= 45);

  if (!isToday || !isAfter1945) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  const foodEntries = currentDocData.foodEntries || [];
  const activities = currentDocData.activities || [];
  const kcalIn = foodEntries.reduce((sum, f) => sum + (Number(f.kcal) || 0), 0);
  const proteinIn = foodEntries.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
  const isTrainingDay = activities.length > 0;
  const target = isTrainingDay ? 2600 : 2300;
  const left = target - kcalIn;

  const textEl = document.getElementById('evening-banner-text');

  if (left >= 250) {
    banner.className = 'evening-banner info';
    let msg = `${left} kcal left today.`;
    if (proteinIn < 180) {
      msg += ` (${180 - proteinIn}g short on protein — make your snack protein-forward)`;
    }
    textEl.textContent = msg;
  } else if (left >= 0) {
    banner.className = 'evening-banner warning';
    textEl.textContent = `Only ${left} kcal left. This is the window — water first, wait twenty minutes.`;
  } else {
    banner.className = 'evening-banner danger';
    textEl.textContent = `${Math.abs(left)} over. Kitchen's closed.`;
  }
}

// Render Activity Section (Section 5)
function renderActivitySection() {
  const container = document.getElementById('activities-list');
  container.innerHTML = '';

  const activities = currentDocData.activities || [];
  const estimatedSum = activities.reduce((sum, a) => sum + (Number(a.kcal) || 0), 0);

  activities.forEach(act => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div>
        <span class="item-name">${act.name}</span>
        <span class="item-stats">${act.kcal} kcal</span>
      </div>
      <button class="remove-btn" onclick="removeActivity('${act.id}')">✕</button>
    `;
    container.appendChild(row);
  });

  const garminInput = document.getElementById('garmin-override-input');
  garminInput.placeholder = estimatedSum > 0 ? `Estimate sum: ${estimatedSum} kcal` : 'Enter Garmin burn';
  garminInput.value = currentDocData.garminBurnOverride !== null && currentDocData.garminBurnOverride !== undefined
    ? currentDocData.garminBurnOverride
    : '';
}

window.removeActivity = function(id) {
  currentDocData.activities = currentDocData.activities.filter(a => a.id !== id);
  saveCurrentDoc();
};

// Render Rehab Section (Section 6)
function renderRehabSection() {
  const container = document.getElementById('rehab-checklist');
  container.innerHTML = '';

  const ticks = currentDocData.rehabTicks || [];

  rehabExercises.forEach(ex => {
    const isChecked = ticks.includes(ex);
    const item = document.createElement('div');
    item.className = `rehab-item ${isChecked ? 'checked' : ''}`;
    
    item.innerHTML = `
      <label>
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleRehabTick('${ex.replace(/'/g, "\\'")}')">
        <span>${ex}</span>
      </label>
      <button class="remove-btn" onclick="removeRehabExercise('${ex.replace(/'/g, "\\'")}')">✕</button>
    `;
    container.appendChild(item);
  });

  // Check 20:00 nudge requirement
  const nudge = document.getElementById('rehab-nudge');
  const isToday = selectedDate === getTodayStr();
  const now = new Date();
  const isAfter2000 = now.getHours() >= 20;

  if (isToday && isAfter2000 && ticks.length === 0) {
    nudge.style.display = 'block';
  } else {
    nudge.style.display = 'none';
  }
}

window.toggleRehabTick = function(ex) {
  let ticks = currentDocData.rehabTicks || [];
  if (ticks.includes(ex)) {
    ticks = ticks.filter(t => t !== ex);
  } else {
    ticks.push(ex);
  }
  currentDocData.rehabTicks = ticks;
  saveCurrentDoc();
};

window.removeRehabExercise = function(ex) {
  rehabExercises = rehabExercises.filter(e => e !== ex);
  db.collection('food_settings').doc('rehab').set({ exercises: rehabExercises });
};

// Render Food Section (Section 7)
function renderFoodSection() {
  const container = document.getElementById('food-entries-list');
  container.innerHTML = '';

  const foodEntries = currentDocData.foodEntries || [];

  foodEntries.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';

    let tagClass = 'tag-whole';
    if (item.tag === 'Protein') tagClass = 'tag-protein';
    if (item.tag === 'Treat') tagClass = 'tag-treat';

    row.innerHTML = `
      <div>
        <span class="item-name">${item.name}</span>
        <span class="item-stats">${item.kcal} kcal, ${item.protein}g P</span>
        ${item.tag ? `<span class="item-tag ${tagClass}">${item.tag}</span>` : ''}
      </div>
      <button class="remove-btn" onclick="removeFoodEntry('${item.id}')">✕</button>
    `;
    container.appendChild(row);
  });

  renderSnackReport();
}

window.removeFoodEntry = function(id) {
  currentDocData.foodEntries = currentDocData.foodEntries.filter(f => f.id !== id);
  saveCurrentDoc();
};

function renderSavedFoodsDropdown() {
  const select = document.getElementById('saved-foods-select');
  select.innerHTML = '<option value="">-- Add from Saved Foods --</option>';

  savedFoodsList.forEach(food => {
    const opt = document.createElement('option');
    opt.value = food.id;
    opt.textContent = `${food.name} (${food.kcal} kcal / ${food.protein}g P)`;
    select.appendChild(opt);
  });
}

function renderSnackReport() {
  // Trailing 30 days snack tag counts
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  let wholeCount = 0;
  let proteinCount = 0;
  let treatCount = 0;

  Object.keys(historicalLogs).forEach(dateStr => {
    const d = new Date(dateStr + 'T12:00:00');
    if (d >= cutoffDate) {
      const entries = historicalLogs[dateStr].foodEntries || [];
      entries.forEach(item => {
        if (item.tag === 'Whole food') wholeCount++;
        if (item.tag === 'Protein') proteinCount++;
        if (item.tag === 'Treat') treatCount++;
      });
    }
  });

  document.getElementById('count-whole').textContent = wholeCount;
  document.getElementById('count-protein').textContent = proteinCount;
  document.getElementById('count-treat').textContent = treatCount;
}

// Render Weigh-in Section (Section 8)
function renderWeighInSection() {
  const w = currentDocData.weighIn?.weight || '';
  const bf = currentDocData.weighIn?.bodyFat || '';
  const m = currentDocData.weighIn?.muscleMass || '';
  const bmr = currentDocData.weighIn?.bmr || '';

  document.getElementById('weighin-weight').value = w;
  document.getElementById('weighin-bf').value = bf;
  document.getElementById('weighin-muscle').value = m;
  document.getElementById('weighin-bmr').value = bmr;

  const goalBanner = document.getElementById('goal-weight-banner');
  if (w && bf) {
    const currentWeight = Number(w);
    const currentBfPct = Number(bf);
    // Formula: weight * (1 - currentBF/100) / (1 - 0.14)
    const goalWeight = (currentWeight * (1 - (currentBfPct / 100))) / (1 - 0.14);
    const distToGoalPct = (currentBfPct - 14.0).toFixed(1);

    if (currentBfPct > 14.0) {
      goalBanner.textContent = `${distToGoalPct}% to 14% BF goal (Goal weight at current lean mass: ${goalWeight.toFixed(1)} lbs)`;
      goalBanner.style.display = 'block';
    } else {
      goalBanner.textContent = `🎯 14% Body Fat Goal Reached! (${currentBfPct}% current BF)`;
      goalBanner.style.display = 'block';
    }
  } else {
    goalBanner.style.display = 'none';
  }
}

// Render Yesterday + Streak Cards (Section 2)
function renderYesterdayAndStreaks() {
  const yesterdayStr = getYesterdayStr(getTodayStr());
  const yestDoc = historicalLogs[yesterdayStr];
  const yestCard = document.getElementById('yesterday-card');

  if (yestDoc && yestDoc.foodEntries && yestDoc.foodEntries.length > 0) {
    yestCard.style.display = 'block';
    const kcalIn = yestDoc.foodEntries.reduce((sum, f) => sum + (Number(f.kcal) || 0), 0);
    const proteinIn = yestDoc.foodEntries.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
    const isTraining = (yestDoc.activities || []).length > 0;
    const target = isTraining ? 2600 : 2300;

    const hitCal = kcalIn <= target;
    const hitProtein = proteinIn >= 180;

    document.getElementById('yesterday-stats').textContent = `${kcalIn} kcal, ${proteinIn}g P`;

    const verdictEl = document.getElementById('yesterday-verdict');
    if (hitCal && hitProtein) {
      verdictEl.className = 'verdict-badge verdict-success';
      verdictEl.textContent = 'Both targets hit.';
    } else {
      verdictEl.className = 'verdict-badge verdict-miss';
      let missParts = [];
      if (!hitCal) missParts.push(`${kcalIn - target} over calories`);
      if (!hitProtein) missParts.push(`${180 - proteinIn}g short on protein`);
      verdictEl.textContent = missParts.join(', ');
    }
  } else {
    yestCard.style.display = 'none';
  }

  // Calculate Nutrition Streak
  const streak = calculateNutritionStreak();
  document.getElementById('nutrition-streak-val').textContent = streak;

  // Calculate Rehab Streak
  const rehabStreak = calculateRehabStreak();
  document.getElementById('rehab-streak-val').textContent = `${rehabStreak}d streak`;
}

function isDaySuccessful(dateStr) {
  const doc = historicalLogs[dateStr];
  if (!doc || !doc.foodEntries || doc.foodEntries.length === 0) return false;

  const kcalIn = doc.foodEntries.reduce((sum, f) => sum + (Number(f.kcal) || 0), 0);
  const proteinIn = doc.foodEntries.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
  const isTraining = (doc.activities || []).length > 0;
  const target = isTraining ? 2600 : 2300;

  return kcalIn <= target && proteinIn >= 180;
}

function calculateNutritionStreak() {
  const sortedDates = Object.keys(historicalLogs).sort().reverse();
  if (sortedDates.length === 0) return 0;

  let streak = 0;
  let curr = getTodayStr();

  // If today isn't logged or finished yet, allow streak to count starting from yesterday
  if (!isDaySuccessful(curr)) {
    curr = getYesterdayStr(curr);
  }

  while (historicalLogs[curr] && isDaySuccessful(curr)) {
    streak++;
    curr = getYesterdayStr(curr);
  }
  return streak;
}

function calculateRehabStreak() {
  let streak = 0;
  let curr = getTodayStr();

  const todayTicks = historicalLogs[curr]?.rehabTicks || [];
  if (todayTicks.length === 0) {
    curr = getYesterdayStr(curr);
  }

  while (historicalLogs[curr] && (historicalLogs[curr].rehabTicks || []).length > 0) {
    streak++;
    curr = getYesterdayStr(curr);
  }
  return streak;
}

// Render Trends (Section 9)
function renderTrendsSection() {
  const dates = Object.keys(historicalLogs).sort();
  if (dates.length === 0) return;

  // 7-day rolling averages
  const last7Dates = dates.slice(-7);
  let total7Kcal = 0;
  let total7Protein = 0;

  last7Dates.forEach(d => {
    const entries = historicalLogs[d].foodEntries || [];
    total7Kcal += entries.reduce((s, f) => s + (Number(f.kcal) || 0), 0);
    total7Protein += entries.reduce((s, f) => s + (Number(f.protein) || 0), 0);
  });

  const avgKcal = Math.round(total7Kcal / (last7Dates.length || 1));
  const avgProtein = Math.round(total7Protein / (last7Dates.length || 1));

  const proteinAvgEl = document.getElementById('trend-avg-protein');
  proteinAvgEl.textContent = `${avgProtein}g`;
  proteinAvgEl.className = `trend-val ${avgProtein >= 180 ? 'target-met' : 'target-missed'}`;
  document.getElementById('trend-avg-kcal').textContent = `${avgKcal} kcal`;

  // Deficit Days out of Logged Days
  let deficitDaysCount = 0;
  dates.forEach(d => {
    const doc = historicalLogs[d];
    const kcalIn = (doc.foodEntries || []).reduce((s, f) => s + (Number(f.kcal) || 0), 0);
    const actBurn = doc.garminBurnOverride || (doc.activities || []).reduce((s, a) => s + (Number(a.kcal) || 0), 0);
    const bmr = doc.weighIn?.bmr || 2230;
    if (bmr + actBurn > kcalIn && kcalIn > 0) deficitDaysCount++;
  });
  document.getElementById('trend-deficit-days').textContent = `${deficitDaysCount} / ${dates.length}`;

  // Weight Trend & Change
  const weighInDates = dates.filter(d => historicalLogs[d].weighIn?.weight);
  if (weighInDates.length > 0) {
    const latestW = historicalLogs[weighInDates[weighInDates.length - 1]].weighIn.weight;
    const firstW = historicalLogs[weighInDates[0]].weighIn.weight;
    const diff = (latestW - firstW).toFixed(1);
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    document.getElementById('trend-weight').textContent = `${latestW} lbs (${diffStr} lbs)`;
  } else {
    document.getElementById('trend-weight').textContent = 'No entries';
  }

  // Rehab Days in Last 14
  const last14Dates = dates.slice(-14);
  let rehabDaysCount = 0;
  last14Dates.forEach(d => {
    if ((historicalLogs[d].rehabTicks || []).length > 0) rehabDaysCount++;
  });
  document.getElementById('trend-rehab-count').textContent = `${rehabDaysCount} / 14 days`;

  // Render 14-day SVG Bar Charts
  renderBarChart('chart-protein-svg', last14Dates, d => {
    return (historicalLogs[d].foodEntries || []).reduce((s, f) => s + (Number(f.protein) || 0), 0);
  }, 220, '#16a34a');

  renderBarChart('chart-kcal-svg', last14Dates, d => {
    return (historicalLogs[d].foodEntries || []).reduce((s, f) => s + (Number(f.kcal) || 0), 0);
  }, 3200, '#2563eb');
}

function renderBarChart(svgId, datesList, valueExtractor, maxVal, barColor) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';

  const width = svg.clientWidth || 300;
  const height = svg.clientHeight || 90;
  const numBars = datesList.length || 1;
  const barWidth = Math.max(8, Math.floor((width - (numBars * 4)) / numBars));

  datesList.forEach((d, i) => {
    const val = valueExtractor(d);
    const barHeight = Math.min(height, Math.round((val / maxVal) * height));
    const x = i * (barWidth + 4) + 6;
    const y = height - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', barColor);
    rect.setAttribute('rx', '3');

    // Add title hover element
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${d}: ${val}`;
    rect.appendChild(title);

    svg.appendChild(rect);
  });
}

// Render Badges Section (Section 10)
function renderBadgesSection() {
  const dates = Object.keys(historicalLogs);
  const loggedDaysCount = dates.length;
  const streak = calculateNutritionStreak();
  const rehabStreak = calculateRehabStreak();

  let proteinDaysCount = 0;
  let lowestBf = 99;

  dates.forEach(d => {
    const doc = historicalLogs[d];
    const pIn = (doc.foodEntries || []).reduce((s, f) => s + (Number(f.protein) || 0), 0);
    if (pIn >= 180) proteinDaysCount++;

    if (doc.weighIn?.bodyFat && doc.weighIn.bodyFat < lowestBf) {
      lowestBf = doc.weighIn.bodyFat;
    }
  });

  const badges = [
    { id: 'badge-first', earned: loggedDaysCount >= 1 },
    { id: 'badge-7d-log', earned: loggedDaysCount >= 7 },
    { id: 'badge-3d-streak', earned: streak >= 3 },
    { id: 'badge-7d-streak', earned: streak >= 7 },
    { id: 'badge-14d-streak', earned: streak >= 14 },
    { id: 'badge-10p', earned: proteinDaysCount >= 10 },
    { id: 'badge-3r', earned: rehabStreak >= 3 },
    { id: 'badge-7r', earned: rehabStreak >= 7 },
    { id: 'badge-bf14', earned: lowestBf <= 14.0 }
  ];

  badges.forEach(b => {
    const card = document.getElementById(b.id);
    if (card) {
      if (b.earned) {
        card.classList.add('earned');
      } else {
        card.classList.remove('earned');
      }
    }
  });
}
