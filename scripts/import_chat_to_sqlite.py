import json
import sqlite3
import os

CHAT_JSON = r"d:\FY003\chat_backup.json"
DB_PATH = r"C:\Users\Lenovo\AppData\Roaming\jarvis-one-company-os\company-data\dev.db"

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

with open(CHAT_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("""CREATE TABLE IF NOT EXISTS chat_topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    messageCount INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)""")

c.execute("""CREATE TABLE IF NOT EXISTS chat_messages (
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
)""")

c.execute("CREATE INDEX IF NOT EXISTS idx_chat_topics_updated ON chat_topics(updatedAt)")
c.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_topic ON chat_messages(topicId, createdAt)")

topic_count = 0
msg_count = 0

for t in data["topics"]:
    c.execute(
        "INSERT OR REPLACE INTO chat_topics (id, title, messageCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        (t["id"], t["title"], t["messageCount"], t["createdAt"], t["updatedAt"])
    )
    topic_count += 1

    msgs = data["messages"].get(t["id"], [])
    for m in msgs:
        c.execute(
            """INSERT OR REPLACE INTO chat_messages 
            (id, topicId, role, content, attachmentsJson, mentionsJson, quotedMessageJson, teamMessagesJson, llmModelUsed, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                m.get("id", ""),
                t["id"],
                m.get("role", ""),
                m.get("content", ""),
                json.dumps(m["attachments"]) if m.get("attachments") else None,
                json.dumps(m["mentions"]) if m.get("mentions") else None,
                json.dumps(m["quotedMessage"]) if m.get("quotedMessage") else None,
                json.dumps(m["teamMessages"]) if m.get("teamMessages") else None,
                m.get("llmModelUsed"),
                m.get("createdAt", ""),
            )
        )
        msg_count += 1

conn.commit()
conn.close()

print(f"Done! Imported {topic_count} topics and {msg_count} messages into {DB_PATH}")
