async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" })
    });
    const data = await res.json();
    console.log("RESPONSE:", data);
  } catch (e) {
    console.error("ERROR:", e);
  }
}
test();
