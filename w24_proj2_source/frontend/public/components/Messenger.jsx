import { useState, useEffect } from "react";
import { sendMessage, fetchMessages } from "../api";
import Conversation from "./Conversation";

export default function Messenger({ username }) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([]);

  async function loadMessages() {
    const msgs = await fetchMessages(username);
    setConversation(msgs);
  }

  async function handleSend() {
    await sendMessage(username, recipient, message);
    setMessage("");
    loadMessages();
  }

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card">
      <h2>Send Message</h2>

      <input
        type="text"
        placeholder="Recipient username"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />

      <textarea
        placeholder="Message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button onClick={handleSend}>Send</button>

      <Conversation conversation={conversation} />
    </div>
  );
}
