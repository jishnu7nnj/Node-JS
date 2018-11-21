var express = require('express');
var app = express();
var router = require('router');
var cassandra = require('cassandra-driver');
var http = require('http');
var bodyParser = require('body-parser');

var port = process.env.PORT || 3000; //setting up the port

var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});

var client = new cassandra.Client({contactPoints : ['localhost']}); //cassandra client to establish connection with the DB
client.connect(function(err, result){
    console.log('Connection made. . . ');
});

var query = 'SELECT * from dbkey.orders';
app.get('/getdata', function(req, res){
//executing the query for retreiving the data from the DB
    client.execute(query, [], function(err, result){
        if(err){
            res.status(404).send({msg : err});
        }else{
            console.log(result.rows);
            res.send(result.rows)
        }
    })
});

