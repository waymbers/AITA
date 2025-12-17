import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  MessageSquare, AlertTriangle, CheckCircle2, Upload, ArrowRight, 
  Activity, ShieldCheck, Info, RefreshCcw, Scale, Zap, FileImage, 
  FileText, X, Smartphone, Users, Sparkles, Copy, Loader2, Trophy, 
  Gavel, BrainCircuit, HeartCrack, Mic, Search, ChevronDown, 
  ChevronUp, Quote, TrendingUp, Bot, Wand2, Send, Paperclip, 
  Key, Skull, PenTool, Link as LinkIcon, Globe, Lock, Siren 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * UTILITIES & CONFIG
 */
const firebaseConfig = {}; // Your config here
const getSpeechRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognition ? new SpeechRecognition() : null;
};

// ... (Keep your callGemini, processFile, and Schemas here) ...

/**
 * MAIN COMPONENT
 */
export default function EquiTalkPro() {
  const [view, setView] = useState('landing');
  const [mode, setMode] = useState('conversation');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedArgument, setRecordedArgument] = useState("");
  const recognitionRef = useRef(null);

  const handleRecordArgument = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = getSpeechRecognition();
    if (!recognition) {
      alert("Speech recognition not supported.");
      return;
    }
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      setRecordedArgument(prev => prev + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    setIsRecording(true);
    recognition.start();
  };

  // ... (Rest of your component UI logic) ...

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 relative">
      {/* Live Argument Recorder UI */}
      <div className="fixed top-4 right-4 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex flex-col items-end gap-2">
        <button onClick={handleRecordArgument} className={`px-4 py-2 rounded-lg font-bold shadow ${isRecording ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {isRecording ? 'Stop Recording' : 'Record Live Argument'}
        </button>
        <textarea
          className="w-72 h-32 p-2 border border-slate-300 rounded-lg text-slate-800 mt-2"
          placeholder="Your argument will appear here..."
          value={recordedArgument}
          onChange={e => setRecordedArgument(e.target.value)}
        />
      </div>
      {/* ... The rest of your Header and Main views ... */}
    </div>
  );
}