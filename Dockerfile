# The client's development server.
#
# This is a development image: it serves the Vite dev server so the compose
# stack matches what a person runs locally. A production build would be a static
# bundle behind a web server, and is M4's concern rather than M1's.
FROM node:22-alpine

WORKDIR /app

# protoc is here because the contract is generated rather than committed as
# hand-written types, and `npm run contract` is part of a first-run setup.
RUN apk add --no-cache protobuf bash curl git

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
