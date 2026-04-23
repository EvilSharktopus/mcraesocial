document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  const uploadSection = document.getElementById('upload-section');
  const loadingSection = document.getElementById('loading-section');
  const resultsSection = document.getElementById('results-section');
  const resetBtn = document.getElementById('reset-btn');
  const topicCountSelect = document.getElementById('topic-count');
  
  let allTopics = [];

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
    showSection(uploadSection);
    fileInput.value = '';
    allTopics = [];
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

    showSection(loadingSection);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        setTimeout(() => {
          processData(results.data, results.meta);
        }, 500); // Artificial delay for smooth transition
      },
      error: function(err) {
        alert("Error parsing CSV: " + err.message);
        showSection(uploadSection);
      }
    });
  }

  function processData(data, meta) {
    if (!data.length || !meta.fields.length) {
      alert("CSV appears to be empty or missing headers.");
      showSection(uploadSection);
      return;
    }

    // Common metadata columns to ignore
    const skipWords = ['timestamp', 'name', 'email', 'score', 'id', 'class', 'period'];
    const validColumns = meta.fields.filter(col => {
      const lower = col.toLowerCase();
      return !skipWords.some(skip => lower.includes(skip));
    });

    if (validColumns.length === 0) {
      alert("Could not find any question columns to analyze. Make sure your CSV has headers.");
      showSection(uploadSection);
      return;
    }

    allTopics = validColumns.map(col => {
      // Get all non-empty responses for this column
      const responses = data
        .map(row => row[col])
        .filter(val => val !== undefined && val !== null && val.toString().trim() !== '');
      
      return analyzeTopic(col, responses);
    });

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
          const shortLabel = label.length > 8 ? label.substring(0, 6) + '..' : label;
          chartHtml += `<div class="bar" style="height: ${Math.max(5, height)}%" data-tooltip="${label}: ${count}"></div>`;
        });
        chartHtml += `</div>`;
      }

      card.innerHTML = `
        <div class="topic-rank ${rankClass}">#${index + 1}</div>
        <div class="topic-info">
          <h3>${topic.title}</h3>
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
