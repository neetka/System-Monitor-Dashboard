let cpuChart, memoryChart;
      let cpuData = Array(30).fill(0);
      let autoRefresh = true;
      let refreshInterval = 2000;
      let refreshIntervalId;
      let currentPid = null;

      function initCharts() {
        // CPU Chart
        cpuChart = new Chart(document.getElementById('cpuChart'), {
          type: 'line',
          data: {
            labels: Array(30).fill(''),
            datasets: [{
              label: 'User CPU',
              data: cpuData,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                min: 0,
                max: 100,
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#94a3b8'
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#94a3b8'
                }
              }
            },
            plugins: {
              legend: {
                display: false
              }
            },
            animation: {
              duration: 500
            }
          }
        });

        // Memory Chart
        memoryChart = new Chart(document.getElementById('memoryChart'), {
          type: 'doughnut',
          data: {
            labels: ['Used', 'Available'],
            datasets: [{
              data: [0, 1],
              backgroundColor: ['#60a5fa', '#34d399'],
              borderWidth: 0,
              cutout: '75%'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });
      }

      async function fetchData() {
        try {
          const [statsRes, procRes] = await Promise.all([
            fetch('http://localhost:3000/system-stats'),
            fetch('http://localhost:3000/processes')
          ]);
          
          if (!statsRes.ok || !procRes.ok) throw new Error('HTTP error!');
          
          const stats = await statsRes.json();
          const processes = await procRes.json();
          
          // Update system metrics
          document.getElementById('system-load').textContent = stats.load.toFixed(2);
          document.getElementById('active-processes').textContent = stats.activeProcesses;  // This will now show the actual process count
          document.getElementById('system-uptime').textContent = formatUptime(stats.uptime); 
          document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

          // Update CPU metrics
          document.getElementById('cpu-value').textContent = `${stats.cpu}%`;
          cpuData = [...cpuData.slice(1), parseFloat(stats.cpu)];
          cpuChart.data.datasets[0].data = cpuData;
          cpuChart.update();

          // Update memory metrics with proper values
          const usedMemory = Number(stats.memory.used);
          const availableMemory = Number(stats.memory.available);
          const totalMemory = Number(stats.memory.total);
          
          // Format memory values for display
          document.getElementById('memory-value').textContent = `${usedMemory.toFixed(1)} GB`;
          document.getElementById('memory-available').textContent = `${availableMemory.toFixed(1)} GB`;
          
          // Update memory chart with numeric values
          memoryChart.data.datasets[0].data = [usedMemory, availableMemory];
          memoryChart.update();

          // Add memory percentage indicator if needed
          const memoryPercentage = Number(stats.memory.percentage);
          if (memoryPercentage > 80) {
            showNotification(`High Memory Usage: ${memoryPercentage}%`);
          }

          // Update process list
          updateProcessList(processes);

          // Check for warnings
          if (parseFloat(stats.cpu) > 80) {
            showNotification(`High CPU Usage: ${stats.cpu}%!`);
          }
          if (availableMemory < 2) {
            showNotification(`Low Memory: Only ${availableMemory.toFixed(1)} GB available!`);
          }
        } catch (error) {
          console.error('Fetch error:', error);
          showNotification(`Connection error: ${error.message}`);
        }
      }

      function formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      function updateProcessList(processes) {
        const processList = document.getElementById('process-list');
        processList.innerHTML = processes.map(proc => `
          <div class="process-item" onclick="showModal('${proc.pid}', ${proc.cpu}, ${proc.memory})">
            <div class="process-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 5V11L8 14L2 11V5L8 2Z" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="process-info">
              <span class="process-name">${proc.name}</span>
              <span class="process-details">PID: ${proc.pid}</span>
            </div>
            <div class="process-stats">
              <span class="stat ${proc.cpu > 80 ? 'resource-critical' : proc.cpu > 50 ? 'resource-warning' : ''}">
                <svg class="stat-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M2 14V2M14 14V2M6 14V2M10 14V2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                ${proc.cpu}%
              </span>
              <span class="stat">
                <svg class="stat-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M2 14H14M8 2V10" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                ${proc.memory} MB
              </span>
            </div>
            <button class="kill-btn" onclick="showKillModal('${proc.pid}', event)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </button>
          </div>
        `).join('');
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

      // function showKillModal(pid, event) {
      //   event.stopPropagation();
      //   currentPid = pid;
      //   document.getElementById('modal-pid').textContent = `PID: ${pid} - Confirm Kill?`;
      //   document.getElementById('cpu-history').textContent = '';
      //   document.getElementById('memory-trend').textContent = '';
      //   document.getElementById('modal').style.display = 'flex';
      // }

      // ... existing code ...

function showKillModal(pid, event) {
  event.stopPropagation();
  currentPid = pid;
  
  // Find the process data from the process list
  const processItem = event.target.closest('.process-item');
  const cpuValue = processItem.querySelector('.stat:first-child').textContent.trim();
  const memoryValue = processItem.querySelector('.stat:last-child').textContent.trim();
  
  document.getElementById('modal-pid').textContent = `PID: ${pid} - Confirm Kill?`;
  document.getElementById('cpu-history').textContent = `CPU Usage: ${cpuValue}`;
  document.getElementById('memory-trend').textContent = `Memory Usage: ${memoryValue}`;
  document.getElementById('modal').style.display = 'flex';
}

      document.getElementById('cancel-btn').addEventListener('click', () => {
        document.getElementById('modal').style.display = 'none';
        currentPid = null;
      });

      document.getElementById('confirm-btn').addEventListener('click', async () => {
        if (currentPid) {
          try {
            await killProcess(currentPid);
          } catch (error) {
            console.error('Error killing process:', error);
            showNotification('Error terminating process!');
          }
        }
        document.getElementById('modal').style.display = 'none';
        currentPid = null;
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

      async function killProcess(pid) {
        try {
          const response = await fetch(`http://localhost:3000/kill/${pid}`, {
            method: 'POST'
          });
          
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          
          const result = await response.json();
          showNotification(result.message);
          fetchData(); // Refresh data after killing process
        } catch (error) {
          console.error('Error killing process:', error);
          showNotification(`Error terminating process: ${error.message}`);
        }
      }

      initCharts();
      fetchData();
      refreshIntervalId = setInterval(fetchData, refreshInterval);