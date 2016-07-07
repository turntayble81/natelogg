var express         = require('express');
var socketio        = require('socket.io');
var morgan          = require('morgan');
var fs              = require('fs');
var Tail            = require('tail').Tail;
var config          = require('./config');
var formatters      = require('./formatters');
var app             = express();
var watchers        = {};

app.set('view engine', 'ejs');
app.use(morgan('dev'));
app.use('/static', express.static('./static'));

app.get('/', function (req, res) {
    fs.readdir(config.logDirectory, function(err, logs) {
        if(err) {
           return res.send('Can\'t read log directory ' + config.logDirectory); 
        }

        res.render('main', {
            logs: logs
        });
    });
});

var server = app.listen(config.port, function () {
    console.log('Natelogg started on port %s', config.port);
});
var io = socketio(server);

io.on('connection', function(socket) {
    var formatter;

    console.log('Client websocket connected.');

    console.log('Creating log event handlers');
    socket._lineHandler = function(data) {
        if(formatter) {
            data = formatter.handleLogLine(data);
        }
        socket.emit('logData', data);
    };

    socket._errHandler = function(err) {
        socket.emit('logData', data);
    };

    socket.on('setFormatter', function(data) {
        formatter = new formatters[data.formatter]({});
    });

    socket.on('setFormatterOptions', function(data) {
        var options = eval('(' + data.options + ')');
        formatter = new formatters[data.formatter](options);
    });

    socket.on('toggleLog', function(data) {
        var watcher;

        if(data.enabled) {
            console.log('Log %s is now being watched.', data.log);

            if(!watchers[data.log]) {
                console.log('Watcher does not exist for log %s. Creating now.', data.log);
                watcher = new Tail(config.logDirectory + '/' + data.log, {
                    fromBeginning : false,
                    follow        : true
                });

                watcher._log          = data.log;
                watcher._lineHandlers = [];
                watcher._errHandlers  = [];

                watcher.on('line', function(data) {
                    watcher._lineHandlers.forEach(function(handler) {
                        handler(data);
                    });
                });

                watcher.on('error', function(err) {
                    watcher._errHandlers.forEach(function(handler) {
                        handler(err);
                    });
                });

                watchers[data.log] = watcher;
            }else {
                watcher = watchers[data.log];
            }

            subscribe(watcher);
        }else {
            console.log('Log %s is no longer being watched.', data.log);
            watcher = watchers[data.log];
            unsubscribe(watcher);
        }
    });

    socket.on('disconnect', function() {
        console.log('Client websocket disconnected.');
        console.log('Unsubscribing from all log events.');
        Object.keys(watchers).forEach(function(watcher) {
            watcher = watchers[watcher];
            unsubscribe(watcher);
        });
    });

    function subscribe(watcher) {
        console.log('Subscribing to log events for %s.', watcher._log);
        watcher._lineHandlers.push(socket._lineHandler);
        watcher._errHandlers.push(socket._errHandler);
    }

    function unsubscribe(watcher) {
        var lineHandlerPos = watcher._lineHandlers.indexOf(socket._lineHandler);
        var errHandlerPos  = watcher._errHandlers.indexOf(socket._errHandler);

        console.log('Unsubscribing from log events for %s.', watcher._log);
        if(lineHandlerPos > -1) {
            watcher._lineHandlers.splice(lineHandlerPos, 1);
        }
        if(errHandlerPos > -1) {
            watcher._errHandlers.splice(errHandlerPos, 1);
        }
        if(!watcher._lineHandlers.length && !watcher._errHandlers.length) {
            console.log('No more handlers are bound to the watcher for %s. Killing watcher.', watcher._log);
            delete watchers[watchers._log];
        }
    }
});
