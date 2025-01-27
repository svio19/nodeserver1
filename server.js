const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Directory and file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const LOG_DIR = path.join(DATA_DIR, 'logs');

// Fixed username for non-authenticated users
const ANONYMOUS_USER = 'anonymous_user';

// Initial data structures
const initialData = {
  storage: { items: [] },
  requests: { requests: [] }
};

// Ensure all required directories and files exist
const initializeFileSystem = async () => {
  try {
    // Create directories
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Initialize files if they don't exist
    const files = [
      { path: DATA_FILE, data: initialData.storage },
      { path: REQUESTS_FILE, data: initialData.requests }
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        // File doesn't exist, create it with initial data
        await fs.writeFile(
          file.path, 
          JSON.stringify(file.data, null, 2)
        );
        console.log(`Initialized ${path.basename(file.path)}`);
      }
    }

    console.log('File system initialized successfully');
  } catch (error) {
    console.error('Error initializing file system:', error);
    process.exit(1); // Exit if we can't initialize properly
  }
};

// Enhanced error handling for file operations
const safeFileOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    // Log error to file
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    await fs.appendFile(
      path.join(LOG_DIR, 'error.log'),
      JSON.stringify(errorLog, null, 2) + '\n'
    ).catch(console.error);

    throw error;
  }
};

// Read data from file with validation
const readData = async (filename) => {
  return safeFileOperation(async () => {
    const data = await fs.readFile(filename, 'utf8');
    try {
      const parsedData = JSON.parse(data);
      // Validate data structure
      if (filename === REQUESTS_FILE && !parsedData.requests) {
        parsedData.requests = [];
      } else if (filename === DATA_FILE && !parsedData.items) {
        parsedData.items = [];
      }
      return parsedData;
    } catch (error) {
      console.error(`Invalid JSON in ${filename}, resetting to initial state`);
      const initialState = filename === REQUESTS_FILE ? 
        initialData.requests : initialData.storage;
      await writeData(filename, initialState);
      return initialState;
    }
  });
};

// Write data to file with backup
const writeData = async (filename, data) => {
  return safeFileOperation(async () => {
    // Create backup before writing
    const backupFile = `${filename}.backup`;
    try {
      await fs.copyFile(filename, backupFile);
    } catch (error) {
      console.warn(`Could not create backup of ${filename}:`, error);
    }

    // Write new data
    await fs.writeFile(filename, JSON.stringify(data, null, 2));

    // Remove backup if write was successful
    try {
      await fs.unlink(backupFile);
    } catch (error) {
      console.warn(`Could not remove backup file ${backupFile}:`, error);
    }
  });
};

// Log request middleware with enhanced error handling
const logRequest = async (req, res, next) => {
  try {
    const requestData = await readData(REQUESTS_FILE);
    
    const newRequest = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      user: ANONYMOUS_USER,
      body: req.method === 'POST' ? req.body : null,
      headers: {
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type']
      }
    };
    
    requestData.requests.push(newRequest);
    await writeData(REQUESTS_FILE, requestData);
    
    req.user = ANONYMOUS_USER;
    next();
  } catch (error) {
    console.error('Error in request logging:', error);
    next(error);
  }
};

// Apply logging middleware to all routes
app.use(logRequest);

// GET: Retrieve all items
app.get('/items', async (req, res) => {
  try {
    const data = await readData(DATA_FILE);
    res.json(data.items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve items' });
  }
});

// GET: Retrieve all requests
app.get('/requests', async (req, res) => {
  try {
    const data = await readData(REQUESTS_FILE);
    res.json(data.requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve requests' });
  }
});

// POST: Add a new item
app.post('/items', async (req, res) => {
  try {
    const data = await readData(DATA_FILE);
    const newItem = {
      id: Date.now(),
      content: req.body.content,
      createdBy: ANONYMOUS_USER,
      createdAt: new Date().toISOString()
    };
    data.items.push(newItem);
    await writeData(DATA_FILE, data);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Initialize file system before starting server
const startServer = async () => {
  try {
    await initializeFileSystem();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Data directory: ${DATA_DIR}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();