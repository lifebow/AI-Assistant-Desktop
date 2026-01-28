/**
 * IPC handlers for API calls
 * Proxies requests from renderer to external APIs
 */

import { ipcMain } from 'electron';
import type { AppConfig, ChatMessage } from '../../src/lib/types';

// Import API functions (we'll need to adapt these for Node.js context)
// For now, we use fetch directly in the main process

interface ApiResponse {
    text: string;
    error?: string;
}

function getDefaultBaseUrl(provider: string): string {
    switch (provider) {
        case 'openai': return 'https://api.openai.com/v1';
        case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
        case 'anthropic': return 'https://api.anthropic.com/v1';
        case 'openrouter': return 'https://openrouter.ai/api/v1';
        case 'perplexity': return 'https://api.perplexity.ai';
        default: return '';
    }
}

export function registerApiHandlers() {
    // Execute non-streaming API call
    ipcMain.handle('execute-api-call', async (_event, { messages, config }: { messages: ChatMessage[]; config: AppConfig }): Promise<ApiResponse> => {
        const provider = config.selectedProvider;
        const apiKeys = config.apiKeys[provider];

        if (!apiKeys || apiKeys.length === 0) {
            return { text: '', error: `No API key found for ${provider}` };
        }

        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
        const baseUrl = config.customBaseUrls[provider] || getDefaultBaseUrl(provider);
        const model = config.selectedModel[provider];

        try {
            switch (provider) {
                case 'openai':
                case 'openrouter':
                    return await callOpenAI(apiKey, baseUrl, model, messages);
                case 'google':
                    return await callGoogle(apiKey, baseUrl, model, messages);
                case 'anthropic':
                    return await callAnthropic(apiKey, baseUrl, model, messages);
                default:
                    return await callOpenAI(apiKey, baseUrl, model, messages);
            }
        } catch (e: any) {
            return { text: '', error: e.message || 'API call failed' };
        }
    });

    // Fetch available models
    ipcMain.handle('fetch-models', async (_event, { provider, apiKey, baseUrl }: { provider: string; apiKey: string; baseUrl?: string }): Promise<string[]> => {
        const url = baseUrl || getDefaultBaseUrl(provider);

        try {
            if (provider === 'google') {
                const res = await fetch(`${url}/models?key=${apiKey}`);
                if (!res.ok) throw new Error(res.statusText);
                const data = await res.json() as { models?: Array<{ name: string }> };
                return (data.models || [])
                    .map((m) => m.name.replace('models/', ''))
                    .sort();
            } else if (provider === 'perplexity') {
                return ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning'];
            } else {
                const res = await fetch(`${url}/models`, {
                    headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
                });
                if (!res.ok) throw new Error(res.statusText);
                const data = await res.json() as { data?: Array<{ id: string }> };
                return (data.data || []).map((m) => m.id).sort();
            }
        } catch (e: any) {
            console.error('Failed to fetch models:', e);
            return [];
        }
    });
}

// API call implementations

async function callOpenAI(apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> {
    const url = `${baseUrl}/chat/completions`;

    const msgs = messages.map(m => {
        if (m.image) {
            return {
                role: m.role,
                content: [
                    { type: 'text', text: m.content },
                    { type: 'image_url', image_url: { url: m.image } }
                ]
            };
        }
        return { role: m.role, content: m.content };
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages: msgs })
    });

    if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string }; text?: string }> };
    return { text: data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '' };
}

async function callGoogle(apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> {
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const contents = messages.map(m => {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: m.content }];
        if (m.image && m.image.startsWith('data:')) {
            const [meta, data] = m.image.split(',');
            const mimeType = meta.split(':')[1]?.split(';')[0];
            if (mimeType && data) {
                parts.push({ inlineData: { mimeType, data } });
            }
        }
        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts
        };
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
}

async function callAnthropic(apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> {
    const url = `${baseUrl}/messages`;

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
        if (m.image && m.image.startsWith('data:')) {
            const [meta, data] = m.image.split(',');
            const mimeType = meta.split(':')[1]?.split(';')[0];
            return {
                role: m.role,
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
                    { type: 'text', text: m.content }
                ]
            };
        }
        return { role: m.role, content: m.content };
    });

    const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        messages: chatMessages
    };

    if (systemMessage) {
        body.system = systemMessage.content;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } };
        throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    const textContent = data.content?.find((c) => c.type === 'text');
    return { text: textContent?.text || '' };
}
