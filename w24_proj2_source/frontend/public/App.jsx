import { useState } from "react";
import Register from "../src/components/Register";
import Messenger from "../src/components/Messenger";

export default function App() {
  const [username, setUsername] = useState(null);

  return (
    <div className="container">
      <h1>Secure Messenger</h1>

      {!username ? (
        <Register onRegister={setUsername} />
      ) : (
        <Messenger username={username} />
      )}
    </div>
  );
}
