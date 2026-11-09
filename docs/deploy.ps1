<#
.SYNOPSIS
  Pushes each Beyondcy project folder to its own GitHub repository.

.DESCRIPTION
  Lives in the parent folder (Beyondcy-Web). For each project it:
    1. checks the folder is connected to the RIGHT GitHub repo and on 'main'
    2. skips it when there is nothing to commit or push
    3. blocks the push if a secret file or secret key is about to be committed
    4. commits, pushes, and prints the live link
  GitHub then publishes each site automatically.

.EXAMPLE
  .\deploy.ps1                      # every project that has changes
.EXAMPLE
  .\deploy.ps1 track                # only the tracker
.EXAMPLE
  .\deploy.ps1 site dash -Message "Update stay tuned copy"
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [ValidateSet('site', 'dash', 'track')]
  [string[]]$Only,

  [string]$Message
)

# ---- SETTINGS --------------------------------------------------------------
# $false = sites live on github.io links (now)
# $true  = sites live on beyondcy.co, dash.beyondcy.co, track.beyondcy.co
#          (switch this when the domain is connected - see 11_CONNECT_DOMAIN.md)
$UseCustomDomains = $false
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Continue'   # git writes progress to stderr; we check exit codes ourselves
$Root = $PSScriptRoot
$GitHubUser = 'Beyondcy888'

$Projects = @(
  [pscustomobject]@{ Key = 'site';  Folder = 'beyondcy.co';       Repo = 'beyondcy.co';       Domain = 'https://beyondcy.co' }
  [pscustomobject]@{ Key = 'dash';  Folder = 'beyondcy.co-dash';  Repo = 'beyondcy.co-dash';  Domain = 'https://dash.beyondcy.co' }
  [pscustomobject]@{ Key = 'track'; Folder = 'beyondcy.co-track'; Repo = 'beyondcy.co-track'; Domain = 'https://track.beyondcy.co' }
)
foreach ($p in $Projects) {
  $pagesUrl = 'https://{0}.github.io/{1}/' -f $GitHubUser.ToLower(), $p.Repo
  $live = $pagesUrl
  if ($UseCustomDomains) { $live = $p.Domain }
  $p | Add-Member -NotePropertyName Live -NotePropertyValue $live
}
if ($Only) { $Projects = $Projects | Where-Object { $Only -contains $_.Key } }

# Files that must never be committed (.env.example is allowed)
$SecretFilePattern = '(^|/)\.env(\.(?!example$)[^/]+)?$|\.pem$|\.key$|(^|/)id_rsa'
# Supabase secret keys: new format, or a legacy service_role JWT (base64 of "service_role")
$SecretContentPattern = 'sb_secret_[A-Za-z0-9_\-]{10,}|c2VydmljZV9yb2xl'

function Invoke-Git {
  param([string]$Path, [Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $out = & git -C $Path @GitArgs 2>&1
  [pscustomobject]@{
    Code = $LASTEXITCODE
    Out  = (@($out) | ForEach-Object { "$_" }) -join "`n"
  }
}

function Get-RepoSlug([string]$Url) {
  # https://github.com/Owner/repo(.git)  or  git@github.com:Owner/repo(.git)  ->  owner/repo
  $u = $Url.Trim()
  if ($u -match 'github\.com[:/](.+?)(\.git)?/?$') { return $Matches[1].ToLower() }
  return $u.ToLower()
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'Git is not installed or not on PATH.' -ForegroundColor Red
  exit 1
}

$results = @()

foreach ($p in $Projects) {
  $path = Join-Path $Root $p.Folder
  $expected = ("$GitHubUser/$($p.Repo)").ToLower()
  Write-Host ''
  Write-Host ('== {0}  ({1})' -f $p.Folder, $p.Live) -ForegroundColor Cyan

  if (-not (Test-Path (Join-Path $path '.git'))) {
    Write-Host "   Folder not found or not a git repo: $path" -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'missing folder/repo' }
    continue
  }

  # 1. right repo, right branch
  $remote = Invoke-Git $path remote get-url origin
  if ($remote.Code -ne 0 -or (Get-RepoSlug $remote.Out) -ne $expected) {
    Write-Host "   Wrong or missing remote. Expected github.com/$GitHubUser/$($p.Repo), found: $($remote.Out)" -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'wrong remote' }
    continue
  }
  $branch = (Invoke-Git $path rev-parse --abbrev-ref HEAD).Out.Trim()
  if ($branch -ne 'main') {
    Write-Host "   On branch '$branch'. Switch to 'main' first." -ForegroundColor Red
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = "on branch $branch" }
    continue
  }

  # 2. anything to do?
  $dirty = (Invoke-Git $path status --porcelain).Out.Trim()
  $ahead = 0
  $aheadCheck = Invoke-Git $path rev-list --count '@{u}..HEAD'
  if ($aheadCheck.Code -eq 0) { $ahead = [int]$aheadCheck.Out.Trim() } else { $ahead = 1 }  # no upstream yet: push needed
  if (-not $dirty -and $ahead -eq 0) {
    Write-Host '   No changes. Skipped.' -ForegroundColor DarkGray
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'skipped'; Detail = 'no changes' }
    continue
  }

  if ($dirty) {
    # 3. stage and check for secrets
    $null = Invoke-Git $path add -A
    $staged = (Invoke-Git $path diff --cached --name-only).Out -split "`n" | Where-Object { $_ }
    $badFiles = $staged | Where-Object { $_ -match $SecretFilePattern }
    $diffText = (Invoke-Git $path diff --cached -U0).Out
    if ($badFiles -or ($diffText -match $SecretContentPattern)) {
      $null = Invoke-Git $path reset -q
      Write-Host '   BLOCKED: a secret is about to be committed. Nothing was pushed.' -ForegroundColor Red
      if ($badFiles) { $badFiles | ForEach-Object { Write-Host "     file: $_" -ForegroundColor Red } }
      if ($diffText -match $SecretContentPattern) { Write-Host '     a Supabase secret / service_role key appears in the changes' -ForegroundColor Red }
      Write-Host '   Add the file to .gitignore or remove the key, then run again.' -ForegroundColor Yellow
      $results += [pscustomobject]@{ Project = $p.Folder; Result = 'BLOCKED'; Detail = 'secret detected' }
      continue
    }

    if (-not $Message) {
      $Message = Read-Host 'Commit message (Enter = automatic)'
      if ([string]::IsNullOrWhiteSpace($Message)) { $Message = 'Update ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
    }
    $commit = Invoke-Git $path commit -m $Message
    if ($commit.Code -ne 0) {
      Write-Host "   Commit failed:`n$($commit.Out)" -ForegroundColor Red
      $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'commit failed' }
      continue
    }
    Write-Host "   Committed: $Message" -ForegroundColor Gray
  }

  # 4. push
  $push = Invoke-Git $path push -u origin main
  if ($push.Code -ne 0) {
    Write-Host "   Push failed:`n$($push.Out)" -ForegroundColor Red
    Write-Host '   Tip: if GitHub has newer commits, run  git pull --rebase  in this folder, then deploy again.' -ForegroundColor Yellow
    $results += [pscustomobject]@{ Project = $p.Folder; Result = 'FAILED'; Detail = 'push failed' }
    continue
  }
  Write-Host "   Pushed. Live in ~1-2 min: $($p.Live)" -ForegroundColor Green
  $results += [pscustomobject]@{ Project = $p.Folder; Result = 'pushed'; Detail = $p.Live }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
foreach ($r in $results) {
  $color = switch ($r.Result) { 'pushed' { 'Green' } 'skipped' { 'DarkGray' } default { 'Red' } }
  Write-Host ('  {0,-20} {1,-8} {2}' -f $r.Project, $r.Result, $r.Detail) -ForegroundColor $color
}
if ($results | Where-Object { $_.Result -in @('FAILED', 'BLOCKED') }) { exit 1 } else { exit 0 }
