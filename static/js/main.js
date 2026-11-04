// ==========================================================================
// CrediPredict AI — Client-Side Application Logic
// ==========================================================================

let featureChart = null;
let targetDoughnutChart = null;
let propertyChart = null;
let currentPage = 1;
let currentSearch = '';
let currentStatusFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initFormCalculators();
  initLoanForm();
  initDatasetTable();
  loadStatsAndCharts();
  
  // Auto-run evaluation on load with default values for immediate showcase
  evaluateLoan();
});

// ==========================================================================
// Navigation & Tabs
// ==========================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      
      // Update Tab Buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update Tab Panes
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      const activePane = document.getElementById(targetId);
      if (activePane) {
        activePane.classList.add('active');
      }

      // Resize charts if tab is activated
      if (targetId === 'models-tab' && featureChart) {
        featureChart.resize();
      }
      if (targetId === 'dataset-tab') {
        if (targetDoughnutChart) targetDoughnutChart.resize();
        if (propertyChart) propertyChart.resize();
      }
    });
  });
}

// ==========================================================================
// Live Dynamic Form Calculations
// ==========================================================================
function initFormCalculators() {
  const appIncomeInput = document.getElementById('applicantIncome');
  const coIncomeInput = document.getElementById('coapplicantIncome');
  const loanAmtInput = document.getElementById('loanAmount');
  const loanTermSelect = document.getElementById('loanTerm');

  function updateCalcs() {
    const appIncome = parseFloat(appIncomeInput.value) || 0;
    const coIncome = parseFloat(coIncomeInput.value) || 0;
    const loanAmtK = parseFloat(loanAmtInput.value) || 0;
    const loanTermMonths = parseFloat(loanTermSelect.value) || 360;

    // Badges
    document.getElementById('applicantIncomeDisp').textContent = `$${Math.round(appIncome).toLocaleString()}`;
    document.getElementById('coapplicantIncomeDisp').textContent = `$${Math.round(coIncome).toLocaleString()}`;
    document.getElementById('loanAmountDisp').textContent = `$${Math.round(loanAmtK * 1000).toLocaleString()}`;

    // Computed banner
    const totalIncome = appIncome + coIncome;
    document.getElementById('combinedIncome').textContent = `$${Math.round(totalIncome).toLocaleString()} / mo`;

    // Rough estimated monthly payment (assuming ~6.5% interest rate)
    const principal = loanAmtK * 1000;
    const monthlyRate = 0.065 / 12;
    let estMonthly = 0;
    if (principal > 0 && loanTermMonths > 0) {
      estMonthly = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanTermMonths));
    }
    document.getElementById('estPayment').textContent = `~$${Math.round(estMonthly).toLocaleString()} / mo`;

    // Debt to Income
    let dti = totalIncome > 0 ? ((estMonthly / totalIncome) * 100).toFixed(1) : '0.0';
    document.getElementById('dtiRatio').textContent = `${dti}%`;
  }

  [appIncomeInput, coIncomeInput, loanAmtInput, loanTermSelect].forEach(input => {
    input.addEventListener('input', updateCalcs);
    input.addEventListener('change', updateCalcs);
  });

  updateCalcs();
}

// ==========================================================================
// Preset Scenarios
// ==========================================================================
const PRESETS = {
  prime: {
    Gender: 'Male',
    Married: 'Yes',
    Dependents: '0',
    Education: 'Graduate',
    Self_Employed: 'No',
    ApplicantIncome: 7500,
    CoapplicantIncome: 2500,
    LoanAmount: 130,
    Loan_Amount_Term: '360',
    Credit_History: '1.0',
    Property_Area: 'Semiurban'
  },
  rural_family: {
    Gender: 'Female',
    Married: 'Yes',
    Dependents: '2',
    Education: 'Graduate',
    Self_Employed: 'No',
    ApplicantIncome: 3800,
    CoapplicantIncome: 1600,
    LoanAmount: 90,
    Loan_Amount_Term: '360',
    Credit_History: '1.0',
    Property_Area: 'Rural'
  },
  startup_founder: {
    Gender: 'Male',
    Married: 'No',
    Dependents: '0',
    Education: 'Graduate',
    Self_Employed: 'Yes',
    ApplicantIncome: 11000,
    CoapplicantIncome: 0,
    LoanAmount: 220,
    Loan_Amount_Term: '240',
    Credit_History: '1.0',
    Property_Area: 'Semiurban'
  },
  adverse_credit: {
    Gender: 'Male',
    Married: 'Yes',
    Dependents: '1',
    Education: 'Not Graduate',
    Self_Employed: 'No',
    ApplicantIncome: 4000,
    CoapplicantIncome: 0,
    LoanAmount: 180,
    Loan_Amount_Term: '360',
    Credit_History: '0.0',
    Property_Area: 'Urban'
  }
};

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;

  document.getElementById('gender').value = p.Gender;
  document.getElementById('married').value = p.Married;
  document.getElementById('dependents').value = p.Dependents;
  document.getElementById('education').value = p.Education;
  document.getElementById('selfEmployed').value = p.Self_Employed;
  document.getElementById('applicantIncome').value = p.ApplicantIncome;
  document.getElementById('coapplicantIncome').value = p.CoapplicantIncome;
  document.getElementById('loanAmount').value = p.LoanAmount;
  document.getElementById('loanTerm').value = p.Loan_Amount_Term;
  document.getElementById('creditHistory').value = p.Credit_History;
  document.getElementById('propertyArea').value = p.Property_Area;

  // Trigger calculations and evaluation
  document.getElementById('applicantIncome').dispatchEvent(new Event('input'));
  showToast(`Loaded "${key.replace('_', ' ').toUpperCase()}" scenario profile`);
  evaluateLoan();
}

function resetForm() {
  document.getElementById('loanForm').reset();
  document.getElementById('applicantIncome').dispatchEvent(new Event('input'));
  document.getElementById('decisionResult').classList.add('d-none');
  document.getElementById('decisionIdle').classList.remove('d-none');
}

// ==========================================================================
// Loan Evaluation Logic
// ==========================================================================
function initLoanForm() {
  const form = document.getElementById('loanForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    evaluateLoan();
  });

  document.getElementById('modelSelect').addEventListener('change', () => {
    evaluateLoan();
  });
}

async function evaluateLoan() {
  const btn = document.getElementById('btnPredict');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Scoring Risk...</span>`;
  btn.disabled = true;

  const payload = {
    model_type: document.getElementById('modelSelect').value,
    Gender: document.getElementById('gender').value,
    Married: document.getElementById('married').value,
    Dependents: document.getElementById('dependents').value,
    Education: document.getElementById('education').value,
    Self_Employed: document.getElementById('selfEmployed').value,
    ApplicantIncome: parseFloat(document.getElementById('applicantIncome').value) || 0,
    CoapplicantIncome: parseFloat(document.getElementById('coapplicantIncome').value) || 0,
    LoanAmount: parseFloat(document.getElementById('loanAmount').value) || 0,
    Loan_Amount_Term: parseFloat(document.getElementById('loanTerm').value) || 360,
    Credit_History: parseFloat(document.getElementById('creditHistory').value) || 1.0,
    Property_Area: document.getElementById('propertyArea').value
  };

  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await response.json();
    if (!res.success) throw new Error(res.error || 'Prediction failed');

    renderDecisionResult(res);

  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

function renderDecisionResult(data) {
  const idle = document.getElementById('decisionIdle');
  const result = document.getElementById('decisionResult');
  const hero = document.getElementById('resultHero');
  const icon = document.getElementById('statusIcon');
  const title = document.getElementById('statusTitle');
  const riskBadge = document.getElementById('riskBadge');
  const confVal = document.getElementById('confidenceValue');
  const probBar = document.getElementById('probBarFill');

  idle.classList.add('d-none');
  result.classList.remove('d-none');

  const isApproved = (data.prediction === 'Approved');

  // Hero styling
  hero.className = `result-hero ${isApproved ? 'approved' : 'rejected'}`;
  icon.className = isApproved ? 'fa-solid fa-check' : 'fa-solid fa-xmark';
  title.textContent = isApproved ? 'LOAN APPROVED' : 'APPLICATION DECLINED';
  riskBadge.textContent = data.risk_badge || (isApproved ? 'Prime Quality' : 'Elevated Risk');
  confVal.textContent = `${data.confidence}%`;

  // Prob Bar
  probBar.style.width = `${data.prob_approved}%`;
  document.getElementById('probApprovedText').textContent = `${data.prob_approved}%`;
  document.getElementById('probRejectionText').textContent = `${data.prob_rejected}%`;
  document.getElementById('probApprovalText2').textContent = `${data.prob_approved}%`;

  // Factors List
  const factorsContainer = document.getElementById('factorsList');
  factorsContainer.innerHTML = '';
  if (data.key_factors && data.key_factors.length > 0) {
    data.key_factors.forEach(f => {
      const div = document.createElement('div');
      const impactClass = f.impact.toLowerCase();
      let iconMarkup = '<i class="fa-solid fa-circle-check"></i>';
      if (impactClass === 'negative') iconMarkup = '<i class="fa-solid fa-circle-xmark"></i>';
      if (impactClass === 'warning') iconMarkup = '<i class="fa-solid fa-triangle-exclamation"></i>';

      div.className = `factor-item ${impactClass}`;
      div.innerHTML = `
        <div class="factor-icon">${iconMarkup}</div>
        <div class="factor-content">
          <strong>${f.factor} (${f.impact})</strong>
          <p>${f.description}</p>
        </div>
      `;
      factorsContainer.appendChild(div);
    });
  }

  // Summary Chips
  document.getElementById('modelUsedTag').textContent = data.model_used;
  document.getElementById('summaryLoanAmt').textContent = `$${Math.round(data.input_summary.LoanAmount * 1000).toLocaleString()}`;
  document.getElementById('summaryTotalInc').textContent = `$${Math.round(data.input_summary.TotalIncome).toLocaleString()} / mo`;
  document.getElementById('summaryTerm').textContent = `${data.input_summary.LoanTerm} Months`;

  // Trigger Confetti if Approved!
  if (isApproved && typeof confetti === 'function') {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#10b981', '#34d399', '#6366f1', '#38bdf8']
    });
  }
}

// ==========================================================================
// Model Metrics & Charts Loading
// ==========================================================================
async function loadStatsAndCharts() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    const metrics = data.metrics;
    const summary = data.summary;

    // Populate Logistic Regression
    if (metrics.logistic_regression) {
      const lr = metrics.logistic_regression;
      document.getElementById('lrAccuracy').textContent = `${lr.accuracy}%`;
      document.getElementById('lrF1').textContent = lr.f1_score;
      document.getElementById('lrPrecision').textContent = lr.precision;
      document.getElementById('lrRecall').textContent = lr.recall;
      document.getElementById('lrTN').textContent = lr.confusion_matrix.tn;
      document.getElementById('lrFP').textContent = lr.confusion_matrix.fp;
      document.getElementById('lrFN').textContent = lr.confusion_matrix.fn;
      document.getElementById('lrTP').textContent = lr.confusion_matrix.tp;
    }

    // Populate Random Forest
    if (metrics.random_forest) {
      const rfc = metrics.random_forest;
      document.getElementById('rfcAccuracy').textContent = `${rfc.accuracy}%`;
      document.getElementById('rfcF1').textContent = rfc.f1_score;
      document.getElementById('rfcPrecision').textContent = rfc.precision;
      document.getElementById('rfcRecall').textContent = rfc.recall;
      document.getElementById('rfcTN').textContent = rfc.confusion_matrix.tn;
      document.getElementById('rfcFP').textContent = rfc.confusion_matrix.fp;
      document.getElementById('rfcFN').textContent = rfc.confusion_matrix.fn;
      document.getElementById('rfcTP').textContent = rfc.confusion_matrix.tp;
    }

    // KPIs in Dataset Tab
    if (summary) {
      document.getElementById('kpiTotal').textContent = summary.total_records.toLocaleString();
      document.getElementById('kpiApprovalRate').textContent = `${summary.approval_rate}%`;
      document.getElementById('kpiAvgIncome').textContent = `$${Math.round(summary.avg_applicant_income).toLocaleString()}`;
      document.getElementById('kpiAvgLoan').textContent = `$${summary.avg_loan_amount}k`;

      renderTargetDoughnut(summary);
      renderPropertyAreaChart(summary);
    }

    // Feature Importance Chart
    if (metrics.feature_importances) {
      renderFeatureImportanceChart(metrics.feature_importances);
    }

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderFeatureImportanceChart(importances) {
  const ctx = document.getElementById('featureImportanceChart').getContext('2d');
  const labels = Object.keys(importances);
  const values = Object.values(importances);

  if (featureChart) featureChart.destroy();

  featureChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Relative Predictive Importance',
        data: values,
        backgroundColor: values.map((_, i) => i === 0 ? '#10b981' : '#6366f1'),
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` Importance Weight: ${(ctx.parsed.x * 100).toFixed(2)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f8fafc', font: { family: 'Plus Jakarta Sans', weight: '600' } }
        }
      }
    }
  });
}

function renderTargetDoughnut(summary) {
  const ctx = document.getElementById('targetDoughnutChart').getContext('2d');
  if (targetDoughnutChart) targetDoughnutChart.destroy();

  targetDoughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Approved (Y)', 'Rejected (N)'],
      datasets: [{
        data: [summary.approved_count, summary.rejected_count],
        backgroundColor: ['#10b981', '#f43f5e'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' }, padding: 15 }
        }
      },
      cutout: '72%'
    }
  });
}

function renderPropertyAreaChart(summary) {
  const ctx = document.getElementById('propertyAreaChart').getContext('2d');
  if (propertyChart) propertyChart.destroy();

  const labels = Object.keys(summary.property_area_distribution || {});
  const counts = Object.values(summary.property_area_distribution || {});

  propertyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Applicants',
        data: counts,
        backgroundColor: ['#38bdf8', '#818cf8', '#a855f7'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#f8fafc', font: { weight: '600' } }
        }
      }
    }
  });
}

// ==========================================================================
// Live Dataset Table & Pagination
// ==========================================================================
function initDatasetTable() {
  const searchInput = document.getElementById('tableSearch');
  const statusFilter = document.getElementById('tableStatusFilter');

  searchInput.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value;
    currentPage = 1;
    fetchDatasetRecords();
  }, 300));

  statusFilter.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    currentPage = 1;
    fetchDatasetRecords();
  });

  fetchDatasetRecords();
}

function changePage(delta) {
  currentPage += delta;
  fetchDatasetRecords();
}

async function fetchDatasetRecords() {
  const tbody = document.getElementById('datasetTableBody');
  tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Loading records...</td></tr>`;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      per_page: 12,
      search: currentSearch,
      status: currentStatusFilter
    });

    const res = await fetch(`/api/dataset?${params}`);
    const data = await res.json();

    renderTableRows(data.records);

    // Update pagination
    document.getElementById('pageIndicator').textContent = `Page ${data.page} of ${data.total_pages}`;
    document.getElementById('paginationInfo').textContent = `Showing ${(data.page - 1) * 12 + 1} to ${Math.min(data.page * 12, data.total)} of ${data.total} records`;
    document.getElementById('btnPrevPage').disabled = (data.page <= 1);
    document.getElementById('btnNextPage').disabled = (data.page >= data.total_pages);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger py-4">Failed to load records: ${err.message}</td></tr>`;
  }
}

function renderTableRows(records) {
  const tbody = document.getElementById('datasetTableBody');
  tbody.innerHTML = '';

  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted py-4">No matching loan records found.</td></tr>`;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.Loan_ID || '-'}</strong></td>
      <td>${r.Gender || '-'}</td>
      <td>${r.Married || '-'}</td>
      <td>${r.Dependents !== null ? r.Dependents : '-'}</td>
      <td>${r.Education || '-'}</td>
      <td>$${r.ApplicantIncome ? Number(r.ApplicantIncome).toLocaleString() : '0'}</td>
      <td>$${r.CoapplicantIncome ? Number(r.CoapplicantIncome).toLocaleString() : '0'}</td>
      <td>$${r.LoanAmount ? r.LoanAmount + 'k' : '-'}</td>
      <td>${r.Loan_Amount_Term ? r.Loan_Amount_Term + 'm' : '-'}</td>
      <td>${r.Credit_History !== null ? (r.Credit_History === 1 ? '1.0 (Pass)' : '0.0 (Fail)') : '-'}</td>
      <td>${r.Property_Area || '-'}</td>
      <td><span class="badge-status ${r.Loan_Status}">${r.Loan_Status === 'Y' ? 'Approved' : 'Rejected'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Retrain Models Trigger
// ==========================================================================
async function retrainModels() {
  const btn = document.getElementById('btnRetrain');
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Retraining Pipeline...`;
  btn.disabled = true;

  try {
    const res = await fetch('/api/retrain', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Models retrained and refreshed successfully!');
      await loadStatsAndCharts();
      await evaluateLoan();
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    showToast(`Retrain error: ${err.message}`, true);
  } finally {
    btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Retrain Models Live`;
    btn.disabled = false;
  }
}

// ==========================================================================
// Toast Notifications
// ==========================================================================
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderColor = isError ? 'var(--danger)' : 'var(--border-accent)';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
