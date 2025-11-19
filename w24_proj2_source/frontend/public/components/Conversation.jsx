export default function Conversation({ conversation }) {
  return (
    <div className="conversation">
      <h3>Conversation</h3>
      <div>
        {conversation.map((msg, i) => (
          <p key={i}>
            <strong>{msg.from}:</strong> {msg.text}
          </p>
        ))}
      </div>
    </div>
  );
}
