# Builds registry.infra:5000/demo-web (DEL-720), the image
# df-config/catalogue/demo-web.yaml references. Dependency-free Node
# (node:http/fs only), same style as dfplatform-status/api.
FROM node:26-slim

WORKDIR /app
COPY lib.js server.js ./
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
