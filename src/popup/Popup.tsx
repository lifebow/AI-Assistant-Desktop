import { useState, useEffect, useRef } from 'react';
import { type AppConfig, DEFAULT_CONFIG, type ChatMessage, type PromptTemplate } from '../lib/types';
import { getStorage, getSelectedText } from '../lib/storage';
import { callApi } from '../lib/api';
import { Send, Settings, Sparkles, Loader2, User, Bot, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export default function Popup() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [selectedText, setSelectedText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const [cfg, text] = await Promise.all([getStorage(), getSelectedText()]);
      setConfig(cfg);
      setSelectedText(text);
       
       const storage = await chrome.storage.local.get(['contextSelection', 'contextImage']);
       if (storage.contextSelection) {
           setSelectedText(storage.contextSelection as string);
           await chrome.storage.local.remove('contextSelection');
       }
       if (storage.contextImage) {
           setSelectedImage(storage.contextImage as string);
           await chrome.storage.local.remove('contextImage');
       }
    };
    init();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
  }, [instruction]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePromptClick = (prompt: PromptTemplate) => {
      if (prompt.immediate) {
          handleSubmit(prompt.content);
      } else {
          setInstruction(prompt.content);
          if (textareaRef.current) {
              textareaRef.current.focus();
          }
      }
  };

  const handleSubmit = async (overrideInstruction?: string) => {
    const textToSubmit = overrideInstruction !== undefined ? overrideInstruction : instruction;
    
    if (!textToSubmit.trim()) return;
    if (!selectedText && !selectedImage && messages.length === 0) {
        setError("No context selected.");
        return;
    }

    setLoading(true);
    setError('');
    
    // Construct User Message
    let userContent = textToSubmit.trim();
    let messagePayload: ChatMessage;
    
    // First message logic: Inject context if not present
    if (messages.length === 0) {
        // If user picked a template that has ${text}, replace it.
        if (userContent.includes('${text}')) {
            userContent = userContent.replace('${text}', selectedText);
        } else if (selectedText) {
            // Otherwise append context
            userContent = `${userContent}\n\nContext:\n${selectedText}`;
        }

        // Construct message with potential image
        if (selectedImage) {
             messagePayload = { 
                 role: 'user', 
                 content: userContent,
                 image: selectedImage 
             };
        } else {
             messagePayload = { role: 'user', content: userContent };
        }
    } else {
        messagePayload = { role: 'user', content: userContent };
    }
    
    const newMessages = [...messages, messagePayload];
    
    setMessages(newMessages);
    setInstruction('');
    
    // Reset textarea height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    try {
        const res = await callApi(newMessages, config);
        if (res.error) {
            setError(res.error);
        } else {
            setMessages([...newMessages, { role: 'assistant', content: res.text }]);
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const openOptions = () => {
      chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-[450px] h-[600px] bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
            <img src="/icons/icon32.png" alt="Logo" className="w-6 h-6" />
            <h1 className="font-bold text-base tracking-tight text-slate-900">AI Assistant</h1>
        </div>
        <button 
            onClick={openOptions} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all duration-200"
            title="Settings"
        >
            <Settings size={18} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Context Badge */}
        {selectedText && messages.length === 0 && (
             <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Current Context</div>
                <div className="text-xs text-slate-600 italic line-clamp-3">
                    "{selectedText}"
                </div>
            </div>
        )}

        {/* Image Context Badge */}
        {selectedImage && messages.length === 0 && (
             <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                <div className="flex justify-between items-start">
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Image Context</div>
                    <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
                <img src={selectedImage} alt="Selected Context" className="max-h-32 rounded-lg border border-blue-200 object-contain bg-white" />
            </div>
        )}

        {/* Welcome State */}
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center opacity-60 mt-10">
                <Sparkles size={32} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Select a Quick Action below or type an instruction to start.</p>
            </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${ 
                    msg.role === 'user' 
                    ? 'bg-white text-slate-800 border border-slate-200 rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                }`}>
                    {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:p-2 prose-pre:rounded-lg">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                         <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                </div>
            </div>
        ))}

        {loading && (
            <div className="flex gap-3">
                 <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Bot size={14} />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-blue-600" />
                    <span className="text-xs text-slate-500 font-medium">Thinking...</span>
                </div>
            </div>
        )}

        {error && (
             <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 text-center">
                {error}
            </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 z-20">
         {/* Quick Actions (Only show if no messages or always? Let's show if messages < 1 for cleaner chat view, or keep them?) */}
         {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
                {config.prompts.map(p => (
                    <button
                        key={p.id}
                        onClick={() => handlePromptClick(p)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                    >
                        {p.name}
                    </button>
                ))}
            </div>
         )}

         <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
                <textarea
                    ref={textareaRef}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder={messages.length === 0 ? "What should I do with the selected text?" : "Reply to continue chat..."}
                    className="w-full pl-4 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none max-h-[120px] min-h-[44px] transition-all placeholder:text-slate-400"
                    rows={1}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                />
            </div>
            <button
                onClick={() => handleSubmit()}
                disabled={loading || !instruction.trim()}
                className="shrink-0 w-11 h-11 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 flex items-center justify-center"
            >
                <Send size={18} />
            </button>
         </div>
      </div>
    </div>
  );
}