<#
Add Vercel environment variables (interactive helper)

This script prompts for common environment variables and calls `vercel env add` to add them
for a chosen environment (production/preview/development).

Usage (PowerShell):
  cd d:\Current Project\monprojet\Pjd
  .\scripts\add-vercel-env.ps1

Requirements: `vercel` CLI installed and `vercel login` performed.
#>

function Prompt-Secure([string]$prompt) {
  try {
    $secure = Read-Host -AsSecureString -Prompt $prompt
    if ($null -eq $secure) { return $null }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  } catch {
    return Read-Host -Prompt $prompt
  }
}

# Check vercel CLI
try {
  $v = & vercel --version 2>&1
} catch {
  Write-Error "Vercel CLI not found. Install with: npm i -g vercel"
  exit 1
}

Write-Host "Vercel CLI detected: $v" -ForegroundColor Cyan

$envChoice = Read-Host -Prompt "Target environment? (production / preview / development) [production]"
if ([string]::IsNullOrWhiteSpace($envChoice)) { $envChoice = 'production' }

# List of variables to prompt for
$keys = @(
  @{ name='MONGODB_URI'; prompt='MongoDB connection string (MONGODB_URI)'; secure=$false },
  @{ name='JWT_SECRET'; prompt='JWT secret (JWT_SECRET)'; secure=$true },
  @{ name='SMTP_HOST'; prompt='SMTP host (optional)'; secure=$false },
  @{ name='SMTP_PORT'; prompt='SMTP port (optional)'; secure=$false },
  @{ name='SMTP_USER'; prompt='SMTP user (optional)'; secure=$false },
  @{ name='SMTP_PASS'; prompt='SMTP pass (optional)'; secure=$true },
  @{ name='EMAIL_FROM'; prompt='Email from address (optional)'; secure=$false }
)

foreach ($k in $keys) {
  $name = $k.name
  $prompt = $k.prompt
  if ($k.secure) {
    $val = Prompt-Secure $prompt
  } else {
    $val = Read-Host -Prompt $prompt
  }
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host "Skipping $name (empty)" -ForegroundColor Yellow
    continue
  }
  Write-Host "Adding $name to Vercel ($envChoice)..." -ForegroundColor Green
  try {
    # Pipe the value into the interactive `vercel env add` command
    $piped = @($val)
    $piped | vercel env add $name $envChoice
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "vercel env add returned code $LASTEXITCODE for $name"
    } else {
      Write-Host "$name added." -ForegroundColor Green
    }
  } catch {
    Write-Warning "Failed to add $name: $_"
  }
}

Write-Host "Done. Verify variables in Vercel dashboard or run 'vercel env ls'." -ForegroundColor Cyan
