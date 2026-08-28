$ErrorActionPreference = 'Stop'
$Profile = 'fight-ai'
$Region = 'us-east-2'
$AccountId = (aws sts get-caller-identity --profile $Profile --query Account --output text).Trim()
if (-not $AccountId) { throw 'AWS profile fight-ai is not authenticated.' }

$DeployRole = 'FightAIGitHubDeployRole'
$ExecutionRole = 'FightAIEcsTaskExecutionRole'

$taskTrustPath = Join-Path $env:TEMP 'fight-ai-ecs-task-trust.json'
@'
{
  "Version":"2012-10-17",
  "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
}
'@ | Set-Content -Encoding ascii $taskTrustPath

aws iam get-role --role-name $ExecutionRole --profile $Profile *> $null
if ($LASTEXITCODE -ne 0) {
  aws iam create-role --role-name $ExecutionRole --assume-role-policy-document "file://$taskTrustPath" --profile $Profile | Out-Null
} else {
  aws iam update-assume-role-policy --role-name $ExecutionRole --policy-document "file://$taskTrustPath" --profile $Profile | Out-Null
}
aws iam attach-role-policy --role-name $ExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --profile $Profile | Out-Null

$policyPath = Join-Path $env:TEMP 'fight-ai-ecs-deploy-policy.json'
@'
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:GetDownloadUrlForLayer","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage"],"Resource":"arn:aws:ecr:us-east-2:__ACCOUNT__:repository/fight-ai-web"},
    {"Effect":"Allow","Action":["ecs:CreateCluster","ecs:DescribeClusters","ecs:RegisterTaskDefinition","ecs:DescribeTaskDefinition","ecs:CreateService","ecs:UpdateService","ecs:DescribeServices","ecs:ListServices","ecs:ListTasks","ecs:DescribeTasks"],"Resource":"*"},
    {"Effect":"Allow","Action":["ec2:DescribeVpcs","ec2:DescribeSubnets","ec2:DescribeSecurityGroups","ec2:CreateSecurityGroup","ec2:AuthorizeSecurityGroupIngress","ec2:CreateTags"],"Resource":"*"},
    {"Effect":"Allow","Action":["elasticloadbalancing:CreateLoadBalancer","elasticloadbalancing:CreateTargetGroup","elasticloadbalancing:CreateListener","elasticloadbalancing:DescribeLoadBalancers","elasticloadbalancing:DescribeTargetGroups","elasticloadbalancing:DescribeListeners","elasticloadbalancing:DescribeTargetHealth","elasticloadbalancing:ModifyTargetGroupAttributes"],"Resource":"*"},
    {"Effect":"Allow","Action":"iam:PassRole","Resource":"arn:aws:iam::__ACCOUNT__:role/FightAIEcsTaskExecutionRole"},
    {"Effect":"Allow","Action":"iam:CreateServiceLinkedRole","Resource":"*","Condition":{"StringLike":{"iam:AWSServiceName":["ecs.amazonaws.com","elasticloadbalancing.amazonaws.com"]}}}
  ]
}
'@.Replace('__ACCOUNT__', $AccountId) | Set-Content -Encoding ascii $policyPath

aws iam put-role-policy --role-name $DeployRole --policy-name FightAIWebDeploy --policy-document "file://$policyPath" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Failed to update FightAI web deploy permissions for ECS Fargate.' }

Write-Host ''
Write-Host 'Fight AI ECS Fargate bootstrap VERIFIED.' -ForegroundColor Green
Write-Host "Region: $Region"
Write-Host "Execution role: arn:aws:iam::${AccountId}:role/${ExecutionRole}"
Write-Host 'GitHub deploy role now has scoped ECS/ALB/network permissions for Fight AI web.'