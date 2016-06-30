var express  = require('express');
var socketio = require('socket.io');
var morgan   = require('morgan');
var fs       = require('fs');
var config   = require('./config');
var app      = express();

app.set('view engine', 'ejs');
app.use(morgan('dev'));

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
    console.log('Client websocket connected.');

    socket.on('disconnect', function() {
        console.log('Client websocket disconnected.');
    });
});
