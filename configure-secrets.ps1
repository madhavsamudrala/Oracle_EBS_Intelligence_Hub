<#
  configure-secrets.ps1
  One-time local setup: writes backend\.env from hidden prompts.
  Nothing is printed, logged or committed. backend\.env is git-ignored (*.env).
  Press Enter at any prompt to keep the value already in backend\.env.
#>
param([string]$EnvPath = (Join-Path $PSScriptRoot 'backend\.env'))

function Read-Plain([string]$Prompt, [bool]$Secret) {
    if ($Secret) {
        $s = Read-Host $Prompt -AsSecureString
        return [Net.NetworkCredential]::new('', $s).Password.Trim()
    }
    return (Read-Host $Prompt).Trim()
}

function Get-EnvMap([string]$Path) {
    $map = [ordered]@{}
    if (Test-Path $Path) {
        foreach ($line in Get-Content $Path -Encoding UTF8) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { $map[$Matches[1]] = $Matches[2] }
        }
    }
    return $map
}

function Save-EnvMap([string]$Path, $Map) {
    $lines = @('# Oracle EBS Intelligence Hub v6.0 - local secrets. Git-ignored. Do not share.')
    foreach ($k in $Map.Keys) { $lines += "$k=$($Map[$k])" }
    [IO.File]::WriteAllText($Path, ($lines -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))
}

if ($MyInvocation.InvocationName -ne '.') {
    $root = Split-Path $EnvPath -Parent
    Push-Location $root
    git check-ignore -q $EnvPath
    $ignored = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $ignored) { Write-Host 'STOP: backend\.env is not git-ignored. Not writing secrets.' -ForegroundColor Red; exit 1 }

    $cfg = Get-EnvMap $EnvPath
    $defaults = [ordered]@{
        ICA_CONTEXT_ID  = 'ctx_b0ecd6cee49f'
        MCP_GATEWAY_URL = 'https://servicesessentials.ibm.com/mcp-gateway/service/gateway/servers/8ccdd203bdee4014b08e82eedb6046e2/mcp'
        ICA_AGENT_MODE  = 'true'
        ALLOWED_ORIGINS = 'http://localhost:8080,http://127.0.0.1:8080'
        DEBUG           = 'false'
    }
    foreach ($k in $defaults.Keys) { if (-not $cfg.Contains($k) -or -not $cfg[$k]) { $cfg[$k] = $defaults[$k] } }

    Write-Host ''
    Write-Host 'Oracle EBS Intelligence Hub - local secrets setup' -ForegroundColor Cyan
    Write-Host 'Hidden prompts. Enter = keep current value.' -ForegroundColor Gray
    Write-Host ''

    $items = @(
        @{ K = 'ICA_WORKFLOW_URL'; P = 'Langflow workflow run URL (Agent Studio flow -> API -> copy URL)'; S = $false },
        @{ K = 'ICA_API_KEY';      P = 'Langflow API key (used by the backend to call the workflow)';      S = $true  },
        @{ K = 'MCP_BEARER_TOKEN'; P = 'MCP Gateway bearer token (optional in agent mode)';                  S = $true  },
        @{ K = 'MCP_API_KEY';      P = 'Context Studio API key (optional in agent mode)';                    S = $true  }
    )
    foreach ($i in $items) {
        $have = $cfg.Contains($i.K) -and $cfg[$i.K]
        $label = if ($have) { "$($i.P) [set]" } else { "$($i.P) [empty]" }
        $v = Read-Plain $label $i.S
        if ($v) { $cfg[$i.K] = $v }
    }

    Save-EnvMap $EnvPath $cfg
    Write-Host ''
    Write-Host "Saved: $EnvPath" -ForegroundColor Green
    foreach ($k in $cfg.Keys) {
        $isSet = [bool]$cfg[$k]
        $show = if ($k -match 'KEY|TOKEN') { if ($isSet) { 'set (hidden)' } else { 'EMPTY' } } else { if ($isSet) { $cfg[$k] } else { 'EMPTY' } }
        Write-Host ("  {0,-18} {1}" -f $k, $show)
    }
    Write-Host ''
    Write-Host 'Next: run start-all.bat' -ForegroundColor Cyan
}
