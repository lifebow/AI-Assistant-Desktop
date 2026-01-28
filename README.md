# AI Assistant Desktop

A powerful, native AI assistant for macOS that provides instant access to LLMs via global hotkeys, smart text selection, and screen cropping.

![AI Assistant Screenshot](screenshot.png)

## ✨ Features

### 🖥️ Native Desktop Experience
- **Global Hotkey**: Press `CMD+Shift+Y` (configurable) anywhere to open the assistant.
- **Context Aware**: Automatically captures selected text (via Accessibility API) from any active application.
- **Screen Cropping**: Capture any region of your screen (Snippet Tool) and ask AI about it.

### 🤖 Multi-Provider & Models
- **Google Gemini**: Built-in support for Gemini 1.5 Pro, Flash, and experimental models.
- **OpenAI / Custom**: Compatible with OpenAI-style APIs (deepseek, grok, etc. via OpenRouter).
- **Anthropic**: Claude 3.5 Sonnet, Haiku support.
- **Perplexity**: Integrated web search capabilities.
- **Backup Models**: Automatically retry queries with different models if the primary one fails or if you want a second opinion.

### ⚡ Power User Tools
- **Custom Prompts**: Define reusable prompts (e.g., "Summarize", "Fix Grammar") and assign hotkeys.
- **Modern UI**: Clean, native-feeling interface built with Electron and React.
- **Secure**: API keys are stored locally on your device.

## 📦 Installation

1. Go to the [Releases](../../releases) page.
2. Download the latest `.dmg` file for macOS.
3. Open the `.dmg` and drag "AI Assistant" to your Applications folder.

*Note: You may need to grant Accessibility permissions for the app to capture text from other applications.*

## 🚀 Development

Prerequisites: Node.js 18+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in Development Mode:**
   ```bash
   npm run dev:electron
   ```

3. **Build for Production (Mac):**
   ```bash
   npm run package:mac
   ```
   This will generate a `.dmg` and `.zip` in the `release/` directory.

## 🛠️ Tech Stack
- **Electron**: Cross-platform desktop framework.
- **Vite & React**: Fast, modern UI development.
- **TypeScript**: Type-safe codebase.
- **Tailwind CSS**: Utility-first styling.

## 📄 License
MIT