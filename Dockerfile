# Use Node.js Alpine image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies including CORS
RUN npm install && \
    npm install cors

# Bundle app source
COPY . .

# Create data directory and set permissions
RUN mkdir -p /app/data && chmod 777 /app/data

# Modify server configuration for CORS
# Using sed instead of echo to avoid potential append issues
RUN sed -i '1i\app.use(require("cors")());' server.js

# Expose port
EXPOSE 3005

# Create volume for data persistence
VOLUME ["/app/data"]

# Start server
CMD ["node", "server.js"]