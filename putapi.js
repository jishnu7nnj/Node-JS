var express = require('express');
var app = express();
var Request = require('request');
var http = require('http');
var bodyParser = require('body-parser');

app.use(bodyParser.json());


var port = process.env.PORT || 2030; //setting up the port
var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .');
});

app.put('/putdata', function(req, res){
    console.log(req.body);
    Request.put({
        "headers": {
            "content-type": "application/json"
        },
        "url": "http://localhost:2647/putdata",
        "body": JSON.stringify(req.body)
    }, (error, response, body) => {
        res.send(response);
   });
});