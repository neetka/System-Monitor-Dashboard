const express = require('express');
const os = require('os');
const ps = require('ps-node');
const cors = require('cors');
const si = require('systeminformation');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost", // Update with your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Real-time data interval (in ms)
const UPDATE_INTERVAL = 2000;

// Store connected clients
const clients = new Set();

// Helper functions
async function getProcessList() {
  return new Promise((resolve, reject) => {
    ps.lookup({}, (err, resultList) => {
      if (err) {
        reject(err);
        return;
      }

      const processes = resultList.map(process => ({
        pid: process.pid,
        name: process.command || process.arguments[0],
        memory: (process.memory / (1024 * 1024)).toFixed(2),
        cpu: process.cpu ? process.cpu.toFixed(2) : '0.00'
      }));

      // Sort by memory usage (descending)
      processes.sort((a, b) => parseFloat(b.memory) - parseFloat(a.memory));

      resolve(processes.slice(0, 50)); // Return top 50 processes
    });
  });
}

async function getSystemStats() {
  try {
    // Get CPU usage
    const cpuUsage = await new Promise((resolve) => {
      si.currentLoad().then(data => resolve(data.currentload.toFixed(2)));
    });

    // Get memory info
    const memInfo = os.freemem() / (1024 * 1024 * 1024); // in GB
    const totalMem = os.totalmem() / (1024 * 1024 * 1024); // in GB
    const usedMem = totalMem - memInfo;

    return {
      cpu: cpuUsage,
      memory: {
        free: memInfo.toFixed(2),
        used: usedMem.toFixed(2),
        total: totalMem.toFixed(2)
      },
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
}

// Broadcast system data to all connected clients
async function broadcastSystemData() {
  if (clients.size === 0) return;

  try {
    const [stats, processes] = await Promise.all([
      getSystemStats(),
      getProcessList()
    ]);

    io.emit('system-update', {
      stats,
      processes,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error broadcasting system data:', error);
  }
}

// Set up periodic updates
let updateInterval = setInterval(broadcastSystemData, UPDATE_INTERVAL);

// Routes
app.get('/system-stats', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

app.get('/processes', async (req, res) => {
  try {
    const processes = await getProcessList();
    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get process list' });
  }
});

app.post('/kill/:pid', (req, res) => {
  const pid = req.params.pid;
  
  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'Invalid PID' });
  }

  try {
    process.kill(pid, 'SIGTERM');
    // Broadcast update after killing process
    broadcastSystemData();
    res.json({ success: true, message: `Process ${pid} terminated` });
  } catch (error) {
    console.error(`Error killing process ${pid}:`, error);
    res.status(500).json({ error: `Failed to kill process ${pid}` });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  clients.add(socket.id);

  // Send initial data immediately
  broadcastSystemData();

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    clients.delete(socket.id);
  });

  socket.on('set-update-interval', (interval) => {
    clearInterval(updateInterval);
    UPDATE_INTERVAL = interval;
    updateInterval = setInterval(broadcastSystemData, UPDATE_INTERVAL);
    console.log(`Update interval changed to ${interval}ms`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Real-time System Monitor API running on http://localhost:${PORT}`);
});