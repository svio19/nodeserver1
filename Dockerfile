# Use Node.js Alpine image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Create data directory and set permissions
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose the desired port
EXPOSE 3005

# Create volume for data persistence
VOLUME ["/app/data"]

# Start the server
CMD ["node", "server.js"]
