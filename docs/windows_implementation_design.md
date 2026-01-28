# Windows Support Implementation Design

## 1. Overview
Extend the current macOS-focused Electron application to fully support Windows, ensuring a consistent user experience while respecting platform differences.

## 2. Requirements & Decisions

### 2.1 Text Capture Strategy
- **Decision**: Use **Clipboard Simulation**.
- **Reasoning**: Native Accessibility (UI Automation) on Windows is complex and requires specific native modules. Clipboard simulation is a reliable fallback.
- **Implementation**:
  - Detect `process.platform === 'win32'`.
  - Simulate `Ctrl+C` (instead of `Cmd+C`).
  - Read clipboard, then restore original content.

### 2.2 Window Management & UI
- **Decision**: **Custom Frameless Window**.
- **Reasoning**: To maintain the "premium" AI Assistant look and feel, avoiding the distinct Windows 10/11 title bars.
- **Implementation**:
  - `BrowserWindow` config: `{ frame: false, titleBarStyle: 'hidden' }` (or similar for Windows to completely remove standard frame).
  - **Custom Window Controls**:
    - Add Minimize (`_`), Maximize/Restore (`□`), Close (`X`) buttons to the Header.
    - **Visibility Check**: These buttons MUST only appear when `window.electronAPI.platform === 'win32'`.
    - **IPC Events**: Frontend needs to emit `window-minimize`, `window-maximize`, `window-close`.

### 2.3 Distribution
- **Decision**: **Portable Executable only**.
- **Reasoning**: User preference for "click-and-run" simplicity.
- **Implementation**:
  - Update `package.json` -> `build.win.target`: `['portable']`.

## 3. Implementation Plan

### 3.1 Backend (Electron/Main)
1.  **Platform Detection**: Expose platform to renderer via `preload.ts` (`window.electronAPI.platform`).
2.  **IPC Handlers**:
    - `ipcMain.on('window-minimize', ...)`
    - `ipcMain.on('window-maximize', ...)`
    - `ipcMain.on('window-close', ...)`
3.  **Config Update**: Ensure `text-capture.ts` handles Windows key codes (`control` vs `command`).

### 3.2 Frontend (React)
1.  **Component**: Create `WindowsTitleBarControls` component.
    - Icons: Lucide `Minus`, `Square`, `X`.
    - CSS: Absolute positioning top-right, `no-drag`.
2.  **Integration**:
    - Add to `ChatInterface` header.
    - Add to `Options` header.
    - Condition: `{platform === 'win32' && <WindowsTitleBarControls />}`.

### 3.3 CI/CD
1.  Update `release.yml` to run `npm run package:win`.
2.  Configure artifacts upload.

## 4. Work Breakdown

- [ ] **Core**: Update `preload.ts` to expose platform.
- [ ] **Electron**: Add window control IPC handlers in `main.ts`.
- [ ] **Text Capture**: Verify/Fix `text-capture.ts` for Windows logic.
- [ ] **UI**: Create `WindowsWindowControls` component.
- [ ] **UI**: Integrate controls into `ChatInterface` and `Options`.
- [ ] **Packaging**: Update `package.json` build config.
- [ ] **CI**: Update GitHub Actions for Windows build.
