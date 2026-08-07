param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [string]$Region = "asia-northeast1",
  [string]$Repository = "spajin",
  [string]$JobName = "spajin-review-summary-kanagawa",
  [string]$ServiceAccount = "spajin-review-job",
  [string]$SpreadsheetId = "1Ms-6KWFxf3CQvf5cNsJxabH7EHlTVxXXk6WlxUyYaUo",
  [int]$MaxRows = 5
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/review-summary:latest"
$serviceAccountEmail = "$ServiceAccount@$ProjectId.iam.gserviceaccount.com"
$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$buildServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com sheets.googleapis.com places.googleapis.com cloudscheduler.googleapis.com aiplatform.googleapis.com

gcloud artifacts repositories describe $Repository --location $Region 2>$null
if ($LASTEXITCODE -ne 0) { gcloud artifacts repositories create $Repository --repository-format docker --location $Region }

gcloud iam service-accounts describe $serviceAccountEmail 2>$null
if ($LASTEXITCODE -ne 0) { gcloud iam service-accounts create $ServiceAccount --display-name "Spajin review summary job" }

gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$serviceAccountEmail" --role "roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$serviceAccountEmail" --role "roles/serviceusage.serviceUsageConsumer"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$serviceAccountEmail" --role "roles/aiplatform.user"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$buildServiceAccount" --role "roles/storage.objectViewer"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$buildServiceAccount" --role "roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$buildServiceAccount" --role "roles/logging.logWriter"
gcloud builds submit --tag $image .

gcloud run jobs deploy $JobName `
  --image $image `
  --region $Region `
  --service-account $serviceAccountEmail `
  --set-env-vars "GCP_PROJECT_ID=$ProjectId,SPREADSHEET_ID=$SpreadsheetId,GEMINI_MODEL=gemini-2.5-flash-lite,VERTEX_LOCATION=global,MAX_ROWS=$MaxRows,DELAY_MS=500" `
  --task-timeout 3600s `
  --max-retries 0 `
  --tasks 1 `
  --parallelism 1

Write-Host "Cloud Run Job deployed: $JobName"
Write-Host "Share the spreadsheet with: $serviceAccountEmail (Editor)"
Write-Host "First run: gcloud run jobs execute $JobName --region $Region --wait"
