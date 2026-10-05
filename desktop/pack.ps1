$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = Join-Path $env:TEMP "silly-factory-payload.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
$count = 0
try {
  Get-ChildItem $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart("\", "/")
    if ($rel -match '(^|[\\/])(node_modules|\.next|\.git|\.remotion-bundle|\.remotion-check|output|dist)([\\/]|$)') { return }
    if ($rel -match '(^|[\\/])public[\\/]generated([\\/]|$)') { return }
    if ($rel -match '(^|[\\/])\.cache([\\/]|$)') { return }
    if ($rel -match '\.(exe|pid)$' -or $rel -eq ".env" -or $rel -eq ".env.local") { return }
    $entry = $rel.Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry) | Out-Null
    $count++
  }
} finally {
  $zip.Dispose()
}
if ($count -lt 10) { throw "The app payload is incomplete." }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$cache = Join-Path $PSScriptRoot ".cache\webview2"
$pkg = Join-Path $cache "pkg"
$winforms = Get-ChildItem $pkg -Recurse -Filter "Microsoft.Web.WebView2.WinForms.dll" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match "net462" } | Select-Object -First 1
if (-not $winforms) {
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $nupkg = Join-Path $cache "webview2.zip"
  Invoke-WebRequest "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40" -OutFile $nupkg -UseBasicParsing
  if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
  Expand-Archive $nupkg $pkg
  $winforms = Get-ChildItem $pkg -Recurse -Filter "Microsoft.Web.WebView2.WinForms.dll" |
    Where-Object { $_.FullName -match "net462" } | Select-Object -First 1
}
$core = Get-ChildItem $pkg -Recurse -Filter "Microsoft.Web.WebView2.Core.dll" |
  Where-Object { $_.FullName -match "net462" } | Select-Object -First 1
$loader = Get-ChildItem $pkg -Recurse -Filter "WebView2Loader.dll" |
  Where-Object { $_.FullName -match "win-x64" } | Select-Object -First 1
if (-not $winforms -or -not $core -or -not $loader) { throw "WebView2 files were not found." }

$out = Join-Path $dist "silly-factory.exe"
$setup = Join-Path $dist "silly-factory-setup.exe"
$icon = Join-Path $PSScriptRoot "icon\app.ico"
$iconArg = @()
if (Test-Path $icon) { $iconArg = @("/win32icon:$icon") }
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
& $csc /nologo /target:winexe `
  @iconArg `
  /r:System.IO.Compression.dll `
  /r:System.IO.Compression.FileSystem.dll `
  /r:System.Windows.Forms.dll `
  /r:System.Drawing.dll `
  /r:"$($winforms.FullName)" `
  /r:"$($core.FullName)" `
  /resource:"$zipPath",Payload `
  /resource:"$($winforms.FullName)",WV.WinForms `
  /resource:"$($core.FullName)",WV.Core `
  /resource:"$($loader.FullName)",WV.Loader `
  /out:"$out" `
  (Join-Path $PSScriptRoot "launcher.cs")
if ($LASTEXITCODE -ne 0) { throw "Could not build the app." }

& $csc /nologo /target:winexe `
  @iconArg `
  /r:System.Windows.Forms.dll `
  /r:System.Drawing.dll `
  /resource:"$out",AppExe `
  /out:"$setup" `
  (Join-Path $PSScriptRoot "installer.cs")
if ($LASTEXITCODE -ne 0) { throw "Could not build the installer." }

Write-Host ""
Write-Host "Packed $count files."
Write-Host $out
Write-Host $setup
Write-Host ""
