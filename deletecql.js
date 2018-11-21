var express = require('express');
var app = express();
var cassandra = require('cassandra-driver');
var http = require('http');
var bodyparser = require('body-parser');

//for processing the JSON body from the server
app.use(bodyparser.json());

var port = process.env.PORT || 3222; //setting up the port

var server = http.createServer(app); //creating the server
server.listen(port, function(){
    console.log('Listening. . .')
});

var client = new cassandra.Client({contactPoints: ['localhost'], keyspace: 'dbkey'}); //cassandra client to establish connection with the DB
client.connect(function(err){
    console.log('Connection made. . . ');
});

var query = 'DELETE FROM dbkey.orders WHERE order_id=?';
app.delete('/deletedata',function(req, res){
    var params = [req.body.order_id];
    console.log(req.body.order_id);
//executing the query for deleting the data from the DB
    client.execute(query, params, {prepare: true}, function(err, result){
        if(err){
            res.send("Error :" +err);
        }else{
            res.send("Deleted");
        }
    })
});