const Tail = require('tail').Tail;
const path = require('path');
const fs = require('fs');
const Monitor = require('./monitor');

class BaseMonitors extends Monitor {
    constructor(config, socket) {
        super({
            resetCount: 0,
            emitName: 'baseMonitor',
            resetCountThreshold: 20
        });

        this.resetCount = 0;
        this.watchers = fs.readdirSync(config.logDirectory)
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
                        context.crashed = true;
                        this.resetCount = 0;

                        socket.emit(this.emitName, {crash: context.crashed, log: context.log});                        
                    } else if (context.crashed && !this.isCrashed(data) && this.isReset()) {
                        context.crashed = false;
                        
                        socket.emit(this.emitName, {crash: context.crashed, log: context.log});
                    } else {
                        this.resetCount++;
                    }
                };

                tail.on('line', lineHandler.bind(this, context));

                return context;
            });
    }

    isCrashed(data) {
        return data.toLowerCase().indexOf('cannot find module') >= 0;
    }
}

module.exports = BaseMonitors;
