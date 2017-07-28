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

        let context = {
          tail: tail,
          log: log,
          isCrashed: false
        };

        let lineHandler = (context, data) => {
          if (this.isCrashed(data)) {
            socket.emit('baseMonitor', {crash: true, log: log});
            context.crashed = true;
          } else if (context.crashed && !this.isCrashed(data)) {
            socket.emit('baseMonitor', {crash: false, log: log});            
            context.crashed = false;
          }
        };        

        tail.on('line', lineHandler.bind(this, context));        

        return context;
      });   
  }

  isCrashed(data) {
    return data.indexOf('Cannot find module') >= 0;
  }
}

module.exports = Tails;