# proxy-password-automator
automatically send user/password to http proxy server so you do not need to input it manually<br><br>

Not finished yet. please wait.

Usage:

run <br>
<br>
node proxy-login-automator.js <br>
<br>
Usage of parameters: <br>
        [--host host]           listening address. Default: localhost. (* means all interfaces) <br>
        [--port port]           listening port. Default: 8080 <br>
        <--remote_host host>            real proxy server address <br>
        [--remote_port port]            real proxy server port. Default: 8080 <br>
        [--pac urlPath]         proxy_auto_config_file_url_path <br>
        [--usr user]            proxy user id <br>
        [--pwd password]                proxy user password <br>


then <br>
<br>
C:\Users\qj>"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --proxy-server=http://localhost:8600<br>

