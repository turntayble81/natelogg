[![NPM version](https://img.shields.io/npm/v/natelogg.svg)](https://www.npmjs.com/package/natelogg)

Natelogg is a lightweight app for realtime tailing of logs to your browser. It's very quick and easy to set up.

![alt text](screenshots/screenshot.png "Interface")

### Installation

- Install globally using npm: `npm install -g natelogg`

### Configuration

Copy the following example config file to `~/.natelogg/config` and change values as necessary:

```javascript
var config = {};

//DEFINE THE SERVER PORT
config.port = 9000;

//DEFINE PORT MAPPINGS FOR EACH APP YOU WISH TO INSPECT
config.portAppMap = {
    9229: 'web-ui.log'
    9230: 'admin-ui.log'
}

//DEFINE THE DIRECTORY WHERE LOGS ARE LOCATED
config.logDirectory = '/log';

module.exports = config;
```

### Usage

All files located in `config.logDirectory` are loaded in the Logs section. Check the checkbox next to the log(s) you wish to tail. Bunyan formatting can be enabled and configured in the Formatters section.

#### Run log server
```
natelogg-server
```

or

```
npm start
```

#### Run log server with bindings for Node --inspect
```
npm run inspect
```
