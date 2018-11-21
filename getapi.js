var express = require('express');
var app = express();
var Request = require('request');
var http = require('http');
var bodyParser = require('body-parser');

app.use(bodyParser.json());

var port = process.env.PORT || 2020; //setting up the port
var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});
const getDetails = {
    "headers": {
        "content-type": "application/json"
    },
    url: "http://localhost:3000/getdata",
    method: "GET"
}

app.get('/read', function(req, res){
  http.request(getDetails,(response) => {
    if(response.statusCode === 200){
        res.sendStatus(200);
        console.log(response.body)
    };
    req.on('error', function(error){
        res.status(404).send({msg : error});
    });
   });
});