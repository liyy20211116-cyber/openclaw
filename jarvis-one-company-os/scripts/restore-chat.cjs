const { ClassicLevel } = require("classic-level");
const path = require("path");
const fs = require("fs");

async function main() {
  const dbPath = path.join("d:", "FY003", "backup_chat_20260415_224552", "Local Storage", "leveldb");
  console.log("Opening LevelDB at:", dbPath);
  
  const db = new ClassicLevel(dbPath, { 
    createIfMissing: false,
    keyEncoding: "buffer",
    valueEncoding: "buffer"
  });
  
  const entries = new Map();
  
  for await (const [key, value] of db.iterator()) {
    const keyBuf = Buffer.from(key);
    const valBuf = Buffer.from(value);
    const keyStr = keyBuf.toString("utf-8");
    
    const jarvisMatch = keyStr.match(/(jarvis-os\.[^\x00]+|jarvis-one-company-os\.[^\x00]+)/);
    if (!jarvisMatch) continue;
    
    const cleanKey = jarvisMatch[1];
    
    // Electron LevelDB: value byte 0 is type indicator (0x01 = string)
    // Remaining bytes are UTF-16LE encoded string
    let cleanVal;
    if (valBuf.length > 0 && valBuf[0] === 0x01) {
      cleanVal = valBuf.slice(1).toString("utf16le");
    } else if (valBuf.length > 0 && valBuf[0] === 0x00) {
      cleanVal = valBuf.slice(1).toString("utf16le");
    } else {
      cleanVal = valBuf.toString("utf16le");
    }
    
    // LevelDB keeps multiple versions - use the latest (last seen)
    entries.set(cleanKey, cleanVal);
  }
  
  await db.close();
  
  // Extract topics and messages
  const topicsRaw = entries.get("jarvis-os.chat-topics");
  if (!topicsRaw) {
    console.log("No chat topics found in backup!");
    return;
  }
  
  let topics;
  try {
    topics = JSON.parse(topicsRaw);
    console.log(`Found ${topics.length} topic(s):`);
    for (const t of topics) {
      console.log(`  - ${t.id}: "${t.title}" (${t.messageCount} msgs, ${t.createdAt})`);
    }
  } catch (e) {
    console.log("Failed to parse topics:", e.message);
    console.log("Raw topics (first 500 chars):", topicsRaw.substring(0, 500));
    return;
  }
  
  // Collect all messages
  const allMessages = {};
  for (const t of topics) {
    const msgKey = `jarvis-os.chat-msgs.${t.id}`;
    const msgRaw = entries.get(msgKey);
    if (msgRaw) {
      try {
        const msgs = JSON.parse(msgRaw);
        allMessages[t.id] = msgs;
        console.log(`  Messages for ${t.id}: ${msgs.length} messages`);
        if (msgs.length > 0) {
          const first = msgs[0];
          console.log(`    First msg: [${first.role}] ${first.content?.substring(0, 80)}...`);
        }
      } catch (e) {
        console.log(`  Failed to parse messages for ${t.id}:`, e.message);
      }
    } else {
      console.log(`  No messages found for ${t.id}`);
    }
  }
  
  // Now write to SQLite
  const Database = require("better-sqlite3");
  const sqlitePath = path.join("C:", "Users", "Lenovo", "AppData", "Roaming", "jarvis-one-company-os", "company-data", "dev.db");
  
  console.log("\nWriting to SQLite:", sqlitePath);
  
  // Ensure directory exists
  const dir = path.dirname(sqlitePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const sqlDb = new Database(sqlitePath);
  sqlDb.pragma("journal_mode = WAL");
  
  // Ensure tables exist
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS chat_topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      messageCount INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      topicId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      attachmentsJson TEXT,
      mentionsJson TEXT,
      quotedMessageJson TEXT,
      teamMessagesJson TEXT,
      llmModelUsed TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (topicId) REFERENCES chat_topics(id) ON DELETE CASCADE
    );
  `);
  
  // Insert topics
  const insertTopic = sqlDb.prepare(`
    INSERT OR REPLACE INTO chat_topics (id, title, messageCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertMessage = sqlDb.prepare(`
    INSERT OR REPLACE INTO chat_messages (id, topicId, role, content, attachmentsJson, mentionsJson, quotedMessageJson, teamMessagesJson, llmModelUsed, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let topicCount = 0;
  let msgCount = 0;
  
  const insertAll = sqlDb.transaction(() => {
    for (const t of topics) {
      insertTopic.run(t.id, t.title, t.messageCount || 0, t.createdAt, t.updatedAt);
      topicCount++;
      
      const msgs = allMessages[t.id] || [];
      for (const m of msgs) {
        insertMessage.run(
          m.id,
          t.id,
          m.role || '',
          m.content || '',
          m.attachments ? JSON.stringify(m.attachments) : null,
          m.mentions ? JSON.stringify(m.mentions) : null,
          m.quotedMessage ? JSON.stringify(m.quotedMessage) : null,
          m.teamMessages ? JSON.stringify(m.teamMessages) : null,
          m.llmModelUsed || null,
          m.createdAt || new Date().toISOString()
        );
        msgCount++;
      }
    }
  });
  
  insertAll();
  sqlDb.close();
  
  console.log(`\nDone! Inserted ${topicCount} topics and ${msgCount} messages into SQLite.`);
}

main().catch(e => { console.error("Error:", e.message, e.stack); process.exit(1); });
