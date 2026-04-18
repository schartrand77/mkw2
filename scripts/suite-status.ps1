param(
  [ValidateSet("local", "production")]
  [string]$Target = "local",
  [string]$SshHost = "",
  [string]$ProductionComposePath = "",
  [string]$MakerWorksUrl = "http://localhost:3000/api/health",
  [string]$StockWorksUrl = "http://localhost:8000/",
  [string]$PrintLabUrl = "http://localhost:8289/health",
  [string]$OrderWorksUrl = "http://localhost:3001/",
  [switch]$SkipHttp
)

$ErrorActionPreference = "Continue"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title =="
}

function ConvertTo-ShellSingleQuoted {
  param([string]$Value)
  return "'" + ($Value -replace "'", "'\''") + "'"
}

function Invoke-StatusCommand {
  param([string]$Command)

  if ($Target -eq "production") {
    if ([string]::IsNullOrWhiteSpace($SshHost)) {
      throw "SshHost is required when Target is production."
    }
    $quotedCommand = ConvertTo-ShellSingleQuoted $Command
    ssh $SshHost "sh -lc $quotedCommand"
    return
  }

  Invoke-Expression $Command
}

function Test-HttpEndpoint {
  param(
    [string]$Name,
    [string]$Url
  )

  if ($Target -eq "production") {
    $quotedUrl = ConvertTo-ShellSingleQuoted $Url
    $command = "code=`$(curl -k -s -o /dev/null -w '%{http_code}' --max-time 10 $quotedUrl || true); echo '$Name' `$code $quotedUrl"
    Invoke-StatusCommand $command
    return
  }

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
    Write-Host "$Name $($response.StatusCode) $Url"
  } catch {
    $response = $_.Exception.Response
    if ($response -and $response.StatusCode) {
      $statusCode = [int]$response.StatusCode
      Write-Host "$Name $statusCode $Url"
    } else {
      Write-Host "$Name ERROR $Url $($_.Exception.Message)"
    }
  }
}

Write-Section "Docker Containers"
if ($Target -eq "production") {
  Invoke-StatusCommand 'docker ps'
} else {
  Invoke-StatusCommand 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"'
}

if ($Target -eq "production" -and -not [string]::IsNullOrWhiteSpace($ProductionComposePath)) {
  Write-Section "Production Compose"
  $quotedPath = ConvertTo-ShellSingleQuoted $ProductionComposePath
  Invoke-StatusCommand "cd $quotedPath && if command -v docker-compose >/dev/null 2>&1; then docker-compose ps; elif docker compose version >/dev/null 2>&1; then docker compose ps; else echo 'Docker Compose is not available on this host or PATH.'; fi"
}

if (-not $SkipHttp) {
  Write-Section "HTTP Checks"
  Test-HttpEndpoint "MakerWorks" $MakerWorksUrl
  Test-HttpEndpoint "StockWorks" $StockWorksUrl
  Test-HttpEndpoint "PrintLab" $PrintLabUrl
  Test-HttpEndpoint "OrderWorks" $OrderWorksUrl
}

Write-Section "Next Steps"
Write-Host "For production, use -Target production -SshHost <ssh-alias> -ProductionComposePath <path>."
Write-Host "Mutating production actions still require explicit human approval."
