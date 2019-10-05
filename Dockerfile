From node:lts

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run compile

EXPOSE 3000

CMD [ "npm", "start" ]