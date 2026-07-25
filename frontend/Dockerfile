FROM node:20-alpine

WORKDIR /app

# Install first, separately from the rest of the source, so Docker's layer
# cache can skip this step on rebuilds where only app code changed.
COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
