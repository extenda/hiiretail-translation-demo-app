FROM node:24-alpine

ENV PUBLIC_HTML=/var/www
EXPOSE 8080

COPY dist /var/www
COPY server /opt/server

CMD ["/usr/local/bin/node", "/opt/server/index.mjs"]
