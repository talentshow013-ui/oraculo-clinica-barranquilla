# Registra el reloj diario de ORÁCULO en el Programador de tareas de Windows (una sola vez).
# Corre todos los días a las 6:00 a. m. y también al encender el PC si a esa hora estaba apagado.
# Uso (desde la carpeta oraculo):  powershell -ExecutionPolicy Bypass -File deploy\instalar-reloj-windows.ps1
$carpeta = Split-Path -Parent $PSScriptRoot
$script = Join-Path $carpeta 'deploy\oraculo-diario.ps1'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $carpeta
$diario = New-ScheduledTaskTrigger -Daily -At 6:00am
$alEncender = New-ScheduledTaskTrigger -AtLogOn
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Oraculo reloj diario' -Action $accion -Trigger $diario, $alEncender -Settings $ajustes -Force | Out-Null
Write-Host 'Listo: «Oraculo reloj diario» corre a las 6:00 a. m. y al encender el PC. Para probarlo ya: Start-ScheduledTask -TaskName "Oraculo reloj diario"'
