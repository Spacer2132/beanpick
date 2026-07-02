# 자동 게시 래퍼: 날짜별 로그 + 중복 실행 잠금.
# 로그 마커는 인코딩 문제를 피하려고 영문으로 쓴다 (PS5.1은 BOM 없는 UTF-8 스크립트의 한글을 깨뜨린다).
$date = Get-Date -Format "yyyyMMdd"
$logFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$date.log"
Set-Location "C:\Codeproject\Workspace\beanpick"

function Write-Marker($text) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $text" | Out-File -FilePath $logFile -Append -Encoding utf8
}

# PC가 꺼져 있다 켜지면 밀린 작업들이 동시에 발화한다. 두 게시가 같이 돌면
# 네이버 수집이 서로 간섭해 데이터가 나빠지므로, 이미 실행 중이면 건너뛴다.
$mutex = New-Object System.Threading.Mutex($false, "Global\BeanPickAutoPublish")
$acquired = $false
try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
if (-not $acquired) {
    Write-Marker "SKIP: another publish is already running"
    exit 0
}

try {
    Write-Marker "START auto-publish"
    npm run iphone:snapshot:publish 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
    Write-Marker "END auto-publish (exit $LASTEXITCODE)"
} finally {
    $mutex.ReleaseMutex() | Out-Null
}
