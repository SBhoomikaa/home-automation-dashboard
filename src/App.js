import React, { useEffect, useState } from "react";
import { Mic, MicOff, Shield, Zap, Film, Home, Wifi, Settings } from "lucide-react";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: processa.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dialogflow integration
const queryDialogflow = async (text, sessionId = 'default-session') => {
  try {
    const response = await fetch('/api/dialogflow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        sessionId,
        projectId: import.meta.env.VITE_DIALOGFLOW_PROJECT_ID,
        location: import.meta.env.VITE_DIALOGFLOW_LOCATION
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error querying Dialogflow:', error);
    throw error;
  }
};

function App() {
  const [alarm, setAlarm] = useState("off");
  const [override, setOverride] = useState("off");
  const [movieNight, setMovieNight] = useState("off");
  const [manualTranscript, setManualTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Firebase real-time listener
  useEffect(() => {
    const deviceDocRef = doc(db, 'devices', 'home-controls');
    
    const unsubscribe = onSnapshot(deviceDocRef, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setAlarm(data.alarm || 'off');
          setOverride(data.override || 'off');
          setMovieNight(data.movieNight || 'off');
          setFirebaseConnected(true);
          console.log('✅ Firebase data updated:', data);
        } else {
          console.log('📄 No document found, creating default...');
          // Initialize document with default values
          updateDoc(deviceDocRef, {
            alarm: 'off',
            override: 'off',
            movieNight: 'off',
            lastUpdated: new Date().toISOString()
          }).catch(console.error);
        }
      },
      (error) => {
        console.error('❌ Firebase listener error:', error);
        setFirebaseConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update Firebase when state changes
  const updateFirebase = async (field, value) => {
    try {
      setLoading(true);
      const deviceDocRef = doc(db, 'devices', 'home-controls');
      await updateDoc(deviceDocRef, {
        [field]: value,
        lastUpdated: new Date().toISOString()
      });
      console.log(`✅ Updated ${field} to ${value}`);
    } catch (error) {
      console.error(`❌ Error updating ${field}:`, error);
      alert(`Error updating ${field}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  const manualStartListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ Your browser does not support Web Speech API. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("🎤 Speech recognition started");
      setListening(true);
      setManualTranscript("");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      console.log("🎙️ Speech result:", spokenText);
      setManualTranscript(spokenText);
    };

    recognition.onerror = (e) => {
      console.error("❌ Speech recognition error:", e.error);
      let errorMessage = "Speech recognition error: ";
      switch(e.error) {
        case 'network':
          errorMessage += "Network error. Check your internet connection.";
          break;
        case 'not-allowed':
          errorMessage += "Microphone access denied. Please allow microphone access.";
          break;
        case 'no-speech':
          errorMessage += "No speech detected. Please speak clearly.";
          break;
        default:
          errorMessage += e.error;
      }
      alert(errorMessage);
      setListening(false);
    };

    recognition.onend = () => {
      console.log("🛑 Speech recognition ended");
      setListening(false);
    };

    recognition.start();
  };

  const handleVoice = async () => {
    if (!manualTranscript.trim()) {
      alert("❗ Please say something before processing the command.");
      return;
    }

    setLoading(true);
    try {
      console.log("🤖 Sending to Dialogflow:", manualTranscript);
      const result = await queryDialogflow(manualTranscript);
      
      console.log("Dialogflow response:", result);

      if (!result.intent) {
        alert("❌ Could not understand the command. Try saying 'turn on alarm' or 'start movie night'");
        return;
      }

      const intentName = result.intent.displayName;
      const parameters = result.parameters;

      // Process the intent and update Firebase
      if (intentName === "alarm_control") {
        const state = parameters.state || parameters['device-state'];
        if (state) {
          await updateFirebase('alarm', state);
          alert(`✅ Alarm ${state} via voice command!`);
        }
      } else if (intentName === "override_control") {
        const state = parameters.state || parameters['device-state'];
        if (state) {
          await updateFirebase('override', state);
          alert(`✅ Override mode ${state} via voice command!`);
        }
      } else if (intentName === "movie_control") {
        const state = parameters.state || parameters['device-state'];
        if (state) {
          await updateFirebase('movieNight', state);
          alert(`🎬 Movie Night mode ${state} via voice command!`);
        }
      } else {
        alert(`⚠️ Command recognized but not implemented: ${intentName}`);
      }

    } catch (error) {
      console.error("❌ Error processing voice command:", error);
      alert("❌ Error processing voice command. Check console for details.");
    } finally {
      setLoading(false);
      setManualTranscript("");
    }
  };

  const DeviceCard = ({ title, status, onToggle, icon: Icon, accentColor, description, field }) => (
    <div className="group relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 scale-110"></div>
      
      <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/8 rounded-3xl p-8 border-2 border-white/20 hover:border-white/40 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-black/25 transform-gpu">
        {/* Top section with icon and status */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <div className={`p-4 rounded-3xl bg-gradient-to-br ${accentColor} shadow-2xl`}>
              <Icon className="w-8 h-8 text-white" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-3xl"></div>
            </div>
            {status === 'on' && <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>}
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full transition-all duration-500 ${
              status === 'on' 
                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/60 animate-pulse' 
                : 'bg-gray-500 shadow-inner'
            }`}></div>
            <span className="text-lg font-bold text-white capitalize tracking-wide">
              {status === 'on' ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
        
        {/* Content */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">{title}</h3>
          <p className="text-cyan-300/80 text-base leading-relaxed">{description}</p>
        </div>
        
        {/* Action button */}
        <button
          onClick={() => onToggle(field, status === "on" ? "off" : "on")}
          disabled={loading}
          className={`group/btn relative w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-500 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
            status === 'on' 
              ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60' 
              : 'bg-gradient-to-br from-gray-600 via-slate-600 to-gray-700 text-gray-200 hover:from-gray-500 hover:to-slate-600 shadow-2xl shadow-gray-600/40'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
          <span className="relative z-10">
            {loading ? 'UPDATING...' : (status === 'on' ? 'DEACTIVATE' : 'ACTIVATE')}
          </span>
          {loading && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-cyan-400/15 to-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-indigo-400/15 to-purple-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/3 w-72 h-72 bg-gradient-to-br from-teal-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full blur-3xl animate-pulse delay-300"></div>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <div className="relative p-4 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 rounded-3xl shadow-2xl shadow-blue-500/25">
              <Home className="w-10 h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-white via-cyan-200 to-blue-300 bg-clip-text text-transparent">
                IoT Control Hub
              </h1>
              <p className="text-cyan-300/80 text-lg font-medium">Real-time device management system</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-white font-mono tracking-tight">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-cyan-300/70 font-medium">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div className={`relative p-4 backdrop-blur-xl bg-white/10 rounded-3xl border-2 transition-all duration-300 ${firebaseConnected ? 'border-emerald-400/50 shadow-lg shadow-emerald-400/20' : 'border-red-400/50 shadow-lg shadow-red-400/20'}`}>
              <Wifi className={`w-8 h-8 ${firebaseConnected ? 'text-emerald-400' : 'text-red-400'}`} />
              {firebaseConnected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>}
            </div>
          </div>
        </div>

        {/* Voice Control Section */}
        <div className="mb-10">
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/5 rounded-3xl p-8 border-2 border-white/20 shadow-2xl shadow-black/20">
            {/* Glowing border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-blue-500/20 to-indigo-600/20 rounded-3xl blur-xl opacity-50"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-6 mb-6">
                <div className="relative p-4 bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-700 rounded-3xl shadow-2xl shadow-indigo-500/25">
                  <Mic className="w-8 h-8 text-white" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl"></div>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">AI Voice Assistant</h2>
                  <p className="text-cyan-300/80 text-lg">Intelligent voice control system</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <button
                  onClick={manualStartListening}
                  disabled={listening || loading}
                  className={`group relative flex items-center justify-center gap-4 py-6 px-8 rounded-3xl font-bold text-lg transition-all duration-500 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                    listening 
                      ? 'bg-gradient-to-br from-red-500 via-pink-500 to-rose-600 text-white shadow-2xl shadow-red-500/40 animate-pulse' 
                      : 'bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-600 text-white shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {listening ? <MicOff className="w-7 h-7 animate-pulse relative z-10" /> : <Mic className="w-7 h-7 relative z-10" />}
                  <span className="relative z-10">{listening ? 'Stop Listening' : 'Start Voice Control'}</span>
                  {listening && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>}
                </button>

                <button
                  onClick={handleVoice}
                  disabled={!manualTranscript.trim() || loading}
                  className="group relative flex items-center justify-center gap-4 py-6 px-8 rounded-3xl font-bold text-lg bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-500 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Zap className={`w-7 h-7 relative z-10 ${loading ? 'animate-spin' : ''}`} />
                  <span className="relative z-10">{loading ? 'Processing Command...' : 'Execute Command'}</span>
                </button>
              </div>

              <div className="backdrop-blur-sm bg-black/20 rounded-3xl p-6 border border-white/10 shadow-inner">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-4 h-4 rounded-full ${listening ? 'bg-red-400 animate-pulse shadow-lg shadow-red-400/50' : 'bg-gray-500'}`}></div>
                  <span className="text-lg font-semibold text-cyan-300">
                    {listening ? 'Listening for voice commands...' : 'Voice recognition ready'}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-gray-900/80 to-black/80 rounded-2xl p-6 border border-cyan-500/20">
                  <p className="text-white font-mono text-lg leading-relaxed min-h-[4rem] flex items-center">
                    {manualTranscript || "Try: 'Turn on the security alarm' or 'Start movie night mode'"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Device Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
          <DeviceCard
            title="Security System"
            status={alarm}
            onToggle={updateFirebase}
            field="alarm"
            icon={Shield}
            accentColor="from-red-500 via-rose-500 to-pink-600"
            description="Advanced security monitoring and alert system"
          />
          
          <DeviceCard
            title="Emergency Override"
            status={override}
            onToggle={updateFirebase}
            field="override"
            icon={Settings}
            accentColor="from-orange-500 via-amber-500 to-yellow-600"
            description="Critical system override and emergency controls"
          />
          
          <DeviceCard
            title="Entertainment Mode"
            status={movieNight}
            onToggle={updateFirebase}
            field="movieNight"
            icon={Film}
            accentColor="from-purple-500 via-violet-500 to-indigo-600"
            description="Optimized lighting and audio for entertainment"
          />
        </div>

        {/* Status Bar */}
        <div className="backdrop-blur-xl bg-gradient-to-r from-white/10 to-white/5 rounded-2xl p-6 border-2 border-white/15 shadow-2xl">
          <div className="flex items-center justify-between text-base flex-wrap gap-6">
            <div className="flex items-center gap-8 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-4 h-4 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"></div>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-50"></div>
                </div>
                <span className="text-cyan-300 font-semibold">System Online</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-4 h-4 rounded-full shadow-lg ${firebaseConnected ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-red-400 shadow-red-400/50'}`}></div>
                  {firebaseConnected && <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-50"></div>}
                </div>
                <span className="text-cyan-300 font-semibold">
                  Database {firebaseConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {loading && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"></div>
                    <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-50"></div>
                  </div>
                  <span className="text-yellow-300 font-semibold">Processing Commands...</span>
                </div>
              )}
            </div>
            
            <div className="text-cyan-300/70 font-mono text-sm">
              Last sync: {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;