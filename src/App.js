import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// Firebase config from .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function App() {
  const [alarm, setAlarm] = useState("off");
  const [override, setOverride] = useState("off");

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

  const toggleAlarm = () => {
    const newState = alarm === "on" ? "off" : "on";
    set(ref(db, "alarm"), newState);
  };

  const toggleOverride = () => {
    const newState = override === "on" ? "off" : "on";
    set(ref(db, "override"), newState);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold">🏠 Home Automation Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-2xl shadow-md text-center">
          <h2 className="text-xl mb-2">Alarm</h2>
          <p className="mb-2">Current state: <strong>{alarm}</strong></p>
          <button
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
            onClick={toggleAlarm}
          >
            Toggle Alarm
          </button>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl shadow-md text-center">
          <h2 className="text-xl mb-2">Override</h2>
          <p className="mb-2">Current state: <strong>{override}</strong></p>
          <button
            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded"
            onClick={toggleOverride}
          >
            Toggle Override
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
