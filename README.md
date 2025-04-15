# System Monitor Dashboard

A modern, real-time system monitoring dashboard built with Node.js and Chart.js that provides detailed insights into your system's performance.

![System Monitor Dashboard](screenshot.png)

## Features

- **Real-time Monitoring**
  - CPU usage tracking with historical data
  - Memory usage visualization with used/available breakdown
  - System load and active processes counter
  - System uptime display

- **Process Management**
  - List of top processes with resource usage
  - Process search functionality
  - Ability to terminate processes
  - Detailed process information modal

- **User Interface**
  - Modern, responsive design
  - Dark/Light theme toggle
  - Interactive charts and visualizations
  - Real-time updates with configurable refresh rate
  - System notifications for high resource usage

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/system-monitor-dashboard.git
cd system-monitor-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Dependencies

- Express.js - Web application framework
- systeminformation - System and hardware information library
- Chart.js - Interactive charts
- pidusage - Process CPU and memory statistics
- cors - Cross-origin resource sharing

## Configuration

The dashboard comes with default settings that can be modified:

- Default refresh rate: 2 seconds
- Memory warning threshold: 80%
- CPU warning threshold: 80%
- Process list limit: 20 processes

## Usage

### Basic Monitoring
- View real-time CPU and memory usage
- Monitor system load and active processes
- Track system uptime

### Process Management
- Search processes using the search bar
- Click on a process to view detailed information
- Use the kill button to terminate processes
- Sort processes by resource usage

### Customization
- Toggle between dark and light themes
- Adjust the refresh rate using the slider
- Export system statistics to JSON

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Chart.js for the beautiful charts
- systeminformation for reliable system metrics
- The Node.js community for excellent tools and libraries 