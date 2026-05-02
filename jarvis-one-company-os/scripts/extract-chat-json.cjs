const { ClassicLevel } = require("classic-level");
const path = require("path");
const fs = require("fs");

async function main() {
  const dbPath = path.join("d:", "FY003", "backup_chat_20260415_224552", "Local Storage", "leveldb");
  const db = new ClassicLevel(dbPath, { 
    createIfMissing: false,
    keyEncoding: "buffer",
    valueEncoding: "buffer"
  });
  
  const entries = new Map();
  
  for await (const [key, value] of db.iterator()) {
    const keyStr = Buffer.from(key).toString("utf-8");
    const valBuf = Buffer.from(value);
    
    const match = keyStr.match(/(jarvis-os\.[^\x00]+|jarvis-one-company-os\.[^\x00]+)/);
    if (!match) continue;
    
    const cleanKey = match[1];
    let cleanVal = valBuf.length > 0 && valBuf[0] === 0x01
      ? valBuf.slice(1).toString("utf16le")
      : valBuf.toString("utf16le");
    
    entries.set(cleanKey, cleanVal);
  }
  
  await db.close();
  
  const topicsRaw = entries.get("jarvis-os.chat-topics");
  if (!topicsRaw) { console.log("No topics!"); return; }
  
  const topics = JSON.parse(topicsRaw);
  const result = { topics: [], messages: {} };
  
  for (const t of topics) {
    result.topics.push(t);
    const msgKey = "jarvis-os.chat-msgs." + t.id;
    const msgRaw = entries.get(msgKey);
    if (msgRaw) {
      result.messages[t.id] = JSON.parse(msgRaw);
      console.log("Topic:", t.title, "->", result.messages[t.id].length, "messages");
    }
  }
  
  const outPath = path.join("d:", "FY003", "chat_backup.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log("Saved to:", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
