# STEP 1: Base image for dependencies
FROM node:22-slim as base
WORKDIR /app
COPY package.json .yarnrc ./
# Install production dependencies and prune
RUN yarn --production
RUN apt-get update && apt-get install -y wget && \
    wget -O - https://gobinaries.com/tj/node-prune | sh && \
    node-prune && \
    apt-get remove -y wget && apt-get autoremove -y

# STEP 2: Build stage
FROM base AS dev
COPY nest-cli.json tsconfig.* ./
COPY ./src/ ./src/
RUN yarn
RUN yarn build

# STEP 3: Final Production Image
FROM --platform=linux/amd64 node:22-slim

# ca-certificates for TLS to the bucket, Redis and RabbitMQ. No aws CLI / rclone: uploads go through the S3 SDK.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set up application directory
WORKDIR /app

# Copy built application and dependencies from previous stages
COPY --from=base /app/package.json ./
COPY --from=dev /app/dist/ ./dist/
COPY --from=base /app/node_modules/ ./node_modules/

EXPOSE 3000
CMD ["node", "dist/main.js"]