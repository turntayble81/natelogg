var express  = require('express');
var socketio = require('socket.io');
var morgan   = require('morgan');
var fs       = require('fs');
var Tail     = require('tail').Tail;
var config   = require('./config');
var app      = express();
var watchers = {};
var _socket;

app.set('view engine', 'ejs');
app.use(morgan('dev'));

app.get('/', function (req, res) {
    fs.readdir(config.logDirectory, function(err, logs) {
        if(err) {
           return res.send('Can\'t read log directory ' + config.logDirectory); 
        }
        logs.forEach(function(log) {
            var watcher = new Tail(config.logDirectory + '/' + log);
            watcher.unwatch();
            watcher.on('line', function(data) {
                _socket.emit('logData', data);
            });
            watcher.on('error', function(err) {
                _socket.emit('logData', data);
            });
            watchers[log] = watcher;
        });

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
    console.log('Client websocket connected.');

    _socket = socket;
    socket.on('toggleLog', function(data) {
        var watcher = watchers[data.log];
        if(data.enabled) {
            console.log('Log %s is now being watched.', data.log);
            watcher.watch();
        }else {
            console.log('Log %s is no longer being watched.', data.log);
            watcher.unwatch();
        }
    });

    socket.on('disconnect', function() {
        console.log('Client websocket disconnected.');
    });
});
