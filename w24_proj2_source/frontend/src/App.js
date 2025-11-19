import React, { useState } from 'react';
import './style.css';

function App() {
  const [users, setUsers] = useState([]);
  const [certs, setCerts] = useState({});
  const [currentUser, setCurrentUser] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState({});
  const [showCert, setShowCert] = useState(false);

  function generateCertificate(username) {
    return {
      username,
      certId: Math.random().toString(36).substring(2, 10),
      issuedAt: new Date().toLocaleString(),
      publicKey: 'MockPublicKey_' + username,
    };
  }

  const handleRegister = () => {
    if (!currentUser || users.includes(currentUser)) return;

    setUsers([...users, currentUser]);
    setConversations((prev) => ({ ...prev, [currentUser]: [] }));

    const cert = generateCertificate(currentUser);
    setCerts((prev) => ({ ...prev, [currentUser]: cert }));
  };

  const handleSend = () => {
    if (!currentUser || !recipient || !message || !users.includes(recipient) || currentUser === recipient) return;

    const newMessage = {
      from: currentUser,
      to: recipient,
      text: message,
      timestamp: Date.now(),
    };

    setConversations((prev) => ({
      ...prev,
      [recipient]: [...(prev[recipient] || []), newMessage],
    }));

    setMessage('');
  };

  const conversationMessages = (
    (conversations[currentUser] || [])
      .concat(conversations[recipient] || [])
      .filter(
        (msg) =>
          (msg.from === currentUser && msg.to === recipient) ||
          (msg.from === recipient && msg.to === currentUser)
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  );

  return (
    <div className="dark-app-bg">
      <header className="dark-header-bar">
        <div className="header-left">
          <div className="profile-icon">👤</div>
          <div className="header-info">
            <div className="header-user">{recipient || 'No Chat Selected'}</div>
            {recipient && <div className="online-status">● Online</div>}
          </div>
        </div>
      </header>

      <div className="dark-container">
        <div className="top-row">
          <div className="dark-section box">
            <h2>User Setup</h2>

            <input
              type="text"
              className="styled-input"
              placeholder="Enter username"
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
            />

            <button className="styled-btn" onClick={handleRegister}>
              Register
            </button>

            <div className="status-text">
              {users.includes(currentUser) ? `Registered as ${currentUser}` : ''}
            </div>

            {users.includes(currentUser) && certs[currentUser] && (
              <div className="cert-toggle">
                <button className="styled-btn" onClick={() => setShowCert(!showCert)}>
                  {showCert ? 'Hide Certificate' : 'Show Certificate'}
                </button>

                <div className={showCert ? 'cert-info show' : 'cert-info blurred'}>
                  <h3>Certificate</h3>
                  <div><b>Username:</b> {certs[currentUser].username}</div>
                  <div><b>Cert ID:</b> {certs[currentUser].certId}</div>
                  <div><b>Issued At:</b> {certs[currentUser].issuedAt}</div>
                  <div><b>Public Key:</b> {certs[currentUser].publicKey}</div>
                </div>
              </div>
            )}
          </div>

          <div className="dark-section box">
            <h2>Send Message</h2>

            <input
              type="text"
              className="styled-input"
              placeholder="Recipient username"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />

            <textarea
              className="styled-input"
              placeholder="Type your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <button className="styled-btn" onClick={handleSend}>
              Send
            </button>
          </div>
        </div>

        <div className="conversation-section box dark-conversation-bg">
          <h2>Conversation</h2>

          <div className="conversation">
            {users.includes(currentUser) && users.includes(recipient) ? (
              conversationMessages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.from === currentUser
                      ? 'bubble bubble-right dark-bubble-right'
                      : 'bubble bubble-left dark-bubble-left'
                  }
                >
                  <div className="bubble-content">
                    <div className="bubble-text">{msg.text}</div>
                    <div className="bubble-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-convo">No conversation yet.</div>
            )}

            {message && (
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;