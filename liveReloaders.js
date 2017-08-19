const Tail = require('tail').Tail;
const path = require('path');
const fs = require('fs');
const Monitor = require('./monitor');

class LiveReloaders extends Monitor {
    constructor(config, socket) {
        super({
            config: config,            
            emitName: 'buildComplete'
        });

        this.watchers = fs.readdirSync(config.logDirectory)
            .filter((log) => (config.uiLogStreams.indexOf(log) >= 0))
            .map((log) => {
                let tail = new Tail(path.join(config.logDirectory, log), {
                    fromBeginning: false,
                    follow: true
                });

                let context = {
                    tail: tail,
                    log: log,
                    complete: true
                };

                let lineHandler = (context, data) => {
                    if (this.buildComplete(data)) {
                        context.complete = true;                        
                        
                        socket.emit(this.emitName, { log: context.log, complete: context.complete });
                    } else if (context.complete && this.buildStarting(data)) {
                        context.complete = false;
                        
                        socket.emit(this.emitName, { log: context.log, complete: context.complete });
                    } 
                };

                tail.on('line', lineHandler.bind(this, context));

                return context;
            });
    }

    buildComplete(data) {
        return data.toLowerCase().indexOf(this.config.uiBuildStopString.toLowerCase()) >= 0;
    }

    buildStarting(data) {
        return data.toLowerCase().indexOf(this.config.uiBuildStartString.toLowerCase()) >= 0;
    }    
}

module.exports = LiveReloaders;
