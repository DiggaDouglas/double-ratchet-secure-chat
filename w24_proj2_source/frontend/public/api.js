const BASE = "http://localhost:3000"; // your backend port

export async function registerUser(username) {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function sendMessage(sender, recipient, message) {
  const res = await fetch(`${BASE}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender, recipient, message }),
  });
  return res.json();
}

export async function fetchMessages(user) {
  const res = await fetch(`${BASE}/messages/${user}`);
  return res.json();
}
