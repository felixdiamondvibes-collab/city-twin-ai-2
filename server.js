// server.js
const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// Path to store "memories"
const MEMORY_FILE = './user_memory.json';

// Load existing memory or create new
const getMemory = () => {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
};

// Endpoint to handle AI communication
app.post('/chat', (req, res) => {
    const { message } = req.body;
    let memories = getMemory();

    // 1. Logic: In a real app, you would send 'message' + 'memories' 
    // to an AI API like OpenAI or Google Gemini here.
    
    // 2. Save the interaction to "memory"
    memories.push({ timestamp: new Date(), user: message });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));

    res.json({ reply: "I have stored your message in my long-term memory: " + message });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
