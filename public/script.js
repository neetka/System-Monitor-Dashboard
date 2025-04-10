let cpuChart, cpuData = Array(30).fill(0);
      let autoRefresh = true;
      let refreshInterval = 2000;
      let refreshIntervalId;
      let currentPid = null;
      let memoryChart;

      function initCharts() {
        cpuChart = new Chart(document.getElementById('cpuChart'), {
          type: 'line',
          data: {
            labels: Array(30).fill(''),
            datasets: [{ label: 'CPU Usage (%)', data: cpuData, borderColor: '#00d4ff', fill: false }]
          },
          options: { scales: { y: { min: 0, max: 100 } }, animation: { duration: 500 } }
        });
      }
    
  
      function updateGauge(used, total) {
        const percentage = (used / total) * 100;
        document.getElementById('gauge-fill').style.transform = `rotate(${percentage * 1.8}deg)`;
        document.getElementById('memory-value').textContent = `${used.toFixed(2)} / ${total.toFixed(2)} GB`;
      }
    
      async function fetchData() {
  try {
    const [statsRes, procRes] = await Promise.all([
      fetch('http://localhost:3000/system-stats'),
      fetch('http://localhost:3000/processes')
    ]);
    
    if (!statsRes.ok) throw new Error(`HTTP error! status: ${statsRes.status}`);
    if (!procRes.ok) throw new Error(`HTTP error! status: ${procRes.status}`);

    const stats = await statsRes.json();
    const processes = await procRes.json();

    // Update CPU display
    document.getElementById('cpu-value').textContent = `${stats.cpu}%`;
    cpuData = [...cpuData.slice(1), parseFloat(stats.cpu)];
    cpuChart.data.datasets[0].data = cpuData;
    cpuChart.update();

    // Update memory display (values are already in GB)
    updateGauge(parseFloat(stats.memory.used), parseFloat(stats.memory.total));
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

    // Update process list
    const processList = document.getElementById('process-list');
    processList.innerHTML = processes.map(proc => `
      <div class="process-item" onclick="showModal('${proc.pid}', ${stats.cpu}, ${stats.memory.used})">
        <span>${proc.name} (PID: ${proc.pid}) - Mem: ${proc.memory || 'N/A'}</span>
        <button class="kill-btn" onclick="showKillModal('${proc.pid}', event)">Kill</button>
      </div>
    `).join('');

    // Notifications
    if (parseFloat(stats.cpu) > 80) {
      showNotification(`High CPU Usage: ${stats.cpu}%!`);
    }
    if (parseFloat(stats.memory.free) < 1) {
      showNotification(`Low Memory: Only ${stats.memory.free} GB free!`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showNotification(`Connection error: ${error.message}`);
  }
}
      function showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 3500);
      }
  
      function showModal(pid, cpu, memory) {
        currentPid = pid;
        document.getElementById('modal-pid').textContent = `PID: ${pid}`;
        document.getElementById('cpu-history').textContent = `Recent CPU: ${cpu.toFixed(2)}% (simulated)`;
        document.getElementById('memory-trend').textContent = `Recent Mem: ${memory.toFixed(2)} GB (simulated)`;
        document.getElementById('modal').style.display = 'flex';
      }
  
      function showKillModal(pid, event) {
        event.stopPropagation();
        currentPid = pid;
        document.getElementById('modal-pid').textContent = `PID: ${pid} - Confirm Kill?`;
        document.getElementById('cpu-history').textContent = '';
        document.getElementById('memory-trend').textContent = '';
        document.getElementById('modal').style.display = 'flex';
      }
  
      document.getElementById('cancel-btn').addEventListener('click', () => {
        document.getElementById('modal').style.display = 'none';
        currentPid = null;
      });
  
      document.getElementById('confirm-btn').addEventListener('click', async () => {
        if (currentPid) {
          try {
            await fetch(`http://localhost:3000/kill/${currentPid}`, { method: 'POST' });
            fetchData();
            showNotification(`Process ${currentPid} terminated!`);
          } catch (error) {
            console.error('Error killing process:', error);
            showNotification('Error terminating process!');
          }
        }
        document.getElementById('modal').style.display = 'none';
        currentPid = null;
      });
  
      document.getElementById('theme-toggle').addEventListener('click', () => {
        const body = document.body;
        const light = '#f0f2f5';
        const dark = '#1a1a2e';
        
        // Get computed style instead of inline style
        const currentBg = window.getComputedStyle(body).backgroundColor;
        const isDarkMode = currentBg === 'rgb(26, 26, 46)' || currentBg === '#1a1a2e';
        
        // Toggle to the opposite theme
        const newTheme = isDarkMode ? light : dark;
        body.style.background = newTheme;
        body.style.color = newTheme === light ? '#333' : '#e0e0e0';
        
        document.querySelectorAll('.section').forEach(el => {
          el.style.background = newTheme === light ? '#f8f9fa' : '#16213e';
        });
        
        document.getElementById('theme-toggle').textContent = newTheme === dark ? 'Toggle Light Mode' : 'Toggle Dark Mode';
      });
        
            document.getElementById('auto-refresh-btn').addEventListener('click', () => {
              autoRefresh = !autoRefresh;
              document.getElementById('auto-refresh-btn').textContent = `Auto-Refresh: ${autoRefresh ? 'On' : 'Off'}`;
              if (autoRefresh) {
                refreshIntervalId = setInterval(fetchData, refreshInterval);
              } else {
                clearInterval(refreshIntervalId);
              }
            });
        
            document.getElementById('refresh-interval').addEventListener('input', (e) => {
              refreshInterval = e.target.value * 1000;
              if (autoRefresh) {
                clearInterval(refreshIntervalId);
                refreshIntervalId = setInterval(fetchData, refreshInterval);
              }
            });
        
            document.getElementById('export-btn').addEventListener('click', async () => {
              const statsRes = await fetch('http://localhost:3000/system-stats');
              const procRes = await fetch('http://localhost:3000/processes');
              const stats = await statsRes.json();
              const processes = await procRes.json();
              const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ stats, processes }, null, 2))}`;
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute('href', dataStr);
              downloadAnchorNode.setAttribute('download', `system-stats-${new Date().toISOString()}.json`);
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              document.body.removeChild(downloadAnchorNode);
            });
      document.getElementById('search-process').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const processItems = document.querySelectorAll('.process-item');
        processItems.forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
      });
  
      initCharts();
      fetchData();
      refreshIntervalId = setInterval(fetchData, refreshInterval);