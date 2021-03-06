const express = require('express');
const app = express();
var http = require('http');
var bodyparser = require('body-parser');

var port = process.env.PORT || 2991;

const courses= [
    {id: 1, name: 'Course1'},
    {id: 2, name: 'Course2'},
    {id: 3, name: 'Course3'},
    {id: 4, name: 'Course4'},
    {id: 5, name: 'Course5'},
    {id: 6, name: 'Course6'},
];

var server = http.createServer(app);
server.listen(port, function(){
    console.log('Listening to server 2991. . .')
});

app.use(bodyparser.json());

app.post('/api/course/postdata', function(req, res){
    const course = {
        id: courses.length + 1,
        name: req.body.name
    }
    courses.push(course);
    res.send('Data pushed');
    console.log(req.body.name);
    console.log(courses)
});