const express=require('express');
const app= express();
var http = require('http');
var bodyParser = require('body-parser');

var port = process.env.PORT || 2991;
const courses= [
    {id: 1, name: 'Course1'},
    {id: 2, name: 'Course2'},
    {id: 3, name: 'Course3'},
];
var server = http.createServer(app);
server.listen(port, function() {
    console.log('Listening. . . ')
});

app.get('/api/course/getdata', function(req, res) {

    res.send('1st Get request');
    
});
