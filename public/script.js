const socket = io();
const cpuChartCanvas = document.getElementById('cpuChart').getContext('2d');
const cpuPercentDiv = document.getElementById('cpu-percent');
const memTotalDiv = document.getElementById('mem-total');
const memFreeDiv = document.getElementById('mem-free');
const memUsedDiv = document.getElementById('mem-used');
const processList = document.getElementById('process-list');
const currentTimeDiv = document.getElementById('current-time');

let cpuChart;

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('systemData', (data) => {
    // Time
    currentTimeDiv.innerText = data.time;

    // CPU Usage
    cpuPercentDiv.innerText = `CPU: ${data.cpu.currentLoad.toFixed(2)}%`;
    updateCPUChart(data.cpu.currentLoad);

    // Memory Usage
    memTotalDiv.innerText = `Total Memory: ${(data.memory.total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    memFreeDiv.innerText = `Free Memory: ${(data.memory.free / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    memUsedDiv.innerText = `Used Memory: ${(data.memory.used / (1024 * 1024 * 1024)).toFixed(2)} GB`;

    // Processes
    processList.innerHTML = '';
    data.processes.forEach(process => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${process.name} - CPU: ${process.cpu.toFixed(2)}% - Memory: ${(process.memRss / 1024).toFixed(2)} MB
            <button class="kill-button" data-pid="${process.pid}">Kill</button>
        `;
        processList.appendChild(li);
    });

    // Add event listeners to kill buttons
    document.querySelectorAll('.kill-button').forEach(button => {
        button.addEventListener('click', function() {
            const pid = this.dataset.pid;
            socket.emit('killProcess', pid);
        });
    });
});

socket.on('killSuccess', (data) => {
    alert(`Process ${data.pid} killed successfully.`);
});

socket.on('killError', (data) => {
    alert(`Error killing process ${data.pid}: ${data.error}`);
});

function updateCPUChart(cpuLoad) {
    if (!cpuChart) {
        cpuChart = new Chart(cpuChartCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: {
                animation: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    cpuChart.data.labels.push(new Date().toLocaleTimeString());
    cpuChart.data.datasets[0].data.push(cpuLoad);

    if (cpuChart.data.labels.length > 10) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }

    cpuChart.update();
}