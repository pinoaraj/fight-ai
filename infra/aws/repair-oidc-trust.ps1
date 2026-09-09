$ErrorActionPreference = 'Stop'
$Profile = 'fight-ai'
$AccountId = (aws sts get-caller-identity --profile $Profile --query Account --output text).Trim()
if (-not $AccountId) { throw 'AWS profile fight-ai is not authenticated.' }

$ProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$TrustPath = Join-Path $env:TEMP 'fight-ai-oidc-trust-fixed.json'
$WebSubject = 'repo:pinoaraj@*/fight-ai@*:ref:refs/heads/web/mvp'
$MainSubject = 'repo:pinoaraj@*/fight-ai@*:ref:refs/heads/main'
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
          "__WEB_SUBJECT__",
          "__MAIN_SUBJECT__"
        ]}
      }
    }
  ]
}
'@.Replace('__PROVIDER_ARN__', $ProviderArn).Replace('__WEB_SUBJECT__', $WebSubject).Replace('__MAIN_SUBJECT__', $MainSubject) | Set-Content -Encoding ascii $TrustPath

aws iam update-assume-role-policy --role-name FightAIGitHubDeployRole --policy-document "file://$TrustPath" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Failed to update FightAIGitHubDeployRole trust policy.' }

$RoleJson = aws iam get-role --role-name FightAIGitHubDeployRole --profile $Profile --output json
if ($LASTEXITCODE -ne 0 -or -not $RoleJson) { throw 'Failed to read FightAIGitHubDeployRole after trust repair.' }
$Role = $RoleJson | ConvertFrom-Json
$Subjects = @($Role.Role.AssumeRolePolicyDocument.Statement | ForEach-Object { $_.Condition.StringLike.'token.actions.githubusercontent.com:sub' })
if ($Subjects -notcontains $WebSubject) { throw 'Trust repair verification failed: expected web/mvp subject pattern is absent from the effective role trust policy.' }

Write-Host ''
Write-Host 'Fight AI OIDC trust VERIFIED.' -ForegroundColor Green
Write-Host "Allowed branch subject pattern: $WebSubject"
Write-Host "Allowed branch subject pattern: $MainSubject"
Write-Host 'Effective IAM trust policy contains the observed GitHub custom-subject pattern.'
Write-Host 'Existing ECS/ALB/ECR deployment permissions were not modified.'
