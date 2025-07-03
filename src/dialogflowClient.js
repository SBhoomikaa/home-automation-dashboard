import axios from "axios";

// Replace this with your deployed backend URL
const PROXY_URL = "https://dialogflow-proxy-rkio.onrender.com";

export async function sendToDialogflow(text) {
  try {
    const response = await axios.post(`${PROXY_URL}/detect-intent`, { text });
    return response.data;
  } catch (err) {
    console.error("❌ Error sending to Dialogflow:", err);
    return { intent: { displayName: "unknown" }, parameters: {} };
  }
}
