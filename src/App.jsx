import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  MessageSquare, AlertTriangle, CheckCircle2, Upload, ArrowRight, Activity, 
  ShieldCheck, Info, RefreshCcw, Scale, Zap, FileImage, FileText, X, 
  Smartphone, Users, Sparkles, Copy, Loader2, Trophy, Gavel, BrainCircuit, 
  HeartCrack, Mic, Search, ChevronDown, ChevronUp, Quote, TrendingUp, Bot, 
  Wand2, Send, Paperclip, Key, Skull, PenTool, Link as LinkIcon, Globe, Lock, Siren
} from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * UTILITIES & API HANDLER
 * ------------------------------------------------------------------
 */

const copyToClipboard = (text) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
    throw new Error("execCommand returned false");
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  }
};

const callGemini = async (systemInstruction, attachments = [], responseSchema = null, keyOverride = null) => {
  // FIXED: Use relative path for Proxy to handle CORS
  const url = '/api/gemini'; 

  const parts = [{ text: systemInstruction }];
  attachments.forEach(att => {
    if (att.type === 'blob') parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    else if (att.type === 'text') parts.push({ text: att.text });
  });

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: responseSchema ? "application/json" : "text/plain",
      ...(responseSchema && { responseSchema })
    }
  };

  try {
    const headers = { "Content-Type": "application/json" };
    // If you implemented the userApiKey feature, we can pass it in headers if your backend supports it, 
    // or you might rely on the backend's env variable. 
    // For this implementation, we send standard requests to the proxy.
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        ...payload,
        // Optional: Pass key if your backend endpoint expects it in the body to override server env
        // key: keyOverride 
      })
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error("Unauthorized (401). Check API Key.");
        if (response.status === 503) throw new Error("Service Unavailable (503). Model overloaded.");
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle different backend response structures
    const candidate = data.candidates ? data.candidates[0] : (data.result ? { content: { parts: [{ text: data.result }] } } : null);

    if (!candidate) throw new Error("AI returned no response candidates.");

    const contentParts = candidate.content?.parts || [];
    const textResult = contentParts.filter(p => p.text).map(p => p.text).join('');
    
    if (!textResult.trim()) throw new Error("AI returned empty text content.");

    if (responseSchema) {
      try {
        return JSON.parse(textResult);
      } catch (e) {
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error("Failed to parse structured data from AI response.");
      }
    }
    return textResult;
  } catch (error) {
    console.error("Gemini API Failed:", error);
    throw error;
  }
};

const processFile = (file) => {
  return new Promise((resolve, reject) => {
    const MAX_SIZE = 5 * 1024 * 1024; 
    if (file.size > MAX_SIZE) { reject(new Error(`File ${file.name} exceeds 5MB limit.`)); return; }
    const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|md|html|js|jsx|ts|tsx|json|csv|log|xml|py|rb|java|c|cpp|h)$/i);
    if (isText) {
      const reader = new FileReader();
      reader.onload = () => resolve({ type: 'text', text: `\n\n--- BEGIN FILE: ${file.name} ---\n${reader.result}\n--- END FILE ---\n` });
      reader.onerror = reject;
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({ type: 'blob', mimeType: file.type || 'application/octet-stream', data: base64Data });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
};

/**
 * ------------------------------------------------------------------
 * SCHEMAS
 * ------------------------------------------------------------------
 */
const CONVERSATION_SCHEMA = { type: "OBJECT", properties: { meta: { type: "OBJECT", properties: { message_count: { type: "INTEGER" }, mode: { type: "STRING" } } }, balance_analysis: { type: "OBJECT", properties: { score: { type: "INTEGER" }, dominant_factor: { type: "STRING" }, summary: { type: "STRING" }, evidence: { type: "ARRAY", items: { type: "OBJECT", properties: { quote: { type: "STRING" }, impact: { type: "STRING" }, favors: { type: "STRING" } } } } } }, speaker_mapping: { type: "OBJECT", properties: { intro: { type: "STRING" }, parties: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, label: { type: "STRING" }, visual_cue: { type: "STRING" }, detected_role: { type: "STRING" } } } } } }, speakers: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, label: { type: "STRING" }, metrics: { type: "OBJECT", properties: { reasonableness: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } }, toxicity: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } }, logic_score: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } }, emotional_intelligence: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } }, manipulation_index: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } }, clarity: { type: "OBJECT", properties: { score: { type: "INTEGER" }, quote: { type: "STRING" } } } } }, tags: { type: "ARRAY", items: { type: "STRING" } }, summary: { type: "STRING" } } } }, narrative: { type: "OBJECT", properties: { headline: { type: "STRING" }, body: { type: "STRING" } } }, resolve: { type: "OBJECT", properties: { joint: { type: "STRING" }, speakerA_steps: { type: "ARRAY", items: { type: "STRING" } }, speakerB_steps: { type: "ARRAY", items: { type: "STRING" } } } } } };
const BS_SCHEMA = { type: "OBJECT", properties: { score: { type: "INTEGER" }, level: { type: "STRING" }, flags: { type: "ARRAY", items: { type: "OBJECT", properties: { type: { type: "STRING" }, text: { type: "STRING" }, severity: { type: "STRING" } } } }, summary: { type: "STRING" } } };
const SIMULATION_SCHEMA = { type: "OBJECT", properties: { reply: { type: "STRING" }, coach_tip: { type: "STRING" }, intensity_score: { type: "INTEGER" } } };
const VIBE_SCHEMA = { type: "OBJECT", properties: { rating: { type: "STRING" }, critique: { type: "STRING" }, improved_text: { type: "STRING" } } };

/**
 * ------------------------------------------------------------------
 * UI COMPONENTS
 * ------------------------------------------------------------------
 */

const MiniGauge = memo(({ value, label, evidence, colorScheme = "default" }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  let strokeColor = "#e5e7eb";
  const safeValue = typeof value === 'number' ? value : 0;
  const safeEvidence = typeof evidence === 'string' ? evidence : (evidence ? JSON.stringify(evidence).slice(0, 100) + "..." : 'Pattern detected.');

  if (colorScheme === 'default') {
    if (safeValue >= 75) strokeColor = "#059669"; 
    else if (safeValue >= 50) strokeColor = "#f59e0b"; 
    else strokeColor = "#f43f5e"; 
  } else {
    if (safeValue <= 25) strokeColor = "#059669"; 
    else if (safeValue <= 50) strokeColor = "#f59e0b"; 
    else strokeColor = "#f43f5e"; 
  }

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center relative group" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}>
      <div className="relative h-12 w-12 flex items-center justify-center mb-1 cursor-help transition-transform group-hover:scale-110">
        <svg className="transform -rotate-90 w-12 h-12">
          <circle cx="24" cy="24" r={radius} stroke="#f3f4f6" strokeWidth="4" fill="transparent" />
          <circle cx="24" cy="24" r={radius} stroke={strokeColor} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] font-bold text-slate-700">{safeValue}</span></div>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-center leading-tight">{label}</span>
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-slate-900 text-white text-xs p-4 rounded-xl shadow-2xl z-[60] transition-all duration-300 pointer-events-none transform ${showTooltip ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}`}>
        <div className="flex items-center gap-1.5 mb-2 border-b border-slate-700 pb-2"><Skull size={10} className="text-rose-400" /><span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">The Receipt</span></div>
        <p className="italic text-slate-200 leading-relaxed font-medium">"{safeEvidence}"</p>
      </div>
    </div>
  );
});

const RealityScale = memo(({ score, evidence, speakerMap, dominantFactor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const safeScore = typeof score === 'number' ? score : 0;
  const intensity = Math.abs(safeScore);
  const percent = ((safeScore + 100) / 200) * 100;
  
  let favoredSide = 'NEUTRAL';
  if (safeScore < -5) favoredSide = 'A';
  else if (safeScore > 5) favoredSide = 'B';

  const speakerA = speakerMap.find(s => s.id === 'A') || { label: 'Speaker A' };
  const speakerB = speakerMap.find(s => s.id === 'B') || { label: 'Speaker B' };
 
  return (
    <div className="mb-10 animate-in slide-in-from-top-4 duration-700">
      <div onClick={() => setIsOpen(!isOpen)} className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow group relative">
        <div className="p-6 pb-2">
            <div className="flex justify-between items-center mb-4 px-2">
                <div className={`text-left w-1/3 transition-all duration-500 ${favoredSide === 'A' ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    <h3 className="text-lg font-bold text-slate-900 leading-none truncate">{speakerA.label}</h3>
                    {favoredSide === 'A' && <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 animate-pulse">YTA (The Asshole)</span>}
                    {favoredSide !== 'A' && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">NTA</span>}
                </div>
                <div className="text-center w-1/3 pb-1">
                   <div className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1 shadow-lg"><Gavel size={12} /> A-Hole Scale</div>
                </div>
                <div className={`text-right w-1/3 transition-all duration-500 ${favoredSide === 'B' ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    <h3 className="text-lg font-bold text-slate-900 leading-none truncate">{speakerB.label}</h3>
                    {favoredSide === 'B' && <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 animate-pulse">YTA (The Asshole)</span>}
                    {favoredSide !== 'B' && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">NTA</span>}
                </div>
            </div>
            <div className="relative h-14 bg-slate-100 rounded-xl overflow-hidden mb-4 shadow-inner border border-slate-200">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-10"></div>
                <div className="absolute top-1 bottom-1 w-1.5 rounded-full bg-slate-900 shadow-[0_0_15px_rgba(0,0,0,0.4)] z-30 transition-all duration-1000 ease-out" style={{ left: `calc(${percent}% - 3px)` }}></div>
                {favoredSide !== 'NEUTRAL' && (
                    <div className={`absolute top-0 bottom-0 ${favoredSide === 'A' ? 'right-1/2 bg-gradient-to-l' : 'left-1/2 bg-gradient-to-r'} from-rose-500 to-rose-400/80 transition-all duration-1000 ease-out z-20`} style={{ width: `${Math.abs(safeScore)/2}%` }}>
                         <div className={`absolute ${favoredSide === 'A' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 text-white text-xs font-bold whitespace-nowrap opacity-90`}>{intensity}% Asshole</div>
                    </div>
                )}
            </div>
            <div className="text-center relative pb-2">
               <p className="text-sm font-medium text-slate-600">Verdict: <span className="font-bold text-rose-600">{favoredSide === 'A' ? speakerA.label : (favoredSide === 'B' ? speakerB.label : "Both/Neither")} is The Asshole</span>.</p>
               <p className="text-xs text-slate-400 mt-1">Primary Factor: <span className="font-semibold text-indigo-600">{dominantFactor || 'Toxic Behavior'}</span></p>
               <div className="mt-4 text-indigo-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {isOpen ? "Close Receipts" : "View Receipts"}
               </div>
            </div>
        </div>
        {isOpen && (
            <div className="bg-slate-50 border-t border-slate-200 p-6 animate-in slide-in-from-top-2">
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wide mb-4"><TrendingUp size={16} /> Why they are The Asshole</h4>
                <div className="space-y-3">
                    {evidence && evidence.map((item, idx) => (
                        <div key={idx} className="flex gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                             <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.favors === 'A' ? 'bg-rose-500' : 'bg-rose-500'}`}></div>
                            <div className="mt-1 shrink-0 text-slate-400"><CheckCircle2 size={18} /></div>
                            <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${item.favors === 'A' ? 'bg-rose-100 text-rose-700' : 'bg-rose-100 text-rose-700'}`}>Against {item.favors === 'A' ? speakerA.label : speakerB.label}</span>
                                    <span className="text-xs font-bold text-slate-800">{item.impact}</span>
                                </div>
                                <div className="pl-2 border-l-2 border-slate-100 mt-2"><p className="text-sm text-slate-600 italic">"{item.quote}"</p></div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        )}
      </div>
    </div>
  );
});

const ReplyArchitect = memo(({ onDraft, userApiKey }) => {
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVibeCheck = async () => {
    if (!draft.trim()) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const prompt = `Analyze this text message: "${draft}". Task: Rate the "Vibe" (e.g., Doormat, Passive Aggressive, Secure, Petty, Toxic), give a short critique, and provide an improved version. Return JSON: { rating, critique, improved_text }`;
      const result = await callGemini(prompt, [], VIBE_SCHEMA, userApiKey);
      setAnalysis(result);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mt-6 animate-fade-in">
      <h3 className="flex items-center gap-2 text-indigo-900 font-bold text-lg mb-4"><Wand2 size={20} /> Reply Architect</h3>
      <div className="mb-4">
        <textarea className="w-full p-4 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm text-slate-700" placeholder="Type your draft here..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex justify-end mt-2 gap-2">
           <button onClick={handleVibeCheck} disabled={!draft.trim() || loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
             {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Vibe Check
           </button>
        </div>
      </div>
      {analysis && (
        <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm animate-in slide-in-from-top-2">
           <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verdict</span><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${analysis.rating.toLowerCase().includes('secure') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{analysis.rating}</span></div>
           <p className="text-slate-700 text-sm mb-4 font-medium">"{analysis.critique}"</p>
           <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100"><p className="text-xs text-indigo-400 font-bold uppercase tracking-wide mb-1">Better Version</p><p className="text-indigo-900 text-sm font-mono">{analysis.improved_text}</p><button onClick={() => setDraft(analysis.improved_text)} className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"><PenTool size={10} /> Use This</button></div>
        </div>
      )}
      <div className="mt-6 pt-4 border-t border-indigo-200">
         <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-3 text-center">Or Auto-Generate</p>
         <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onDraft("high_road")} className="p-3 bg-white hover:bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors">🕊️ The High Road</button>
            <button onClick={() => onDraft("boundary")} className="p-3 bg-white hover:bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors">🛡️ Firm Boundary</button>
         </div>
      </div>
    </div>
  );
});

const PracticeDojo = memo(({ analysis, onExit, userApiKey }) => {
  const [messages, setMessages] = useState([{ role: 'ai', text: "I'll simulate the other person. Come at me.", isSystem: true }]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
 
    const otherPerson = analysis?.speaker_mapping?.parties?.find(p => p.id === 'B') || { label: 'The Other Person' };
    const otherSpeakerTags = analysis?.speakers?.find(s => s.id === 'B')?.tags || [];
    const narrativeBody = typeof analysis?.narrative?.body === 'string' ? analysis.narrative.body : '';
    try {
      const prompt = `ROLEPLAY SIMULATION. Roleplay as "${otherPerson.label}". Context: ${narrativeBody}. Personality: ${JSON.stringify(otherSpeakerTags)}. User msg: "${inputText}". 1. Reply STRICTLY as Speaker B. 2. Provide a SEPARATE "Coach Tip" on how the user's message landed. Return JSON: { reply, coach_tip, intensity_score }`;
      const result = await callGemini(prompt, [], SIMULATION_SCHEMA, userApiKey);
      setMessages(prev => [...prev, { role: 'ai', text: result.reply, tip: result.coach_tip }]);
    } catch (e) { 
        console.error(e);
        setMessages(prev => [...prev, { role: 'ai', text: "Connection error. Try again.", isSystem: true }]); 
    } finally { 
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
       <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div><h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Bot className="text-indigo-600" /> Practice Dojo</h3><p className="text-xs text-slate-500">Argue with the AI Clone</p></div>
          <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24} /></button>
       </div>
       <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] ${msg.isSystem ? 'w-full text-center' : ''}`}>
                  {msg.isSystem ? (
                    <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full">{msg.text}</span>
                  ) : (
                    <>
                      <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>{msg.text}</div>
                      {msg.tip && <div className="mt-2 ml-2 flex gap-2 items-start animate-in fade-in slide-in-from-top-1"><Sparkles size={12} className="text-amber-500 mt-0.5 shrink-0" /><p className="text-xs text-slate-500 italic bg-amber-50 p-2 rounded-lg border border-amber-100 inline-block">Reality Check: {msg.tip}</p></div>}
                    </>
                  )}
               </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1 items-center"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span></div></div>}
       </div>
       <div className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative">
             <input type="text" className="w-full bg-slate-100 border-none rounded-full pl-6 pr-14 py-4 focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400" placeholder="Type your response..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={loading} />
             <button onClick={handleSend} disabled={!inputText.trim() || loading} className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
          </div>
       </div>
    </div>
  );
});

const DetailedResolve = memo(({ data, onPractice, userApiKey }) => {
  const [drafting, setDrafting] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);

  if (!data) return null;

  const handleMagicDraft = async (type) => {
    setDrafting(true);
    const context = `
      The user is Speaker A. Speaker A needs to reply to Speaker B.
      The joint reality is: "${data.joint || ''}".
      Speaker A's recommended steps are: ${JSON.stringify(data.speakerA_steps || [])}.
      Task: Draft a specific text message response for Speaker A.
      Tone: ${type === "high_road" ? "The High Road (Calm, mature, de-escalating)" : "Firm Boundary (Assertive, no-nonsense, self-respecting)"}.
      Constraints: Max 3 sentences. No emojis unless ironic.
    `;
    try {
      const result = await callGemini(context, [], null, userApiKey);
      setGeneratedDraft({ type, text: result });
    } catch (e) {
      console.error(e);
    } finally {
      setDrafting(false);
    }
  };

  const safeRender = (content) => {
      if (typeof content === 'string') return content;
      if (typeof content === 'object') return JSON.stringify(content);
      return '';
  };

  return (
    <div className="mt-8 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 rounded-2xl overflow-hidden">
      <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Scale size={20} />
          <h3 className="font-bold text-lg tracking-wide">RESOLVE: Strategic Next Steps</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={onPractice} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
             <Bot size={14} />
             Practice
           </button>
        </div>
      </div>
     
      <div className="p-6">
        <div className="mb-8 p-4 bg-white rounded-xl border-l-4 border-indigo-500 shadow-sm">
          <h4 className="text-indigo-900 font-bold mb-2">The Joint Reality</h4>
          <p className="text-slate-700 leading-relaxed">
            {safeRender(data.joint)}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h4 className="flex items-center gap-2 font-bold text-green-700 mb-4 uppercase text-xs tracking-wider">
              <span className="w-2 h-2 rounded-full bg-green-600"></span>
              Your Next Moves
            </h4>
            <ul className="space-y-4">
              {data.speakerA_steps?.map((step, i) => (
                <li key={i} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-sm text-slate-700 leading-relaxed">
                  {typeof step === 'string' ? step.split("**").map((part, idx) => 
                    idx % 2 === 1 ? <span key={idx} className="font-bold text-slate-900 block mb-1">{part}</span> : part
                  ) : safeRender(step)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="flex items-center gap-2 font-bold text-slate-600 mb-4 uppercase text-xs tracking-wider">
               <span className="w-2 h-2 rounded-full bg-slate-500"></span>
               Their Next Moves
            </h4>
            <ul className="space-y-4">
              {data.speakerB_steps?.map((step, i) => (
                <li key={i} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-sm text-slate-700 leading-relaxed">
                  {typeof step === 'string' ? step.split("**").map((part, idx) => 
                    idx % 2 === 1 ? <span key={idx} className="font-bold text-slate-900 block mb-1">{part}</span> : part
                  ) : safeRender(step)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ReplyArchitect onDraft={handleMagicDraft} userApiKey={userApiKey} />

        {generatedDraft && (
           <div className="mt-4 bg-indigo-100 border border-indigo-200 rounded-xl p-4 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-2">
                 <h4 className="flex items-center gap-2 text-indigo-800 font-bold text-sm">
                   <Sparkles size={14} /> Generated Draft: {generatedDraft.type === 'high_road' ? 'The High Road' : 'Firm Boundary'}
                 </h4>
                 <button onClick={() => setGeneratedDraft(null)} className="text-indigo-400 hover:text-indigo-600"><X size={14} /></button>
              </div>
              <p className="font-mono text-sm text-slate-700 bg-white p-3 rounded border border-indigo-100 mb-2">
                 "{generatedDraft.text}"
              </p>
              <p className="text-xs text-indigo-400">*Always edit before sending.</p>
           </div>
        )}
      </div>
    </div>
  );
});

const ConversationResults = memo(({ data, onReset, onPractice, userApiKey }) => {

  const handleCopyReceipt = () => {
    let receipt = 'AITA? The Verdict\n';
    receipt += '====================\n';
    if (data && data.metrics) {
      receipt += '\n--- METRICS ---\n';
      Object.entries(data.metrics).forEach(([key, value]) => {
        receipt += `${key}: ${value}\n`;
      });
    }
    if (data && data.verdict) {
      receipt += `\nVERDICT: ${data.verdict}\n`;
    }
    navigator.clipboard.writeText(receipt).then(() => {
      alert('Receipt copied to clipboard!');
    }, () => {
      alert('Failed to copy receipt.');
    });
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Activity className="text-indigo-600" /> The Verdict</h2>
        <button onClick={handleCopyReceipt} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow transition-all">Copy Receipt</button>
        <button onClick={onReset} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm ml-2"><RefreshCcw size={16} /> New Session</button>
      </div>

      {data.balance_analysis && <RealityScale score={data.balance_analysis.score} evidence={data.balance_analysis.evidence} dominantFactor={data.balance_analysis.dominant_factor} speakerMap={data.speaker_mapping?.parties || []} />}
      
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {data.speakers?.map((speaker, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50"><h3 className={`text-lg font-bold px-3 py-1 rounded-lg ${speaker.id === 'A' ? 'text-emerald-800 bg-emerald-50' : 'text-slate-700 bg-slate-100'}`}>{speaker.label}</h3></div>
            <div className="grid grid-cols-3 gap-y-6 gap-x-2 mb-8 p-4 bg-slate-50 rounded-xl">
              {speaker.metrics ? (
                <>
                  <MiniGauge value={speaker.metrics.reasonableness?.score} label="Sanity" evidence={speaker.metrics.reasonableness?.quote} />
                  <MiniGauge value={speaker.metrics.toxicity?.score} label="Toxic Waste" colorScheme="reverse" evidence={speaker.metrics.toxicity?.quote} />
                  <MiniGauge value={speaker.metrics.logic_score?.score} label="Brain Cells" evidence={speaker.metrics.logic_score?.quote} />
                  <MiniGauge value={speaker.metrics.emotional_intelligence?.score} label="Vibe Check" evidence={speaker.metrics.emotional_intelligence?.quote} />
                  <MiniGauge value={speaker.metrics.manipulation_index?.score} label="Gaslight" colorScheme="reverse" evidence={speaker.metrics.manipulation_index?.quote} />
                  <MiniGauge value={speaker.metrics.clarity?.score} label="Coherence" evidence={speaker.metrics.clarity?.quote} />
                </>
              ) : <div className="col-span-3 text-center text-xs text-slate-400 py-4">Metrics unavailable</div>}
           </div>
            <div className="space-y-4 flex-grow">
              <div className="flex flex-wrap gap-2">{speaker.tags?.map(tag => <span key={tag} className="px-2 py-1 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide rounded-md border border-slate-200">{tag}</span>)}</div>
              <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100 italic">"{speaker.summary}"</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">{data.narrative?.headline}</h3>
        <p className="text-slate-700 leading-relaxed whitespace-pre-line text-lg">{typeof data.narrative?.body === 'string' ? data.narrative.body : ''}</p>
      </div>

      <DetailedResolve data={data.resolve} onPractice={onPractice} userApiKey={userApiKey} />
    </div>
  );
});

const BSResults = memo(({ data, onReset }) => (
  <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-700">
    <div className="flex items-center justify-between mb-8">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="text-rose-600" /> BS Detector</h2>
      <button onClick={onReset} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm"><RefreshCcw size={16} /> New Session</button>
    </div>
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-6 text-center">
       <div className="max-w-xs mx-auto mb-6"><div className="flex flex-col items-center"><span className="text-6xl font-black text-slate-900">{data.score}</span><span className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Reliability Score</span></div></div>
       <h3 className="text-xl font-bold text-slate-900 mb-2">{data.level}</h3>
       <p className="text-slate-600">{data.summary}</p>
    </div>
    <div className="space-y-3">
        {data.flags?.map((flag, i) => (
           <div key={i} className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex gap-4 items-start"><AlertTriangle className="text-rose-500 shrink-0 mt-1" size={20} /><div><h4 className="font-bold text-rose-800 text-sm uppercase">{flag.type}</h4><p className="text-rose-900">{flag.text}</p></div></div>
        ))}
    </div>
  </div>
));

const LandingPage = memo(({ onStart }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto px-6">
    <div className="mb-6 p-4 bg-white shadow-xl rounded-2xl border border-slate-100 rotate-3 transition-transform hover:rotate-0"><Activity size={48} className="text-indigo-600" /></div>
    <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">AITA<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">?</span></h1>
    <p className="text-xl text-slate-600 mb-10 leading-relaxed font-medium">Stop guessing. Find out if you're the problem. <br/> The professional-grade tool to decode conflicting communication styles.</p>
    <div className="grid md:grid-cols-2 gap-4 w-full">
      <button onClick={() => onStart('conversation')} className="group relative flex flex-col items-center p-8 bg-slate-900 text-white rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 text-left overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-colors"></div>
        <div className="relative z-10 w-full"><div className="mb-4 text-indigo-300 group-hover:text-white transition-colors"><MessageSquare size={32} /></div><h3 className="text-xl font-bold mb-2">Am I The Asshole?</h3><p className="text-slate-400 text-sm group-hover:text-slate-300">Upload screenshots. Identify patterns. Get a strategic resolution plan.</p></div>
      </button>
      <button onClick={() => onStart('bs')} className="group relative flex flex-col items-center p-8 bg-white border-2 border-slate-200 hover:border-rose-500 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left">
        <div className="w-full"><div className="mb-4 text-rose-500"><ShieldCheck size={32} /></div><h3 className="text-xl font-bold text-slate-900 mb-2">BS Detector</h3><p className="text-slate-500 text-sm">Analyze single-party text for contradictions and "word salad".</p></div>
      </button>
    </div>
  </div>
));

const AnalysisLoader = memo(({ error, onRetryWithKey, onRetry }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {error ? (
        <div className="text-center p-8 bg-rose-50 rounded-2xl border border-rose-200 max-w-md animate-in fade-in zoom-in-95 duration-300">
           <AlertTriangle className="mx-auto text-rose-500 mb-4" size={48} />
           <h3 className="text-xl font-bold text-rose-900 mb-2">Analysis Failed</h3>
           <p className="text-rose-700 mb-4">{error}</p>
           {error.includes("401") || error.includes("Authorization") ? (
             <button onClick={onRetryWithKey} className="flex items-center gap-2 mx-auto bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all"><Key size={16} /> Enter API Key to Retry</button>
           ) : (
             <button onClick={onRetry} className="text-sm font-bold underline text-rose-800">Retry Analysis</button>
           )}
        </div>
      ) : (
        <>
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Judging the Situation...</h3>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-slate-500 animate-pulse text-sm">Uploading context...</p>
            <p className="text-slate-500 animate-pulse text-sm delay-75">Scoring EQ & Logic...</p>
            <p className="text-slate-500 animate-pulse text-sm delay-150">Determining Validity...</p>
          </div>
        </>
      )}
    </div>
));

const ApiKeyModal = memo(({ onSave, onCancel }) => {
  const [key, setKey] = useState("");
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2"><Key className="text-indigo-600" /> Enter Gemini API Key</h3>
        <p className="text-slate-500 text-sm mb-4">The default system key is missing or unauthorized. Please provide your own Google Gemini API key to continue.</p>
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-amber-800 text-xs mb-4"><strong>Security Note:</strong> Your key is stored locally in your browser for this session only. We recommend generating a restricted key for this use.</div>
        <input type="password" className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="AIzaSy..." value={key} onChange={(e) => setKey(e.target.value)} />
        <div className="flex justify-end gap-3"><button onClick={onCancel} className="text-slate-500 hover:text-slate-700 text-sm font-bold">Cancel</button><button onClick={() => onSave(key)} disabled={!key} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50">Save & Retry</button></div>
      </div>
    </div>
  );
});

const InputScreen = ({ mode, onAnalyze, onBack }) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };
  
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
  };
  
  const addFiles = (newFiles) => {
    const fileArray = Array.from(newFiles);
    setFiles(prev => [...prev, ...fileArray]);
  };
  
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleStartAnalysis = () => {
    onAnalyze(text, files);
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1">← Back to Mission Control</button>
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${mode === 'conversation' ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>{mode === 'conversation' ? <MessageSquare size={24} /> : <AlertTriangle size={24} />}</div>
        <div><h2 className="text-2xl font-bold text-slate-900">{mode === 'conversation' ? 'Conversation Context Analysis' : 'Consistency Check'}</h2><p className="text-slate-500 text-sm">{mode === 'conversation' ? 'Upload screenshots, logs, HTML, or paste text.' : 'Paste the monologue, email, or upload a document.'}</p></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={`p-8 border-b border-slate-100 transition-colors ${isDragging ? 'bg-indigo-50' : 'bg-slate-50'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {mode === 'conversation' && (
            <div className="mb-6">
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all group">
                <div className="bg-indigo-50 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform"><div className="flex gap-1 justify-center"><FileImage className="text-indigo-500" size={32} /><FileText className="text-indigo-400" size={32} /></div></div>
                <h3 className="font-semibold text-slate-700">Drop Files Here</h3>
                <p className="text-xs text-slate-400 mt-1">Accepts Images, PDFs, Text, HTML, Code... (Max 5MB)</p>
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Upload Queue ({files.length})</p>
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden"><span className="flex-shrink-0 bg-slate-200 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">{idx + 1}</span><div className="overflow-hidden"><span className="text-sm text-slate-700 truncate block">{file.name}</span><span className="text-[10px] text-slate-400 uppercase tracking-wide">{file.type || 'UNKNOWN'}</span></div></div>
                      <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center"><span className="bg-slate-50 px-2 text-xs text-slate-400 uppercase">OR Paste Text</span></div></div>
          <textarea className="w-full h-40 mt-6 bg-white p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-700 placeholder-slate-400 text-sm leading-relaxed" placeholder={mode === 'conversation' ? "Speaker A (Green): Hey...\nSpeaker B (Gray): What?..." : "Paste the text block here..."} value={text} onChange={(e) => setText(e.target.value)}></textarea>
        </div>
        <div className="p-4 bg-white flex justify-end items-center gap-4"><p className="text-xs text-slate-400 max-w-md text-right hidden md:block">Gemini Flash 2.5 Preview is active.</p><button disabled={!text && files.length === 0} onClick={handleStartAnalysis} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"><Zap size={18} /> Run Deep Analysis</button></div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('landing');
  const [mode, setMode] = useState('conversation');
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  const [showPractice, setShowPractice] = useState(false);
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("equitalk_api_key") || "");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  const handleSaveKey = (key) => {
    setUserApiKey(key);
    localStorage.setItem("equitalk_api_key", key);
    setShowApiKeyModal(false);
    setError(null);
    if (pendingRequest) handleAnalyze(pendingRequest.text, pendingRequest.fileList, key);
  };

  const handleStart = (selectedMode) => {
    setMode(selectedMode);
    setView('input');
    setError(null);
  };

  const handleAnalyze = async (text, fileList, keyOverride = null) => {
    setView('analyzing');
    setError(null);
    setPendingRequest({ text, fileList });
    const currentKey = keyOverride || userApiKey;
    try {
      const processedFiles = [];
      if (fileList && fileList.length > 0) {
        for (const file of fileList) {
          const payload = await processFile(file);
          processedFiles.push(payload);
        }
      }
      let systemPrompt = "";
      let schema = null;
      if (mode === 'conversation') {
        schema = CONVERSATION_SCHEMA;
        systemPrompt = `You are 'AITA? AI', a brutally honest judge. Determine who is the asshole based on logic/decency.
        TASK 1: ID Speakers/Roles. 
        TASK 2: The Asshole Score (-100 to 100).
        CRITICAL SCORING RULES:
        - -100 means Speaker A is 100% The Asshole (YTA).
        - 100 means Speaker B is 100% The Asshole (YTA).
        - 0 means neither/both (ESH/NAH).
        - The scale measures "Asshole-ness".
        Higher magnitude means BIGGER ASSHOLE.
        Provide evidence. 
        TASK 3: 6-Point Metric (Reasonableness, Toxicity, Logic, EQ, Manipulation, Clarity) with scores/quotes.
        TASK 4: Narrative/Resolve. Return JSON.`;
        if (text) systemPrompt += `\n\nTEXT INPUT:\n${text}`;
      } else {
        schema = BS_SCHEMA;
        systemPrompt = `Analyze text for BS.
        Score 0-100 (100=Truth). Find lies/contradictions. Return JSON.`;
        if (text) systemPrompt += `\n\nTEXT INPUT:\n${text}`;
      }
      
      const result = await callGemini(systemPrompt, processedFiles, schema, currentKey);
      setAnalysisData(result);
      setView('results');
      setPendingRequest(null);
    } catch (err) {
      console.error(err);
      if (err.message.includes("401") || err.message.includes("403") || err.message.includes("Authorization")) {
         setError("Authorization Error: 401. The system API key is missing or invalid.");
      } else {
         setError(err.message || "We encountered an issue connecting to the Gemini API.");
      }
    }
  };

  const handleReset = () => {
    setAnalysisData(null);
    setView('landing');
    setError(null);
    setShowPractice(false);
    setPendingRequest(null);
    window.history.pushState({}, document.title, window.location.pathname);
  };

  const handleRetry = () => {
    if (pendingRequest) handleAnalyze(pendingRequest.text, pendingRequest.fileList);
    else setView('input');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 relative">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div onClick={handleReset} className="flex items-center gap-2 cursor-pointer group">
            <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:bg-indigo-600 transition-colors">
              <Activity size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight">AITA<span className="text-indigo-600">?</span></span>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] max-w-6xl mx-auto px-6 w-full">
        {view === 'landing' && <LandingPage onStart={handleStart} />}
        {view === 'input' && <InputScreen mode={mode} onAnalyze={(t, f) => handleAnalyze(t, f, null)} onBack={() => setView('landing')} />}
        {view === 'analyzing' && <AnalysisLoader error={error} onRetryWithKey={() => setShowApiKeyModal(true)} onRetry={handleRetry} />}
        {view === 'results' && mode === 'conversation' && analysisData && (
           <ConversationResults 
             data={analysisData} 
             onReset={handleReset} 
             onPractice={() => setShowPractice(true)}
             userApiKey={userApiKey}
           />
        )}
        {view === 'results' && mode === 'bs' && analysisData && <BSResults data={analysisData} onReset={handleReset} />}
      </main>

      {showPractice && analysisData && <PracticeDojo analysis={analysisData} onExit={() => setShowPractice(false)} userApiKey={userApiKey} />}
      {showApiKeyModal && <ApiKeyModal onSave={handleSaveKey} onCancel={() => setShowApiKeyModal(false)} />}
    </div>
  );
}