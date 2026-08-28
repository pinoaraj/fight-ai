$ErrorActionPreference = 'Stop'

$Profile = 'fight-ai'
$Region = 'us-east-2'
$Repo = 'pinoaraj/fight-ai'
$DeployRole = 'FightAIGitHubDeployRole'
$AppRunnerAccessRole = 'FightAIAppRunnerECRAccessRole'
$EcrRepo = 'fight-ai-web'

$AccountId = aws sts get-caller-identity --profile $Profile --query Account --output text
if (-not $AccountId) { throw 'AWS login/profile fight-ai is not available.' }

$ProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$providers = aws iam list-open-id-connect-providers --profile $Profile --query 'OpenIDConnectProviderList[].Arn' --output text
if ($providers -notmatch [regex]::Escape($ProviderArn)) {
  aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com --profile $Profile | Out-Null
}

$trust = @"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "$ProviderArn"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
      "StringLike": {"token.actions.githubusercontent.com:sub": [
        "repo:$Repo:ref:refs/heads/web/mvp",
        "repo:$Repo:ref:refs/heads/main"
      ]}
    }
  }]
}
"@
$trustPath = Join-Path $env:TEMP 'fight-ai-github-trust.json'
$trust | Set-Content -Encoding ascii $trustPath

$roleExists = $true
try { aws iam get-role --role-name $DeployRole --profile $Profile | Out-Null } catch { $roleExists = $false }
if (-not $roleExists) {
  aws iam create-role --role-name $DeployRole --assume-role-policy-document "file://$trustPath" --profile $Profile | Out-Null
} else {
  aws iam update-assume-role-policy --role-name $DeployRole --policy-document "file://$trustPath" --profile $Profile | Out-Null
}

$ecrArn = "arn:aws:ecr:${Region}:${AccountId}:repository/${EcrRepo}"
$accessRoleArn = "arn:aws:iam::${AccountId}:role/${AppRunnerAccessRole}"
$deployPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:GetDownloadUrlForLayer","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage"],"Resource":"$ecrArn"},
    {"Effect":"Allow","Action":["apprunner:CreateService","apprunner:ListServices"],"Resource":"*"},
    {"Effect":"Allow","Action":["apprunner:DescribeService","apprunner:StartDeployment","apprunner:UpdateService"],"Resource":"arn:aws:apprunner:${Region}:${AccountId}:service/fight-ai-web/*"},
    {"Effect":"Allow","Action":"iam:PassRole","Resource":"$accessRoleArn"}
  ]
}
"@
$policyPath = Join-Path $env:TEMP 'fight-ai-deploy-policy.json'
$deployPolicy | Set-Content -Encoding ascii $policyPath
aws iam put-role-policy --role-name $DeployRole --policy-name FightAIWebDeploy --policy-document "file://$policyPath" --profile $Profile | Out-Null

$runnerTrust = @"
{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]
}
"@
$runnerTrustPath = Join-Path $env:TEMP 'fight-ai-apprunner-trust.json'
$runnerTrust | Set-Content -Encoding ascii $runnerTrustPath
$runnerRoleExists = $true
try { aws iam get-role --role-name $AppRunnerAccessRole --profile $Profile | Out-Null } catch { $runnerRoleExists = $false }
if (-not $runnerRoleExists) {
  aws iam create-role --role-name $AppRunnerAccessRole --assume-role-policy-document "file://$runnerTrustPath" --profile $Profile | Out-Null
}
aws iam attach-role-policy --role-name $AppRunnerAccessRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess --profile $Profile | Out-Null

$repoExists = $true
try { aws ecr describe-repositories --repository-names $EcrRepo --region $Region --profile $Profile | Out-Null } catch { $repoExists = $false }
if (-not $repoExists) {
  aws ecr create-repository --repository-name $EcrRepo --image-scanning-configuration scanOnPush=true --region $Region --profile $Profile | Out-Null
}

Write-Host ''
Write-Host 'Fight AI AWS bootstrap complete.' -ForegroundColor Green
Write-Host "Account: $AccountId"
Write-Host "Region: $Region"
Write-Host "GitHub OIDC role: arn:aws:iam::${AccountId}:role/${DeployRole}"
Write-Host "ECR repository: $EcrRepo"
Write-Host "App Runner ECR role: $accessRoleArn"
Write-Host 'Root credentials are not stored in GitHub.'
