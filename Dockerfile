# Use Node.js Alpine image
FROM node:18-alpine

# Install CORS middleware
RUN npm install cors

# Create app directory
WORKDIR /app

# Create data directory and set permissions
RUN mkdir -p /app/data && chmod 777 /app/data

# Install app dependencies
COPY package*.json ./
RUN npm install


# Bundle app source
COPY . .

# Add CORS configuration to server
RUN echo "app.use(require('cors')());" >> server3.js

# Expose port
EXPOSE 3005

# Create volume for data persistence
VOLUME ["/app/data"]

# Start server
CMD ["node", "server.js"]