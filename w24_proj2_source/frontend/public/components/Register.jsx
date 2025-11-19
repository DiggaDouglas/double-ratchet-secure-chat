import { useState } from "react";
import { registerUser } from "../api";

export default function Register({ onRegister }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  async function handleRegister() {
    setStatus("Registering...");
    const res = await registerUser(name);

    if (res.success) {
      onRegister(name);
    } else {
      setStatus("Registration failed.");
    }
  }

  return (
    <div className="card">
      <h2>User Setup</h2>
      <input
        type="text"
        placeholder="Enter username"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleRegister}>Register</button>
      <p>{status}</p>
    </div>
  );
}
