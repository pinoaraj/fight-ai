param(
  [string]$Profile = 'fight-ai',
  [string]$Region = 'sa-east-1',
  [string]$BucketName = 'fight-ai-video-ingest-379549361550-sa-east-1',
  [string]$TableName = 'fight-ai-analysis-jobs',
  [string]$TaskRoleName = 'FightAIEcsTaskRole',
  [string]$DeployRoleName = 'FightAIGitHubDeployRole'
)

$ErrorActionPreference = 'Stop'

function Invoke-Aws([string[]]$Arguments) {
  & aws @Arguments --profile $Profile
  if ($LASTEXITCODE -ne 0) { throw "AWS CLI failed: aws $($Arguments -join ' ')" }
}

$account = (& aws sts get-caller-identity --profile $Profile --query Account --output text)
if (-not $account -or $account -eq 'None') { throw "AWS profile '$Profile' is not authenticated." }

$bucketArn = "arn:aws:s3:::$BucketName"
$tableArn = "arn:aws:dynamodb:${Region}:${account}:table/$TableName"

& aws s3api head-bucket --bucket $BucketName --profile $Profile 2>$null
$existingBucket = $LASTEXITCODE -eq 0
if (-not $existingBucket) { Invoke-Aws @('s3api','create-bucket','--bucket',$BucketName,'--region',$Region,'--create-bucket-configuration',"LocationConstraint=$Region") | Out-Null }
Invoke-Aws @('s3api','put-public-access-block','--bucket',$BucketName,'--public-access-block-configuration','BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true') | Out-Null
Invoke-Aws @('s3api','put-bucket-encryption','--bucket',$BucketName,'--server-side-encryption-configuration','{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}') | Out-Null
Invoke-Aws @('s3api','put-bucket-lifecycle-configuration','--bucket',$BucketName,'--lifecycle-configuration','{"Rules":[{"ID":"expire-private-sparring","Status":"Enabled","Filter":{"Prefix":"uploads/"},"Expiration":{"Days":2},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}') | Out-Null
$cors = @{ CORSRules = @(@{ AllowedOrigins = @('https://d1ga34t3tjgix2.cloudfront.net','http://localhost:3000'); AllowedMethods = @('PUT'); AllowedHeaders = @('*'); ExposeHeaders = @('ETag'); MaxAgeSeconds = 3600 }) } | ConvertTo-Json -Depth 6 -Compress
Invoke-Aws @('s3api','put-bucket-cors','--bucket',$BucketName,'--cors-configuration',$cors) | Out-Null

& aws dynamodb describe-table --table-name $TableName --region $Region --profile $Profile 2>$null
$table = $LASTEXITCODE -eq 0
if (-not $table) { Invoke-Aws @('dynamodb','create-table','--table-name',$TableName,'--attribute-definitions','AttributeName=jobId,AttributeType=S','--key-schema','AttributeName=jobId,KeyType=HASH','--billing-mode','PAY_PER_REQUEST','--region',$Region) | Out-Null }
Invoke-Aws @('dynamodb','update-time-to-live','--table-name',$TableName,'--time-to-live-specification','Enabled=true,AttributeName=expiresAt','--region',$Region) | Out-Null

$trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
& aws iam get-role --role-name $TaskRoleName --profile $Profile *> $null
if ($LASTEXITCODE -ne 0) { Invoke-Aws @('iam','create-role','--role-name',$TaskRoleName,'--assume-role-policy-document',$trust) | Out-Null }

$taskPolicyObject = @{ Version = '2012-10-17'; Statement = @(
  @{ Effect = 'Allow'; Action = @('s3:AbortMultipartUpload','s3:CompleteMultipartUpload','s3:CreateMultipartUpload','s3:GetObject','s3:ListBucket','s3:PutObject','s3:UploadPart'); Resource = @($bucketArn,"$bucketArn/*") },
  @{ Effect = 'Allow'; Action = @('dynamodb:GetItem','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:Scan'); Resource = $tableArn }
) }
$taskPolicy = $taskPolicyObject | ConvertTo-Json -Depth 6 -Compress
Invoke-Aws @('iam','put-role-policy','--role-name',$TaskRoleName,'--policy-name','FightAILargeVideoIngestion','--policy-document',$taskPolicy) | Out-Null

$passRolePolicyObject = @{ Version = '2012-10-17'; Statement = @(@{ Effect = 'Allow'; Action = 'iam:PassRole'; Resource = "arn:aws:iam::${account}:role/$TaskRoleName"; Condition = @{ StringEquals = @{ 'iam:PassedToService' = 'ecs-tasks.amazonaws.com' } } }) }
$passRolePolicy = $passRolePolicyObject | ConvertTo-Json -Depth 6 -Compress
Invoke-Aws @('iam','put-role-policy','--role-name',$DeployRoleName,'--policy-name','FightAIEcsTaskRolePass','--policy-document',$passRolePolicy) | Out-Null

Write-Host "Large-video ingestion ready: s3://$BucketName and DynamoDB $TableName." -ForegroundColor Green
Write-Host "Task role: arn:aws:iam::$account:role/$TaskRoleName" -ForegroundColor Green
