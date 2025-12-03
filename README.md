# AI Ask - Chrome Extension

A powerful, modern Chrome extension that allows you to instantly process selected text using various AI providers (Google Gemini, OpenAI, Anthropic Claude, OpenRouter).

## Features

*   **Context-Aware**: Select text on any webpage and instantly send it to an AI model.
*   **Multi-Provider Support**: Native support for:
    *   **Google AI Studio** (Gemini models)
    *   **OpenAI** (GPT-4o, GPT-3.5, etc.)
    *   **Anthropic** (Claude 3.5 Sonnet, Haiku, etc.)
    *   **OpenRouter** (Access to Llama 3, Mistral, and more)
*   **Custom Prompts**: Create and manage your own reusable prompt templates (e.g., "Summarize", "Explain like I'm 5", "Translate").
*   **Secure Key Management**:
    *   Store multiple API keys for each provider.
    *   Keys are stored locally in your browser (Chrome Sync Storage).
    *   **Load Balancing**: The extension randomly selects one of your stored keys for each request to distribute usage.
*   **Customizable**:
    *   Configure custom Base URLs (useful for proxies or local LLMs).
    *   Specify custom Model IDs.
*   **Modern UI**: Clean, responsive interface built with React, TypeScript, and Tailwind CSS.

## Installation

### From Source (Developer Mode)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ai-ask
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```
    This will create a `dist` folder containing the compiled extension.

4.  **Load into Chrome:**
    *   Open Chrome and navigate to `chrome://extensions/`.
    *   Enable **Developer mode** (toggle switch in the top right).
    *   Click **Load unpacked**.
    *   Select the `dist` folder generated in step 3.

## Usage

1.  **Configuration**:
    *   Click the extension icon in the toolbar (or right-click and select Options).
    *   Go to the **Settings** page.
    *   Select your default provider.
    *   Add your API Key(s).
    *   (Optional) Customize the Model ID if you want to use a specific model version.

2.  **Asking AI**:
    *   Highlight any text on a webpage.
    *   Open the popup via:
        *   **Keyboard Shortcut**: `Ctrl+Shift+Y` (Windows/Linux) or `Command+Shift+Y` (Mac).
        *   **Context Menu**: Right-click the selection and choose "Ask AI with selection".
        *   **Toolbar Icon**: Click the AI Ask icon.
    *   The selected text will appear in the popup.
    *   Select a **Preset Instruction** (e.g., "Summarize") or type a custom instruction.
    *   Click **Ask AI**.

## Development

This project is built with:
*   [Vite](https://vitejs.dev/)
*   [React](https://react.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Tailwind CSS](https://tailwindcss.com/)

### Project Structure

*   `src/popup`: The main popup UI (React app).
*   `src/options`: The settings page (React app).
*   `src/background`: Service worker for background tasks and context menu handling.
*   `src/lib`: Shared utilities (storage, API calls, types).

### Commands

*   `npm run dev`: Start Vite dev server (useful for UI development, but extension APIs won't work fully outside Chrome).
*   `npm run build`: Type-check and build the extension for production.
*   `npm run lint`: Run ESLint.

## License

MIT