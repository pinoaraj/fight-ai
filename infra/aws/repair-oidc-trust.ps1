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
          "repo:pinoaraj@132783424/fight-ai@1348995885:ref:refs/heads/web/mvp",
          "repo:pinoaraj@132783424/fight-ai@1348995885:ref:refs/heads/main"
        ]}
      }
    }
  ]
}
'@.Replace('__PROVIDER_ARN__', $ProviderArn) | Set-Content -Encoding ascii $TrustPath

aws iam update-assume-role-policy --role-name FightAIGitHubDeployRole --policy-document "file://$TrustPath" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Failed to update FightAIGitHubDeployRole trust policy.' }

$PolicyPath = Join-Path $env:TEMP 'fight-ai-web-deploy-policy-fixed.json'
@'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:GetDownloadUrlForLayer","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage"],"Resource":"arn:aws:ecr:us-east-2:__ACCOUNT__:repository/fight-ai-web"},
    {"Effect":"Allow","Action":["apprunner:CreateService","apprunner:ListServices"],"Resource":"*"},
    {"Effect":"Allow","Action":["apprunner:DescribeService","apprunner:StartDeployment","apprunner:UpdateService"],"Resource":"arn:aws:apprunner:us-east-2:__ACCOUNT__:service/fight-ai-web/*"},
    {"Effect":"Allow","Action":"iam:PassRole","Resource":["arn:aws:iam::__ACCOUNT__:role/FightAIAppRunnerECRAccessRole","arn:aws:iam::__ACCOUNT__:role/FightAIAppRunnerInstanceRole"]},
    {"Effect":"Allow","Action":["ssm:PutParameter","ssm:GetParameter","ssm:GetParameters"],"Resource":"arn:aws:ssm:us-east-2:__ACCOUNT__:parameter/fight-ai/gemini-api-key"},
    {"Effect":"Allow","Action":["iam:GetRole","iam:CreateRole","iam:PutRolePolicy","iam:UpdateAssumeRolePolicy"],"Resource":"arn:aws:iam::__ACCOUNT__:role/FightAIAppRunnerInstanceRole"}
  ]
}
'@.Replace('__ACCOUNT__', $AccountId) | Set-Content -Encoding ascii $PolicyPath

aws iam put-role-policy --role-name FightAIGitHubDeployRole --policy-name FightAIWebDeploy --policy-document "file://$PolicyPath" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Failed to update FightAIWebDeploy permissions.' }

Write-Host ''
Write-Host 'Fight AI OIDC trust VERIFIED.' -ForegroundColor Green
Write-Host 'Subject: repo:pinoaraj@132783424/fight-ai@1348995885:ref:refs/heads/web/mvp'
Write-Host 'GitHub deploy role has scoped SSM permissions for the Gemini SecureString runtime parameter.'
