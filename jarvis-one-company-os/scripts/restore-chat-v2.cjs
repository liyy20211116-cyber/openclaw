const { ClassicLevel } = require("classic-level");
const path = require("path");
const fs = require("fs");

async function main() {
  const dbPath = path.join("d:", "FY003", "backup_chat_20260415_224552", "Local Storage", "leveldb");
  console.log("Reading LevelDB:", dbPath);
  
  const db = new ClassicLevel(dbPath, { 
    createIfMissing: false,
    keyEncoding: "buffer",
    valueEncoding: "buffer"
  });
  
  // Collect ALL entries per key, keeping only the latest (last seen in LevelDB order)
  const entries = new Map();
  
  for await (const [key, value] of db.iterator()) {
    const keyStr = Buffer.from(key).toString("utf-8");
    const valBuf = Buffer.from(value);
    
    const match = keyStr.match(/(jarvis-os\.[^\x00]+)/);
    if (!match) continue;
    
    const cleanKey = match[1];
    // Skip first byte (type indicator 0x00), decode rest as UTF-16LE
    const cleanVal = valBuf.slice(1).toString("utf16le");
    
    entries.set(cleanKey, cleanVal);
  }
  
  await db.close();
  
  // Find the topics entry with the MOST topics (latest state)
  // Since LevelDB has multiple origins (different ports), each has its own topics list
  // The latest/largest one is the most complete
  let bestTopicsJson = null;
  let bestTopicsCount = 0;
  let allMsgs = new Map();
  
  // First pass: collect all message entries
  for (const [key, val] of entries) {
    if (key.startsWith("jarvis-os.chat-msgs.")) {
      const topicId = key.replace("jarvis-os.chat-msgs.", "");
      try {
        const msgs = JSON.parse(val);
        // Keep the entry with the most messages for each topic
        const existing = allMsgs.get(topicId);
        if (!existing || msgs.length > existing.length) {
          allMsgs.set(topicId, msgs);
        }
      } catch (e) {
        console.warn("Failed to parse msgs for", topicId);
      }
    }
  }
  
  console.log("\nMessage topics found:", allMsgs.size);
  for (const [id, msgs] of allMsgs) {
    console.log(`  ${id}: ${msgs.length} messages`);
    if (msgs.length > 0) {
      const first = msgs[0];
      console.log(`    [${first.role}] ${(first.content || "").substring(0, 80)}...`);
    }
  }
  
  // Build a combined topics list from all message entries
  const topicIds = new Set(allMsgs.keys());
  const allTopicsMeta = new Map();
  
  // Try to get metadata from topics entries
  if (entries.has("jarvis-os.chat-topics")) {
    try {
      const topics = JSON.parse(entries.get("jarvis-os.chat-topics"));
      for (const t of topics) {
        allTopicsMeta.set(t.id, t);
      }
    } catch {}
  }
  
  // Build final topics list
  const finalTopics = [];
  for (const topicId of topicIds) {
    const msgs = allMsgs.get(topicId) || [];
    if (msgs.length === 0) continue; // Skip empty topics
    
    const meta = allTopicsMeta.get(topicId);
    const firstMsg = msgs[0];
    const lastMsg = msgs[msgs.length - 1];
    
    finalTopics.push({
      id: topicId,
      title: meta?.title || (firstMsg.content || "").substring(0, 30) + "...",
      messageCount: msgs.length,
      createdAt: meta?.createdAt || firstMsg.createdAt || new Date().toISOString(),
      updatedAt: meta?.updatedAt || lastMsg.createdAt || new Date().toISOString(),
    });
  }
  
  // Sort by createdAt descending (newest first)
  finalTopics.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  console.log("\nFinal topics to restore:", finalTopics.length);
  for (const t of finalTopics) {
    console.log(`  ${t.id}: "${t.title}" (${t.messageCount} msgs, ${t.createdAt})`);
  }
  
  // Write to SQLite using Python (since better-sqlite3 has version mismatch)
  const result = { topics: finalTopics, messages: {} };
  for (const t of finalTopics) {
    result.messages[t.id] = allMsgs.get(t.id) || [];
  }
  
  const outPath = path.join("d:", "FY003", "chat_backup.json");
  fs.writeFileSync(outPath, JSON.stringify(result), "utf-8");
  console.log("\nSaved to:", outPath, `(${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
}

main().catch(e => { console.error(e.message, e.stack); process.exit(1); });
