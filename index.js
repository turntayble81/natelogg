var express = require('express');
var fs      = require('fs');
var config = require('./config');
var app = express();

app.set('view engine', 'ejs');

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

app.listen(config.port, function () {
    console.log('Natelogg started on port %s', config.port);
});
