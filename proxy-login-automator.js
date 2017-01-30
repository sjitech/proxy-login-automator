#!/usr/bin/env node
'use strict';
var net = require('net'), tls = require('tls');
var HTTPParser = process.binding('http_parser').HTTPParser;
var http = require('http'), https = require('https');
var url = require('url');

function main() {
  //convert `-key value` to cfg[key]=value
  var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function (cfg, arg, i, argv) {
    i % 2 === 0 && (arg.slice(0, 1) === '-' && (cfg[arg.slice(1)] = argv[i + 1]));
    return cfg;
  }, /*init cfg:*/ {local_host: 'localhost', local_port: 8080, remote_host: 8080, remote_port: 8080});
  cfg.local_host = cfg.local_host || cfg.host;
  cfg.local_port = Number(cfg.local_port || cfg.port);
  cfg.remote_port = Number(cfg.remote_port);
  cfg.usr = cfg.usr || cfg.user || '';
  cfg.pwd = cfg.pwd || cfg.password || '';
  cfg.as_pac_server = cfg.as_pac_server === 'true';
  cfg.is_remote_https = cfg.is_remote_https === 'true';
  cfg.chk_remote_cert = cfg.chk_remote_cert !== 'false';

  if (!cfg.local_host || !cfg.local_port || !cfg.remote_host || !cfg.remote_port || !cfg.usr || !cfg.pwd)
    return console.error('Usage of parameters:\n'
      + '-local_host host\t' + 'listening address. Default: localhost. (* means all interfaces)\n'
      + '-local_port port\t' + 'listening port. Default: 8080\n'
      + '-remote_host host\t' + 'real proxy server address\n'
      + '-remote_port port\t' + 'real proxy server port. Default: 8080\n'
      + '-usr user\t' + 'proxy user id\n'
      + '-pwd password\t' + 'proxy user password\n'
      + '-as_pac_server true/false \t' + 'used as pac(proxy auto configuration) server. Default: false\n'
      + '-is_remote_https true/false \t' + 'talk to real proxy server with HTTPS. Default: false\n'
      + '-chk_remote_cert true/false \t' + 'check real proxy server SSL certificate. Default: true\n'
    );
  if (cfg.as_pac_server && (cfg.local_host === '*' || cfg.local_host === '0.0.0.0' || cfg.local_host === '::')) {
    return console.error('when use as a PAC server, the local_host parameter must be a definite address');
  }
  console.error('Using parameters: ' + JSON.stringify(cfg, null, '  '));
  cfg.buf_proxy_basic_auth = new Buffer('Proxy-Authorization: Basic ' + new Buffer(cfg.usr + ':' + cfg.pwd).toString('base64'));

  if (cfg.as_pac_server) {
    createPacServer(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth, cfg.is_remote_https, cfg.chk_remote_cert);
  } else {
    createPortForwarder(cfg.local_host, cfg.local_port, cfg.remote_host, cfg.remote_port, cfg.buf_proxy_basic_auth, cfg.is_remote_https, cfg.chk_remote_cert);
  }
}

var CR = 0xd, LF = 0xa, BUF_CR = new Buffer([0xd]), BUF_CR_LF_CR_LF = new Buffer([0xd, 0xa, 0xd, 0xa]), BUF_LF_LF = new Buffer([0xa, 0xa]);
var STATE_NONE = 0, STATE_FOUND_LF = 1, STATE_FOUND_LF_CR = 2;

function createPortForwarder(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, is_remote_https, chk_remote_cert) {
  net.createServer({allowHalfOpen: true}, function (socket) {
    var realCon = (is_remote_https ? tls : net).connect({
      port: remote_port, host: remote_host, allowHalfOpen: true,
      rejectUnauthorized: chk_remote_cert /*not used when is_remote_https false*/
    });
    realCon.on('data', function (buf) {
      //console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
      socket.write(buf);
      realCon.__haveGotData = true;
    }).on('end', function () {
      socket.end();
      if (!realCon.__haveGotData && !realCon.__haveShownError) {
        console.log('[Local proxy server(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: ended by remote peer');
        realCon.__haveShownError = true;
      }
    }).on('close', function () {
      socket.end();
      if (!realCon.__haveGotData && !realCon.__haveShownError) {
        console.log('[Local proxy server(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] Error: reset by remote peer');
        realCon.__haveShownError = true;
      }
    }).on('error', function (err) {
      console.log('[Local proxy server(:' + local_port + ')][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
      realCon.__haveShownError = true;
    });

    var parser = new HTTPParser(HTTPParser.REQUEST);
    parser[HTTPParser.kOnHeadersComplete] = function () {
      //console.log('---- kOnHeadersComplete----');
      //console.log(arguments);
      parser.__is_headers_complete = true;
    };
    //parser[HTTPParser.kOnMessageComplete] = function () {
    //    console.log('---- kOnMessageComplete----');
    //    console.log(arguments);
    //};

    var state = STATE_NONE;

    socket.on('data', function (buf) {
      //console.log('[' + remote_host + ':' + remote_port + ']>>>>' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
      //var ret = parser.execute(buf);
      //console.log('\n\n----parser result: ' + ret + ' buf len:' + buf.length);
      //realCon.write(buf);
      //return;

      var buf_ary = [], unsavedStart = 0, buf_len = buf.length;

      //process orphan CR
      if (state === STATE_FOUND_LF_CR && buf[0] !== LF) {
        parser.execute(BUF_CR);
        buf_ary.push(BUF_CR);
      }

      for (var i = 0; i < buf_len; i++) {
        //find first LF
        if (state === STATE_NONE) {
          if (buf[i] === LF) {
            state = STATE_FOUND_LF;
          }
          continue;
        }

        //find second CR LF or LF
        if (buf[i] === LF) {
          parser.__is_headers_complete = false;
          parser.execute(buf.slice(unsavedStart, i + 1));

          if (parser.__is_headers_complete) {
            buf_ary.push(buf.slice(unsavedStart, buf[i - 1] === CR ? i - 1 : i));
            //console.log('insert auth header');
            buf_ary.push(buf_proxy_basic_auth);
            buf_ary.push(state === STATE_FOUND_LF_CR ? BUF_CR_LF_CR_LF : BUF_LF_LF);

            unsavedStart = i + 1;
            state = STATE_NONE;
          }
          else {
            state = STATE_FOUND_LF;
          }
        }
        else if (buf[i] === CR && state === STATE_FOUND_LF) {
          state = STATE_FOUND_LF_CR;
        } else {
          state = STATE_NONE;
        }
      }

      if (unsavedStart < buf_len) {
        //strip last CR if found LF_CR
        buf = buf.slice(unsavedStart, state === STATE_FOUND_LF_CR ? buf_len - 1 : buf_len);
        if (buf.length) {
          parser.execute(buf);
          buf_ary.push(buf);
        }
      }

      buf = Buffer.concat(buf_ary);
      realCon.write(buf);

    }).on('end', cleanup).on('close', cleanup).on('error', function (err) {
      console.log('[Local proxy server(:' + local_port + ')][Incoming connection] ' + err);
    });

    function cleanup() {
      if (parser) {
        parser.close();
        parser = null;
      }
      realCon.end();
    }
  }).on('error', function (err) {
    console.log('[Local proxy server(:' + local_port + ')] Failed to listen at ' + local_host + ':' + local_port + '\n' + err);
    process.exit(1);
  }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
    console.log('[Local proxy server(:' + local_port + ')] OK: forward ' + local_host + ':' + local_port + ' to ' + remote_host + ':' + remote_port);
  });
}

var proxyAddrMap = {};

function createPacServer(local_host, local_port, remote_host, remote_port, buf_proxy_basic_auth, is_remote_https, chk_remote_cert) {
  http.createServer(function (req, res) {

    var internal_req = url.parse(req.url);

    internal_req.host = remote_host;
    internal_req.port = remote_port;
    if (req.headers['host']) { //to avoid certificate verification error
      req.headers['host'] = remote_host + ( req.headers['host'].indexOf(':') >= 0 ? (':' + remote_port) : '');
    }
    if (!req.headers['proxy-authorization']) {
      req.headers['proxy-authorization'] = buf_proxy_basic_auth.slice('Proxy-Authorization: '.length);
    }
    internal_req.headers = req.headers;
    internal_req.keepAlive = req.headers['connection'] === 'keep-alive';
    internal_req.rejectUnauthorized = chk_remote_cert; //only used for SSL

    (is_remote_https ? https : http).get(internal_req, function (internal_res) {

      delete internal_res.headers['content-length'];
      delete internal_res.headers['transfer-encoding'];

      res.writeHead(internal_res.statusCode, internal_res.headers);
      res.__haveWrittenData = true;

      var buf_ary = [];
      internal_res.on('data', function (buf) {
        // console.log('<<<<' + (Date.t=new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
        buf_ary.push(buf);
      }).on('end', function () {
        var s = Buffer.concat(buf_ary).toString();
        buf_ary = [];
        s = s.replace(/\bPROXY\s+([^'":;\s]+):(\d+)/g, function (_, host, port) {
          var remoteAddr = host + ':' + port;
          var _local_port = proxyAddrMap[remoteAddr];
          if (!_local_port) {
            _local_port = local_port + Object.keys(proxyAddrMap).length + 1;
            proxyAddrMap[remoteAddr] = _local_port;
            createPortForwarder(local_host, _local_port, host, Number(port), buf_proxy_basic_auth, is_remote_https, chk_remote_cert);
          }
          return 'PROXY ' + local_host + ':' + _local_port;
        });
        //console.log('return patched pac');
        res.end(s);
      }).on('error', function (err) {
        res.end();
        console.log('[Local PAC server][Reading response from ' + remote_host + ':' + remote_port + '] ' + err);
      });
    }).on('error', function (err) {
      if (!res.__haveWrittenData) {
        res.statusCode = 500;
        res.end();
      }
      console.log('[Local PAC server][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
    });
    res.on('error', function (err) {
      console.log('[Local PAC server][Writing response] ' + err);
    });
  }).on('error', function (err) {
    console.log('[Local PAC server] Failed to listen at ' + local_host + ':' + local_port + '\n' + err);
    process.exit(1);
  }).listen(local_port, local_host === '*' ? undefined : local_host, function () {
    console.log('[Local PAC server] OK: listen at ' + local_host + ':' + local_port);
  });
}

main();
