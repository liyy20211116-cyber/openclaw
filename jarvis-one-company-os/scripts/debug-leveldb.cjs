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
  
  for await (const [key, value] of db.iterator()) {
    const keyStr = Buffer.from(key).toString("utf-8");
    const valBuf = Buffer.from(value);
    
    if (!keyStr.includes("jarvis-os.chat-topics")) continue;
    
    console.log("Key (utf-8):", keyStr);
    console.log("Key hex (first 80):", Buffer.from(key).slice(0, 80).toString("hex"));
    console.log("Value length:", valBuf.length);
    console.log("Value hex (first 80):", valBuf.slice(0, 80).toString("hex"));
    console.log("Value byte 0:", valBuf[0], "byte 1:", valBuf[1]);
    
    // Try different decodings
    console.log("\n--- UTF-8 (skip 1):", valBuf.slice(1).toString("utf-8").substring(0, 200));
    console.log("\n--- UTF-16LE (skip 0):", valBuf.toString("utf16le").substring(0, 200));
    console.log("\n--- UTF-16LE (skip 1):", valBuf.slice(1).toString("utf16le").substring(0, 200));
    console.log("\n--- Latin1 (skip 1):", valBuf.slice(1).toString("latin1").substring(0, 200));
    
    // Check if every other byte is 0 (indicating UTF-16LE with null bytes)
    let isUtf16Pattern = true;
    for (let i = 2; i < Math.min(valBuf.length, 20); i += 2) {
      if (valBuf[i] !== 0) { isUtf16Pattern = false; break; }
    }
    console.log("\nEvery-other-byte-zero pattern:", isUtf16Pattern);
    
    // Try to find the JSON start
    for (let offset = 0; offset < Math.min(10, valBuf.length); offset++) {
      const ch = String.fromCharCode(valBuf[offset]);
      if (ch === '[' || ch === '{' || ch === '"') {
        console.log(`Found JSON start at offset ${offset}: '${ch}'`);
        const decoded = valBuf.slice(offset).toString("utf-8");
        console.log("UTF-8 from there:", decoded.substring(0, 300));
        break;
      }
    }
    
    console.log("======\n");
  }
  
  await db.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
