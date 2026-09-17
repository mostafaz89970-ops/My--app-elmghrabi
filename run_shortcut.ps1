$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('run.lnk')
$s.TargetPath = 'cmd.exe'
$s.Arguments = '/k run.bat'
$s.WorkingDirectory = '.'
$s.Save()
