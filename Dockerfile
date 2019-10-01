From node:lts

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY src/ ./

EXPOSE 3000

CMD [ "npm", "start" ]