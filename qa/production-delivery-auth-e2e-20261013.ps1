# Synthetic Auth/PostgREST proof for the preserved, unlinked local stack only.
$ErrorActionPreference = 'Stop'
$stack = Join-Path $env:LOCALAPPDATA 'RRJ-Private-Backups\rehearsal-20261013\isolated-stack'
$status = ((npx.cmd --yes supabase@2.120.0 status --workdir $stack -o json 2>$null) -join "`n") | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:56321' -or
    (docker inspect -f '{{.State.Running}}' supabase_db_isolated-stack) -ne 'true') {
  throw 'The isolated local stack is required.'
}

$admin = [Net.Http.HttpClient]::new()
$admin.DefaultRequestHeaders.Add('apikey', $status.SERVICE_ROLE_KEY)
$admin.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $status.SERVICE_ROLE_KEY)
$password = 'Aa1!' + [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
function New-LocalUser([string]$role) {
  $email = 'delivery-policy-' + $role + '-' + [guid]::NewGuid().ToString('N') + '@example.invalid'
  $body = @{email=$email;password=$password;email_confirm=$true;user_metadata=@{first_name='Policy';last_name='QA'}} | ConvertTo-Json -Depth 5
  $response = $admin.PostAsync($status.API_URL + '/auth/v1/admin/users',
    [Net.Http.StringContent]::new($body,[Text.Encoding]::UTF8,'application/json')).GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) { throw "Local synthetic Auth creation failed for $role." }
  $id = [guid](($response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json).id)
  $updated = docker exec -u postgres supabase_db_isolated-stack psql -U supabase_admin -d postgres -Atqc `
    "update public.profiles set role='$role', is_active=true where id='$id' returning id"
  if ($updated -ne $id.ToString()) { throw "Local $role profile setup failed." }
  $client = [Net.Http.HttpClient]::new()
  $client.DefaultRequestHeaders.Add('apikey', $status.PUBLISHABLE_KEY)
  $login = $client.PostAsync($status.API_URL + '/auth/v1/token?grant_type=password',
    [Net.Http.StringContent]::new((@{email=$email;password=$password}|ConvertTo-Json),[Text.Encoding]::UTF8,'application/json')).GetAwaiter().GetResult()
  if (-not $login.IsSuccessStatusCode) { throw "Local $role sign-in failed." }
  $token = ($login.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json).access_token
  $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
  return $client
}
function Call-LocalRpc($client,[string]$name,$rpcArgs) {
  $body = ConvertTo-Json -InputObject $rpcArgs -Depth 10 -Compress
  $response = $client.PostAsync($status.API_URL + '/rest/v1/rpc/' + $name,
    [Net.Http.StringContent]::new($body,[Text.Encoding]::UTF8,'application/json')).GetAwaiter().GetResult()
  return @{ code=[int]$response.StatusCode; body=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
}
$manager = New-LocalUser 'manager'
$cashier = New-LocalUser 'cashier'
$admin.Dispose()
$reportId = [guid]::NewGuid()
$receivedAt = [DateTimeOffset]::UtcNow.ToString('o')
$emergencyArgs = @{p_report_id=$reportId;p_received_at=$receivedAt;p_source_reference='LOCAL-SYNTHETIC-POLICY';
  p_notes=$null;p_reason='Synthetic local emergency exception';p_inspected_by_name='Synthetic QA Inspector'}
$cashierResult = Call-LocalRpc $cashier 'create_emergency_production_receiving' $emergencyArgs
if ($cashierResult.code -ne 403) {
  $errorBody = $cashierResult.body | ConvertFrom-Json
  throw "Cashier emergency denial failed: HTTP $($cashierResult.code), code $($errorBody.code), message $($errorBody.message)."
}
$legacyResult = Call-LocalRpc $manager 'create_replenishment_request' @{
  p_request_id=[guid]::NewGuid();p_inventory_item_id=[guid]::NewGuid();p_quantity=1;
  p_needed_at=$null;p_priority='normal';p_note=$null}
if ($legacyResult.code -lt 400) { throw 'Authenticated legacy request creation was allowed.' }
$normalResult = Call-LocalRpc $manager 'create_receiving_report_draft' @{
  p_request_id=[guid]::NewGuid();p_source_type='production_team';p_source_reference=$null;
  p_purchase_order_id=$null;p_received_at=$receivedAt;p_supplier_delivery_reference=$null;p_notes=$null}
if ($normalResult.code -ne 403) { throw "Unlinked normal Receiving denial failed: HTTP $($normalResult.code)." }
$approved = Call-LocalRpc $manager 'create_emergency_production_receiving' $emergencyArgs
if ($approved.code -ne 200) { throw "Manager emergency authorization failed: HTTP $($approved.code)." }
$evidence = Call-LocalRpc $manager 'get_receiving_policy_evidence' @{p_report_id=$reportId}
if ($evidence.code -ne 200) { throw 'Manager could not read emergency evidence.' }
$row = $evidence.body | ConvertFrom-Json
if ($row.classification -ne 'manager_emergency' -or $row.reason -ne $emergencyArgs.p_reason -or
    $row.inspected_by_name -ne $emergencyArgs.p_inspected_by_name -or -not $row.authorized_by -or
    -not $row.authorized_at) { throw 'Emergency evidence mismatch.' }
$cashierRead = Call-LocalRpc $cashier 'get_receiving_policy_evidence' @{p_report_id=$reportId}
if ($cashierRead.code -ne 403) { throw "Cashier evidence denial failed: HTTP $($cashierRead.code)." }
$manager.Dispose(); $cashier.Dispose()
Write-Output 'PASS local signed-in Cashier denial, authenticated legacy creation denial, normal unlinked denial, Manager emergency authorization/evidence, Cashier evidence denial.'
