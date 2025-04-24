let cpuChart, memoryChart;
let cpuData = Array(30).fill(0);
let autoRefresh = true;
let refreshInterval = 2000;
let refreshIntervalId;
let currentPid = null;
let currentPage = 1;
const processesPerPage = 50;
let allProcesses = [];

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
            showNotification(`High Memory Usage: ${memoryPercentage}%`, 'error');
        }

        // Update process list
        updateProcessList(processes);

        // Check for warnings
        if (parseFloat(stats.cpu) > 80) {
            showNotification(`High CPU Usage: ${stats.cpu}%!`, 'error');
        }
        if (availableMemory < 2) {
            showNotification(`Low Memory: Only ${availableMemory.toFixed(1)} GB available!`, 'error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showNotification(`Connection error: ${error.message}`, 'error');
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateProcessList(processes) {
    console.log('Updating process list with', processes.length, 'processes');
    allProcesses = processes;
    renderProcessPage(currentPage);
}

function renderProcessPage(page) {
    const startIndex = (page - 1) * processesPerPage;
    const endIndex = startIndex + processesPerPage;
    const pageProcesses = allProcesses.slice(startIndex, endIndex);
    
    const processList = document.getElementById('process-list');
    processList.innerHTML = pageProcesses.map(proc => {
        if (!proc) return '';
        return `
            <div class="process-item" onclick="showModal('${proc.pid}', ${proc.cpu}, ${proc.memory})">
                <div class="process-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2L14 5V11L8 14L2 11V5L8 2Z" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="process-info">
                    <span class="process-name">${proc.name}</span>
                    <span class="process-details">PID: ${proc.pid}</span>
                    <span class="process-details">Priority: ${proc.priority || 'normal'}</span>
                    <span class="process-details">State: ${proc.state}</span>
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
                <div class="process-actions">
                    <button class="priority-btn" onclick="showPriorityModal('${proc.pid}', event)">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 2L14 5V11L8 14L2 11V5L8 2Z" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                    ${proc.state === 'Stopped' ? 
                        `<button class="resume-btn" onclick="resumeProcess('${proc.pid}', event)">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 2L12 8L4 14V2Z" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>` :
                        `<button class="pause-btn" onclick="pauseProcess('${proc.pid}', event)">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 2H6V14H4V2Z" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M10 2H12V14H10V2Z" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>`
                    }
                    <button class="kill-btn" onclick="showKillModal('${proc.pid}', event)">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Update pagination controls
    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(allProcesses.length / processesPerPage);
    const paginationDiv = document.getElementById('pagination-controls') || createPaginationControls();
    
    paginationDiv.innerHTML = `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;
}

function createPaginationControls() {
    const paginationDiv = document.createElement('div');
    paginationDiv.id = 'pagination-controls';
    paginationDiv.className = 'pagination-controls';
    document.querySelector('.section').appendChild(paginationDiv);
    return paginationDiv;
}

function changePage(newPage) {
    const totalPages = Math.ceil(allProcesses.length / processesPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderProcessPage(currentPage);
    }
}

function showNotification(message, type = 'error') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification'; // Reset classes
    notification.classList.add(type);
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3500);
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
    const processName = processItem.querySelector('.process-name').textContent;
    const cpuValue = processItem.querySelector('.stat:first-child').textContent.trim();
    const memoryValue = processItem.querySelector('.stat:last-child').textContent.trim();
    
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
        <svg class="modal-warning-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Confirm Process Termination</h3>
        <div class="modal-process-info">
            <p><strong>Process:</strong> ${processName}</p>
            <p><strong>PID:</strong> ${pid}</p>
            <p><strong>CPU Usage:</strong> ${cpuValue}</p>
            <p><strong>Memory Usage:</strong> ${memoryValue}</p>
        </div>
        <div class="modal-actions">
            <button id="cancel-btn">Cancel</button>
            <button id="confirm-btn">Terminate Process</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Add event listeners for the new buttons
    modal.querySelector('#cancel-btn').addEventListener('click', () => {
        modal.style.display = 'none';
        currentPid = null;
    });
    
    modal.querySelector('#confirm-btn').addEventListener('click', async () => {
        try {
            await killProcess(currentPid);
            modal.style.display = 'none';
            currentPid = null;
        } catch (error) {
            console.error('Error in process termination:', error);
            showNotification('Failed to terminate process', 'error');
        }
    });
}

function showPriorityModal(pid, event) {
    event.stopPropagation();
    currentPid = pid;
    
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
        <h3>Change Process Priority</h3>
        <div class="modal-process-info">
            <p><strong>PID:</strong> ${pid}</p>
            <div class="priority-controls">
                <label for="priority-level">Priority Level:</label>
                <select id="priority-level">
                    <option value="high">High</option>
                    <option value="normal" selected>Normal</option>
                    <option value="low">Low</option>
                </select>
            </div>
        </div>
        <div class="modal-actions">
            <button id="cancel-btn">Cancel</button>
            <button id="confirm-btn">Set Priority</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Add event listeners for the new buttons
    modal.querySelector('#cancel-btn').addEventListener('click', () => {
        modal.style.display = 'none';
        currentPid = null;
    });
    
    modal.querySelector('#confirm-btn').addEventListener('click', async () => {
        const priority = modal.querySelector('#priority-level').value;
        try {
            await setProcessPriority(pid, priority);
            modal.style.display = 'none';
            currentPid = null;
        } catch (error) {
            console.error('Error setting priority:', error);
            showNotification(`Error setting priority: ${error.message}`, 'error');
        }
    });
}

async function killProcess(pid) {
    if (!pid) {
        console.error('No PID provided for termination');
        showNotification('No process selected for termination', 'error');
        return;
    }

    try {
        console.log('Attempting to terminate process:', pid);
        const response = await fetch(`http://localhost:3000/kill/${pid}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('Error killing process:', result);
            showNotification(result.error || 'Error terminating process', 'error');
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification(result.message || 'Process terminated successfully', 'success');
        await fetchData(); // Refresh data after killing process
        return result;
    } catch (error) {
        console.error('Error killing process:', error);
        showNotification(`Error terminating process: ${error.message}`, 'error');
        throw error;
    }
}

async function setProcessPriority(pid, priority) {
    try {
        console.log(`Setting priority for PID ${pid} to ${priority}`);
        const response = await fetch(`http://localhost:3000/process/${pid}/priority`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ priority })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('Error setting priority:', result);
            showNotification(result.error || 'Error setting priority', 'error');
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        console.log('Priority change result:', result);
        showNotification(result.message || 'Priority changed successfully', 'success');
        
        // Force a refresh of the process list
        console.log('Refreshing process list...');
        await fetchData();
        
        return result;
    } catch (error) {
        console.error('Error setting priority:', error);
        showNotification(`Error: ${error.message}`, 'error');
        throw error;
    }
}

async function pauseProcess(pid, event) {
    event.stopPropagation();
    try {
        const response = await fetch(`http://localhost:3000/process/${pid}/pause`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showNotification(result.error || 'Error pausing process', 'error');
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification(result.message || 'Process paused successfully', 'success');
        await fetchData(); // Refresh data after pausing process
    } catch (error) {
        console.error('Error pausing process:', error);
        showNotification(`Error pausing process: ${error.message}`, 'error');
    }
}

async function resumeProcess(pid, event) {
    event.stopPropagation();
    try {
        const response = await fetch(`http://localhost:3000/process/${pid}/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showNotification(result.error || 'Error resuming process', 'error');
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification(result.message || 'Process resumed successfully', 'success');
        await fetchData(); // Refresh data after resuming process
    } catch (error) {
        console.error('Error resuming process:', error);
        showNotification(`Error resuming process: ${error.message}`, 'error');
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

    // Add pagination controls
    createPaginationControls();

    // Clear any existing modal event listeners
    const modal = document.getElementById('modal');
    const oldCancelBtn = modal.querySelector('#cancel-btn');
    const oldConfirmBtn = modal.querySelector('#confirm-btn');
    
    if (oldCancelBtn) {
        oldCancelBtn.replaceWith(oldCancelBtn.cloneNode(true));
    }
    if (oldConfirmBtn) {
        oldConfirmBtn.replaceWith(oldConfirmBtn.cloneNode(true));
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
        showNotification(`Error exporting data: ${error.message}`, 'error');
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
            showNotification('Error terminating process!', 'error');
        }
    }
    document.getElementById('modal').style.display = 'none';
    currentPid = null;
});