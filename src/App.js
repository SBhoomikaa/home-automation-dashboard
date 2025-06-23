// Updated App.js with the new UI design but retaining the original backend logic

import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { sendToDialogflow } from "./dialogflowClient";
import { Mic, MicOff, Shield, Zap, Film, Home, Wifi, Settings } from "lucide-react";
import "./index.css"; // Tailwind styles

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const alarmRef = ref(db, "alarm");
    const overrideRef = ref(db, "override");
    const movieRef = ref(db, "movie_night");

    onValue(alarmRef, (snapshot) => {
      if (snapshot.exists()) setAlarm(snapshot.val());
    });

    onValue(overrideRef, (snapshot) => {
      if (snapshot.exists()) setOverride(snapshot.val());
    });

    onValue(movieRef, (snapshot) => {
      if (snapshot.exists()) setMovieNight(snapshot.val());
    });
  }, []);

  const manualStartListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("❌ Your browser does not support Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setManualTranscript("");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setManualTranscript(spokenText);
    };

    recognition.onerror = (e) => {
      alert("Error: " + e.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const handleVoice = async () => {
    if (!manualTranscript.trim()) {
      alert("❗ Say something before sending to Dialogflow.");
      return;
    }

    const result = await sendToDialogflow(manualTranscript);
    const intent = result?.intent?.displayName;
    const params = result?.parameters;

    if (!intent) {
      alert("❌ No intent detected.");
      return;
    }

    if (intent === "alarm_toggle") {
      const val = params?.state;
      if (val) {
        set(ref(db, "alarm"), val);
        alert("✅ Alarm updated via voice!");
      }
    } else if (intent === "override_toggle") {
      const val = params?.state;
      if (val) {
        set(ref(db, "override"), val);
        alert("✅ Override updated via voice!");
      }
    } else if (intent === "movie_night_toggle") {
      const val = params?.state;
      if (val) {
        set(ref(db, "movie_night"), val);
        alert("🎬 Movie Night mode set via voice!");
      }
    } else {
      alert(`⚠️ Unknown command: ${intent}`);
    }

    setManualTranscript("");
  };

  const DeviceCard = ({ title, status, onToggle, icon: Icon, accentColor, description, field }) => (
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
          onClick={() => onToggle(field, status === "on" ? "off" : "on")}
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

  const updateFirebase = (field, value) => {
    set(ref(db, field), value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Home className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Smart Control
              </h1>
              <p className="text-gray-400">Voice controlled automation</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-gray-400">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Voice Assistant</h2>
                <p className="text-gray-400">Speak to control devices</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button
                onClick={manualStartListening}
                disabled={listening}
                className={`flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-white ${
                  listening
                    ? 'bg-gradient-to-r from-red-500 to-pink-600'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-600'
                }`}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} {listening ? 'Listening...' : 'Start Listening'}
              </button>

              <button
                onClick={handleVoice}
                disabled={!manualTranscript.trim()}
                className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-white bg-gradient-to-r from-green-500 to-teal-600"
              >
                <Zap className="w-5 h-5" /> Execute
              </button>
            </div>

            <div className="bg-black/20 rounded-xl p-4">
              <p className="text-white font-mono">{manualTranscript || "Say 'turn on the alarm'..."}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DeviceCard
            title="Security Alarm"
            status={alarm}
            onToggle={updateFirebase}
            field="alarm"
            icon={Shield}
            accentColor="from-red-500 to-pink-600"
            description="Enable or disable security system"
          />
          <DeviceCard
            title="Override Mode"
            status={override}
            onToggle={updateFirebase}
            field="override"
            icon={Settings}
            accentColor="from-orange-500 to-red-600"
            description="Toggle emergency override"
          />
          <DeviceCard
            title="Movie Night"
            status={movieNight}
            onToggle={updateFirebase}
            field="movie_night"
            icon={Film}
            accentColor="from-purple-500 to-indigo-600"
            description="Activate cinematic mode"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
