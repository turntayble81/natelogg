#!/usr/bin/env node

var express         = require('express');
var socketio        = require('socket.io');
var morgan          = require('morgan');
var fs              = require('fs');
var minimist        = require('minimist');
var Tail            = require('tail').Tail;
var formatters      = require(__dirname + '/formatters');
var R               = require('ramda');
var app             = express();
var watchers        = {};
var options         = minimist(process.argv.slice(2));
var homeDir         = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var config;

try {
    config          = require(homeDir + '/.natelogg/config');
}catch(e) {
    console.error('Could not load config file. Make sure you have a config file at ~/.natelogg/config');
    process.exit();
}

var BaseMonitors    = require('./baseMonitors');
var LiveReloaders   = require('./liveReloaders');

if (options.enableInspector) {
    if (typeof config.portAppMap === 'undefined') {
        console.error('Cannot use node --inspect mode without "portAppMap" in config file.');
        process.exit();
    } else {
        options.portAppMap  = config.portAppMap;
    }
}

var port = config.port || 9000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(morgan('dev'));
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
    fs.readdir(config.logDirectory, function(err, logs) {
        if(err) {
           return res.send('Can\'t read log directory ' + config.logDirectory);
        }

        res.render('main', {
            logs: logs,
            options: options
        });
    });
});

app.get('/newtab', function (req, res) {
    res.location('/' + req.query.url);
});

var server = app.listen(port, function () {
    console.log('Natelogg started on port %s', port);
});
var io = socketio(server);

io.on('connection', onConnect);

function onConnect(socket) {
    var formatter;

    console.log('Client websocket connected.');

    console.log('Creating log event handlers');
    socket._lineHandler = function(data) {
        if(formatter) {
            data = formatter.handleLogLine(data);
        }
        if(data) {
            socket.emit('logData', data);
        }
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

    if (!options.enableLiveReload || socketBelongsToLogger(socket)) {
        //base app monitoring - report crashes to the ui
        var baseMonitors = new BaseMonitors(config, socket);

        socket.on('disconnect', function() {
            console.log('Client websocket disconnected.');
            console.log('Unsubscribing from all log events.');
            Object.keys(watchers).forEach(function(watcher) {
                watcher = watchers[watcher];
                unsubscribe(watcher);
            });

            baseMonitors.destroy();
        });

    }

    if (options.enableLiveReload) {
        //live reloaders - refreshes ui after build complete
        var liveReloaders = new LiveReloaders(config, socket);

        socket.on('disconnect', function() {
            liveReloaders.destroy();
        });
    }

    function socketBelongsToLogger(socket) {
        return R.pathSatisfies(
            (origin) => {
                return origin.indexOf('http://log.') >= 0 ||
                    origin.indexOf('http://localhost:9000') >= 0
            },
            ['handshake', 'headers', 'referer'],
            socket
        );
    }

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
}
