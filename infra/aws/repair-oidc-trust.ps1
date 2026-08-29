$ErrorActionPreference = 'Stop'
$Profile = 'fight-ai'
$AccountId = (aws sts get-caller-identity --profile $Profile --query Account --output text).Trim()
if (-not $AccountId) { throw 'AWS profile fight-ai is not authenticated.' }

$ProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$TrustPath = Join-Path $env:TEMP 'fight-ai-oidc-trust-fixed.json'
@'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Federated": "__PROVIDER_ARN__"},
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
        "StringLike": {"token.actions.githubusercontent.com:sub": [
          "repo:pinoaraj/fight-ai:ref:refs/heads/web/mvp",
          "repo:pinoaraj/fight-ai:ref:refs/heads/main"
        ]}
      }
    }
  ]
}
'@.Replace('__PROVIDER_ARN__', $ProviderArn) | Set-Content -Encoding ascii $TrustPath

aws iam update-assume-role-policy --role-name FightAIGitHubDeployRole --policy-document "file://$TrustPath" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Failed to update FightAIGitHubDeployRole trust policy.' }

aws iam get-role --role-name FightAIGitHubDeployRole --profile $Profile | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to verify FightAIGitHubDeployRole after trust repair.' }

Write-Host ''
Write-Host 'Fight AI OIDC trust VERIFIED.' -ForegroundColor Green
Write-Host 'Allowed branch subject: repo:pinoaraj/fight-ai:ref:refs/heads/web/mvp'
Write-Host 'Allowed branch subject: repo:pinoaraj/fight-ai:ref:refs/heads/main'
Write-Host 'Existing ECS/ALB/ECR deployment permissions were not modified.'
