document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  const uploadSection = document.getElementById('upload-section');
  const loadingSection = document.getElementById('loading-section');
  const resultsSection = document.getElementById('results-section');
  const resetBtn = document.getElementById('reset-btn');
  const topicCountSelect = document.getElementById('topic-count');
  const liveBadge = document.getElementById('live-badge');

  let allTopics = [];
  let lastRows = [];

  // --- Question key: paste the real questions; CSV headers are often just "#1", "#2"... ---
  const QUESTION_KEY_STORAGE = 'debate-analyzer-questions';
  const questionKeyInput = document.getElementById('question-key-input');
  const questionKeyStatus = document.getElementById('question-key-status');
  // Questions that arrived with live data (from the Google Doc). They win over the box.
  let liveQuestions = null;

  try {
    const saved = localStorage.getItem(QUESTION_KEY_STORAGE);
    if (saved) questionKeyInput.value = saved;
  } catch (e) { /* storage unavailable: the box still works for this visit */ }

  function parseQuestionLines(lines) {
    // Returns { byNumber: {1: "text", ...}, list: ["text", ...] }
    const byNumber = {};
    const list = [];
    lines.forEach(line => {
      const trimmed = String(line).trim();
      if (!trimmed) return;
      // "1. text", "1) text", "#1 text", "Q1: text", "1 - text"
      const m = trimmed.match(/^(?:#|q(?:uestion)?\s*)?(\d+)\s*[.):\-–]?\s*(.*)$/i);
      let num = null, body = trimmed;
      if (m && m[2]) { num = parseInt(m[1], 10); body = m[2].trim(); }
      list.push(body);
      byNumber[num !== null ? num : list.length] = body;
    });
    return { byNumber, list };
  }
  const parseQuestionKey = text => parseQuestionLines(text.split(/\r?\n/));

  function updateQuestionKeyStatus() {
    const { list } = parseQuestionKey(questionKeyInput.value);
    questionKeyStatus.textContent = list.length
      ? `${list.length} question${list.length === 1 ? '' : 's'} loaded. Columns named like "#3", "Q3" or "3" will show as question 3's text.`
      : 'Columns named like "#3", "Q3" or "3" will show as question 3\'s text. Saved in this browser. Ignored when the live source supplies questions.';
  }

  questionKeyInput.addEventListener('input', () => {
    try { localStorage.setItem(QUESTION_KEY_STORAGE, questionKeyInput.value); } catch (e) {}
    updateQuestionKeyStatus();
  });
  updateQuestionKeyStatus();

  // Give each topic a readable title from the key, keeping the raw header as a subtitle.
  function relabelTopics() {
    const key = liveQuestions && liveQuestions.length
      ? parseQuestionLines(liveQuestions)
      : parseQuestionKey(questionKeyInput.value);
    allTopics.forEach(topic => {
      const header = topic.column;
      const numMatch = header.match(/(\d+)/);
      let text = null;
      if (numMatch && key.byNumber[parseInt(numMatch[1], 10)]) text = key.byNumber[parseInt(numMatch[1], 10)];
      else if (!numMatch && key.list[topic.columnIndex]) text = key.list[topic.columnIndex];
      topic.title = text || header;
      topic.subtitle = text ? header : '';
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // --- Live source: an Apps Script web app that returns {columns, rows, questions} ---
  const LIVE_URL_STORAGE = 'debate-analyzer-live-url';
  const LIVE_INTERVAL_MS = 30000;
  const liveUrlInput = document.getElementById('live-url-input');
  const liveLoadBtn = document.getElementById('live-load-btn');
  const liveStatus = document.getElementById('live-status');
  let liveTimer = null;
  let liveActive = false;

  try {
    const savedUrl = localStorage.getItem(LIVE_URL_STORAGE);
    if (savedUrl) liveUrlInput.value = savedUrl;
  } catch (e) {}

  liveUrlInput.addEventListener('input', () => {
    try { localStorage.setItem(LIVE_URL_STORAGE, liveUrlInput.value.trim()); } catch (e) {}
  });

  liveLoadBtn.addEventListener('click', () => {
    const url = liveUrlInput.value.trim();
    if (!/^https:\/\/script\.google(?:usercontent)?\.com\//.test(url)) {
      alert('Paste the web app URL from Apps Script (it starts with https://script.google.com/macros/...).');
      return;
    }
    showSection(loadingSection);
    startLive(url);
  });

  async function fetchLive(url) {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch (e) { throw new Error('The URL did not return JSON. Check the deployment is a Web app with access set to Anyone.'); }
    if (json.error) throw new Error(json.error);
    if (!Array.isArray(json.columns) || !Array.isArray(json.rows)) throw new Error('Unexpected response shape.');
    return json;
  }

  async function startLive(url) {
    liveActive = true;
    try {
      await refreshLive(url, true);
    } catch (err) {
      liveActive = false;
      alert('Could not load live responses: ' + err.message);
      showSection(uploadSection);
      return;
    }
    clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      if (!liveActive) return;
      refreshLive(url, false).catch(err => {
        liveBadge.textContent = 'Live · retrying (' + err.message + ')';
        liveBadge.classList.add('live-badge--error');
      });
    }, LIVE_INTERVAL_MS);
  }

  async function refreshLive(url, first) {
    const json = await fetchLive(url);
    liveQuestions = Array.isArray(json.questions) ? json.questions : null;
    const rows = json.rows.map(r => Object.fromEntries(json.columns.map((c, i) => [c, r[i]])));
    const previousCount = lastRows.length;
    processData(rows, json.columns, { live: true });
    const now = new Date();
    const stamp = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const qNote = liveQuestions && liveQuestions.length ? ` · ${liveQuestions.length} questions from your doc` : (json.questionsError ? ' · questions doc unreadable, using the box' : '');
    liveBadge.textContent = `Live · ${rows.length} responses · updated ${stamp}${qNote}`;
    liveBadge.classList.remove('live-badge--error');
    liveBadge.classList.toggle('live-badge--pulse', !first && rows.length !== previousCount);
    liveStatus.textContent = `Connected. Refreshing every ${LIVE_INTERVAL_MS / 1000} seconds while results are open.`;
  }

  function stopLive() {
    liveActive = false;
    clearInterval(liveTimer);
    liveTimer = null;
    liveQuestions = null;
    liveBadge.textContent = '';
    liveBadge.classList.remove('live-badge--error', 'live-badge--pulse');
  }

  // --- Event Listeners ---

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  resetBtn.addEventListener('click', () => {
    stopLive();
    showSection(uploadSection);
    fileInput.value = '';
    allTopics = [];
    lastRows = [];
  });

  topicCountSelect.addEventListener('change', () => {
    renderTopics(allTopics);
  });

  // --- Logic ---

  function showSection(section) {
    [uploadSection, loadingSection, resultsSection].forEach(s => s.classList.remove('active'));
    section.classList.add('active');
  }

  function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
      alert("Please upload a valid CSV file.");
      return;
    }

    stopLive();
    showSection(loadingSection);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        setTimeout(() => {
          processData(results.data, results.meta.fields, { live: false });
        }, 500); // Artificial delay for smooth transition
      },
      error: function(err) {
        alert("Error parsing CSV: " + err.message);
        showSection(uploadSection);
      }
    });
  }

  // rows: array of {header: value}; fields: ordered list of headers.
  function processData(data, fields, { live }) {
    if (!data.length || !fields || !fields.length) {
      if (live) {
        allTopics = []; lastRows = [];
        document.getElementById('results-meta').textContent = 'No responses yet. Waiting for the first one.';
        document.getElementById('topics-list').innerHTML = '';
        showSection(resultsSection);
        return;
      }
      alert("CSV appears to be empty or missing headers.");
      showSection(uploadSection);
      return;
    }

    // Common metadata columns to ignore
    const skipWords = ['timestamp', 'name', 'email', 'score', 'id', 'class', 'period'];
    const validColumns = fields.filter(col => {
      const lower = col.toLowerCase();
      return !skipWords.some(skip => lower.includes(skip));
    });

    if (validColumns.length === 0) {
      alert("Could not find any question columns to analyze. Make sure your CSV has headers.");
      showSection(uploadSection);
      return;
    }

    allTopics = validColumns.map((col, columnIndex) => {
      // Get all non-empty responses for this column
      const responses = data
        .map(row => row[col])
        .filter(val => val !== undefined && val !== null && val.toString().trim() !== '');

      const topic = analyzeTopic(col, responses);
      topic.column = col;
      topic.columnIndex = columnIndex;
      return topic;
    });
    lastRows = data;
    relabelTopics();

    // Sort by split score descending
    allTopics.sort((a, b) => b.splitScore - a.splitScore);

    // Update metadata text
    const metaText = document.getElementById('results-meta');
    metaText.textContent = `Analyzed ${data.length} student responses across ${allTopics.length} topics.`;

    renderTopics(allTopics);
    showSection(resultsSection);
  }

  function analyzeTopic(title, rawResponses) {
    // Try to map textual responses to numeric values for better variance calculation
    const numericMap = {
      'strongly disagree': 1,
      'disagree': 2,
      'neutral': 3, 'neither agree nor disagree': 3,
      'agree': 4,
      'strongly agree': 5,
      'yes': 5, 'no': 1,
      'true': 5, 'false': 1
    };

    let numericCount = 0;
    const parsedResponses = rawResponses.map(r => {
      const str = r.toString().toLowerCase().trim();
      if (numericMap[str]) {
        numericCount++;
        return numericMap[str];
      }

      // Extract number if it starts with one (e.g. "1 - Strongly Disagree")
      const match = str.match(/^(\d+)/);
      if (match) {
        numericCount++;
        return parseInt(match[1]);
      }

      return r;
    });

    const isNumeric = numericCount > (parsedResponses.length * 0.5);
    const freq = {};

    parsedResponses.forEach(r => {
      freq[r] = (freq[r] || 0) + 1;
    });

    let splitScore = 0;
    let scoreDisplay = "";

    if (isNumeric) {
      // Calculate Standard Deviation
      const nums = parsedResponses.filter(r => typeof r === 'number');
      if (nums.length > 0) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
        const stdDev = Math.sqrt(variance);

        // A max stdDev for a 1-5 scale is 2.0 (if perfectly split between 1 and 5).
        // Let's normalize it roughly to a 0-100 score.
        splitScore = stdDev;
        scoreDisplay = `Polarization: ${(stdDev / 2 * 100).toFixed(0)}%`;
      }
    } else {
      // Categorical - use Shannon Entropy
      const n = parsedResponses.length;
      let entropy = 0;
      Object.values(freq).forEach(count => {
        const p = count / n;
        entropy -= p * Math.log2(p);
      });

      splitScore = entropy;
      scoreDisplay = `Entropy: ${entropy.toFixed(2)}`;
    }

    return {
      title,
      responses: parsedResponses.length,
      splitScore,
      scoreDisplay,
      freq,
      isNumeric
    };
  }

  function renderTopics(topics) {
    const listContainer = document.getElementById('topics-list');
    listContainer.innerHTML = '';

    const limitVal = topicCountSelect.value;
    const limit = limitVal === 'all' ? topics.length : parseInt(limitVal);

    const displayTopics = topics.slice(0, limit);

    displayTopics.forEach((topic, index) => {
      const card = document.createElement('div');
      card.className = 'topic-card';

      let rankClass = index < 3 ? `rank-${index + 1}` : '';

      // Build visualization
      let chartHtml = '';
      if (topic.isNumeric) {
        // Force 1-5 scale for visual consistency if numeric
        const maxCount = Math.max(...Object.values(topic.freq), 1);
        chartHtml = `<div class="bar-chart">`;
        for (let i = 1; i <= 5; i++) {
          const count = topic.freq[i] || 0;
          const height = (count / maxCount) * 100;
          chartHtml += `<div class="bar" style="height: ${Math.max(5, height)}%" data-tooltip="${count} votes"></div>`;
        }
        chartHtml += `</div>
        <div class="chart-labels">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        </div>`;
      } else {
        // Categorical top 5
        const sortedEntries = Object.entries(topic.freq).sort((a,b) => b[1] - a[1]).slice(0, 5);
        const maxCount = Math.max(...Object.values(topic.freq), 1);
        chartHtml = `<div class="bar-chart">`;
        sortedEntries.forEach(([label, count]) => {
          const height = (count / maxCount) * 100;
          chartHtml += `<div class="bar" style="height: ${Math.max(5, height)}%" data-tooltip="${escapeHtml(label)}: ${count}"></div>`;
        });
        chartHtml += `</div>`;
      }

      card.innerHTML = `
        <div class="topic-rank ${rankClass}">#${index + 1}</div>
        <div class="topic-info">
          <h3>${escapeHtml(topic.title)}</h3>
          ${topic.subtitle ? `<div class="topic-source">${escapeHtml(topic.subtitle)}</div>` : ''}
          <div class="topic-stats">
            <span class="stat-badge split-score">${topic.scoreDisplay}</span>
            <span class="stat-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ${topic.responses} Responses
            </span>
          </div>
        </div>
        <div class="topic-vis">
          ${chartHtml}
        </div>
      `;

      listContainer.appendChild(card);
    });
  }
});
