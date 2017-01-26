# proxy-password-automator
automatically send user/password to http proxy server so you do not need to input it manually.

- please install node.js first.

- Usage of parameters:

    ```
    -local_host host           listening address. Default: localhost. (* means all interfaces)
    -local_port port           listening port. Default: 8080
    -remote_host host          real proxy server address
    -remote_port port          real proxy server port. Default: 8080
    -usr user                  proxy user id
    -pwd password              proxy user password
    -as_pac_server true or false   used as pac(proxy auto configuration) server. Default: no
    ```

##Example1: Normal http/https proxy server
- You have a proxy server `real_proxy_ip:8080`
- You run following command to create a local trampoline at `localhost:8081`

    ```
    node proxy-login-automator.js  -local_port 8081 -remote_host real_proxy_ip -remote_port 8080 -usr user1 -pwd password1
    ```

- Then you can set your browser's proxy ip:port = `localhost:8081` manually or close Chrome then run following command

    ```
    path_of_Chrome --proxy-server=http://localhost:8081
    ```

##Example2: PAC(proxy auto configuration) server
- You have a pac server serving at `http://real_proxy_ip:8080/real_pac_path`

  The real_pac_path point to a PAC file which contains instruction says
  ```
  /*on some condition ...*/ return "PROXY proxy1:port1"
  /*on other condition...*/ return "PROXY proxy2:port2" 
  /*on other condition...*/ return "DIRECT" 
  ```
  means use child proxy servers, assume they require same password.
  
- You run following command to create a trampoline at `http://localhost:65000//real_pac_path`

    ```
	node proxy-login-automator.js  -local_port 65000 -remote_host real_proxy_ip -remote_port 8080 -usr usr1 -pwd password1 -as_pac_server true
	```

    - This tool dynamically create multiple child proxy servers which auto inject authentication header.
    
    - The child proxy servers will listen at `localhost:65001`, `localhost:65002` for proxy1:port1, proxy2:port2 ... respectively.
  
    **please specify large local port number because i use multiple local port sequentially like 65001, 65002, ....**

- Then you can set your browser's PAC url = `http://localhost:65000/real_pac_path` manually or close Chrome then run following command

    ```
	path_of_Chrome --proxy-pac-url=http://localhost:65000/real_pac_path
	```

Note: The user/password are both for the local PAC server and child proxy servers.

#Note for Windows 10 "Windows Store Apps"
On Windows 10, The Windows Store Apps (such as pre-installed Weather, Calender) maybe use "Isolated Network" settings which does not respect Internet Option of IE or control panel.

Windows Store Apps may have its own network policy such as how to connect to internet.
There are group policy Computer Configuration\Policies\Administrative Templates\Network\Network Isolation\Internet proxy servers for apps to serve these apps.

See http://www.thewindowsclub.com/setup-proxy-metro-application-windows-8

#Note for other authentication(such as NTLM)

This tool currently only support HTTP basic authentication between local proxy server and real proxy server. 

If you want to use other authentication such as NTLM,
you can use other tool such as [NGINX reverse proxy to NTLM authenticated http server](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#ntlm)

Good luck
