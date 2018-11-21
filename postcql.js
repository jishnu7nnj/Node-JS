var express = require('express');
var app = express();
var cassandra = require('cassandra-driver');
var http = require('http');
var bodyParser = require('body-parser');

//for processing the JSON body from the server
app.use(bodyParser.json());

var port = process.env.PORT || 2991; //setting up the port

var server = http.createServer(app) //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});

var client = new cassandra.Client({contactPoints : ['localhost'], keyspace: process.env.keyspace}); //cassandra client to establish connection with the DB
client.connect(function(err){
    console.log('Connection made. . . ');
});

var query = 'INSERT INTO dbkey.orders(order_id, location, product_name, quantity) VALUES (?, ?, ?, ?)';
app.post('/postdata', function(req, res){
    console.log(query);
    console.log(req.body);
    var params = [req.body.order_id, req.body.location, req.body.product_name, req.body.quantity];
//executing the query for inserting the data into the DB
    client.execute(query, params,{prepare: true}, function(err, result){
        if(err){
            res.send(err);
        }else{
            res.send(result.rows);
        }
    })
})
