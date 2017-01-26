# proxy-password-automator
Automatically inject user/password to proxy server(HTTP/HTTPS), so you do not need to input password manually.

This is done by create a local proxy server as trampoline to real proxy server.
You need change your proxy config to use the local proxy server.

[PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) is also supported. Child proxy servers 
(defined in PAC) which require user/password will also be automated by dynamically created trampolines. 

## Usage

- Please install node.js first.
 
- Download & cd this project dir, run `node proxy-login-automator.js ...`. 

  For Linux/Mac users, you can install it by `npm install -g proxy-login-automator` 
  then run `proxy-login-automator.js` directly. 

- Parameters of `proxy-login-automator.js`:

    ```
    -local_host host           listening address. Default: localhost. (* means all interfaces)
    -local_port port           listening port. Default: 8080
    -remote_host host          real proxy server address
    -remote_port port          real proxy server port. Default: 8080
    -usr user                  proxy user id
    -pwd password              proxy user password
    -as_pac_server true or false   used as pac(proxy auto configuration) server. Default: no
    ```

##Example1: normal Proxy Server

- You have a proxy server `http://real_proxy_ip:8080`

    This server requires a user/password.

- You run following command to create a local trampoline at `localhost:8081`

    ```
    node proxy-login-automator.js  -local_port 8081 -remote_host real_proxy_ip -remote_port 8080 -usr user1 -pwd password1
    ```

- Then you can set your browser's proxy ip:port = `localhost:8081` manually or close Chrome then run following command

    ```
    path_of_Chrome --proxy-server=http://localhost:8081
    ```

##Example2: [PAC(proxy auto configuration)](https://en.wikipedia.org/wiki/Proxy_auto-config) Server

- You have a pac server serving at `http://real_proxy_ip:8080/real_pac_path`

    This server may require a user/password or not, it does not matter.

    The real_pac_path points to a [PAC file](https://en.wikipedia.org/wiki/Proxy_auto-config)
    which contains instructions says
    ```
    /*on some condition ...*/ return "PROXY proxy1:port1"
    /*on another condition...*/ return "PROXY proxy2:port2" 
    /*on other condition...*/ return "DIRECT" 
    ```
    means use child proxy servers.
     
    **Assume all user/password are same**.
  
- You run following command to create a trampoline at `http://localhost:65000//real_pac_path`

    ```
	node proxy-login-automator.js  -local_port 65000 -remote_host real_proxy_ip -remote_port 8080 -usr usr1 -pwd password1 -as_pac_server true
	```

    - This tool dynamically creates multiple child proxy servers which auto inject user/password when talking to real proxy servers.
    
    - The child proxy servers will listen at `localhost:65001`, `localhost:65002` for proxy1:port1, proxy2:port2 ... respectively.
  
    **Please specify large local port number because i use multiple local port incrementally like 65001, 65002, ....**

- Then you can set your browser's PAC url = `http://localhost:65000/real_pac_path` manually or close Chrome then run following command

    ```
	path_of_Chrome --proxy-pac-url=http://localhost:65000/real_pac_path
	```

##Note for Windows 10 "Windows Store Apps"

On Windows 10, The Windows Store Apps (such as pre-installed Weather, Calender) maybe use "Isolated Network" settings which does not respect Internet Option of IE or control panel.

Windows Store Apps may have its own network policy such as how to connect to internet.
There are group policy Computer Configuration\Policies\Administrative Templates\Network\Network Isolation\Internet proxy servers for apps to serve these apps.

See http://www.thewindowsclub.com/setup-proxy-metro-application-windows-8

##Note for other authentication(such as NTLM)

This tool currently only support HTTP basic authentication between local proxy server and real proxy server. 

If you want to use other authentication such as NTLM,
you can use other tool such as [NGINX reverse proxy to NTLM authenticated http server](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#ntlm)

##Note for HTTPS 

Proxy Server normally supports HTTPS browsing(by [handling HTTP CONNECT request](https://en.wikipedia.org/wiki/HTTP_tunnel)),
so this tool also support HTTPS browsing of course.

As above link described, even serving for HTTPS browsing, **when talk to proxy server, 
browsers are still using HTTP** to send the `HTTP CONNECT` request, 
where the user/password will also be injected.
This seems mainly due to historical reason. 

Currently only Chrome support HTTPS talking. 

So this tool only use HTTP to talk to proxy server.

Good luck
