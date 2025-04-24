const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const os = require('os');
const pidusage = require('pidusage');
const router = express.Router();
const ps = require('ps-node');
const { exec } = require('child_process');
const process = require('process');

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
        
        // macOS specific ps command with state filter
        exec('ps -ax -o pid,state,pri,comm', async (error, stdout, stderr) => {
            if (error) {
                console.error('Error getting process list:', error);
                return res.status(500).json({ error: 'Failed to get process list' });
            }

            // Parse ps output
            const processes = stdout.split('\n')
                .slice(1) // Skip header row
                .filter(line => line.trim()) // Remove empty lines
                .map(line => {
                    // macOS ps output format handling
                    const parts = line.trim().split(/\s+/);
                    // Handle cases where comm (name) might contain spaces
                    const pid = parts[0];
                    const state = parts[1];
                    const priority = parts[2];
                    const name = parts.slice(3).join(' '); // Join remaining parts as name

                    return {
                        pid: parseInt(pid),
                        state: getMacProcessState(state), // Convert macOS state code to readable format
                        priority: parseInt(priority),
                        name: name.split('/').pop() // Get just the process name without path
                    };
                })
                .filter(proc => {
                    // Filter for only running processes
                    const state = proc.state.toLowerCase();
                    return state.includes('running') || state.includes('sleeping');
                });

            // Get additional details for each process
            const detailedProcesses = await Promise.all(
                processes.map(async (proc) => {
                    try {
                        const details = await getProcessDetails(proc.pid);
                        if (!details) return null;
                        
                        return {
                            ...proc,
                            cpu: details.cpu,
                            memory: details.memory
                        };
                    } catch (error) {
                        console.error(`Error getting details for PID ${proc.pid}:`, error);
                        return null;
                    }
                })
            );

            // Filter out null processes and sort by CPU usage
            const validProcesses = detailedProcesses
                .filter(p => p !== null && p.cpu > 0) // Only include processes with CPU usage
                .sort((a, b) => b.cpu - a.cpu);

            console.log(`Returning ${validProcesses.length} valid running processes`);
            res.json(validProcesses);
        });
    } catch (error) {
        console.error('Error in process list endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get process list',
            details: error.message 
        });
    }
});

// Helper function to convert macOS process state codes to readable format
function getMacProcessState(stateCode) {
    if (!stateCode) return 'Unknown';

    // Handle combined state codes
    const baseState = stateCode.charAt(0);
    const modifier = stateCode.slice(1);

    // Base states with more detailed descriptions
    const baseStates = {
        'R': 'Running',
        'S': 'Sleeping',
        'I': 'Idle',
        'T': 'Stopped',
        'U': 'Uninterruptible Sleep',
        'Z': 'Zombie Process',
        'W': 'Waiting',
        'D': 'Deep Sleep'
    };

    // State modifiers with more comprehensive descriptions
    const modifierMeanings = {
        '+': 'Foreground Process',
        's': 'Session Leader',
        'l': 'Multi-threaded',
        'N': 'Low Priority (Nice)',
        '<': 'High Priority',
        '>': 'Negative Nice Value',
        'L': 'Pages Locked in Memory',
        'X': 'Dead',
        '=': 'Default Priority',
        'E': 'Trying to Exit'
    };

    // Get base state description
    let state = baseStates[baseState] || 'Unknown';
    
    // Special handling for common combined states
    if (stateCode === 'SN') {
        return 'Sleeping (Low Priority)';
    }

    // Add modifier descriptions if present
    if (modifier) {
        const modifierDescriptions = [...modifier].map(mod => modifierMeanings[mod] || mod)
            .filter(desc => desc);
        if (modifierDescriptions.length > 0) {
            state += ` (${modifierDescriptions.join(', ')})`;
        }
    }

    return state;
}

// Kill a process
app.post('/kill/:pid', async (req, res) => {
    const pid = parseInt(req.params.pid);
    
    if (!pid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid PID provided'
        });
    }

    try {
        console.log(`Attempting to terminate process ${pid}`);
        
        // First try SIGTERM for graceful termination
        const termCommand = `kill ${pid}`;
        exec(termCommand, (termError) => {
            if (termError) {
                // If SIGTERM fails, try SIGKILL
                console.log(`SIGTERM failed for PID ${pid}, attempting SIGKILL...`);
                const killCommand = `kill -9 ${pid}`;
                
                exec(killCommand, (killError) => {
                    if (killError) {
                        console.error(`Failed to terminate process ${pid}:`, killError);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to terminate process',
                            details: killError.message
                        });
                    }

                    // Verify the process is terminated
                    verifyProcessTermination(pid, res);
                });
            } else {
                // Verify the process is terminated after SIGTERM
                verifyProcessTermination(pid, res);
            }
        });
    } catch (error) {
        console.error(`Error in kill process endpoint:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Helper function to verify process termination
function verifyProcessTermination(pid, res) {
    // Check if process still exists
    exec(`ps -p ${pid}`, (error) => {
        if (error && error.code === 1) {
            // Process not found, which means it was successfully terminated
            res.json({
                success: true,
                message: `Process ${pid} terminated successfully`
            });
        } else {
            // Process still exists
            res.status(500).json({
                success: false,
                error: `Failed to terminate process ${pid}`,
                details: 'Process still running after termination attempt'
            });
        }
    });
}

// Change process priority
app.post('/process/:pid/priority', (req, res) => {
    try {
        const pid = parseInt(req.params.pid);
        const { priority } = req.body;

        console.log(`Attempting to change priority for PID ${pid} to ${priority}`);

        // Validate input
        if (!pid || !priority) {
            return res.status(400).json({
                success: false,
                error: 'Missing PID or priority level',
                details: {
                    received: { pid: req.params.pid, priority: req.body.priority },
                    required: { pid: 'number', priority: 'string (high, normal, or low)' }
                }
            });
        }

        // Map priority levels to nice values for macOS
        const niceValues = {
            'high': '-20',    // Highest priority
            'normal': '0',    // Normal priority
            'low': '20'       // Lowest priority
        };

        const niceValue = niceValues[priority];
        if (niceValue === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Invalid priority level',
                validPriorities: Object.keys(niceValues)
            });
        }

        // Construct the command based on priority level
        let command;
        if (priority === 'high') {
            // For high priority, we'll use sudo
            command = `echo "Setting high priority for PID ${pid}" && sudo renice -n ${niceValue} ${pid}`;
        } else {
            // For normal and low priority
            command = `renice -n ${niceValue} ${pid}`;
        }

        console.log('Executing command:', command);

        // Execute the priority change command
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error changing priority:', error);
                
                // Check if it's a permission error
                if (error.message.includes('Permission denied') || error.message.includes('operation not permitted')) {
                    return res.status(403).json({
                        success: false,
                        error: 'Permission denied',
                        details: 'To change process priority, try these steps:',
                        steps: [
                            '1. Run the server with sudo:',
                            '   sudo node server.js',
                            '2. Or use these commands in Terminal:',
                            `   sudo renice -n ${niceValue} ${pid}`,
                            '3. If still having issues, check process ownership:',
                            `   ps -o user,pid,nice -p ${pid}`
                        ],
                        command: command,
                        errorMessage: error.message
                    });
                }

                return res.status(500).json({
                    success: false,
                    error: 'Failed to change process priority',
                    details: error.message,
                    command: command
                });
            }

            // Check the new priority value
            exec(`ps -o pid,nice,command -p ${pid}`, (checkError, checkOutput) => {
                if (checkError) {
                    console.error('Error checking new priority:', checkError);
                    return res.status(500).json({
                        success: false,
                        error: 'Could not verify priority change',
                        details: checkError.message
                    });
                }

                const processInfo = checkOutput.split('\n')[1];
                console.log('Process info after priority change:', processInfo);

                res.json({
                    success: true,
                    message: 'Process priority change attempted',
                    data: {
                        pid: pid,
                        priority: priority,
                        command: command,
                        processInfo: processInfo.trim(),
                        output: stdout.trim(),
                        note: 'If you see Permission denied, try running the server with sudo'
                    }
                });
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

// Pause a process
app.post('/process/:pid/pause', (req, res) => {
    const pid = parseInt(req.params.pid);
    
    if (!pid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid PID provided'
        });
    }

    try {
        console.log(`Attempting to pause process ${pid}`);
        
        // Use SIGSTOP to pause the process
        const command = `kill -STOP ${pid}`;
        exec(command, (error) => {
            if (error) {
                console.error(`Failed to pause process ${pid}:`, error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to pause process',
                    details: error.message
                });
            }

            // Verify the process is paused
            exec(`ps -o state -p ${pid}`, (checkError, checkOutput) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        error: 'Could not verify process state',
                        details: checkError.message
                    });
                }

                const state = checkOutput.split('\n')[1].trim();
                if (state === 'T') { // 'T' means stopped
                    res.json({
                        success: true,
                        message: `Process ${pid} paused successfully`,
                        state: 'paused'
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: 'Process not in paused state',
                        currentState: state
                    });
                }
            });
        });
    } catch (error) {
        console.error(`Error in pause process endpoint:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Resume a process
app.post('/process/:pid/resume', (req, res) => {
    const pid = parseInt(req.params.pid);
    
    if (!pid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid PID provided'
        });
    }

    try {
        console.log(`Attempting to resume process ${pid}`);
        
        // Use SIGCONT to resume the process
        const command = `kill -CONT ${pid}`;
        exec(command, (error) => {
            if (error) {
                console.error(`Failed to resume process ${pid}:`, error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to resume process',
                    details: error.message
                });
            }

            // Verify the process is running
            exec(`ps -o state -p ${pid}`, (checkError, checkOutput) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        error: 'Could not verify process state',
                        details: checkError.message
                    });
                }

                const state = checkOutput.split('\n')[1].trim();
                if (state === 'R' || state === 'S') { // 'R' means running, 'S' means sleeping
                    res.json({
                        success: true,
                        message: `Process ${pid} resumed successfully`,
                        state: 'running'
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: 'Process not in running state',
                        currentState: state
                    });
                }
            });
        });
    } catch (error) {
        console.error(`Error in resume process endpoint:`, error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`System monitor server running at http://localhost:${port}`);
});