FROM node:20-alpine

# Install git and build tools (required by baileys)
RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
