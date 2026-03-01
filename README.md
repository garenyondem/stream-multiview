# 🎥 Stream MultiView

> Watch up to 12 YouTube live streams simultaneously in a slick, security camera-style interface.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss)

## ✨ What It Does

Stream MultiView is your personal command center for monitoring multiple YouTube live streams at once. Perfect for:

- 📺 Keeping an eye on multiple gaming streams
- 🎵 Monitoring several music livestreams
- 📰 Following multiple news broadcasts
- 🏆 Watching different angles of esports tournaments
- 🎥 Any scenario where you need multiple streams!

## 📸 Screenshots

Click images to view full size in a new tab.

<a href="https://github.com/user-attachments/assets/161dd803-d5ed-47c5-98de-bab01285f4b2" target="_blank">
  <img src="https://github.com/user-attachments/assets/161dd803-d5ed-47c5-98de-bab01285f4b2" alt="Main Setup Page" width="600">
</a>

*Main setup page — select streams and paste YouTube URLs*

<a href="https://github.com/user-attachments/assets/8037af75-a60a-4ef5-99c4-61d60593950f" target="_blank">
  <img src="https://github.com/user-attachments/assets/8037af75-a60a-4ef5-99c4-61d60593950f" alt="Multi-Stream Viewer" width="600">
</a>

*Multi-stream viewer — watch up to 12 streams with draggable resize*

## 🚀 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router for blazing fast performance |
| **React 19** | Latest React with concurrent features |
| **TypeScript 5.9** | Type-safe code with strict mode enabled |
| **Tailwind CSS 4** | Utility-first styling for rapid UI development |
| **Bun** | Lightning fast package manager & runtime |

## 🎯 Features

- **Multi-Stream Grid** — Dynamic layout adapts to your stream count (1-12 streams)
- **Stage Layout** — Main spotlight stream on top + grid below for the rest
- **Stream Promotion** — Click "→ Stage" to spotlight any stream instantly
- **Draggable Resize** — Drag grid dividers to customize panel sizes (60fps smooth!)
- **Shareable URLs** — Share exact layout via base91 compressed URLs (~7.5% shorter!)
- **Layout Modes** — Toggle between Grid (equal) and Stage (spotlight) layouts
- **One-Click Refresh** — Reload all streams instantly without losing your layout
- **YouTube URL Support** — Handles multiple YouTube formats automatically
- **Soft Persistence** — Stream URLs stick around while you navigate (cleared on refresh)
- **Dark Theme** — Easy on the eyes for those long streaming sessions
- **Responsive Design** — Full-screen layout maximizes your viewing area
- **Live Indicators** — Pulsing red dots show which streams are active

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx          # Setup page — select streams & enter URLs
│   ├── viewer/page.tsx   # Multi-stream grid viewer with resize & share
│   ├── layout.tsx        # Root layout with dark theme
│   └── globals.css       # Global styles
├── lib/
│   ├── stream-context.tsx # React Context for state management
│   └── share-utils.ts    # URL encoding/decoding for shareable links
```

## 🛠️ Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Open http://localhost:3000
```

## 📝 How to Use

1. **Open the app** — You'll see the setup page
2. **Select stream count** — Click 1-12 to choose how many streams
3. **Paste YouTube URLs** — Supports live/, watch?v=, youtu.be formats
4. **Start watching** — Click "Start Watching Streams"
5. **Choose layout** — Switch between **Grid** (equal) or **Stage** (spotlight) mode
6. **Spotlight streams** — In Stage mode, click "→ Stage" to spotlight any stream
7. **Customize layout** — Drag the red grid dividers to resize panels
8. **Share your view** — Click "Share" to copy a link to your exact layout
9. **Refresh streams** — Click "Refresh" to reload all streams instantly
10. **Enjoy your grid** — All streams play simultaneously!

## 🧞 Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun lint` | Check code quality |
| `bun typecheck` | Run TypeScript checks |

## 📜 License

MIT — See [LICENSE](./LICENSE) for details.

---

Built with ⚡ and ☕ using the latest web technologies.
