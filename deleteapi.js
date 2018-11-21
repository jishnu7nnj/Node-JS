var express = require('express');
var app = express();
var Request = require('request');
var http = require('http');
var bodyParser = require('body-parser');

app.use(bodyParser.json());

var port = process.env.PORT || 2040; //setting up the port
var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});

app.delete('/deletedata', function(req, res){
    console.log(req.body);
    Request.delete({
        "headers": {
            "content-type": "application/json"
        },
        "url": "http://localhost:3222/deletedata",
        "body": JSON.stringify(req.body)
    }, (error, response, body) => {
        res.send(response);
   });
});
