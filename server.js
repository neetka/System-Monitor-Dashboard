const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const si = require('systeminformation');
const ps = require('ps-node');
const kill = require('tree-kill'); // For killing processes

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const port = process.env.PORT || 4000;

app.use(express.static('public'));
app.use(express.json()); // Middleware to parse JSON bodies

io.on('connection', (socket) => {
    console.log('Client connected');

    const sendSystemData = async () => {
        try {
            const cpuData = await si.currentLoad();
            const memData = await si.mem();
            const processes = await si.processes();
            const currentTime = new Date().toLocaleTimeString();

            socket.emit('systemData', {
                cpu: cpuData,
                memory: memData,
                processes: processes.list.slice(0, 5), // Limit to top 5 processes
                time: currentTime
            });
        } catch (error) {
            console.error('Error fetching system data:', error);
        }
    };

    // Send system data every 1 second
    setInterval(sendSystemData, 1000);

    socket.on('killProcess', (pid) => {
        console.log(`Attempting to kill process with PID: ${pid}`);
        try {
            kill(pid, 'SIGKILL', (err) => {
                if (err) {
                    console.error(`Failed to kill process ${pid}:`, err);
                    socket.emit('killError', { pid: pid, error: err.message });
                } else {
                    console.log(`Process ${pid} killed successfully.`);
                    socket.emit('killSuccess', { pid: pid });
                    // Optionally, refresh process list after killing
                    sendSystemData();
                }
            });
        } catch (e) {
            console.error(`Error killing process ${pid}:`, e);
            socket.emit('killError', { pid: pid, error: e.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});