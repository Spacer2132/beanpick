$date = Get-Date -Format "yyyyMMdd"
$logFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$date.log"
Set-Location "C:\Codeproject\Workspace\beanpick"
npm run iphone:snapshot:publish 2>&1 | Tee-Object -FilePath $logFile -Append
