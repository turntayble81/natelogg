const Tail = require('tail').Tail;
const path = require('path');
const fs = require('fs');

class Tails {
  constructor(config, socket) {
    this.tails = fs.readdirSync(config.logDirectory)
      .map((log) => {
        let tail = new Tail(path.join(config.logDirectory, log), {
          fromBeginning: false,
          follow: true
        });

        let lineHandler = (data) => {
          if (this.isCrashed(data)) {
            socket.emit('baseMonitor', {crash: true, log: log});
          }
        };        

        tail.on('line', lineHandler);        

        return {
          tail: tail,
          log: log
        };
      });   
  }

  isCrashed(data) {
    return data.indexOf('Cannot find module') >= 0;
  }
}

module.exports = Tails;