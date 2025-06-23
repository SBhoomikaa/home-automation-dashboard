import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { sendToDialogflow } from "./dialogflowClient";
import "./index.css"; // Tailwind styles
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
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const alarmRef = ref(db, "alarm");
    const overrideRef = ref(db, "override");
    const movieRef = ref(db, "movie_night");
    const connRef = ref(db, ".info/connected");

    onValue(connRef, (snap) => {
      setFirebaseConnected(snap.val() === true);
    });

    onValue(alarmRef, (snap) => {
      if (snap.exists()) setAlarm(snap.val());
    });

    onValue(overrideRef, (snap) => {
      if (snap.exists()) setOverride(snap.val());
    });

    onValue(movieRef, (snap) => {
      if (snap.exists()) setMovieNight(snap.val());
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
      setManualTranscript(event.results[0][0].transcript);
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
    setLoading(true);
    try {
      const result = await sendToDialogflow(manualTranscript);
      const intent = result?.intent?.displayName;
      const params = result?.parameters;
      const intentMap = {
        alarm_toggle: "alarm",
        override_toggle: "override",
        movie_night_toggle: "movie_night",
      };
      const field = intentMap[intent];
      const value = params?.state;
      if (field && value) {
        await set(ref(db, field), value);
        alert(`✅ ${field} updated via voice!`);
      } else {
        alert(`⚠️ Unknown command: ${intent}`);
      }
    } catch (e) {
      console.error(e);
      alert("❌ Failed to send command to Dialogflow.");
    } finally {
      setManualTranscript("");
      setLoading(false);
    }
  };

  const updateFirebase = async (field, value) => {
    setLoading(true);
    try {
      const key = field === "movieNight" ? "movie_night" : field;
      await set(ref(db, key), value);
    } catch (e) {
      alert("❌ Error updating Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const DeviceCard = ({ title, status, onToggle, icon: Icon, accentColor, description, field }) => (
    <div className="p-6 rounded-xl border bg-white/10 text-white shadow-md hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <div className={`p-3 rounded-full ${accentColor}`}><Icon /></div>
        <div className={`text-sm ${status === "on" ? "text-green-400" : "text-red-400"}`}>
          {status.toUpperCase()}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-300 mb-4">{description}</p>
      <button
        onClick={() => onToggle(field, status === "on" ? "off" : "on")}
        disabled={loading}
        className={`w-full px-4 py-2 rounded text-white font-semibold transition ${
          status === "on" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {status === "on" ? "Turn Off" : "Turn On"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-2">IoT Voice Control Hub</h1>
        <p className="text-cyan-300">Real-time device control with Dialogflow</p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-center">
        <button
          onClick={manualStartListening}
          disabled={listening || loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {listening ? <MicOff /> : <Mic />} {listening ? "Stop Listening" : "Start Listening"}
        </button>

        <button
          onClick={handleVoice}
          disabled={!manualTranscript.trim() || loading}
          className="bg-green-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
        >
          <Zap className={loading ? "animate-spin" : ""} /> {loading ? "Processing..." : "Send Command"}
        </button>
      </div>

      <div className="text-white text-center mb-6">
        <p className="text-xl font-mono">
          {manualTranscript || "Try saying: 'Turn on the alarm' or 'Activate movie night'"}
        </p>
        <p className="text-sm text-gray-400">{currentTime.toLocaleString()}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <DeviceCard
          title="Security System"
          status={alarm}
          onToggle={updateFirebase}
          field="alarm"
          icon={Shield}
          accentColor="bg-red-500"
          description="Monitors doors, windows and alerts you to intrusion."
        />

        <DeviceCard
          title="Override System"
          status={override}
          onToggle={updateFirebase}
          field="override"
          icon={Settings}
          accentColor="bg-yellow-500"
          description="Manually overrides all devices in case of emergency."
        />

        <DeviceCard
          title="Movie Night Mode"
          status={movieNight}
          onToggle={updateFirebase}
          field="movieNight"
          icon={Film}
          accentColor="bg-purple-500"
          description="Sets the ambience for a perfect movie night."
        />
      </div>

      <div className="mt-10 text-center text-cyan-400 font-mono text-sm">
        Firebase: {firebaseConnected ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
}

export default App;
