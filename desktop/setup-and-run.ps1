$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$runtime = Join-Path $env:LOCALAPPDATA "SillyFactory\node"
$node = Join-Path $runtime "node.exe"
$npmCli = Join-Path $runtime "node_modules\npm\bin\npm-cli.js"

function Say([string]$Code) {
  Write-Output "STATUS $Code"
}

function Quote([string]$Text) {
  return '"' + ($Text -replace '"', '\"') + '"'
}

function Invoke-HiddenNode([string[]]$Words) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $quoted = foreach ($word in $Words) { Quote $word }
  $psi.Arguments = $quoted -join " "
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::Start($psi)
  $outTask = $process.StandardOutput.ReadToEndAsync()
  $errTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $outTask.Wait()
  $errTask.Wait()
  $logDir = Join-Path $env:LOCALAPPDATA "SillyFactory"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $text = $outTask.Result + "`r`n" + $errTask.Result
  [System.IO.File]::AppendAllText((Join-Path $logDir "setup.log"), $text + "`r`n")
  if ($process.ExitCode -ne 0) { throw "Command failed." }
}

if (-not (Test-Path $node)) {
  Say "node"
  $sums = (Invoke-WebRequest "https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt" -UseBasicParsing).Content
  $line = @($sums -split "`n" | Where-Object { $_ -match "win-x64\.zip" }) | Select-Object -First 1
  if (-not $line) { throw "Node.js package was not found." }
  $name = ($line.Trim() -split "\s+")[-1]
  $zip = Join-Path $env:TEMP $name
  Invoke-WebRequest "https://nodejs.org/dist/latest-v22.x/$name" -OutFile $zip -UseBasicParsing
  $unpack = Join-Path $env:TEMP "silly-factory-node"
  if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
  Expand-Archive $zip -DestinationPath $unpack
  $extracted = Get-ChildItem $unpack -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force -Path (Split-Path $runtime) | Out-Null
  if (Test-Path $runtime) { Remove-Item $runtime -Recurse -Force }
  Move-Item $extracted.FullName $runtime
}

$env:Path = "$runtime;" + $env:Path

function Hash-File([string]$Path) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "") }
  finally { $stream.Close(); $sha.Dispose() }
}

$lockFile = Join-Path $root "package-lock.json"
$depsStamp = Join-Path $env:LOCALAPPDATA "SillyFactory\deps.stamp"
$want = ""
if (Test-Path $lockFile) { $want = Hash-File $lockFile }
$have = ""
if (Test-Path $depsStamp) { $have = (Get-Content $depsStamp -Raw).Trim() }
$depsReady = ($have -eq $want) -and (Test-Path "node_modules\.bin\next.cmd") -and (Test-Path "node_modules\@remotion\renderer")
if (-not $depsReady) {
  Say "deps"
  Invoke-HiddenNode @($npmCli, "install")
  if (-not (Test-Path "node_modules\.bin\next.cmd")) { throw "Dependencies did not install." }
  if (Test-Path $lockFile) { $want = Hash-File $lockFile }
  New-Item -ItemType Directory -Force -Path (Split-Path $depsStamp) | Out-Null
  Set-Content -Path $depsStamp -Value $want -Encoding Ascii
}

$cached = Get-ChildItem "node_modules\.remotion" -Recurse -Filter "chrome*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$systemChrome = @(
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $cached -and -not $systemChrome) {
  Say "browser"
  Invoke-HiddenNode @((Join-Path $PSScriptRoot "ensure-browser.js"))
}

if (-not (Test-Path ".next\BUILD_ID")) {
  Say "build"
  Invoke-HiddenNode @($npmCli, "run", "build")
}
