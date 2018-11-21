const express = require('express');
const app = express();
var http =  require('http');
var bodyparser = require('body-parser');

var port = process.env.PORT || 2991;
const courses= [
    {id: 1, name: 'Course1'},
    {id: 2, name: 'Course2'},
    {id: 3, name: 'Course3'},
];
var server = http.createServer(app);
server.listen(port, function() {
    console.log('Listening. . . ')
});
app.use(bodyparser.json());

app.put('/api/course/:id', function (req, res){
  
    const requestID = req.params.id;
    var course = courses.filter(course => {
        return course.id == requestID;
    })[0];
    const index = courses.indexOf(course);
    const keys = Object.keys(req.body);
    
    keys.forEach(key =>{
        course[key] = req.body[key];
    });
    courses[index]= course;
    res.send(courses[index]);
    console.log(courses);
});