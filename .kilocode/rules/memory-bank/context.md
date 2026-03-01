# Active Context: Stream MultiView

## Current State

**Application Status**: ✅ Ready for development

A live stream monitoring application that allows users to watch up to 12 live streams simultaneously in a security camera-style interface.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] **NEW**: YouTube stream monitor setup page
- [x] **NEW**: Multi-stream viewer with grid layout
- [x] **NEW**: Soft persistence for stream URLs using React Context
- [x] **NEW**: Dark theme styling throughout
- [x] **NEW**: Fixed scrolling on setup page for 7+ streams
- [x] **NEW**: Stage layout mode with main stage + bottom grid
- [x] **NEW**: Layout selector (Grid vs Stage) in viewer header
- [x] **NEW**: Dynamic stream promotion to/from stage
- [x] **NEW**: Fixed vertical separators in stage mode - no longer spill into stage area
- [x] **NEW**: "→ Stage" button now fades in/out (50% → 100% opacity on hover)
- [x] **NEW**: Reset Layout button now respects current mode (stage vs grid)
- [x] **NEW**: Stream label overlay now transparent - removed black background
- [x] **NEW**: "→ Stage" button now fully transparent with text shadow for visibility

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Stream setup page | ✅ Ready |
| `src/app/viewer/page.tsx` | Multi-stream viewer | ✅ Ready |
| `src/app/layout.tsx` | Root layout with dark theme | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `src/lib/stream-context.tsx` | Stream state management | ✅ Ready |
| `src/lib/share-utils.ts` | URL encoding/decoding utilities | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Features Implemented

### Setup Page (`/`)
- Select 1-12 streams via clickable number buttons
- Individual URL input for each stream
- Supports multiple YouTube URL formats (live/, watch?v=, youtu.be)
- Validation before starting streams
- "Start Watching Streams" button
- **Scrollable layout** - page scrolls when adding 7+ streams so button stays accessible

### Viewer Page (`/viewer`)
- **Full-screen layout** - uses entire viewport (100vh × 100vw)
- Dynamic grid layout based on stream count:
  - 1 stream: 1×1 (full screen)
  - 2 streams: 2×1 (horizontal split)
  - 3-4 streams: 2×2 grid
  - 5-6 streams: 3×2 grid
  - 7-9 streams: 3×3 grid
  - 10+ streams: 4×3 grid
- **Draggable resize handles** - drag grid dividers to resize stream panels
- **Refresh button** - reload all streams without changing layout or order
- **Shareable URLs** - share exact layout with others via compressed URL
  - Encodes video IDs and separator positions
  - Uses zlib compression + base64 encoding
  - Updates URL automatically when layout changes
  - Anyone with the link sees the exact same streams and layout
  - **60fps smooth performance** - uses direct DOM manipulation, no React re-renders during drag
  - Handles follow mouse cursor during drag for smooth visual feedback
  - Minimum 10% size constraint per panel
  - Thicker 24px hit area for easy grabbing
  - Visual divider line stays red while actively dragging
  - Refs-based DOM updates for zero-lag response
- Minimal header/footer to maximize stream area
- Each stream in its own panel with label
- Live indicator (pulsing red dot)
- "Edit", "Refresh", "Clear", and "Reset Layout" buttons in compact header
- **Layout Selector** - Switch between "Grid" (equal) and "Stage" layouts
  - Grid: All streams in equal-sized grid cells
  - Stage: Main large stream on top, remaining streams in grid below
- **Stream Promotion** - Click "→ Stage" on any non-stage stream to move it to the main stage
- Stage layout includes "Stage Mode" indicator in header

### State Management
- React Context for soft persistence
- URLs preserved when navigating back/forth
- Cleared on browser refresh

## Current Focus

The application is fully functional. Next steps depend on user requirements:

1. Test with actual YouTube live stream URLs
2. Add any additional features (fullscreen mode, stream reordering, etc.)
3. Deploy for production use

## Quick Start Guide

### To use the monitor:

1. Open the application
2. Select how many streams (1-10)
3. Paste YouTube live stream URLs
4. Click "Start Watching Streams"
5. Streams play in grid layout
6. Use "Edit Streams" to modify URLs
7. Use "Clear All" to start fresh

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-28 | Added YouTube stream monitor application |
| 2026-03-01 | Fixed scrolling on setup page for many streams |
| 2026-02-28 | Increased stream limit from 10 to 12 |
| 2026-02-28 | Made setup page scrollable for long content |
| 2026-02-28 | Fixed scrolling by removing flexbox centering that blocked overflow |
| 2026-02-28 | Added draggable grid resize handles for custom stream panel sizes |
| 2026-02-28 | Made resize dividers thicker and easier to grab |
| 2026-02-28 | Added refresh button to reload all streams |
| 2026-03-01 | Added shareable URL feature with zlib compression |
| 2026-02-28 | Divider now follows mouse cursor exactly during drag operation |
| 2026-02-28 | Refactored resize logic for 60fps performance - pure DOM manipulation, no React re-renders during drag |
| 2026-03-01 | Added Stage layout feature with top half main stream + bottom grid |
| 2026-03-01 | Added Layout selector button (Grid vs Stage) with dropdown menu |
| 2026-03-01 | Added stream promotion controls - click "→ Stage" to move any stream to main stage |
| 2026-03-01 | Updated shareable URLs to include layout type and stage index |
| 2026-03-01 | Fixed vertical separators in stage mode - no longer spill into stage area |
| 2026-03-01 | Made "→ Stage" button fade in/out (50% → 100% opacity) on hover |
| 2026-03-01 | Updated reset layout button to respect current mode (stage vs grid) |
| 2026-03-01 | Made stream label and "→ Stage" button fully transparent with text shadows |
