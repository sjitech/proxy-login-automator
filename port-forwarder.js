var net = require('net'), t;
net.createServer({allowHalfOpen:true}, function(socket){
    var con = net.connect({port:8080, host:'real_proxy_server', allowHalfOpen:true});
    con.on('data', function(buf) {
        console.log('<<<<' + (t=new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        socket.write(buf);
    }).on('end', function() {
        socket.end();
    }).on('error', dummy);
    socket.on('data', function(buf){
        console.log('>>>>' + (t=new Date()) + '.' + t.getMilliseconds() + '\n' + buf.toString('ascii'));
        con.write(buf);
    }).on('end', function() {
        con.end();
    }).on('error', dummy);
}).listen(8080, 'localhost');

function dummy() {}
