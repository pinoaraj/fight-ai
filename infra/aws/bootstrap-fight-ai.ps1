$ErrorActionPreference = 'Stop'

$Profile = 'fight-ai'
$Region = 'us-east-2'
$Repo = 'pinoaraj/fight-ai'
$DeployRole = 'FightAIGitHubDeployRole'
$AppRunnerAccessRole = 'FightAIAppRunnerECRAccessRole'
$EcrRepo = 'fight-ai-web'

function Quote-Arg([string]$arg) {
  if ($arg -notmatch '[\s"]') { return $arg }
  return '"' + ($arg -replace '(\\*)"','$1$1\"' -replace '(\\+)$','$1$1') + '"'
}

function Invoke-Aws {
  param(
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [switch]$AllowFailure
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'aws.exe'
  $psi.Arguments = (($Arguments | ForEach-Object { Quote-Arg $_ }) -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  $code = $process.ExitCode

  if ($code -ne 0 -and -not $AllowFailure) {
    throw "AWS CLI failed ($code): aws $($Arguments -join ' ')`n$stderr"
  }

  return [pscustomobject]@{
    ExitCode = $code
    Output = $stdout.Trim()
    Error = $stderr.Trim()
  }
}

$identity = Invoke-Aws -Arguments @('sts','get-caller-identity','--profile',$Profile,'--output','json')
$identityJson = $identity.Output | ConvertFrom-Json
$AccountId = $identityJson.Account
if (-not $AccountId) { throw 'AWS login/profile fight-ai is not available.' }

$ProviderArn = "arn:aws:iam::${AccountId}:oidc-provider/token.actions.githubusercontent.com"
$providerCheck = Invoke-Aws -Arguments @('iam','get-open-id-connect-provider','--open-id-connect-provider-arn',$ProviderArn,'--profile',$Profile) -AllowFailure
if ($providerCheck.ExitCode -ne 0) {
  Write-Host 'Creating GitHub OIDC provider...'
  Invoke-Aws -Arguments @('iam','create-open-id-connect-provider','--url','https://token.actions.githubusercontent.com','--client-id-list','sts.amazonaws.com','--profile',$Profile) | Out-Null
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

$roleCheck = Invoke-Aws -Arguments @('iam','get-role','--role-name',$DeployRole,'--profile',$Profile) -AllowFailure
if ($roleCheck.ExitCode -ne 0) {
  Write-Host "Creating IAM role $DeployRole..."
  Invoke-Aws -Arguments @('iam','create-role','--role-name',$DeployRole,'--assume-role-policy-document',"file://$trustPath",'--profile',$Profile) | Out-Null
} else {
  Invoke-Aws -Arguments @('iam','update-assume-role-policy','--role-name',$DeployRole,'--policy-document',"file://$trustPath",'--profile',$Profile) | Out-Null
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
Invoke-Aws -Arguments @('iam','put-role-policy','--role-name',$DeployRole,'--policy-name','FightAIWebDeploy','--policy-document',"file://$policyPath",'--profile',$Profile) | Out-Null

$runnerTrust = @"
{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]
}
"@
$runnerTrustPath = Join-Path $env:TEMP 'fight-ai-apprunner-trust.json'
$runnerTrust | Set-Content -Encoding ascii $runnerTrustPath
$runnerRoleCheck = Invoke-Aws -Arguments @('iam','get-role','--role-name',$AppRunnerAccessRole,'--profile',$Profile) -AllowFailure
if ($runnerRoleCheck.ExitCode -ne 0) {
  Write-Host "Creating IAM role $AppRunnerAccessRole..."
  Invoke-Aws -Arguments @('iam','create-role','--role-name',$AppRunnerAccessRole,'--assume-role-policy-document',"file://$runnerTrustPath",'--profile',$Profile) | Out-Null
} else {
  Invoke-Aws -Arguments @('iam','update-assume-role-policy','--role-name',$AppRunnerAccessRole,'--policy-document',"file://$runnerTrustPath",'--profile',$Profile) | Out-Null
}
Invoke-Aws -Arguments @('iam','attach-role-policy','--role-name',$AppRunnerAccessRole,'--policy-arn','arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess','--profile',$Profile) | Out-Null

$repoCheck = Invoke-Aws -Arguments @('ecr','describe-repositories','--repository-names',$EcrRepo,'--region',$Region,'--profile',$Profile) -AllowFailure
if ($repoCheck.ExitCode -ne 0) {
  Write-Host "Creating ECR repository $EcrRepo..."
  Invoke-Aws -Arguments @('ecr','create-repository','--repository-name',$EcrRepo,'--image-scanning-configuration','scanOnPush=true','--region',$Region,'--profile',$Profile) | Out-Null
}

Invoke-Aws -Arguments @('iam','get-role','--role-name',$DeployRole,'--profile',$Profile) | Out-Null
Invoke-Aws -Arguments @('iam','get-role','--role-name',$AppRunnerAccessRole,'--profile',$Profile) | Out-Null
Invoke-Aws -Arguments @('ecr','describe-repositories','--repository-names',$EcrRepo,'--region',$Region,'--profile',$Profile) | Out-Null

Write-Host ''
Write-Host 'Fight AI AWS bootstrap VERIFIED.' -ForegroundColor Green
Write-Host "Account: $AccountId"
Write-Host "Region: $Region"
Write-Host "GitHub OIDC role: arn:aws:iam::${AccountId}:role/${DeployRole}"
Write-Host "ECR repository: $EcrRepo"
Write-Host "App Runner ECR role: $accessRoleArn"
Write-Host 'No AWS access keys or root credentials are stored in GitHub.'
