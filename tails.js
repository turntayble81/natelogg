const Tail = require('tail').Tail;
const path = require('path');
const fs = require('fs');

class Tails {
  constructor(config, socket) {
    this.resetCount = 0;
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
            socket.emit('baseMonitor', {crash: true, log: context.log});
            context.crashed = true;
            this.resetCount = 0;
          }
          else if (context.crashed && !this.isCrashed(data) && this.resetCount > 20) {
            socket.emit('baseMonitor', {crash: false, log: context.log});
            context.crashed = false;
          } else {
              this.resetCount++;
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
