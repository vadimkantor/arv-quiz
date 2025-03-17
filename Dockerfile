# Basis-Image mit Node.js 18 (alpine für kleinere Größe)
FROM node:18-alpine

# Setze das Arbeitsverzeichnis im Container
WORKDIR /app

# Kopiere package.json und package-lock.json, um Abhängigkeiten zuerst zu installieren
COPY package*.json ./

# Installiere die Abhängigkeiten inklusive TypeScript
RUN npm install

# Kopiere den gesamten Projektcode in den Container
COPY . .

# Baue das TypeScript-Projekt
RUN npm run build

# Exponiere Port 3000
EXPOSE 3000

# Startbefehl für die Anwendung
CMD ["node", "dist/index.js"]
