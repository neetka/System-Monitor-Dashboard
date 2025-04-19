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
        document.getElementById('active-processes').textContent = stats.activeProcesses;
        document.getElementById('system-uptime').textContent = formatUptime(stats.uptime); 
        document.getElementById('current-time').textContent = new Date().toLocaleTimeString();

        // Update CPU metrics
        document.getElementById('cpu-value').textContent = `${stats.cpu}%`;
        cpuData = [...cpuData.slice(1), parseFloat(stats.cpu)];
        cpuChart.data.datasets[0].data = cpuData;
        cpuChart.update();

        // Update memory metrics
        const usedMemory = Number(stats.memory.used);
        const availableMemory = Number(stats.memory.available);
        const totalMemory = Number(stats.memory.total);
        
        document.getElementById('memory-value').textContent = `${usedMemory.toFixed(1)} GB`;
        document.getElementById('memory-available').textContent = `${availableMemory.toFixed(1)} GB`;
        
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

function showKillModal(pid, event) {
    event.stopPropagation();
    currentPid = pid;
    
    const processItem = event.target.closest('.process-item');
    const cpuValue = processItem.querySelector('.stat:first-child').textContent.trim();
    const memoryValue = processItem.querySelector('.stat:last-child').textContent.trim();
    
    document.getElementById('modal-pid').textContent = `PID: ${pid} - Confirm Kill?`;
    document.getElementById('cpu-history').textContent = `CPU Usage: ${cpuValue}`;
    document.getElementById('memory-trend').textContent = `Memory Usage: ${memoryValue}`;
    document.getElementById('modal').style.display = 'flex';
}

async function killProcess(pid) {
    try {
        const response = await fetch(`http://localhost:3000/kill/${pid}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        showNotification(result.message);
        fetchData(); // Refresh data after killing process
    } catch (error) {
        console.error('Error killing process:', error);
        showNotification(`Error terminating process: ${error.message}`);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme and auto-refresh settings
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let autoRefresh = localStorage.getItem('autoRefresh') === 'true';
    let refreshRate = parseInt(localStorage.getItem('refreshRate')) || 2;
    
    // Set initial theme
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.getElementById('theme-toggle').textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    
    // Set initial auto refresh state
    document.getElementById('auto-refresh-btn').textContent = `Auto-Refresh: ${autoRefresh ? 'On' : 'Off'}`;
    document.getElementById('refresh-interval').value = refreshRate;
    
    // Initialize charts and start data fetching
    initCharts();
    fetchData();
    
    if (autoRefresh) {
        refreshIntervalId = setInterval(fetchData, refreshRate * 1000);
    }
});

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', function() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    this.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
});

// Auto refresh toggle
document.getElementById('auto-refresh-btn').addEventListener('click', function() {
    autoRefresh = !autoRefresh;
    localStorage.setItem('autoRefresh', autoRefresh);
    this.textContent = `Auto-Refresh: ${autoRefresh ? 'On' : 'Off'}`;
    
    if (autoRefresh) {
        refreshIntervalId = setInterval(fetchData, refreshInterval);
    } else {
        clearInterval(refreshIntervalId);
    }
});

// Refresh interval change
document.getElementById('refresh-interval').addEventListener('input', function() {
    refreshInterval = this.value * 1000;
    localStorage.setItem('refreshRate', this.value);
    
    if (autoRefresh) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = setInterval(fetchData, refreshInterval);
    }
});

// Export data
document.getElementById('export-btn').addEventListener('click', async function() {
    try {
        const [statsRes, procRes] = await Promise.all([
            fetch('http://localhost:3000/system-stats'),
            fetch('http://localhost:3000/processes')
        ]);
        
        if (!statsRes.ok || !procRes.ok) throw new Error('HTTP error!');
        
        const stats = await statsRes.json();
        const processes = await procRes.json();
        
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ stats, processes }, null, 2))}`;
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', `system-stats-${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        document.body.removeChild(downloadAnchorNode);
    } catch (error) {
        console.error('Export error:', error);
        showNotification(`Error exporting data: ${error.message}`);
    }
});

// Process search
document.getElementById('search-process').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const processItems = document.querySelectorAll('.process-item');
    processItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
});

// Modal actions
document.getElementById('cancel-btn').addEventListener('click', function() {
    document.getElementById('modal').style.display = 'none';
    currentPid = null;
});

document.getElementById('confirm-btn').addEventListener('click', async function() {
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