import { useState, useEffect } from 'react';
import { type AppConfig, DEFAULT_CONFIG, type Provider, type PromptTemplate } from '../lib/types';
import { getStorage, setStorage } from '../lib/storage';
import { fetchModels } from '../lib/api';
import { Trash2, Plus, RotateCcw, Eye, EyeOff, Key, MessageSquareText, Settings2, CheckCircle2, RefreshCw, List, ChevronDown, Keyboard } from 'lucide-react';
import { clsx } from 'clsx';

const Providers: Provider[] = ['openai', 'google', 'anthropic', 'openrouter'];

const ProviderDisplayNames: Record<Provider, string> = {
    openai: 'OpenAI',
    google: 'Google Gemini',
    anthropic: 'Anthropic',
    openrouter: 'OpenRouter'
};

export default function Options() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'prompts' | 'hotkeys'>('general');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savedToast, setSavedToast] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({});
  const [isCustomModel, setIsCustomModel] = useState<Record<string, boolean>>({});
  const [recordingHotkey, setRecordingHotkey] = useState(false);

  useEffect(() => {
    getStorage().then((data) => {
      setConfig(data);
      setLoading(false);
    });
  }, []);

  const saveConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await setStorage(newConfig);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleAddKey = (provider: Provider) => {
    const keys = [...config.apiKeys[provider], ''];
    saveConfig({ ...config, apiKeys: { ...config.apiKeys, [provider]: keys } });
  };

  const handleUpdateKey = (provider: Provider, index: number, value: string) => {
    const keys = [...config.apiKeys[provider]];
    keys[index] = value;
    saveConfig({ ...config, apiKeys: { ...config.apiKeys, [provider]: keys } });
  };

  const handleKeyBlur = (provider: Provider) => {
      if (config.apiKeys[provider]?.length > 0 && config.apiKeys[provider][0]) {
          handleFetchModels(provider, true);
      }
  };

  const handleRemoveKey = (provider: Provider, index: number) => {
    const keys = config.apiKeys[provider].filter((_, i) => i !== index);
    saveConfig({ ...config, apiKeys: { ...config.apiKeys, [provider]: keys } });
  };

  const toggleShowKey = (keyId: string) => {
    setShowKey(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleFetchModels = async (provider: Provider, silent = false) => {
      const keys = config.apiKeys[provider];
      if (!keys || keys.length === 0 || !keys[0]) {
          if (!silent) alert(`Please add a valid API key for ${ProviderDisplayNames[provider]} first.`);
          return;
      }

      setFetchingModels(prev => ({ ...prev, [provider]: true }));
      try {
          const models = await fetchModels(provider, keys[0], config.customBaseUrls[provider]);
          if (models.length > 0) {
              setFetchedModels(prev => ({ ...prev, [provider]: models }));
          } else {
              if (!silent) alert('No models found or provider does not support listing models.');
          }
      } catch (err: any) {
          if (!silent) alert(`Failed to fetch models: ${err.message}`);
      } finally {
          setFetchingModels(prev => ({ ...prev, [provider]: false }));
      }
  };

  const handleAddPrompt = () => {
    const newPrompt: PromptTemplate = {
        id: crypto.randomUUID(),
        name: 'New Prompt',
        content: '${text}'
    };
    saveConfig({ ...config, prompts: [...config.prompts, newPrompt] });
  };

  const handleUpdatePrompt = (index: number, field: keyof PromptTemplate, value: any) => {
      const prompts = [...config.prompts];
      prompts[index] = { ...prompts[index], [field]: value };
      saveConfig({ ...config, prompts });
  };

  const handleRemovePrompt = (index: number) => {
      const prompts = config.prompts.filter((_, i) => i !== index);
      saveConfig({ ...config, prompts });
  };

  const handleHotkeyKeyDown = (e: React.KeyboardEvent) => {
      e.preventDefault();
      if (!recordingHotkey) return;

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      const key = e.key.toLowerCase();
      
      // Ignore if only modifiers are pressed
      if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

      const newHotkey = { key, modifiers };
      saveConfig({ ...config, customHotkey: newHotkey });
      setRecordingHotkey(false);
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
          <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Loading settings...</p>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <img src="/icons/icon48.png" alt="Logo" className="w-10 h-10" />
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Assistant</h1>
                    <p className="text-slate-500 text-xs font-medium">Extension Configuration</p>
                </div>
            </div>
            
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={clsx(
                        "px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 flex items-center gap-2",
                        activeTab === 'general' 
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                >
                    <Settings2 size={16} /> General
                </button>
                <button 
                    onClick={() => setActiveTab('prompts')}
                    className={clsx(
                        "px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 flex items-center gap-2",
                        activeTab === 'prompts' 
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                >
                    <MessageSquareText size={16} /> Prompts
                </button>
                <button 
                    onClick={() => setActiveTab('hotkeys')}
                    className={clsx(
                        "px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 flex items-center gap-2",
                        activeTab === 'hotkeys' 
                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                >
                    <Keyboard size={16} /> Hotkeys
                </button>
            </div>
          </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:py-10">
          {/* Success Toast */}
          <div className={clsx(
              "fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform z-50",
              savedToast ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
          )}>
              <CheckCircle2 className="text-green-400" size={20} />
              <span className="font-medium text-sm">Settings saved successfully</span>
          </div>

          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Default Provider Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                        Default Provider
                    </h3>
                    <div className="max-w-md">
                         <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Select Provider</label>
                        <div className="relative">
                            <select 
                                value={config.selectedProvider}
                                onChange={(e) => saveConfig({ ...config, selectedProvider: e.target.value as Provider })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 appearance-none"
                            >
                                {Providers.map(p => <option key={p} value={p}>{ProviderDisplayNames[p]}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <Settings2 size={16} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">This provider will be selected by default when you open the popup.</p>
                    </div>
                </div>

                {/* API Configuration Grid */}
                <div className="grid grid-cols-1 gap-6">
                    {Providers.map((provider) => (
                        <div key={provider} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md duration-300">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    {ProviderDisplayNames[provider]}
                                </h3>
                                <button
                                    onClick={() => handleAddKey(provider)}
                                    className="text-xs font-semibold bg-white text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Plus size={14} /> Add Key
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                {/* Model & Base URL */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Model ID</label>
                                            {provider !== 'anthropic' && (
                                                <button 
                                                    onClick={() => handleFetchModels(provider)}
                                                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                                                    disabled={fetchingModels[provider]}
                                                >
                                                    {fetchingModels[provider] ? <RefreshCw size={10} className="animate-spin" /> : <List size={10} />}
                                                    {fetchingModels[provider] ? 'Loading...' : 'Refresh List'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            {fetchedModels[provider]?.length > 0 && !isCustomModel[provider] ? (
                                                <div className="relative">
                                                    <select 
                                                        value={fetchedModels[provider].includes(config.selectedModel[provider]) ? config.selectedModel[provider] : '___custom___'}
                                                        onChange={(e) => {
                                                            if (e.target.value === '___custom___') {
                                                                setIsCustomModel(prev => ({...prev, [provider]: true}));
                                                            } else {
                                                                saveConfig({
                                                                    ...config,
                                                                    selectedModel: { ...config.selectedModel, [provider]: e.target.value }
                                                                })
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none pr-8 text-slate-700 font-medium"
                                                    >
                                                        {!fetchedModels[provider].includes(config.selectedModel[provider]) && config.selectedModel[provider] && (
                                                            <option value={config.selectedModel[provider]}>{config.selectedModel[provider]}</option>
                                                        )}
                                                        {fetchedModels[provider].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                        <option value="___custom___">Type custom ID...</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. gpt-4, gemini-pro"
                                                        value={config.selectedModel[provider]}
                                                        onChange={(e) => saveConfig({
                                                            ...config,
                                                            selectedModel: { ...config.selectedModel, [provider]: e.target.value }
                                                        })}
                                                        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                    />
                                                    {fetchedModels[provider]?.length > 0 && (
                                                        <button 
                                                            onClick={() => setIsCustomModel(prev => ({...prev, [provider]: false}))}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 bg-blue-50 rounded"
                                                        >
                                                            Back to List
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Base URL <span className="text-slate-300 font-normal lowercase">(optional)</span></label>
                                        <input
                                            type="text"
                                            placeholder="Default"
                                            value={config.customBaseUrls[provider]}
                                            onChange={(e) => saveConfig({
                                                ...config,
                                                customBaseUrls: { ...config.customBaseUrls, [provider]: e.target.value }
                                            })}
                                            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>

                                {/* Keys List */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">API Keys</label>
                                    {config.apiKeys[provider].length === 0 && (
                                        <div className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                                            No API keys configured for {ProviderDisplayNames[provider]}.
                                        </div>
                                    )}
                                    {config.apiKeys[provider].map((key, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <div className="relative flex-1">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                    <Key size={14} />
                                                </div>
                                                <input
                                                    type={showKey[`${provider}-${idx}`] ? "text" : "password"}
                                                    value={key}
                                                    onChange={(e) => handleUpdateKey(provider, idx, e.target.value)}
                                                    onBlur={() => handleKeyBlur(provider)}
                                                    placeholder={`Enter ${ProviderDisplayNames[provider]} API Key`}
                                                    className="w-full pl-9 pr-10 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm group-hover:border-slate-300"
                                                />
                                                <button 
                                                    onClick={() => toggleShowKey(`${provider}-${idx}`)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                    tabIndex={-1}
                                                >
                                                    {showKey[`${provider}-${idx}`] ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveKey(provider, idx)}
                                                className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Remove key"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Prompt Templates</h2>
                        <p className="text-slate-500 text-sm mt-1">Customize the quick actions available in the popup.</p>
                    </div>
                    <button
                      onClick={handleAddPrompt}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 flex items-center gap-2"
                    >
                      <Plus size={18} /> New Prompt
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {config.prompts.map((prompt, idx) => (
                        <div key={prompt.id} className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Name</label>
                                    <input 
                                        type="text" 
                                        value={prompt.name}
                                        onChange={(e) => handleUpdatePrompt(idx, 'name', e.target.value)}
                                        className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none px-0 py-1 transition-colors w-full"
                                        placeholder="Prompt Name"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-4">
                                    <label className="flex items-center gap-2 cursor-pointer group/checkbox">
                                        <div className="relative">
                                            <input 
                                                type="checkbox"
                                                checked={!!prompt.immediate}
                                                onChange={(e) => handleUpdatePrompt(idx, 'immediate', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </div>
                                        <span className="text-xs font-medium text-slate-500 group-hover/checkbox:text-slate-700">Instant Submit</span>
                                    </label>
                                    <button 
                                        onClick={() => handleRemovePrompt(idx)}
                                        className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ml-2"
                                        title="Delete Prompt"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Template Content</label>
                                <textarea 
                                    value={prompt.content}
                                    onChange={(e) => handleUpdatePrompt(idx, 'content', e.target.value)}
                                    className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[80px] resize-y transition-all font-mono"
                                    placeholder="Prompt content..."
                                />
                                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                                    <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-mono text-[10px]">{`\${text}`}</span>
                                    will be replaced by your selected text.
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                 <div className="flex justify-center pt-8 border-t border-slate-200 border-dashed">
                    <button 
                        onClick={() => {
                            if(confirm('Are you sure you want to reset all prompts to default?')) {
                                saveConfig({ ...config, prompts: DEFAULT_CONFIG.prompts })
                            }
                        }}
                        className="text-sm text-slate-400 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    >
                        <RotateCcw size={14} /> Reset Defaults
                    </button>
                </div>
            </div>
          )}

          {activeTab === 'hotkeys' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Global Shortcut</h3>
                      <p className="text-sm text-slate-500 mb-6">
                          Define a keyboard shortcut to trigger the extension on any page.
                          Click the input box below and press your desired key combination.
                      </p>

                      <div className="max-w-md">
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Shortcut</label>
                          <div 
                              className={clsx(
                                  "w-full h-14 flex items-center justify-center border-2 rounded-xl text-lg font-mono font-medium cursor-pointer transition-all select-none",
                                  recordingHotkey 
                                      ? "border-blue-500 bg-blue-50 text-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" 
                                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                              )}
                              onClick={() => setRecordingHotkey(true)}
                              onKeyDown={handleHotkeyKeyDown}
                              tabIndex={0}
                              onBlur={() => setRecordingHotkey(false)}
                          >
                              {recordingHotkey ? (
                                  <span className="animate-pulse">Press keys...</span>
                              ) : config.customHotkey ? (
                                  <div className="flex items-center gap-2">
                                      {config.customHotkey.modifiers.map(m => (
                                          <kbd key={m} className="px-2 py-1 bg-white border border-slate-300 rounded-md text-sm shadow-sm uppercase">{m}</kbd>
                                      ))}
                                      <span className="text-slate-400">+</span>
                                      <kbd className="px-2 py-1 bg-white border border-slate-300 rounded-md text-sm shadow-sm uppercase">{config.customHotkey.key}</kbd>
                                  </div>
                              ) : (
                                  <span className="text-slate-400 italic">Click to set (e.g. Ctrl+Shift+Y)</span>
                              )}
                          </div>
                          {config.customHotkey && (
                              <div className="flex justify-end mt-2">
                                  <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          saveConfig({ ...config, customHotkey: null });
                                      }}
                                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                  >
                                      Clear Shortcut
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                      <div className="text-amber-500 shrink-0 mt-0.5">
                          <Keyboard size={20} />
                      </div>
                      <div className="text-sm text-amber-800">
                          <p className="font-bold mb-1">Note regarding shortcuts</p>
                          <p className="leading-relaxed">
                              Browser-reserved shortcuts (like Ctrl+T, Ctrl+N) cannot be overridden. 
                              If a shortcut doesn't work, try adding Shift or Alt modifiers. 
                              You may need to refresh open tabs for the new shortcut to take effect.
                          </p>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
