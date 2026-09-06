FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Expose the port (Render sets PORT env var)
EXPOSE 10000

# Start the server
CMD ["npm", "start"]
