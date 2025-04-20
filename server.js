const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const os = require('os');
const pidusage = require('pidusage');
const router = express.Router();
const ps = require('ps-node');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// Add JSON parsing middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Add debug logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', req.body);
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

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
        const [cpu, mem, processes] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.processes()
        ]);

        const stats = {
            cpu: Number(cpu.currentLoad.toFixed(1)),
            memory: {
                total: Number((mem.total / 1024 / 1024 / 1024).toFixed(2)),
                used: Number(((mem.total - mem.available) / 1024 / 1024 / 1024).toFixed(2)),
                available: Number((mem.available / 1024 / 1024 / 1024).toFixed(2)),
                percentage: Math.round(((mem.total - mem.available) / mem.total) * 100)
            },
            load: Number(os.loadavg()[0].toFixed(2)),
            uptime: os.uptime(),
            activeProcesses: processes.running || processes.all || 0  // Get running processes count
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
        console.log('Fetching process list...');
        const processes = await si.processes();
        console.log(`Found ${processes.list.length} total processes`);
        
        const detailedProcesses = await Promise.all(
            processes.list
                .slice(0, 20) // Get top 20 processes
                .map(async (proc) => {
                    try {
                        const details = await getProcessDetails(proc.pid);
                        return {
                            pid: proc.pid,
                            name: proc.name,
                            cpu: details ? details.cpu : 0,
                            memory: details ? details.memory : 0,
                            priority: proc.priority || 0 // Add priority to the response
                        };
                    } catch (error) {
                        console.error(`Error getting details for PID ${proc.pid}:`, error);
                        return null;
                    }
                })
        );

        const validProcesses = detailedProcesses.filter(p => p && (p.cpu > 0 || p.memory > 0));
        console.log(`Returning ${validProcesses.length} valid processes`);
        
        res.json(validProcesses);
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

// Change process priority
app.post('/process/:pid/priority', (req, res) => {
    try {
        const pid = parseInt(req.params.pid);
        const { priority } = req.body;

        console.log(`Attempting to change priority for PID ${pid} to ${priority}`);

        // Validate input
        if (!pid || !priority) {
            console.log('Invalid input:', { pid, priority });
            return res.status(400).json({
                success: false,
                error: 'Missing PID or priority level',
                details: {
                    received: {
                        pid: req.params.pid,
                        priority: req.body.priority
                    },
                    required: {
                        pid: 'number',
                        priority: 'string (high, normal, or low)'
                    }
                }
            });
        }

        // Map priority levels to nice values
        const niceValues = {
            'high': -10,
            'normal': 0,
            'low': 10
        };

        const niceValue = niceValues[priority];
        if (niceValue === undefined) {
            console.log('Invalid priority level:', priority);
            return res.status(400).json({
                success: false,
                error: 'Invalid priority level',
                validPriorities: Object.keys(niceValues)
            });
        }

        // Use renice command to change process priority
        const command = `renice ${niceValue} ${pid}`;
        console.log('Executing command:', command);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error changing priority: ${error.message}`);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to change process priority',
                    systemError: error.message,
                    command: command
                });
            }

            if (stderr) {
                console.error(`Priority change stderr: ${stderr}`);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to change process priority',
                    systemError: stderr,
                    command: command
                });
            }

            console.log(`Successfully changed priority for PID ${pid} to ${priority}`);
            console.log('Command output:', stdout);

            // Success response
            res.json({
                success: true,
                message: 'Process priority changed successfully',
                data: {
                    pid: pid,
                    priority: priority,
                    niceValue: niceValue,
                    command: command,
                    output: stdout.trim()
                }
            });
        });
    } catch (error) {
        console.error('Error in priority change endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`System monitor server running at http://localhost:${port}`);
});