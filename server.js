const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const os = require('os');
const pidusage = require('pidusage');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

// Helper function to get process details
async function getProcessDetails(pid) {
    try {
        const stats = await pidusage(pid);
        return {
            cpu: stats.cpu.toFixed(1),
            memory: (stats.memory / 1024 / 1024).toFixed(2), // Convert to MB
            elapsed: stats.elapsed
        };
    } catch (error) {
        console.error(`Error getting process details for PID ${pid}:`, error);
        return null;
    }
}

// Get system statistics
app.get('/system-stats', async (req, res) => {
    try {
        const [cpu, mem, currentLoad] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.currentLoad()
        ]);

        // Fix memory calculations
        const totalMemory = Number((mem.total / 1024 / 1024 / 1024).toFixed(2));
        const usedMemory = Number(((mem.total - mem.available) / 1024 / 1024 / 1024).toFixed(2));
        const availableMemory = Number((mem.available / 1024 / 1024 / 1024).toFixed(2));

        // Ensure memory values are consistent
        const stats = {
            cpu: Number(cpu.currentLoad.toFixed(1)),
            memory: {
                total: totalMemory,
                used: totalMemory - availableMemory, // Fix used memory calculation
                available: availableMemory,
                percentage: Math.round(((totalMemory - availableMemory) / totalMemory) * 100)
            },
            load: Number(os.loadavg()[0].toFixed(2)),
            uptime: os.uptime(),
            activeProcesses: currentLoad.cpus.length
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ error: 'Failed to get system statistics' });
    }
});

// Get process list
app.get('/processes', async (req, res) => {
    try {
        const processes = await si.processes();
        const detailedProcesses = await Promise.all(
            processes.list
                .slice(0, 20) // Get top 20 processes
                .map(async (proc) => {
                    const details = await getProcessDetails(proc.pid);
                    return {
                        pid: proc.pid,
                        name: proc.name,
                        cpu: details ? details.cpu : 0,
                        memory: details ? details.memory : 0
                    };
                })
        );

        res.json(detailedProcesses.filter(p => p.cpu > 0 || p.memory > 0));
    } catch (error) {
        console.error('Error getting process list:', error);
        res.status(500).json({ error: 'Failed to get process list' });
    }
});

// Kill a process
app.post('/kill/:pid', async (req, res) => {
    const pid = parseInt(req.params.pid);
    
    try {
        process.kill(pid);
        res.json({ success: true, message: `Process ${pid} terminated` });
    } catch (error) {
        console.error(`Error killing process ${pid}:`, error);
        res.status(500).json({ error: `Failed to terminate process ${pid}` });
    }
});

app.listen(port, () => {
    console.log(`System monitor server running at http://localhost:${port}`);
});