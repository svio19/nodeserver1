const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'storage.json');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const ANONYMOUS_USER = 'anonymous';

// Initial data structure
const initialStorage = {
  conversations: []
};

// Initialize file system
async function initializeFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOGS_DIR, { recursive: true });

    try {
      await fs.access(STORAGE_FILE);
    } catch {
      await fs.writeFile(STORAGE_FILE, JSON.stringify(initialStorage, null, 2));
      console.log('Storage file initialized');
    }
  } catch (error) {
    console.error('Failed to initialize files:', error);
    process.exit(1);
  }
}

// File operations with error handling
async function readStorage() {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading storage:', error);
    return initialStorage;
  }
}

async function writeStorage(data) {
  try {
    const backupPath = `${STORAGE_FILE}.backup`;
    // Create backup
    await fs.copyFile(STORAGE_FILE, backupPath);
    // Write new data
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2));
    // Remove backup
    await fs.unlink(backupPath);
  } catch (error) {
    console.error('Error writing storage:', error);
    throw error;
  }
}

// Error logging
async function logError(error, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context
  };

  await fs.appendFile(
    path.join(LOGS_DIR, 'error.log'),
    JSON.stringify(logEntry, null, 2) + '\n'
  ).catch(console.error);
}

// Routes
app.post('/items', async (req, res) => {
  try {
    const storage = await readStorage();
    const { content, user } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const newConversation = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user: user?.email || ANONYMOUS_USER,
      content: {
        message: content.message,
        response: content.response
      }
    };

    storage.conversations.push(newConversation);
    await writeStorage(storage);

    res.status(201).json(newConversation);
  } catch (error) {
    await logError(error, { route: '/items', method: 'POST' });
    res.status(500).json({ error: 'Failed to store conversation' });
  }
});

app.get('/items', async (req, res) => {
  try {
    const storage = await readStorage();
    res.json(storage.conversations);
  } catch (error) {
    await logError(error, { route: '/items', method: 'GET' });
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

// Get conversations by user
app.get('/items/user/:email', async (req, res) => {
  try {
    const storage = await readStorage();
    const userConversations = storage.conversations.filter(
      conv => conv.user === req.params.email
    );
    res.json(userConversations);
  } catch (error) {
    await logError(error, { route: '/items/user', method: 'GET' });
    res.status(500).json({ error: 'Failed to retrieve user conversations' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logError(error, { 
    route: req.path, 
    method: req.method 
  }).catch(console.error);
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
async function startServer() {
  try {
    await initializeFiles();
    const PORT = process.env.PORT || 3005;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Data directory: ${DATA_DIR}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();