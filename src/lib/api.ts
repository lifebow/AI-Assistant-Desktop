import type { AppConfig, ChatMessage } from './types';

interface ApiResponse {
  text: string;
  error?: string;
}

export const executeApiCall = async (
  messages: ChatMessage[],
  config: AppConfig
): Promise<ApiResponse> => {
  const provider = config.selectedProvider;
  const apiKeys = config.apiKeys[provider];

  if (!apiKeys || apiKeys.length === 0) {
    return { text: '', error: `No API key found for ${provider}` };
  }

  // Randomly select an API key
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
  const baseUrl = config.customBaseUrls[provider] || getDefaultBaseUrl(provider);
  const model = config.selectedModel[provider];

  try {
    switch (provider) {
      case 'google':
        return await callGoogle(apiKey, baseUrl, model, messages);
      case 'openai':
        return await callOpenAI(apiKey, baseUrl, model, messages);
      case 'anthropic':
        return await callAnthropic(apiKey, baseUrl, model, messages);
      case 'openrouter':
        return await callOpenRouter(apiKey, baseUrl, model, messages);
      default:
        // Assume custom providers are OpenAI compatible
        return await callOpenAI(apiKey, baseUrl, model, messages);
    }
  } catch (e: any) {
    return { text: '', error: e.message || 'API call failed' };
  }
};

export const executeApiStream = async (
  messages: ChatMessage[],
  config: AppConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<ApiResponse> => {
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
      case 'google':
        return await streamGoogle(apiKey, baseUrl, model, messages, onChunk, signal);
      case 'openai':
      case 'openrouter':
        return await streamOpenAI(apiKey, baseUrl, model, messages, onChunk, provider === 'openrouter', signal);
      case 'anthropic':
        return await streamAnthropic(apiKey, baseUrl, model, messages, onChunk, signal);
      default:
        return await streamOpenAI(apiKey, baseUrl, model, messages, onChunk, false, signal);
    }
  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    return { text: '', error: e.message || 'Stream failed' };
  }
};

export const callApi = async (
  messages: ChatMessage[],
  config: AppConfig,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<ApiResponse> => {
  // Check context
  if (window.location.protocol.startsWith('http')) {
    // Content Script -> Proxy to Background
    if (onChunk) {
      return new Promise((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'stream_api' });
        let fullText = '';

        if (signal) {
          signal.addEventListener('abort', () => {
            port.disconnect();
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }

        port.onMessage.addListener((msg) => {
          if (msg.done) {
            port.disconnect();
            resolve({ text: fullText });
          } else if (msg.error) {
            port.disconnect();
            resolve({ text: fullText, error: msg.error });
          } else if (msg.chunk) {
            fullText += msg.chunk;
            onChunk(msg.chunk);
          }
        });

        port.postMessage({ messages, config });
      });
    } else {
      return chrome.runtime.sendMessage({
        type: 'PROXY_API_CALL',
        data: { messages, config }
      });
    }
  } else {
    // Extension Context -> Direct Call
    if (onChunk) {
      return executeApiStream(messages, config, onChunk, signal);
    } else {
      return executeApiCall(messages, config);
    }
  }
};

export const executeFetchModels = async (
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<string[]> => {
  const url = baseUrl || getDefaultBaseUrl(provider);

  try {
    if (provider === 'google') {
      const res = await fetch(`${url}/models?key=${apiKey}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      return (data.models || [])
        .map((m: any) => m.name.replace('models/', ''))
        .sort();
    } else {
      // OpenAI compatible (OpenAI, OpenRouter, Custom)
      // Always send API key if available
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${url}/models`, {
        headers
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id).sort();
    }
  } catch (e) {
    console.error("Failed to fetch models", e);
    throw e;
  }
};

export const fetchModels = async (
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<string[]> => {
  if (window.location.protocol.startsWith('http')) {
    return chrome.runtime.sendMessage({
      type: 'PROXY_FETCH_MODELS',
      data: { provider, apiKey, baseUrl }
    });
  } else {
    return executeFetchModels(provider, apiKey, baseUrl);
  }
};

const getDefaultBaseUrl = (provider: string) => {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    default: return '';
  }
}

const callGoogle = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> => {
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  // Convert standard messages to Gemini format
  const contents = messages.map(m => {
    const parts: any[] = [{ text: m.content }];
    if (m.image) {
      // extract base64
      const [meta, data] = m.image.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      parts.push({ inlineData: { mimeType, data } });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: contents
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  const data = await response.json();
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
};

const callOpenAI = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> => {
  const url = `${baseUrl}/chat/completions`;

  const msgs = messages.map(m => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: m.image } }
        ]
      };
    }
    return m;
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: msgs
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '' };
};

const callAnthropic = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> => {
  const url = `${baseUrl}/messages`;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
    if (m.image) {
      const [meta, data] = m.image.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      return {
        role: m.role,
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data } },
          { type: "text", text: m.content }
        ]
      };
    }
    return m;
  });

  const body: any = {
    model: model,
    max_tokens: 1024,
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
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  const data = await response.json();
  return { text: data.content?.[0]?.text || '' };
};

const callOpenRouter = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[]): Promise<ApiResponse> => {
  // OpenRouter is OpenAI compatible
  const url = `${baseUrl}/chat/completions`;

  const msgs = messages.map(m => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: m.image } }
        ]
      };
    }
    return m;
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // Optional headers for OpenRouter
      'HTTP-Referer': 'https://github.com/your/repo',
      'X-Title': 'AI Ask Extension',
    },
    body: JSON.stringify({
      model: model,
      messages: msgs
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '' };
}

// Streaming Implementations

const readStream = async (response: Response, onChunk: (text: string) => void, parser: (chunk: string) => string | null) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) throw new Error('Response body is unavailable');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process buffer lines
    // We split by newlines but keep the buffer if it doesn't end with one to handle split packets
    // However, generic logic:

    // Strategy: Process one valid unit at a time.
    // For SSE, usually split by \n\n or \n.
    // For Google JSON array, it's tricker.

    // Let's implement provider-specific buffering in the parser or just pass raw chunk?
    // Better: pass raw chunk to parser or handle buffering here.
    // For simplicity for now: assume parser handles string chunks or we do simple line splitting.
    // SSE is based on lines.

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the last partial line

    for (const line of lines) {
      const parsed = parser(line);
      if (parsed) onChunk(parsed);
    }
  }

  // Process remaining buffer
  if (buffer) {
    const parsed = parser(buffer);
    if (parsed) onChunk(parsed);
  }
};

const streamOpenAI = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[], onChunk: (text: string) => void, isOpenRouter = false, signal?: AbortSignal): Promise<ApiResponse> => {
  const url = `${baseUrl}/chat/completions`;

  const msgs = messages.map(m => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: m.image } }
        ]
      };
    }
    return m;
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://github.com/your/repo'; // Should probably be configurable or fixed to something real
    headers['X-Title'] = 'AI Ask Extension';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: msgs,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const err = await response.text(); // Parse text as it might be JSON or plain
    try {
      const jsonErr = JSON.parse(err);
      throw new Error(jsonErr.error?.message || response.statusText);
    } catch {
      throw new Error(err || response.statusText);
    }
  }

  let fullText = '';

  await readStream(response, (text) => {
    fullText += text;
    onChunk(text);
  }, (line) => {
    const trim = line.trim();
    if (!trim || !trim.startsWith('data: ')) return null;

    const dataStr = trim.slice(6);
    if (dataStr === '[DONE]') return null;

    try {
      const json = JSON.parse(dataStr);
      const content = json.choices?.[0]?.delta?.content;
      return content || null;
    } catch (e) {
      return null;
    }
  });

  return { text: fullText };
};

const streamAnthropic = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[], onChunk: (text: string) => void, signal?: AbortSignal): Promise<ApiResponse> => {
  const url = `${baseUrl}/messages`;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
    if (m.image) {
      const [meta, data] = m.image.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      return {
        role: m.role,
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data } },
          { type: "text", text: m.content }
        ]
      };
    }
    return m;
  });

  const body: any = {
    model: model,
    max_tokens: 1024,
    messages: chatMessages,
    stream: true
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
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  let fullText = '';

  await readStream(response, (text) => {
    fullText += text;
    onChunk(text);
  }, (line) => {
    const trim = line.trim();
    if (!trim || !trim.startsWith('data: ')) return null;

    const dataStr = trim.slice(6);
    try {
      const json = JSON.parse(dataStr);
      if (json.type === 'content_block_delta' && json.delta?.text) {
        return json.delta.text;
      }
      return null;
    } catch {
      return null;
    }
  });

  return { text: fullText };
};

const streamGoogle = async (apiKey: string, baseUrl: string, model: string, messages: ChatMessage[], onChunk: (text: string) => void, signal?: AbortSignal): Promise<ApiResponse> => {
  // API: POST https://.../streamGenerateContent?key=...
  const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}`;

  const contents = messages.map(m => {
    const parts: any[] = [{ text: m.content }];
    if (m.image) {
      const [meta, data] = m.image.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      parts.push({ inlineData: { mimeType, data } });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || response.statusText);
  }

  let fullText = '';

  // Google returns a JSON array: [ {...}, {...} ] but streamed.
  // It's not SSE. It's just a broken up JSON array.
  // However, usually each chunk (candidate) is a valid JSON object surrounded by commas/brackets.
  // Simple parser: accumulate text, look for "text": "..."
  // Or simpler: The chunks are actually usually well-behaved valid JSON if we strip the outer array structure or handle it.
  // Actually, `response.body` will deliver bytes.
  // Let's use a simpler heuristic for Google since proper JSON stream parsing is complex.
  // We can regex for `"text": "..."` in the full buffer or chunks? No, that's unsafe.

  // Better approach: Google's stream sends distinct JSON objects corresponding to `GenerateContentResponse`,
  // possibly separated by commas and enclosed in brackets.
  // Format:
  // [
  // { ... },
  // { ... }
  // ]

  // We can accumulate buffer, find matching braces { }, parse, and move forward.

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) throw new Error('No body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let braceCount = 0;
    let start = -1;
    let consumedUpTo = 0;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      if (char === '{') {
        if (braceCount === 0) start = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && start !== -1) {
          // Process object
          const jsonStr = buffer.substring(start, i + 1);
          try {
            const json = JSON.parse(jsonStr);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              onChunk(text);
            }
          } catch (e) {
            // ignore malformed
          }
          start = -1;
          consumedUpTo = i + 1;
        }
      }
    }

    // Remove processed parts
    if (consumedUpTo > 0) {
      buffer = buffer.substring(consumedUpTo);
    }
  }

  return { text: fullText };
};