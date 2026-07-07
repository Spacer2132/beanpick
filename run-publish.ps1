# 자동 게시 래퍼: 날짜별 로그 + 중복 실행 잠금.
# 로그 마커는 인코딩 문제를 피하려고 영문으로 쓴다 (PS5.1은 BOM 없는 UTF-8 스크립트의 한글을 깨뜨린다).
$date = Get-Date -Format "yyyyMMdd"
$logFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$date.log"
$lockFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish.lock.json"
$maxRunSeconds = 5400
Set-Location "C:\Codeproject\Workspace\beanpick"

function Write-Marker($text) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $text" | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Read-LockInfo {
    if (-not (Test-Path $lockFile)) { return $null }
    try {
        return Get-Content -Raw -Path $lockFile | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-ProcessSnapshot($processId) {
    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
        if (-not $processInfo) { return $null }
        return [ordered]@{
            createdAt = ([datetime]$processInfo.CreationDate).ToString("o")
            commandLine = [string]$processInfo.CommandLine
        }
    } catch {
        return $null
    }
}

function Write-LockInfo($childPid) {
    $wrapperSnapshot = Get-ProcessSnapshot $PID
    $childSnapshot = $null
    if ($childPid) {
        $childSnapshot = Get-ProcessSnapshot $childPid
    }

    $info = [ordered]@{
        pid = $PID
        pidCreatedAt = $wrapperSnapshot.createdAt
        pidCommandLine = $wrapperSnapshot.commandLine
        childPid = $childPid
        childCreatedAt = $childSnapshot.createdAt
        childCommandLine = $childSnapshot.commandLine
        startedAt = (Get-Date).ToString("o")
        maxRunSeconds = $maxRunSeconds
    }
    $info | ConvertTo-Json | Out-File -FilePath $lockFile -Encoding utf8
}

function Test-LockProcessIdentity($processId, $expectedCreatedAt, $expectedCommandLine, $requiredText) {
    $snapshot = Get-ProcessSnapshot $processId
    if (-not $snapshot -or -not $expectedCreatedAt -or -not $expectedCommandLine) {
        return $false
    }

    try {
        $ageDeltaSeconds = [Math]::Abs((([datetime]$snapshot.createdAt) - ([datetime]$expectedCreatedAt)).TotalSeconds)
        if ($ageDeltaSeconds -gt 5) { return $false }
    } catch {
        return $false
    }

    if ($snapshot.commandLine -ne $expectedCommandLine) { return $false }
    if ($requiredText -and $snapshot.commandLine -notlike "*$requiredText*") { return $false }
    return $true
}

function Stop-ProcessTree($processId, $reason) {
    Write-Marker "${reason}: stopping process tree pid=$processId"
    & taskkill.exe /PID $processId /T /F 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Get-LockAgeSeconds($lockInfo) {
    if (-not $lockInfo -or -not $lockInfo.startedAt) { return 0 }
    try {
        return ((Get-Date) - ([datetime]$lockInfo.startedAt)).TotalSeconds
    } catch {
        return 0
    }
}

function Get-LiveLockProcessId($lockInfo) {
    if (-not $lockInfo) { return $null }
    if ($lockInfo.childPid -and (Test-LockProcessIdentity ([int]$lockInfo.childPid) $lockInfo.childCreatedAt $lockInfo.childCommandLine "npm.cmd run iphone:snapshot:publish")) {
        return [int]$lockInfo.childPid
    }
    if ($lockInfo.pid -and (Test-LockProcessIdentity ([int]$lockInfo.pid) $lockInfo.pidCreatedAt $lockInfo.pidCommandLine "run-publish.ps1")) {
        return [int]$lockInfo.pid
    }
    return $null
}

# PC가 꺼져 있다 켜지면 밀린 작업들이 동시에 발화한다. 두 게시가 같이 돌면
# 네이버 수집이 서로 간섭해 데이터가 나빠지므로, 이미 실행 중이면 건너뛴다.
$mutex = New-Object System.Threading.Mutex($false, "Global\BeanPickAutoPublish")
$acquired = $false
try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
if (-not $acquired) {
    $lockInfo = Read-LockInfo
    $lockAgeSeconds = Get-LockAgeSeconds $lockInfo

    if ($lockInfo -and $lockInfo.pid -and $lockAgeSeconds -gt $maxRunSeconds) {
        $liveLockProcessId = Get-LiveLockProcessId $lockInfo
        if ($liveLockProcessId) {
            Stop-ProcessTree $liveLockProcessId "STALE LOCK age=$([int]$lockAgeSeconds)s"
            Start-Sleep -Seconds 3
        } else {
            Write-Marker "STALE LOCK age=$([int]$lockAgeSeconds)s: recorded process is not alive"
        }

        try {
            $acquired = $mutex.WaitOne(30000)
        } catch [System.Threading.AbandonedMutexException] {
            $acquired = $true
        }
    }

    if (-not $acquired) {
        Write-Marker "SKIP: another publish is already running"
        exit 0
    }
}

$existingLockInfo = Read-LockInfo
$existingLockAgeSeconds = Get-LockAgeSeconds $existingLockInfo
$existingLockProcessId = Get-LiveLockProcessId $existingLockInfo
if ($existingLockProcessId) {
    if ($existingLockAgeSeconds -gt $maxRunSeconds) {
        Stop-ProcessTree $existingLockProcessId "STALE ORPHAN age=$([int]$existingLockAgeSeconds)s"
        Start-Sleep -Seconds 3
    } else {
        Write-Marker "SKIP: previous publish process is still running pid=$existingLockProcessId"
        $mutex.ReleaseMutex() | Out-Null
        $mutex.Dispose()
        exit 0
    }
} elseif ($existingLockInfo) {
    Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
}

$exitCode = 0
$stdoutFile = $null
$stderrFile = $null
$exitCodeFile = $null
try {
    Write-Marker "START auto-publish"
    Write-LockInfo $null

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $stdoutFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$stamp-$PID.out.tmp"
    $stderrFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$stamp-$PID.err.tmp"
    $exitCodeFile = "C:\Codeproject\Workspace\beanpick\output\auto-publish-$stamp-$PID.code.tmp"
    $publishCommand = "npm.cmd run iphone:snapshot:publish > `"$stdoutFile`" 2> `"$stderrFile`" & echo !ERRORLEVEL! > `"$exitCodeFile`""
    $process = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/d", "/v:on", "/s", "/c", $publishCommand `
        -NoNewWindow `
        -PassThru
    Write-LockInfo $process.Id

    $deadline = (Get-Date).AddSeconds($maxRunSeconds)
    while (-not $process.HasExited -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $process.Refresh()
    }

    if (-not $process.HasExited) {
        Write-Marker "TIMEOUT: auto-publish exceeded ${maxRunSeconds}s"
        Stop-ProcessTree $process.Id "TIMEOUT"
        $exitCode = 124
    } else {
        if ($exitCodeFile -and (Test-Path $exitCodeFile)) {
            try {
                $exitCode = [int](Get-Content -Path $exitCodeFile -First 1)
            } catch {
                $exitCode = 1
                Write-Marker "ERROR: failed to read publish exit code"
            }
        } else {
            $exitCode = 1
            Write-Marker "ERROR: publish exit code file missing"
        }
    }

    if ($stdoutFile -and (Test-Path $stdoutFile)) {
        Get-Content -Path $stdoutFile | Out-File -FilePath $logFile -Append -Encoding utf8
    }
    if ($stderrFile -and (Test-Path $stderrFile)) {
        Get-Content -Path $stderrFile | Out-File -FilePath $logFile -Append -Encoding utf8
    }

    Write-Marker "END auto-publish (exit $exitCode)"
} finally {
    if ($stdoutFile -and (Test-Path $stdoutFile)) { Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue }
    if ($stderrFile -and (Test-Path $stderrFile)) { Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue }
    if ($exitCodeFile -and (Test-Path $exitCodeFile)) { Remove-Item -LiteralPath $exitCodeFile -Force -ErrorAction SilentlyContinue }
    if ($acquired) {
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
        $mutex.ReleaseMutex() | Out-Null
    }
    $mutex.Dispose()
}

exit $exitCode
