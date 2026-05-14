const port = process.env.PORT || process.argv[2] || "3007";

async function main() {
  const url = `http://localhost:${port}/api/ai/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Сформулируй 2 предложения: что такое геоэкология водных ресурсов?"
    })
  });
  const text = await res.text();
  console.log("status:", res.status);
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

