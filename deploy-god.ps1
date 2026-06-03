$ErrorActionPreference = "Stop"

$Server = "root@8.148.245.29"
$RemoteDir = "/www/wwwroot/awkn-lab/god"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$Items = @(
    (Join-Path $ScriptDir "index.html")
    (Join-Path $ScriptDir "css")
    (Join-Path $ScriptDir "js")
    (Join-Path $ScriptDir "assets")
)

Write-Host "Deploying to $Server`:$RemoteDir ..."

& scp -r -o ConnectTimeout=30 @Items "$Server`:$RemoteDir/"

& ssh $Server "find '$RemoteDir' -type d -exec chmod 755 '{}' ';' && find '$RemoteDir' -type f -exec chmod 644 '{}' ';'"

Write-Host "Deployment successful!"
