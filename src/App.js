import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { sendToDialogflow } from "./dialogflowClient";
import { Mic, MicOff, Shield, Zap, Film, Home, Wifi, Settings } from "lucide-react";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function App() {
  const [alarm, setAlarm] = useState("off");
  const [override, setOverride] = useState("off");
  const [movieNight, setMovieNight] = useState("off");
  const [manualTranscript, setManualTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [processingVoice, setProcessingVoice] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firebase listeners
  useEffect(() => {
    const alarmRef = ref(db, "alarm");
    const overrideRef = ref(db, "override");
    const movieRef = ref(db, "movie_night");

    // Set initial connection status
    setConnectionStatus("connected");

    const unsubscribeAlarm = onValue(alarmRef, (snapshot) => {
      if (snapshot.exists()) {
        setAlarm(snapshot.val());
      }
    }, (error) => {
      console.error("Firebase alarm error:", error);
      setConnectionStatus("error");
    });

    const unsubscribeOverride = onValue(overrideRef, (snapshot) => {
      if (snapshot.exists()) {
        setOverride(snapshot.val());
      }
    }, (error) => {
      console.error("Firebase override error:", error);
      setConnectionStatus("error");
    });

    const unsubscribeMovie = onValue(movieRef, (snapshot) => {
      if (snapshot.exists()) {
        setMovieNight(snapshot.val());
      }
    }, (error) => {
      console.error("Firebase movie error:", error);
      setConnectionStatus("error");
    });

    // Cleanup listeners
    return () => {
      unsubscribeAlarm();
      unsubscribeOverride();
      unsubscribeMovie();
    };
  }, []);

  // Enhanced speech recognition with better error handling
  const manualStartListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ Your browser does not support Web Speech API. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      console.log("🎤 Voice recognition started");
      setListening(true);
      setManualTranscript("");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      console.log("🎙️ Voice result:", spokenText, "Confidence:", confidence);
      setManualTranscript(spokenText);
      
      // Auto-process if confidence is high
      if (confidence > 0.8) {
        setTimeout(() => handleVoice(spokenText), 500);
      }
    };

    recognition.onerror = (event) => {
      console.error("❌ Voice recognition error:", event.error);
      let errorMessage = "Voice recognition error: ";
      
      switch(event.error) {
        case 'no-speech':
          errorMessage += "No speech detected. Please try again.";
          break;
        case 'audio-capture':
          errorMessage += "No microphone found. Please check your microphone.";
          break;
        case 'not-allowed':
          errorMessage += "Microphone permission denied. Please allow microphone access.";
          break;
        case 'network':
          errorMessage += "Network error. Please check your internet connection.";
          break;
        default:
          errorMessage += event.error;
      }
      
      alert(errorMessage);
      setListening(false);
    };

    recognition.onend = () => {
      console.log("🛑 Voice recognition ended");
      setListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Error starting recognition:", error);
      setListening(false);
      alert("❌ Could not start voice recognition. Please try again.");
    }
  };

  // Enhanced voice command handling with Dialogflow
  const handleVoice = async (transcript = null) => {
    const textToProcess = transcript || manualTranscript;
    
    if (!textToProcess.trim()) {
      alert("❗ Please say something before processing the command.");
      return;
    }

    setProcessingVoice(true);

    try {
      console.log("🚀 Sending to Dialogflow:", textToProcess);
      const result = await sendToDialogflow(textToProcess);
      console.log("📨 Dialogflow response:", result);

      const intent = result?.intent?.displayName;
      const params = result?.parameters;
      const fulfillmentText = result?.fulfillmentText;

      if (!intent) {
        alert("❌ Sorry, I didn't understand that command. Try saying 'turn on alarm' or 'start movie night'.");
        return;
      }

      // Handle different intents
      switch (intent) {
        case "alarm_toggle":
          await handleAlarmToggle(params?.state, fulfillmentText);
          break;
        case "override_toggle":
          await handleOverrideToggle(params?.state, fulfillmentText);
          break;
        case "movie_night_toggle":
          await handleMovieNightToggle(params?.state, fulfillmentText);
          break;
        case "status_check":
          showSystemStatus();
          break;
        case "help":
          showVoiceHelp();
          break;
        default:
          alert(`⚠️ Command recognized but not implemented: ${intent}`);
      }

      // Show Dialogflow response if available
      if (fulfillmentText) {
        console.log("🤖 Assistant:", fulfillmentText);
      }

    } catch (error) {
      console.error("❌ Dialogflow error:", error);
      alert("❌ Error processing voice command. Please check your Dialogflow configuration.");
    } finally {
      setProcessingVoice(false);
      setManualTranscript("");
    }
  };

  // Device control functions with Firebase
  const handleAlarmToggle = async (state, message) => {
    try {
      if (state) {
        await set(ref(db, "alarm"), state);
        alert(message || `✅ Security alarm ${state === 'on' ? 'activated' : 'deactivated'}!`);
      } else {
        // Toggle if no specific state provided
        const newState = alarm === "on" ? "off" : "on";
        await set(ref(db, "alarm"), newState);
        alert(`✅ Security alarm ${newState === 'on' ? 'activated' : 'deactivated'}!`);
      }
    } catch (error) {
      console.error("Error updating alarm:", error);
      alert("❌ Failed to update alarm. Please try again.");
    }
  };

  const handleOverrideToggle = async (state, message) => {
    try {
      if (state) {
        await set(ref(db, "override"), state);
        alert(message || `✅ Override mode ${state === 'on' ? 'enabled' : 'disabled'}!`);
      } else {
        const newState = override === "on" ? "off" : "on";
        await set(ref(db, "override"), newState);
        alert(`✅ Override mode ${newState === 'on' ? 'enabled' : 'disabled'}!`);
      }
    } catch (error) {
      console.error("Error updating override:", error);
      alert("❌ Failed to update override mode. Please try again.");
    }
  };

  const handleMovieNightToggle = async (state, message) => {
    try {
      if (state) {
        await set(ref(db, "movie_night"), state);
        alert(message || `🎬 Movie night ${state === 'on' ? 'started' : 'ended'}!`);
      } else {
        const newState = movieNight === "on" ? "off" : "on";
        await set(ref(db, "movie_night"), newState);
        alert(`🎬 Movie night ${newState === 'on' ? 'started' : 'ended'}!`);
      }
    } catch (error) {
      console.error("Error updating movie night:", error);
      alert("❌ Failed to update movie night mode. Please try again.");
    }
  };

  // Helper functions
  const showSystemStatus = () => {
    const status = `
System Status:
🚨 Alarm: ${alarm.toUpperCase()}
🛡️ Override: ${override.toUpperCase()}
🎬 Movie Night: ${movieNight.toUpperCase()}
📡 Connection: ${connectionStatus.toUpperCase()}
    `;
    alert(status);
  };

  const showVoiceHelp = () => {
    const help = `
Voice Commands:
• "Turn on/off the alarm"
• "Enable/disable override"
• "Start/stop movie night"
• "What's the status?"
• "Help"

Try speaking clearly and wait for the beep!
    `;
    alert(help);
  };

  // Manual device toggles
  const toggleAlarm = () => handleAlarmToggle();
  const toggleOverride = () => handleOverrideToggle();
  const toggleMovieNight = () => handleMovieNightToggle();

  // Device Card Component
  const DeviceCard = ({ title, status, onToggle, icon: Icon, accentColor, description }) => (
    <div className="group relative">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
      <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${accentColor} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status === 'on' ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-gray-500'} transition-all duration-300`}></div>
            <span className="text-sm text-gray-300 capitalize">{status}</span>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-4">{description}</p>
        
        <button
          onClick={onToggle}
          className={`w-full py-3 px-4 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${
            status === 'on' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40' 
              : 'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-200 hover:from-gray-500 hover:to-gray-600 shadow-lg'
          }`}
        >
          {status === 'on' ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
    </div>
  );

  // Connection status indicator
  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-400';
      case 'connecting': return 'bg-yellow-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Home className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Smart Home
              </h1>
              <p className="text-gray-400">Control your connected devices</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-gray-400">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div className="p-3 backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20">
              <Wifi className={`w-6 h-6 ${connectionStatus === 'connected' ? 'text-green-400' : connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>

        {/* Voice Control Section */}
        <div className="mb-8">
          <div className="backdrop-blur-xl bg-gradient-to-r from-white/10 to-white/5 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Voice Assistant</h2>
                <p className="text-gray-400">Control your devices with voice commands</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={manualStartListening}
                disabled={listening || processingVoice}
                className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                  listening 
                    ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/25 animate-pulse' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                }`}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {listening ? 'Listening...' : 'Start Listening'}
              </button>

              <button
                onClick={() => handleVoice()}
                disabled={!manualTranscript.trim() || processingVoice}
                className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Zap className={`w-5 h-5 ${processingVoice ? 'animate-spin' : ''}`} />
                {processingVoice ? 'Processing...' : 'Execute Command'}
              </button>

              <button
                onClick={showVoiceHelp}
                className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-medium bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 transform hover:scale-105"
              >
                <Settings className="w-5 h-5" />
                Voice Help
              </button>
            </div>

            <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${listening ? 'bg-red-400 animate-pulse' : processingVoice ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm text-gray-400">
                  {listening ? 'Listening for commands...' : processingVoice ? 'Processing with Dialogflow...' : 'Ready to listen'}
                </span>
              </div>
              <p className="text-white font-mono bg-black/20 rounded-xl p-3 min-h-[3rem] flex items-center">
                {manualTranscript || "Say something like 'Turn on the alarm' or 'Start movie night'"}
              </p>
            </div>
          </div>
        </div>

        {/* Device Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DeviceCard
            title="Security Alarm"
            status={alarm}
            onToggle={toggleAlarm}
            icon={Shield}
            accentColor="from-red-500 to-pink-600"
            description="Monitor and secure your home"
          />
          
          <DeviceCard
            title="Override Mode"
            status={override}
            onToggle={toggleOverride}
            icon={Settings}
            accentColor="from-orange-500 to-red-600"
            description="Emergency override controls"
          />
          
          <DeviceCard
            title="Movie Night"
            status={movieNight}
            onToggle={toggleMovieNight}
            icon={Film}
            accentColor="from-purple-500 to-indigo-600"
            description="Optimize settings for entertainment"
          />
        </div>

        {/* Enhanced Status Bar */}
        <div className="mt-8 backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-400">System Online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionColor()}`}></div>
                <span className="text-gray-400">Firebase {connectionStatus}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                <span className="text-gray-400">Dialogflow Ready</span>
              </div>
            </div>
            <div className="text-gray-500">
              Last updated: {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;