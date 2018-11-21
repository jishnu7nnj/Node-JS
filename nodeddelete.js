const express = require('express');
const app = express();
const http = require('http');


const courses= [
    {id: 1, name: 'Course1'},
    {id: 2, name: 'Course2'},
    {id: 3, name: 'Course3'},
    {id: 4, name: 'Course4'},
    {id: 5, name: 'Course5'}
];
var port = process.env.PORT || 2991;

var server = http.createServer(app);
server.listen(port, function(){
    console.log('Listening to port 2991. . .')
});


app.delete('/api/course/deletedata/:id', function(req, res){
    const requestID = req.params.id;
    
    var course = courses.filter(course =>{
        return course.id == requestID;
    })[0];
    
    const index = courses.indexOf(course);
    courses.splice(index, 1);
    res.send('Okay');
    console.log('Deleted');
    console.log(courses)
});