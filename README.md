# proxy-password-automator
automatically send user/password to http proxy server so you do not need to input it manually.<br><br>
please install node.js first.<br><br>

##Example1: Normal http/https proxy server
You have a proxy server real_proxy_ip:8080<br><br>
You run following command to create a local trampoline at localhost:8081<br>

    node proxy-login-automator.js  -local_port 8081 -remote_host real_proxy_ip -remote_port 8080 -usr user1 -pwd password1

Then you can set your browser's proxy ip:port = localhost:8081<br>

    path_of_Chrome --proxy-server=http://localhost:8081

##Example2: PAC(proxy auto configuration) server
You have a pac server serving at http://real_proxy_ip:80/real_pac_path<br>
You run following command to create a trampoline at http://localhost:65000//real_pac_path<br>
(please specify large local port number because i use multiple local port sequentially like 65001, 65002, ....)<br>

	node proxy-login-automator.js  -local_port 65000 -remote_host real_proxy_ip -remote_port 80 -usr usr1 -pwd password1 -as_pac_server true

Then you can set your browser's PAC url = http://localhost:65000/real_pac_path<br>

	path_of_Chrome --proxy-pac-url=http://localhost:65000/real_pac_path

----
##Usage of parameters:
    -local_host host           listening address. Default: localhost. (* means all interfaces)
    -local_port port           listening port. Default: 8080
    -remote_host host          real proxy server address
    -remote_port port          real proxy server port. Default: 8080
    -usr user                  proxy user id
    -pwd password              proxy user password
    -as_pac_server true or false   used as pac(proxy auto configuration) server. Default: no

