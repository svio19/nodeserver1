const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json());
const cors = require('cors');
app.use(cors());

// Serve static files
app.use(express.static('public'));

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const LOG_DIR = path.join(DATA_DIR, 'logs');

const ANONYMOUS_USER = 'anonymous_user';

const initialData = {
  storage: { items: [] },
  requests: { requests: [] }
};

const getUserInfo = (req) => {
    if (req.body.user && req.body.user.email) {
      return {
        email: req.body.user.email,
        name: req.body.user.name || 'Unknown',
        timestamp: new Date().toISOString()
      };
    }
    return {
      email: ANONYMOUS_USER,
      name: 'Anonymous',
      timestamp: new Date().toISOString()
    };
  };
  
  const logRequest = async (req, res, next) => {
    try {
      const requestData = await readData(REQUESTS_FILE);
      const userInfo = getUserInfo(req);
      
      const newRequest = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        user: userInfo,
        body: req.method === 'POST' ? req.body : null,
        headers: {
          userAgent: req.headers['user-agent'],
          contentType: req.headers['content-type']
        }
      };
      
      requestData.requests.push(newRequest);
      await writeData(REQUESTS_FILE, requestData);
      
      req.userInfo = userInfo;
      next();
    } catch (error) {
      console.error('Error in request logging:', error);
      next(error);
    }
  };
  
  app.use(logRequest);

const initializeFileSystem = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOG_DIR, { recursive: true });

    const files = [
      { path: DATA_FILE, data: initialData.storage },
      { path: REQUESTS_FILE, data: initialData.requests }
    ];

    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
        console.log(`Initialized ${path.basename(file.path)}`);
      }
    }

    console.log('File system initialized successfully');
  } catch (error) {
    console.error('Error initializing file system:', error);
    process.exit(1);
  }
};

const safeFileOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
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

const readData = async (filename) => {
  return safeFileOperation(async () => {
    const data = await fs.readFile(filename, 'utf8');
    try {
      const parsedData = JSON.parse(data);
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

const writeData = async (filename, data) => {
  return safeFileOperation(async () => {
    const backupFile = `${filename}.backup`;
    try {
      await fs.copyFile(filename, backupFile);
    } catch (error) {
      console.warn(`Could not create backup of ${filename}:`, error);
    }

    await fs.writeFile(filename, JSON.stringify(data, null, 2));

    try {
      await fs.unlink(backupFile);
    } catch (error) {
      console.warn(`Could not remove backup file ${backupFile}:`, error);
    }
  });
};



app.use(logRequest);

app.get('/items', async (req, res) => {
    try {
      const data = await readData(DATA_FILE);
      res.json(data.items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve items' });
    }
  });




app.get('/requests', async (req, res) => {
  try {
    const data = await readData(REQUESTS_FILE);
    res.json(data.requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve requests' });
  }
});

app.post('/items', async (req, res) => {
    try {
      const data = await readData(DATA_FILE);
      const userInfo = req.userInfo;
  
      const newItem = {
        id: Date.now(),
        content: req.body.content,
        createdBy: {
          email: userInfo.email,
          name: userInfo.name
        },
        createdAt: new Date().toISOString()
      };
      
      data.items.push(newItem);
      await writeData(DATA_FILE, data);
      res.status(201).json(newItem);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create item' });
    }
  });
  
  app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  });
  
  const startServer = async () => {
    try {
      await initializeFileSystem();
      const PORT = process.env.PORT || 3005;
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
  