# This script assumes you already have run the following:
#
#    az login
#    az account set --subscription id
#
param(
    [Parameter(Mandatory=$true)]
    [string]$resource_group,
    [Parameter(Mandatory=$true)]
    [string]$webapp_service_plan,
    [Parameter(Mandatory=$true)]
    [string]$app_service_name,
    [Parameter(Mandatory=$true)]
    [string]$plan_location,
    [Parameter(Mandatory=$true)]
    [string]$web_app_sku
)

# the firebase settings
$apikey = ""
$authdomain = ""
$databaseurl = ""
$projectid = ""
$storagebucket = ""
$messagesenderid = ""
$appid = ""

Set-Location $PSScriptRoot
$location = Get-Location

function Invoke-Tool($prompt, $command)
{
    if ($debug_print) {
        Write-Host $prompt
        Write-Host "CMD:$command"
    }
    $output = Invoke-Expression $command
    $ec = $LastExitCode
    if ($ec -ne 0)
    {
        Write-Host "### Error $ec running command $command" -ForegroundColor Red
        write-Host $output
        Exit $ec
    }
    return $output
}

function Set-JToken($jobject, $name, $value)
{
    # adds property to Newtonsoft.Json.Linq.JObject
    $v = $jobject.GetValue($name)
    if ($null -eq $v){
        $jobject.Add($name, [Newtonsoft.Json.Linq.JValue]::CreateString($value))
    } else {
        $v.Value = $value
    }
}

function RegisterAppIdHelp() {
    Write-Host "Please create Firebase database and set the user-secrets using: "
    Write-Host "  "
    Write-Host "  dotnet user-secrets init"
    Write-Host "  dotnet user-secrets set FirebaseApiKey `"...`""
    Write-Host "  dotnet user-secrets set AuthDomain `"...`""
    Write-Host "  dotnet user-secrets set DatabaseURL `"...`""
    Write-Host "  dotnet user-secrets set ProjectId `"...`""
    Write-Host "  dotnet user-secrets set StorageBucket `"...`""
    Write-Host "  dotnet user-secrets set MessagingSenderId `"...`""
    Write-Host "  dotnet user-secrets set AppId `"...`""
    Exit-PSSession
}

# check we have an firebase settings.
$output = &dotnet user-secrets list  2>&1
if ($output.ToString().Contains("Could not find the global property") -or
    $output.ToString().Contains("No secrets configured for this application")) {
    FirebaseSetupHelp
}

foreach ($line in $output){
    Write-Host "using local user-secret: $line"
    $parts = $line.Split('=')
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($name -eq "FirebaseApiKey"){
        $apikey = $value
    }
    if ($name -eq "AuthDomain"){
        $authdomain = $value
    }
    if ($name -eq "DatabaseURL"){
        $databaseurl = $value
    }
    if ($name -eq "ProjectId"){
        $projectid = $value
    }
    if ($name -eq "StorageBucket"){
        $storagebucket = $value
    }
    if ($name -eq "MessagingSenderId"){
        $messagesenderid = $value
    }
    if ($name -eq "AppId"){
        $appid = $value
    }
}

function EnsureSetting($name, $value) {
    if ($value -eq ""){
        Write-Host "### Error missing setting $name "
        FirebaseSetupHelp
    }
}

EnsureSetting -name "FirebaseApiKey" -value $apikey
EnsureSetting -name "AuthDomain" -value $authdomain
EnsureSetting -name "DatabaseURL" -value $databaseurl
EnsureSetting -name "ProjectId" -value $projectid
EnsureSetting -name "StorageBucket" -value $storagebucket
EnsureSetting -name "MessagingSenderId" -value $messagesenderid
EnsureSetting -name "AppId" -value $appid

$settings = "{ 'FirebaseApiKey': '$apikey', 'AuthDomain':'$authdomain', 'DatabaseURL':'$databaseurl', 'ProjectId':'$projectid', 'StorageBucket':'$storagebucket', 'MessagingSenderId': '$messagesenderid', 'AppId': '$appid' }"
Set-Content -Path "settings.json" -Value $settings

Write-Host "Checking resource group: $resource_group ..."
$output = &az group show --name $resource_group 2>&1
$ec = $LastExitCode
if ($ec -eq 3) {

    $output = Invoke-Tool -prompt "Creating resource group $resource_group" -command "az group create --name $resource_group --location $plan_location"
}
elseif ($ec -ne 0)
{
    Write-Host "### Error $ec looking for resource group $resource_group" -ForegroundColor Red
    write-Host $output
    Exit-PSSession
}

# service plan for web app (hosted on Windows using "S1" sku)
$output = Invoke-Tool -prompt "Checking web app service plan $webapp_service_plan ..." -command "az appservice plan show --name $webapp_service_plan --resource-group $resource_group"
if ($null -eq $output)
{
    $output = Invoke-Tool -prompt "Creating web app service plan $webapp_service_plan (windows, sku $web_app_sku)..." -command "az appservice plan create --name $webapp_service_plan --resource-group $resource_group --sku $web_app_sku --location $plan_location"
}

# create the web app
Write-Host "Checking web app: $app_service_name ..."
$output = &az webapp show --name $app_service_name --resource-group $resource_group 2>&1
$ec = $LastExitCode
if ($output.ToString().Contains("ResourceNotFound") -or
    $output.ToString().Contains("app doesn't exist"))
{
    $output = Invoke-Tool -prompt "Creating app service $app_service_name ..." -command "az webapp create --resource-group $resource_group --plan $webapp_service_plan --name $app_service_name" | ConvertFrom-Json
}
elseif ($ec -ne 0)
{
    Write-Host "### Error $ec looking for appservice $app_service_name in resource group $resource_group" -ForegroundColor Red
    write-Host $output
    Exit-PSSession
}
else {
    $output = $output | ConvertFrom-Json
}

$hostname = $output.defaultHostName
Write-host "Your app service will be available at https://$hostname"

# the '@' sign is special in powershell, so the only way to pass it to az webapp config is to write this
# string to a command script and execute that!
Set-Content -Path "settings.cmd" -Value "az webapp config appsettings set --name $app_service_name --resource-group $resource_group --settings @settings.json"
$output = &settings.cmd

Write-Host ""
Write-Host "====================================================================================================="
Write-Host "Azure resource group '$resource_group' setup complete."
Write-Host "Please use VS to publish your project to resource group $resource_group app service $app_service_name"
