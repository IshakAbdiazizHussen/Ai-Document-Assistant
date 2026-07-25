FROM node:20-alpine

WORKDIR /app

# Install first, separately from the rest of the source, so Docker's layer
# cache can skip this step on rebuilds where only app code changed.
COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Next.js inlines NEXT_PUBLIC_* values into the client bundle during
# `next build` itself — reading them at container runtime is too late.
# Railway's dashboard Variables are only injected as runtime env vars for a
# Dockerfile build, so it must be passed in as a build ARG instead and
# promoted to ENV here so the build step below can actually see it.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
