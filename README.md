# Chataroo 🦘

A desktop chat client for Kick streaming platform, inspired by Chatterino.

## Features

- 🚀 Real-time chat using Pusher WebSocket
- 💬 Multi-channel support with tabs
- 🎨 Clean, dark-themed UI
- 🔨 Moderation tools
- 😀 Emotes and badges support
- 📱 Cross-platform (Windows, Mac, Linux)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Running in Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm run start
```

### Packaging

```bash
npm run package
```

## System Requirements (Linux)

On Linux systems, you may need to install Electron dependencies:

```bash
# Debian/Ubuntu
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0

# Or use --no-sandbox flag if running in limited environments
```

## OAuth Authentication

Chataroo uses OAuth to securely authenticate with Kick's API. The credentials are embedded in the application code, which is standard practice for desktop OAuth applications.

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Pusher** - WebSocket connection for real-time chat
- **Axios** - HTTP client for Kick API

## Project Structure

```
chataroo/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts
│   └── renderer/       # React app
│       ├── components/ # React components
│       └── services/   # API and WebSocket services
├── dist/               # Built files
└── package.json
```

## Disclaimer

This is an unofficial third-party client for Kick. It uses unofficial API methods and may break at any time. Use at your own risk.

## License

MIT
