param(
  [string]$Profile = 'fight-ai',
  [string]$RoleName = 'FightAIGitHubDeployRole'
)

$ErrorActionPreference = 'Stop'

$policy = Join-Path $PSScriptRoot 'fight-ai-cloudfront-oidc-policy.json'
if (-not (Test-Path -LiteralPath $policy)) { throw "No se encontró la política: $policy" }

aws iam put-role-policy `
  --role-name $RoleName `
  --policy-name FightAICloudFrontHttpsFreePlan `
  --policy-document "file://$policy" `
  --profile $Profile

Write-Host "Permisos CloudFront HTTPS aplicados al rol $RoleName." -ForegroundColor Green
