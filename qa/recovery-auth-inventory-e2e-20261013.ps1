# Local-only authenticated recovery check. Creates synthetic data in the
# disposable isolated stack; never point this at a linked or hosted project.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$stack = Join-Path $env:LOCALAPPDATA 'RRJ-Private-Backups\rehearsal-20261013\isolated-stack'
$ErrorActionPreference = 'Continue'
$statusText = npx.cmd --yes supabase@2.120.0 status --workdir $stack -o json 2>$null
$statusExitCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($statusExitCode -ne 0) { throw 'The isolated Supabase stack is unavailable.' }
$status = ($statusText -join "`n") | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:56321') {
  throw 'The API is not the isolated loopback stack.'
}
$dbContainer = 'supabase_db_isolated-stack'
$dbState = docker inspect -f '{{.State.Running}}' $dbContainer
if ($dbState -ne 'true') { throw 'The isolated database is not running.' }

$email = 'recovery-qa-' + [guid]::NewGuid().ToString('N') + '@example.invalid'
$passwordBytes = New-Object byte[] 24
$passwordRng = [Security.Cryptography.RandomNumberGenerator]::Create()
$passwordRng.GetBytes($passwordBytes)
$passwordRng.Dispose()
$password = 'Aa1!' + [Convert]::ToBase64String($passwordBytes)
$admin = [Net.Http.HttpClient]::new()
$admin.DefaultRequestHeaders.Authorization =
  [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $status.SERVICE_ROLE_KEY)
$admin.DefaultRequestHeaders.Add('apikey', $status.SERVICE_ROLE_KEY)
$newUser = @{ email = $email; password = $password; email_confirm = $true;
  user_metadata = @{ first_name = 'Recovery'; last_name = 'QA' } } |
  ConvertTo-Json -Depth 5
$create = $admin.PostAsync(
  $status.API_URL + '/auth/v1/admin/users',
  [Net.Http.StringContent]::new($newUser, [Text.Encoding]::UTF8, 'application/json')
).GetAwaiter().GetResult()
if (-not $create.IsSuccessStatusCode) {
  throw "Local Auth user creation returned $([int]$create.StatusCode)."
}
$userId = [guid](($create.Content.ReadAsStringAsync().GetAwaiter().GetResult() |
  ConvertFrom-Json).id)
$admin.Dispose()
$managerRow = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "update public.profiles set role='manager', is_active=true where id='$userId' returning id"
if ($managerRow -ne $userId.ToString()) { throw 'Manager profile update failed.' }

$client = [Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Add('apikey', $status.PUBLISHABLE_KEY)
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$login = $client.PostAsync(
  $status.API_URL + '/auth/v1/token?grant_type=password',
  [Net.Http.StringContent]::new($loginBody, [Text.Encoding]::UTF8, 'application/json')
).GetAwaiter().GetResult()
if (-not $login.IsSuccessStatusCode) {
  throw "Local sign-in returned $([int]$login.StatusCode)."
}
$token = ($login.Content.ReadAsStringAsync().GetAwaiter().GetResult() |
  ConvertFrom-Json).access_token
$client.DefaultRequestHeaders.Authorization =
  [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

function Invoke-LocalRpc([string]$name, [object]$arguments) {
  if ($name -in @('issue_inventory_request', 'revise_inventory_request')) {
    $arguments.p_expected = $null
  }
  $json = ConvertTo-Json -InputObject $arguments -Depth 30 -Compress
  if ($name -in @('issue_inventory_request', 'revise_inventory_request')) {
    if (-not $script:proposalRaw) { throw 'The proposal was not fetched before issue or revision.' }
    $json = $json.Replace('"p_expected":null', '"p_expected":' + $script:proposalRaw)
  }
  $response = $client.PostAsync(
    $status.API_URL + '/rest/v1/rpc/' + $name,
    [Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
  ).GetAwaiter().GetResult()
  $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if ($name -eq 'get_inventory_request_proposal' -and $response.IsSuccessStatusCode) {
    $script:proposalRaw = $body
  }
  if (-not $response.IsSuccessStatusCode) {
    $failure = try { $body | ConvertFrom-Json } catch { $null }
    $code = if ($failure) { $failure.code } else { 'unknown' }
    $message = if ($failure) { $failure.message } else { 'No JSON error message' }
    throw "$name returned HTTP $([int]$response.StatusCode), SQLSTATE ${code}: $message"
  }
  return ,($body | ConvertFrom-Json)
}

$itemId = [guid]::NewGuid()
$itemName = '__RECOVERY_AUTH_E2E__' + $itemId.ToString('N')
$requestId = [guid]::NewGuid()
$reportId = [guid]::NewGuid()
$lineId = [guid]::NewGuid()
$neededAt = [DateTimeOffset]::UtcNow.AddDays(2).ToString('o')
$insertItem = "insert into public.inventory_items " +
  "(id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required) " +
  "values ('$itemId','$itemName','pcs',0,5,true,0,'fifo',false)"
docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -Atqc $insertItem | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Local synthetic inventory setup failed.' }

$proposal = Invoke-LocalRpc 'get_inventory_request_proposal' @{ p_needed_at = $neededAt }
$issue = Invoke-LocalRpc 'issue_inventory_request' @{
  p_request_id = $requestId.ToString(); p_priority = 'scheduled';
  p_needed_at = $neededAt; p_reason = 'Isolated recovery QA';
  p_lines = @(@{ inventory_item_id = $itemId.ToString(); quantity = 10;
    override_reason = 'Isolated recovery QA' }); p_expected = $proposal
}
if (-not $issue.request_number) { throw 'Request number was not issued.' }
$before = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select quantity_on_hand::text||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId') from public.inventory_items where id='$itemId'"
if ($before -ne '0.000|0') { throw 'Request issue moved stock.' }

Invoke-LocalRpc 'start_inventory_request_receiving' @{
  p_request_id = $requestId.ToString(); p_revision = 1;
  p_report_id = $reportId.ToString(); p_inspected_by_name = 'Recovery QA';
  p_inspection_note = 'Local physical-count fixture'
} | Out-Null
Invoke-LocalRpc 'save_receiving_report_item' @{
  p_receiving_report_id = $reportId.ToString();
  p_receiving_report_item_id = $lineId.ToString();
  p_inventory_item_id = $itemId.ToString(); p_purchase_order_item_id = $null;
  p_quantity_delivered = 8; p_quantity_accepted = 6;
  p_secondary_quantity_delivered = $null; p_secondary_quantity_accepted = $null;
  p_rejection_reason = 'Two rejected'; p_source_lot_code = $null;
  p_manufactured_on = $null; p_use_by_date = $null; p_notes = $null
} | Out-Null
$draft = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select quantity_on_hand::text||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId') from public.inventory_items where id='$itemId'"
if ($draft -ne '0.000|0') { throw 'Receiving draft moved stock.' }
Invoke-LocalRpc 'post_receiving_report' @{
  p_receiving_report_id = $reportId.ToString()
} | Out-Null
$result = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select i.quantity_on_hand::text||'|'||r.status||'|'||d.status||'|'||(select count(*) from public.inventory_transactions t where t.inventory_item_id=i.id and t.transaction_type='receiving' and t.quantity_change=6)||'|'||(select count(*) from public.inventory_batches b where b.receiving_report_item_id='$lineId' and b.quantity_initial=6) from public.inventory_items i join public.receiving_reports r on r.id='$reportId' join public.inventory_request_documents d on d.id='$requestId' where i.id='$itemId'"
if ($result -ne '6.000|posted|partially_received|1|1') {
  throw 'Posted stock, movement, batch, or reconciliation did not match.'
}
$movements = Invoke-LocalRpc 'get_manager_inventory_movements' @{
  p_item_id = $itemId.ToString(); p_type = $null; p_from_date = $null;
  p_to_date = $null; p_cursor_created_at = $null; p_cursor_id = $null;
  p_limit = 20
}
if (@($movements).Count -lt 1) { throw 'Authenticated movement read was empty.' }

# The same formal request may have another physical delivery after the first
# report is posted. An over-limit post must roll back every stock side effect.
$secondReportId = [guid]::NewGuid()
$secondLineId = [guid]::NewGuid()
Invoke-LocalRpc 'start_inventory_request_receiving' @{
  p_request_id = $requestId.ToString(); p_revision = 1;
  p_report_id = $secondReportId.ToString(); p_inspected_by_name = 'Recovery QA B';
  p_inspection_note = 'Second local physical-count fixture'
} | Out-Null
Invoke-LocalRpc 'save_receiving_report_item' @{
  p_receiving_report_id = $secondReportId.ToString();
  p_receiving_report_item_id = $secondLineId.ToString();
  p_inventory_item_id = $itemId.ToString(); p_purchase_order_item_id = $null;
  p_quantity_delivered = 5; p_quantity_accepted = 5;
  p_secondary_quantity_delivered = $null; p_secondary_quantity_accepted = $null;
  p_rejection_reason = $null; p_source_lot_code = $null;
  p_manufactured_on = $null; p_use_by_date = $null; p_notes = $null
} | Out-Null
$overageRejected = $false
try {
  Invoke-LocalRpc 'post_receiving_report' @{
    p_receiving_report_id = $secondReportId.ToString()
  } | Out-Null
} catch {
  $overageRejected = $_.Exception.Message -match 'SQLSTATE 22023'
}
if (-not $overageRejected) { throw 'Cumulative accepted overage was not rejected.' }
$afterOverage = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select i.quantity_on_hand::text||'|'||r.status||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId' and transaction_type='receiving') from public.inventory_items i join public.receiving_reports r on r.id='$secondReportId' where i.id='$itemId'"
if ($afterOverage -ne '6.000|draft|1') {
  throw 'Rejected overage changed stock, report status, or movement count.'
}
Invoke-LocalRpc 'save_receiving_report_item' @{
  p_receiving_report_id = $secondReportId.ToString();
  p_receiving_report_item_id = $secondLineId.ToString();
  p_inventory_item_id = $itemId.ToString(); p_purchase_order_item_id = $null;
  p_quantity_delivered = 3; p_quantity_accepted = 2;
  p_secondary_quantity_delivered = $null; p_secondary_quantity_accepted = $null;
  p_rejection_reason = 'One rejected'; p_source_lot_code = $null;
  p_manufactured_on = $null; p_use_by_date = $null; p_notes = $null
} | Out-Null
Invoke-LocalRpc 'post_receiving_report' @{
  p_receiving_report_id = $secondReportId.ToString()
} | Out-Null
$split = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select i.quantity_on_hand::text||'|'||d.status||'|'||(select count(*) from public.receiving_reports where inventory_request_id='$requestId' and status='posted')||'|'||(select count(*) from public.inventory_batches b join public.receiving_report_items ri on ri.id=b.receiving_report_item_id where ri.receiving_report_id in ('$reportId','$secondReportId'))||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId' and transaction_type='receiving') from public.inventory_items i join public.inventory_request_documents d on d.id='$requestId' where i.id='$itemId'"
if ($split -ne '8.000|partially_received|2|2|2') {
  throw 'Two partial receipts did not reconcile with batches and movements.'
}
$register = Invoke-LocalRpc 'get_inventory_request_register' @{}
$requestRow = @($register | Where-Object { $_.id -eq $requestId.ToString() })
if ($requestRow.Count -ne 1 -or $requestRow[0].lines[0].accepted -ne 8 -or
    $requestRow[0].lines[0].rejected -ne 3 -or
    $requestRow[0].lines[0].remaining -ne 2 -or
    @($requestRow[0].receipts).Count -ne 2) {
  throw 'Authenticated request register did not reconcile two partial receipts.'
}
$duplicateRejected = $false
try {
  Invoke-LocalRpc 'post_receiving_report' @{
    p_receiving_report_id = $secondReportId.ToString()
  } | Out-Null
} catch {
  $duplicateRejected = $_.Exception.Message -match 'SQLSTATE 22023'
}
if (-not $duplicateRejected) { throw 'Duplicate post was not rejected.' }
Invoke-LocalRpc 'close_inventory_request_short' @{
  p_request_id = $requestId.ToString(); p_revision = 1;
  p_reason = 'Two requested pieces were not delivered in isolated QA'
} | Out-Null
$closed = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select d.status||'|'||i.quantity_on_hand::text||'|'||(select count(*) from public.inventory_request_events where request_id='$requestId' and event_type='closed_short')||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId' and transaction_type='receiving') from public.inventory_request_documents d join public.inventory_items i on i.id='$itemId' where d.id='$requestId'"
if ($closed -ne 'closed_short|8.000|1|2') {
  throw 'Audited shortfall closure changed stock or failed to record its event.'
}

# A separate request verifies the fulfilled state without reopening a closed
# shortfall or changing the historical receipt links.
$fullRequestId = [guid]::NewGuid()
$fullReportId = [guid]::NewGuid()
$fullLineId = [guid]::NewGuid()
$fullProposal = Invoke-LocalRpc 'get_inventory_request_proposal' @{ p_needed_at = $neededAt }
Invoke-LocalRpc 'issue_inventory_request' @{
  p_request_id = $fullRequestId.ToString(); p_priority = 'scheduled';
  p_needed_at = $neededAt; p_reason = 'Isolated full reconciliation QA';
  p_lines = @(@{ inventory_item_id = $itemId.ToString(); quantity = 2;
    override_reason = 'Isolated full reconciliation QA' });
  p_expected = $fullProposal
} | Out-Null
Invoke-LocalRpc 'start_inventory_request_receiving' @{
  p_request_id = $fullRequestId.ToString(); p_revision = 1;
  p_report_id = $fullReportId.ToString(); p_inspected_by_name = 'Recovery QA C';
  p_inspection_note = 'Full reconciliation fixture'
} | Out-Null
Invoke-LocalRpc 'save_receiving_report_item' @{
  p_receiving_report_id = $fullReportId.ToString();
  p_receiving_report_item_id = $fullLineId.ToString();
  p_inventory_item_id = $itemId.ToString(); p_purchase_order_item_id = $null;
  p_quantity_delivered = 2; p_quantity_accepted = 2;
  p_secondary_quantity_delivered = $null; p_secondary_quantity_accepted = $null;
  p_rejection_reason = $null; p_source_lot_code = $null;
  p_manufactured_on = $null; p_use_by_date = $null; p_notes = $null
} | Out-Null
Invoke-LocalRpc 'post_receiving_report' @{
  p_receiving_report_id = $fullReportId.ToString()
} | Out-Null
$full = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select d.status||'|'||i.quantity_on_hand::text||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='$itemId' and transaction_type='receiving') from public.inventory_request_documents d join public.inventory_items i on i.id='$itemId' where d.id='$fullRequestId'"
if ($full -ne 'fulfilled|10.000|3') {
  throw 'Full receipt did not reconcile with accepted-only stock and movements.'
}

# Two simultaneous submissions of the same draft must yield one successful
# post and one denial, with one batch and one movement for that receipt line.
$raceRequestId = [guid]::NewGuid()
$raceReportId = [guid]::NewGuid()
$raceLineId = [guid]::NewGuid()
$raceProposal = Invoke-LocalRpc 'get_inventory_request_proposal' @{ p_needed_at = $neededAt }
Invoke-LocalRpc 'issue_inventory_request' @{
  p_request_id = $raceRequestId.ToString(); p_priority = 'scheduled';
  p_needed_at = $neededAt; p_reason = 'Isolated concurrent post QA';
  p_lines = @(@{ inventory_item_id = $itemId.ToString(); quantity = 1;
    override_reason = 'Isolated concurrent post QA' });
  p_expected = $raceProposal
} | Out-Null
Invoke-LocalRpc 'start_inventory_request_receiving' @{
  p_request_id = $raceRequestId.ToString(); p_revision = 1;
  p_report_id = $raceReportId.ToString(); p_inspected_by_name = 'Recovery QA D';
  p_inspection_note = 'Concurrent post fixture'
} | Out-Null
Invoke-LocalRpc 'save_receiving_report_item' @{
  p_receiving_report_id = $raceReportId.ToString();
  p_receiving_report_item_id = $raceLineId.ToString();
  p_inventory_item_id = $itemId.ToString(); p_purchase_order_item_id = $null;
  p_quantity_delivered = 1; p_quantity_accepted = 1;
  p_secondary_quantity_delivered = $null; p_secondary_quantity_accepted = $null;
  p_rejection_reason = $null; p_source_lot_code = $null;
  p_manufactured_on = $null; p_use_by_date = $null; p_notes = $null
} | Out-Null
$raceBody = @{ p_receiving_report_id = $raceReportId.ToString() } |
  ConvertTo-Json -Compress
$raceUrl = $status.API_URL + '/rest/v1/rpc/post_receiving_report'
$postA = $client.PostAsync($raceUrl,
  [Net.Http.StringContent]::new($raceBody, [Text.Encoding]::UTF8, 'application/json'))
$postB = $client.PostAsync($raceUrl,
  [Net.Http.StringContent]::new($raceBody, [Text.Encoding]::UTF8, 'application/json'))
[Threading.Tasks.Task]::WaitAll(@($postA, $postB))
$raceCodes = @([int]$postA.Result.StatusCode, [int]$postB.Result.StatusCode) | Sort-Object
$postA.Result.Dispose()
$postB.Result.Dispose()
if ($raceCodes[0] -ne 200 -or $raceCodes[1] -ne 400) {
  throw 'Concurrent duplicate posts did not return exactly one success and one denial.'
}
$race = docker exec -u postgres $dbContainer psql -U supabase_admin -d postgres -Atqc `
  "select d.status||'|'||r.status||'|'||i.quantity_on_hand::text||'|'||(select count(*) from public.inventory_batches where receiving_report_item_id='$raceLineId')||'|'||(select count(*) from public.inventory_transactions where mutation_request_id='$raceLineId' and transaction_type='receiving') from public.inventory_request_documents d join public.receiving_reports r on r.inventory_request_id=d.id join public.inventory_items i on i.id='$itemId' where d.id='$raceRequestId'"
if ($race -ne 'fulfilled|posted|11.000|1|1') {
  throw 'Concurrent posting duplicated or lost stock, batch, ledger, or fulfillment.'
}
$client.Dispose()
'PASS: Auth issue, two partial receipts, overage rollback, serial/concurrent duplicate-post denial, shortfall closure, full reconciliation, and accepted-only stock/batch/movements.'
