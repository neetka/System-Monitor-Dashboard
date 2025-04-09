let cpuChart, cpuData = Array(30).fill(0);
let autoRefresh = true;
let refreshInterval = 2000;
let currentPid = null;

// Initialize Socket.io connection
const socket = io('http://localhost:3000');

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
  document.getElementById('memory-value').textContent = `${used} / ${total} GB`;
}

// Handle real-time updates from server
socket.on('system-update', (data) => {
  const { stats, processes } = data;
  
  // Update CPU display
  document.getElementById('cpu-value').textContent = `${stats.cpu}%`;
  cpuData = [...cpuData.slice(1), parseFloat(stats.cpu)];
  cpuChart.data.datasets[0].data = cpuData;
  cpuChart.update();

  // Update memory display
  updateGauge(stats.memory.used, stats.memory.total);
  document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

  // Update process list
  updateProcessList(processes);

  // Notifications
  checkForAlerts(stats);
});

function updateProcessList(processes) {
  const processList = document.getElementById('process-list');
  const searchTerm = document.getElementById('search-process').value.toLowerCase();
  
  processList.innerHTML = processes
    .filter(proc => 
      proc.name.toLowerCase().includes(searchTerm) || 
      proc.pid.toString().includes(searchTerm)
    .map(proc => `
      <div class="process-item" onclick="showModal('${proc.pid}', ${proc.cpu}, ${proc.memory})">
        <span>${proc.name} (PID: ${proc.pid}) - CPU: ${proc.cpu}% - Mem: ${proc.memory} MB</span>
        <button class="kill-btn" onclick="showKillModal('${proc.pid}', event)">Kill</button>
      </div>
    `).join(''));
}

function checkForAlerts(stats) {
  if (parseFloat(stats.cpu) > 80) {
    showNotification(`High CPU Usage: ${stats.cpu}%!`);
  }
  if (parseFloat(stats.memory.free) < 1) {
    showNotification(`Low Memory: Only ${stats.memory.free} GB free!`);
  }
}

// Rest of your existing functions (showNotification, showModal, etc.) remain the same...

// Initial setup
initCharts();
socket.emit('set-update-interval', refreshInterval);

// Update interval control
document.getElementById('refresh-interval').addEventListener('input', (e) => {
  refreshInterval = e.target.value * 1000;
  socket.emit('set-update-interval', refreshInterval);
});