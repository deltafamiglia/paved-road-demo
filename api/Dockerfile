# Builds registry.infra:5000/demo-api (DEL-720), the image
# df-config/catalogue/demo-api.yaml references. node:sqlite is a Node
# core module (stable since Node 24) - no native deps to compile, so
# node:26-slim (same base dfplatform-status/api uses) is enough.
FROM node:26-slim

WORKDIR /app
COPY db.js lib.js server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
