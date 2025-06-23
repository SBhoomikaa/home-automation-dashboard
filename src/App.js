import React, { useEffect, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import { sendToDialogflow } from "./dialogflowClient";
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

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    const alarmRef = ref(db, "alarm");
    const overrideRef = ref(db, "override");

    onValue(alarmRef, (snapshot) => {
      if (snapshot.exists()) setAlarm(snapshot.val());
    });

    onValue(overrideRef, (snapshot) => {
      if (snapshot.exists()) setOverride(snapshot.val());
    });
  }, []);

  useEffect(() => {
    console.log("🎙️ Transcript updated:", transcript);
  }, [transcript]);

  const handleVoice = async () => {
    if (!transcript.trim()) {
      alert("❗ Say something before sending to Dialogflow.");
      return;
    }

    const result = await sendToDialogflow(transcript);
    console.log("Dialogflow result:", result);

    const intent = result?.intent?.displayName;
    const params = result?.parameters;

    if (!intent) {
      alert("❌ No intent detected.");
      resetTranscript();
      return;
    }

    if (intent === "alarm_toggle") {
      const val = params?.state;
      if (val) {
        set(ref(db, "alarm"), val);
        alert("✅ Alarm updated via voice!");
      } else {
        alert("⚠️ Could not find alarm state.");
      }
    } else if (intent === "override_toggle") {
      const val = params?.state;
      if (val) {
        set(ref(db, "override"), val);
        alert("✅ Override updated via voice!");
      } else {
        alert("⚠️ Could not find override state.");
      }
    } else {
      alert(`⚠️ Unknown command: ${intent}`);
    }

    resetTranscript();
  };

  const startListening = () => {
    try {
      // Stop any previous instance before starting again
      SpeechRecognition.abortListening();
      resetTranscript();

      SpeechRecognition.startListening({
        continuous: false,
        interimResults: true,
        language: "en-US"
      });
    } catch (err) {
      console.error("❌ Error starting voice recognition:", err);
    }
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        ❌ Your browser does not support speech recognition.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold">🏠 Home Automation Dashboard + Voice</h1>

      <div className="flex gap-4">
        <button className="px-4 py-2 bg-yellow-600 rounded" onClick={startListening}>
          🎤 Start Voice
        </button>
        <button className="px-4 py-2 bg-gray-700 rounded" onClick={stopListening}>
          🛑 Stop
        </button>
        <button className="px-4 py-2 bg-blue-600 rounded" onClick={handleVoice}>
          🚀 Send to Dialogflow
        </button>
      </div>

      <div className="text-sm text-gray-300">
        🎙️ Listening:{" "}
        <span className={listening ? "text-green-400" : "text-red-400"}>
          {listening ? "Yes" : "No"}
        </span>
      </div>

      <p className="text-green-400 mt-2 max-w-lg text-center">
        Transcript: <em>{transcript || "🎧 Waiting for your voice..."}</em>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-800 p-6 rounded-2xl text-center">
          <h2 className="text-xl mb-2">Alarm</h2>
          <p className="mb-2">Current: <strong>{alarm}</strong></p>
          <button
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
            onClick={() => set(ref(db, "alarm"), alarm === "on" ? "off" : "on")}
          >
            Toggle Alarm
          </button>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl text-center">
          <h2 className="text-xl mb-2">Override</h2>
          <p className="mb-2">Current: <strong>{override}</strong></p>
          <button
            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded"
            onClick={() => set(ref(db, "override"), override === "on" ? "off" : "on")}
          >
            Toggle Override
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
