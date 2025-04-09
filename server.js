const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const cors = require('cors'); // Add this line

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

app.get('/system-stats', (req, res) => {
  const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
  const totalMem = os.totalmem() / (1024 * 1024 * 1024); // Convert to GB
  const freeMem = os.freemem() / (1024 * 1024 * 1024); // Convert to GB
  res.json({
    cpu: cpuUsage.toFixed(2),
    memory: { 
      total: totalMem.toFixed(2), 
      used: (totalMem - freeMem).toFixed(2),
      free: freeMem.toFixed(2)
    }
  });
});

app.get('/processes', (req, res) => {
  exec('tasklist /fo csv', (err, stdout) => {
    if (err) return res.status(500).send('Error fetching processes');
    
    const processes = stdout.split('\r\n')
      .slice(1)
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split('","');
        return {
          name: parts[0]?.replace(/"/g, ''),
          pid: parts[1]?.replace(/"/g, ''),
          memory: parts[4]?.replace(/"/g, '')
        };
      })
      .filter(p => p.name && p.pid);
      
    res.json(processes);
  });
});

app.post('/kill/:pid', (req, res) => {
  exec(`taskkill /PID ${req.params.pid} /F`, (err) => {
    if (err) return res.status(500).send('Error killing process');
    res.send('Process terminated');
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));