var express = require('express');
var app = express();
var cassandra = require('cassandra-driver');
var http = require('http');
var bodyparser = require('body-parser');

//for processing the JSON body from the server
app.use(bodyparser.json());

var port = process.env.PORT || 2647; //setting up the port

var server = http.createServer(app); //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});

var client = new cassandra.Client({contactPoints: ['localhost'], keyspace: 'dbkey'}); //cassandra client to establish connection with the DB
client.connect(function(err){
    console.log('Connection made. . . ');
});

var query = 'UPDATE dbkey.orders set quantity = ? WHERE order_id = ?';
app.put('/putdata',function(req, res){
    console.log("body is ----> "+req.body);
    var params = [req.body.quantity, req.body.order_id];
    console.log(req.body);
//executing the query for updating the data from the DB
    client.execute(query, params, {prepare: true}, function(err, result){
        if(err){
         console.log("error :" +err);
        }else{
            console.log("Updated");
        }
    })
    res.sendStatus(200);
});