var express = require('express');
var app = express();
var Request = require('request');
var http = require('http');
var bodyParser = require('body-parser');
require("dotenv-json")();

app.use(bodyParser.json());


var port = process.env.PORT || 2971; //setting up the port
var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});



app.post('/getdata', function(req, res){
    console.log(req.body);
    Request.post({
        "headers": {
            "content-type": "application/json"
        },
        "url": process.env.URL_API,
        "body": JSON.stringify(req.body)
})
res.sendStatus(200);
});
