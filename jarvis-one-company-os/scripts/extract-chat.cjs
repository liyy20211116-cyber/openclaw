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
  
  const chatData = {};
  let totalEntries = 0;
  
  for await (const [key, value] of db.iterator()) {
    totalEntries++;
    const keyStr = key.toString("utf-8");
    
    if (keyStr.includes("jarvis-os") || keyStr.includes("jarvis-one-company-os")) {
      const match = keyStr.match(/(jarvis-os\.[^\x00]+|jarvis-one-company-os\.[^\x00]+)/);
      if (match) {
        const cleanKey = match[1];
        let cleanVal = value.toString("utf-16le");
        if (cleanVal.charCodeAt(0) === 1) cleanVal = cleanVal.substring(1);
        chatData[cleanKey] = cleanVal;
        console.log("Found:", cleanKey, "(" + cleanVal.length + " chars)");
        if (cleanVal.length < 200) {
          console.log("  Value:", cleanVal);
        }
      }
    }
  }
  
  await db.close();
  
  const outPath = path.join("d:", "FY003", "extracted_chat_data.json");
  fs.writeFileSync(outPath, JSON.stringify(chatData, null, 2), "utf-8");
  console.log("\nTotal LevelDB entries:", totalEntries);
  console.log("Extracted", Object.keys(chatData).length, "jarvis-related entries to", outPath);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
