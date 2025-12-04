(() => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const tableBody = document.getElementById('table-body');
  const summariesContainer = document.getElementById('summaries');
  const viewButtons = document.querySelectorAll('.view-toggle button');
  const tableView = document.getElementById('table-view');
  const graphView = document.getElementById('graph-view');

  const charts = {
    river: null,
    precip: null,
    temp: null
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupViewSwitcher();
    loadData();
  }

  function setupViewSwitcher() {
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        viewButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.target;
        if (target === 'table-view') {
          tableView.classList.remove('hidden');
          graphView.classList.add('hidden');
        } else {
          graphView.classList.remove('hidden');
          tableView.classList.add('hidden');
        }
      });
    });
  }

  async function loadData() {
    setStatus('loading', 'Loading…');
    hideError();
    try {
      const supabase = createSupabaseClient();
      const [series, summaries] = await Promise.all([
        fetchTimeSeries(supabase),
        fetchSummaries(supabase)
      ]);
      renderTable(series);
      renderCharts(series);
      renderSummaries(summaries);
      setStatus('ok', 'Live');
    } catch (err) {
      console.error(err);
      showError(err.message || 'Unable to load data.');
      setStatus('error', 'Error');
    }
  }

  function createSupabaseClient() {
    const url =
      window.SUPABASE_URL ||
      document.body.dataset.supabaseUrl ||
      (window.__SUPABASE && window.__SUPABASE.url);
    const key =
      window.SUPABASE_ANON_KEY ||
      document.body.dataset.supabaseKey ||
      (window.__SUPABASE && window.__SUPABASE.key);
    if (!url || !key) {
      throw new Error(
        'Supabase credentials missing. Provide SUPABASE_URL and SUPABASE_ANON_KEY (e.g., via body data attributes or window variables).'
      );
    }
    return window.supabase.createClient(url, key);
  }

  async function fetchTimeSeries(client) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await client
      .from('timeseries_hydro_meteo')
      .select(
        'ts, station_id, river_level_m, temp_c, wind_speed_mph, wind_dir, om_precip_mm, combined_precip_mm, risk_level, summary_text'
      )
      .gte('ts', sevenDaysAgo)
      .order('ts', { ascending: true })
      .throwOnError();
    return data || [];
  }

  async function fetchSummaries(client) {
    const { data } = await client
      .from('timeseries_hydro_meteo_summary')
      .select('generated_at, window_start, window_end, summary_text, risk_level, forecast_text')
      .order('generated_at', { ascending: false })
      .limit(3)
      .throwOnError();
    return data || [];
  }

  function renderTable(rows) {
    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="10" class="placeholder">No data available.</td></tr>';
      return;
    }

    const formatter = buildDateFormatter();
    const cells = rows
      .map((row) => {
        const eaRain = row.ea_precip_mm ?? null;
        const flow = row.flow_m3s ?? null;
        return `
          <tr>
            <td>${formatter.format(new Date(row.ts))}</td>
            <td>${row.station_id ?? '-'}</td>
            <td>${formatNumber(row.river_level_m, 3)}</td>
            <td>${formatNumber(flow)}</td>
            <td>${formatNumber(eaRain)}</td>
            <td>${formatNumber(row.om_precip_mm)}</td>
            <td>${formatNumber(row.combined_precip_mm)}</td>
            <td>${formatNumber(row.temp_c, 1)}</td>
            <td>${formatNumber(row.wind_speed_mph, 1)}</td>
            <td>${row.wind_dir ?? '-'}</td>
          </tr>
        `;
      })
      .join('');
    tableBody.innerHTML = cells;
  }

  function renderCharts(rows) {
    const formatter = buildDateFormatter();
    const labels = rows.map((row) => formatter.format(new Date(row.ts)));
    const riverLevels = rows.map((row) => numOrNull(row.river_level_m));
    const precip = rows.map((row) => numOrNull(row.combined_precip_mm));
    const temps = rows.map((row) => numOrNull(row.temp_c));

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: '#e8eef9' }
        },
        y: {
          beginAtZero: false,
          grid: { color: '#e8eef9' },
          ticks: { precision: 2 }
        }
      },
      plugins: {
        legend: { display: true, labels: { color: '#1f2a3d' } },
        tooltip: { mode: 'index', intersect: false }
      }
    };

    destroyChart('river');
    charts.river = new Chart(document.getElementById('river-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'River Level (m)',
            data: riverLevels,
            borderColor: '#4a9fd8',
            backgroundColor: 'rgba(74, 159, 216, 0.15)',
            tension: 0.25,
            fill: true
          }
        ]
      },
      options: baseOptions
    });

    destroyChart('precip');
    charts.precip = new Chart(document.getElementById('precip-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Combined Precip (mm)',
            data: precip,
            backgroundColor: 'rgba(103, 152, 214, 0.6)',
            borderColor: '#5f8fc8',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Trend',
            data: precip,
            borderColor: '#2c6ea8',
            backgroundColor: 'rgba(44, 110, 168, 0.15)',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          y: { beginAtZero: true, grid: { color: '#e8eef9' } }
        }
      }
    });

    destroyChart('temp');
    charts.temp = new Chart(document.getElementById('temp-chart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: temps,
            borderColor: '#ef8c99',
            backgroundColor: 'rgba(239, 140, 153, 0.18)',
            tension: 0.25,
            fill: true
          }
        ]
      },
      options: baseOptions
    });
  }

  function renderSummaries(rows) {
    if (!rows || rows.length === 0) {
      summariesContainer.innerHTML = '<div class="placeholder">No summaries available.</div>';
      return;
    }
    const formatter = buildDateFormatter();
    const cards = rows
      .map((row) => {
        const badgeClass = riskToBadge(row.risk_level);
        return `
          <div class="summary-card">
            <div class="summary-meta">
              <span>${formatter.format(new Date(row.window_start))} → ${formatter.format(
                new Date(row.window_end)
              )}</span>
              <span class="badge ${badgeClass}">${row.risk_level ?? 'N/A'}</span>
            </div>
            <div class="summary-text">${row.summary_text ?? 'No summary provided.'}</div>
            <div class="forecast-text"><strong>Forecast:</strong> ${row.forecast_text ?? 'No forecast provided.'}</div>
          </div>
        `;
      })
      .join('');
    summariesContainer.innerHTML = cards;
  }

  function riskToBadge(level) {
    const normalized = (level || '').toString().toLowerCase();
    if (normalized.includes('high') || normalized === 'red') return 'red';
    if (normalized.includes('med') || normalized === 'amber') return 'amber';
    if (normalized.includes('low') || normalized === 'green') return 'green';
    return 'amber';
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function buildDateFormatter() {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return Number(value).toFixed(decimals);
  }

  function numOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function setStatus(state, text) {
    const dot = statusDot;
    dot.classList.remove('ok', 'error', 'loading');
    dot.classList.add(state);
    statusText.textContent = text || state;
    if (state === 'ok') {
      dot.style.background = '#2fb573';
      dot.style.boxShadow = '0 0 0 6px rgba(47, 181, 115, 0.2)';
    } else if (state === 'error') {
      dot.style.background = '#d9534f';
      dot.style.boxShadow = '0 0 0 6px rgba(217, 83, 79, 0.2)';
    } else {
      dot.style.background = '#9aa5b5';
      dot.style.boxShadow = '0 0 0 6px rgba(117, 140, 181, 0.15)';
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorBanner.classList.remove('hidden');
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }
})();
