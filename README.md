# System Monitor Dashboard

A modern, real-time system monitoring dashboard built with Node.js that provides detailed insights into your system's performance. This dashboard offers a beautiful and intuitive interface for monitoring system resources and managing processes on macOS.

## Features

- **Real-time System Monitoring**
  - CPU usage tracking with historical data visualization
  - Memory usage monitoring with used/available breakdown
  - System load and active processes counter
  - System uptime display
  - Current time display

- **Process Management**
  - Comprehensive process list with detailed information
  - Process search functionality
  - Process termination capability
  - Process priority adjustment (high, normal, low)
  - Process state monitoring (running, sleeping, etc.)
  - CPU and memory usage per process

- **User Interface**
  - Modern, responsive design with dark/light theme support
  - Interactive charts using Chart.js
  - Real-time updates with configurable refresh rate
  - System notifications for high resource usage
  - Export functionality for system statistics

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- macOS operating system (for process management features)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/neetka/System-Monitor-Dashboard.git
cd System-Monitor-Dashboard
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
- ps-node - Process management utilities

## Usage

### System Monitoring
- View real-time CPU usage with historical data
- Monitor memory usage with used/available breakdown
- Track system load and active processes
- View system uptime

### Process Management
- Search processes using the search bar
- View detailed process information including:
  - Process ID (PID)
  - Process state
  - CPU usage
  - Memory usage
  - Priority level
- Adjust process priority (requires sudo for high priority)
- Terminate processes
- Sort processes by resource usage

### Interface Customization
- Toggle between dark and light themes
- Adjust the refresh rate using the slider
- Export system statistics to JSON format

## API Endpoints

- `GET /system-stats` - Get system statistics
- `GET /processes` - Get list of running processes
- `POST /kill/:pid` - Terminate a process
- `POST /process/:pid/priority` - Change process priority
- `POST /process/:pid/pause` - Pause a process
- `POST /process/:pid/resume` - Resume a paused process

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