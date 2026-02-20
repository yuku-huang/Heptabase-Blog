const fs = require('fs');
const path = require('path');
const https = require('https');

async function main() {
    const configPath = path.join(__dirname, 'src', 'config.js');
    console.log(`Reading config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
        console.error("config.js not found!");
        process.exit(1);
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    const match = configContent.match(/'whiteboard_id':\s*'([^']+)'/);
    if (!match) {
        console.error("Cannot resolve whiteboard_id from config.js");
        process.exit(1);
    }
    const whiteboard_id = match[1];
    console.log(`Using whiteboard_id: ${whiteboard_id}`);

    const url = `https://heptabase-api-five.vercel.app/?whiteboard_id=${whiteboard_id}`;
    console.log(`Trying: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Match the logic in main.yml: ((.code == 0) or (.code == 200) or (.code == null)) and (.data.cards | type == "array")
        if ((data.code === 0 || data.code === 200 || data.code == null) && Array.isArray(data.data?.cards)) {
            const outPath = path.join(__dirname, 'src', 'resources', 'data.json');
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            // Save as JSON string
            fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`Successfully saved data to ${outPath}`);
        } else {
            console.error("Response format invalid:", data);
            process.exit(1);
        }
    } catch (e) {
        console.error("Request failed:", e);
        process.exit(1);
    }
}

main();
